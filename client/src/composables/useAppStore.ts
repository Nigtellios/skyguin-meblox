import { computed, reactive, readonly } from "vue";
import type {
  AppPanel,
  ComponentGroup,
  ContextMode,
  FurnitureObject,
  GridConfig,
  HistoryEntry,
  MaterialTemplate,
  Project,
  SceneMode,
} from "../types";
import { api } from "./useApi";

// ---- Global App State ----
const state = reactive({
  // Projects
  projects: [] as Project[],
  currentProjectId: null as string | null,

  // Objects
  objects: [] as FurnitureObject[],
  selectedObjectIds: [] as string[],

  // Clipboard
  clipboard: null as FurnitureObject[] | null,

  // Materials
  materialTemplates: [] as MaterialTemplate[],

  // Components
  componentGroups: [] as ComponentGroup[],

  // History
  historyEntries: [] as HistoryEntry[],

  // UI
  activePanel: "none" as AppPanel,
  sceneMode: "select" as SceneMode,
  contextMode: "none" as ContextMode,
  showProjectsModal: false,

  // Grid
  grid: {
    visible: true,
    sizeX: 100,
    sizeY: 100,
    sizeZ: 100,
    unit: "mm",
  } as GridConfig,

  // Loading states
  loading: false,
  error: null as string | null,
});

const currentProject = computed(
  () => state.projects.find((p) => p.id === state.currentProjectId) ?? null,
);

const selectedObjects = computed(() =>
  state.objects.filter((o) => state.selectedObjectIds.includes(o.id)),
);

const firstSelectedObject = computed(() =>
  selectedObjects.value.length === 1 ? selectedObjects.value[0] : null,
);

// ---- Actions ----
async function loadProjects() {
  try {
    state.loading = true;
    state.projects = await api.projects.list();
    if (state.projects.length > 0 && !state.currentProjectId) {
      await selectProject(state.projects[0].id);
    }
  } catch (error: unknown) {
    state.error =
      error instanceof Error
        ? error.message
        : "Nie udało się wczytać projektów.";
  } finally {
    state.loading = false;
  }
}

async function selectProject(id: string) {
  state.currentProjectId = id;
  state.selectedObjectIds = [];
  state.contextMode = "none";
  state.historyEntries = [];
  await loadObjects();
  await loadComponents();
  await loadHistory();
  // Sync grid from project
  const proj = state.projects.find((p) => p.id === id);
  if (proj) {
    state.grid.visible = proj.grid_visible === 1;
    state.grid.sizeX = proj.grid_size_mm;
    state.grid.sizeY = proj.grid_size_mm;
    state.grid.sizeZ = proj.grid_size_mm;
  }
}

async function createProject(name: string) {
  const proj = await api.projects.create({ name });
  state.projects.unshift(proj);
  await selectProject(proj.id);
}

async function updateProject(data: Partial<Project>) {
  if (!state.currentProjectId) return;
  const updated = await api.projects.update(state.currentProjectId, data);
  const idx = state.projects.findIndex((p) => p.id === state.currentProjectId);
  if (idx >= 0) state.projects[idx] = updated;
}

async function deleteProject(id: string) {
  await api.projects.delete(id);
  state.projects = state.projects.filter((p) => p.id !== id);
  if (state.currentProjectId === id) {
    state.currentProjectId = null;
    state.objects = [];
    if (state.projects.length > 0) await selectProject(state.projects[0].id);
  }
}

// ---- Objects ----
async function loadObjects() {
  if (!state.currentProjectId) return;
  state.objects = await api.objects.list(state.currentProjectId);
}

// ---- History helpers ----
async function recordHistory(actionType: string, label: string) {
  if (!state.currentProjectId) return;
  const snapshot = JSON.stringify(state.objects);
  try {
    const entry = await api.history.add(state.currentProjectId, {
      action_type: actionType,
      action_label: label,
      snapshot,
    });
    state.historyEntries.push(entry);
  } catch {
    // History recording is best-effort
  }
}

async function createObject(data: Partial<FurnitureObject>) {
  if (!state.currentProjectId) return;
  const obj = await api.objects.create(state.currentProjectId, data);
  state.objects.push(obj);
  selectObject(obj.id, false);
  await recordHistory("create_object", `Dodano: ${obj.name}`);
  return obj;
}

async function updateObject(id: string, data: Partial<FurnitureObject>) {
  if (!state.currentProjectId) return;
  const obj = state.objects.find((o) => o.id === id);
  if (!obj) return;

  const updated = await api.objects.update(state.currentProjectId, id, data);
  const idx = state.objects.findIndex((o) => o.id === id);
  if (idx >= 0) state.objects[idx] = updated;

  // If object is part of a component and not independent, sync the component
  if (updated.component_id && !updated.is_independent) {
    const syncData: Partial<FurnitureObject> = {};
    if (data.width !== undefined) syncData.width = data.width;
    if (data.height !== undefined) syncData.height = data.height;
    if (data.depth !== undefined) syncData.depth = data.depth;
    if (data.color !== undefined) syncData.color = data.color;
    if (data.material_template_id !== undefined)
      syncData.material_template_id = data.material_template_id;

    if (Object.keys(syncData).length > 0) {
      const synced = await api.components.sync(
        state.currentProjectId,
        updated.component_id,
        syncData,
      );
      for (const syncedObj of synced) {
        if (syncedObj.id === id) continue;
        const i = state.objects.findIndex((o) => o.id === syncedObj.id);
        if (i >= 0) state.objects[i] = syncedObj;
      }
    }
  }

  // Record history for significant changes
  const label = (() => {
    if (data.color !== undefined) return `Zmieniono kolor: ${updated.name}`;
    if (
      data.width !== undefined ||
      data.height !== undefined ||
      data.depth !== undefined
    )
      return `Zmieniono wymiary: ${updated.name}`;
    if (data.name !== undefined) return `Zmieniono nazwę: ${updated.name}`;
    if (data.material_template_id !== undefined)
      return `Zmieniono materiał: ${updated.name}`;
    return `Edytowano: ${updated.name}`;
  })();
  await recordHistory("update_object", label);
}

async function updateObjectPosition(
  id: string,
  pos: {
    position_x?: number;
    position_y?: number;
    position_z?: number;
    rotation_y?: number;
  },
) {
  if (!state.currentProjectId) return;
  const updated = await api.objects.update(state.currentProjectId, id, pos);
  const idx = state.objects.findIndex((o) => o.id === id);
  if (idx >= 0) state.objects[idx] = updated;
  const obj = state.objects.find((o) => o.id === id);
  const label =
    pos.rotation_y !== undefined
      ? `Obrócono: ${obj?.name ?? id}`
      : `Przesunięto: ${obj?.name ?? id}`;
  await recordHistory("move_object", label);
}

async function deleteObject(id: string) {
  if (!state.currentProjectId) return;
  const obj = state.objects.find((o) => o.id === id);
  await api.objects.delete(state.currentProjectId, id);
  state.objects = state.objects.filter((o) => o.id !== id);
  state.selectedObjectIds = state.selectedObjectIds.filter((sid) => sid !== id);
  await recordHistory("delete_object", `Usunięto: ${obj?.name ?? id}`);
}

async function duplicateObject(id: string) {
  if (!state.currentProjectId) return;
  const obj = await api.objects.duplicate(state.currentProjectId, id);
  state.objects.push(obj);
  selectObject(obj.id, false);
  await recordHistory("duplicate_object", `Zduplikowano: ${obj.name}`);
  return obj;
}

// ---- Selection ----
function selectObject(id: string, multiSelect = false) {
  if (multiSelect) {
    if (state.selectedObjectIds.includes(id)) {
      state.selectedObjectIds = state.selectedObjectIds.filter(
        (sid) => sid !== id,
      );
    } else {
      state.selectedObjectIds.push(id);
    }
  } else {
    state.selectedObjectIds = [id];
  }
  if (state.selectedObjectIds.length > 0) {
    state.activePanel = "object-props";
    if (state.contextMode === "none") {
      state.contextMode = "object-actions";
    }
  }
}

function deselectAll() {
  state.selectedObjectIds = [];
  if (
    state.contextMode === "object-actions" ||
    state.contextMode === "move-controls"
  ) {
    state.contextMode = "none";
  }
}

// ---- Components ----
async function loadComponents() {
  if (!state.currentProjectId) return;
  state.componentGroups = await api.components.list(state.currentProjectId);
}

async function createComponent(name: string, objectIds: string[]) {
  if (!state.currentProjectId) return;
  const group = await api.components.create(state.currentProjectId, {
    name,
    object_ids: objectIds,
  });
  state.componentGroups.push(group);
  await loadObjects(); // Reload to get updated component_ids
  return group;
}

async function deleteComponent(id: string) {
  if (!state.currentProjectId) return;
  await api.components.delete(state.currentProjectId, id);
  state.componentGroups = state.componentGroups.filter((g) => g.id !== id);
  await loadObjects();
}

async function toggleObjectIndependent(objectId: string) {
  const obj = state.objects.find((o) => o.id === objectId);
  if (!obj) return;
  await updateObject(objectId, { is_independent: obj.is_independent ? 0 : 1 });
}

// ---- Materials ----
async function loadMaterials() {
  state.materialTemplates = await api.materials.list();
}

async function createMaterial(data: Partial<MaterialTemplate>) {
  const mat = await api.materials.create(data);
  state.materialTemplates.unshift(mat);
  return mat;
}

async function updateMaterial(id: string, data: Partial<MaterialTemplate>) {
  const mat = await api.materials.update(id, data);
  const idx = state.materialTemplates.findIndex((m) => m.id === id);
  if (idx >= 0) state.materialTemplates[idx] = mat;
}

async function deleteMaterial(id: string) {
  await api.materials.delete(id);
  state.materialTemplates = state.materialTemplates.filter((m) => m.id !== id);
}

// ---- Grid ----
function setGridConfig(config: Partial<GridConfig>) {
  Object.assign(state.grid, config);
  // Persist to project
  if (state.currentProjectId) {
    updateProject({
      grid_size_mm: state.grid.sizeX,
      grid_visible: state.grid.visible ? 1 : 0,
    });
  }
}

// ---- Panel / Mode ----
function setActivePanel(panel: AppPanel) {
  state.activePanel = panel;
}

function setSceneMode(mode: SceneMode) {
  state.sceneMode = mode;
}

function setContextMode(mode: ContextMode) {
  state.contextMode = mode;
}

function setShowProjectsModal(show: boolean) {
  state.showProjectsModal = show;
}

// ---- History ----
async function loadHistory() {
  if (!state.currentProjectId) return;
  try {
    state.historyEntries = await api.history.list(state.currentProjectId);
  } catch (error) {
    console.error("Failed to load history:", error);
    state.historyEntries = [];
  }
}

async function revertToHistory(historyId: string) {
  if (!state.currentProjectId) return;
  const result = await api.history.revert(state.currentProjectId, historyId);
  state.objects = result.objects;
  state.selectedObjectIds = [];
  state.contextMode = "none";
  // Reload history after revert
  await loadHistory();
}

// ---- Clipboard ----
function copySelected() {
  if (state.selectedObjectIds.length === 0) return;
  state.clipboard = state.objects.filter((o) =>
    state.selectedObjectIds.includes(o.id),
  );
}

async function pasteClipboard() {
  if (!state.clipboard || state.clipboard.length === 0) return;
  if (!state.currentProjectId) return;
  const OFFSET = 50;
  const pasted: FurnitureObject[] = [];
  for (const src of state.clipboard) {
    const obj = await api.objects.create(state.currentProjectId, {
      ...src,
      id: undefined,
      name: `${src.name} (kopia)`,
      position_x: src.position_x + OFFSET,
      position_z: src.position_z + OFFSET,
      component_id: null,
      is_independent: 0,
    });
    state.objects.push(obj);
    pasted.push(obj);
  }
  if (pasted.length > 0) {
    state.selectedObjectIds = pasted.map((o) => o.id);
    const label =
      pasted.length === 1
        ? `Wklejono: ${pasted[0].name}`
        : `Wklejono ${pasted.length} elementów`;
    await recordHistory("paste_objects", label);
  }
}

// ---- Snap to edge ----
function snapObjectToEdge(movingId: string, targetId: string) {
  const moving = state.objects.find((o) => o.id === movingId);
  const target = state.objects.find((o) => o.id === targetId);
  if (!moving || !target) return null;

  // Find nearest edge alignment
  const movingRight = moving.position_x + moving.width / 2;
  const movingLeft = moving.position_x - moving.width / 2;
  const targetRight = target.position_x + target.width / 2;
  const targetLeft = target.position_x - target.width / 2;
  const movingFront = moving.position_z + moving.depth / 2;
  const movingBack = moving.position_z - moving.depth / 2;
  const targetFront = target.position_z + target.depth / 2;
  const targetBack = target.position_z - target.depth / 2;

  const snapOptions = [
    { delta_x: targetRight - movingLeft, delta_z: 0, label: "prawa→lewa" },
    { delta_x: targetLeft - movingRight, delta_z: 0, label: "lewa→prawa" },
    { delta_x: 0, delta_z: targetFront - movingBack, label: "przód→tył" },
    { delta_x: 0, delta_z: targetBack - movingFront, label: "tył→przód" },
  ];
  const best = snapOptions.reduce((a, b) =>
    Math.abs(a.delta_x) + Math.abs(a.delta_z) <
    Math.abs(b.delta_x) + Math.abs(b.delta_z)
      ? a
      : b,
  );
  return {
    position_x: moving.position_x + best.delta_x,
    position_z: moving.position_z + best.delta_z,
  };
}

// ---- Export ----
export function useAppStore() {
  return {
    state: readonly(state),
    currentProject,
    selectedObjects,
    firstSelectedObject,

    loadProjects,
    selectProject,
    createProject,
    updateProject,
    deleteProject,

    loadObjects,
    createObject,
    updateObject,
    updateObjectPosition,
    deleteObject,
    duplicateObject,

    selectObject,
    deselectAll,

    loadComponents,
    createComponent,
    deleteComponent,
    toggleObjectIndependent,

    loadMaterials,
    createMaterial,
    updateMaterial,
    deleteMaterial,

    setGridConfig,
    setActivePanel,
    setSceneMode,
    setContextMode,
    setShowProjectsModal,

    loadHistory,
    revertToHistory,
    recordHistory,

    copySelected,
    pasteClipboard,
    snapObjectToEdge,
  };
}
