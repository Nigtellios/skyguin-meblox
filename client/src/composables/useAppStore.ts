import { defineStore } from "pinia";
import { computed, reactive, readonly } from "vue";
import type {
  AppPanel,
  ComponentGroup,
  ContextMode,
  FurnitureObject,
  GridConfig,
  HistoryEntry,
  MaterialTemplate,
  ObjectRelation,
  Project,
  RelationEditorMode,
  SceneMode,
} from "../types";
import { api } from "./useApi";

function createInitialState() {
  return {
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
    relations: [] as ObjectRelation[],

    // History
    historyEntries: [] as HistoryEntry[],

    // UI
    activePanel: "none" as AppPanel,
    sceneMode: "select" as SceneMode,
    contextMode: "none" as ContextMode,
    showProjectsModal: false,
    relationEditorMode: "visual" as RelationEditorMode,
    relationAttachSourceId: null as string | null,
    relationAttachField: "position_x" as ObjectRelation["source_field"],
    relationAttachSourceAnchor: "end" as NonNullable<
      ObjectRelation["source_anchor"]
    >,
    relationAttachTargetAnchor: "start" as NonNullable<
      ObjectRelation["target_anchor"]
    >,
    relationBuilderMode: "direct" as Extract<
      ObjectRelation["mode"],
      "direct" | "relative"
    >,

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
  };
}

export const useAppStore = defineStore("app", () => {
  const state = reactive(createInitialState());

  const currentProject = computed(
    () => state.projects.find((p) => p.id === state.currentProjectId) ?? null,
  );

  const selectedObjects = computed(() =>
    state.objects.filter((o) => state.selectedObjectIds.includes(o.id)),
  );

  const firstSelectedObject = computed(() =>
    selectedObjects.value.length === 1 ? selectedObjects.value[0] : null,
  );

  function objectHasRelations(id: string) {
    return state.relations.some(
      (relation) =>
        relation.source_object_id === id || relation.target_object_id === id,
    );
  }

  // Returns true only when the object is the SOURCE of at least one relation.
  // Objects that only appear as targets in relations do not trigger downstream
  // updates via syncRelations when their own position changes.
  function objectHasOutgoingRelations(id: string) {
    return state.relations.some((relation) => relation.source_object_id === id);
  }

  // Returns true when the object belongs to a component and is not marked
  // independent (so moving it should move all other members too).
  function objectIsNonIndependentComponentMember(id: string) {
    const obj = state.objects.find((o) => o.id === id);
    return !!(obj?.component_id && !obj?.is_independent);
  }

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
    await loadRelations();
    await loadHistory();

    const proj = state.projects.find((project) => project.id === id);
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
    const idx = state.projects.findIndex(
      (p) => p.id === state.currentProjectId,
    );
    if (idx >= 0) state.projects[idx] = updated;
  }

  async function deleteProject(id: string) {
    await api.projects.delete(id);
    state.projects = state.projects.filter((p) => p.id !== id);
    if (state.currentProjectId === id) {
      state.currentProjectId = null;
      state.objects = [];
      state.componentGroups = [];
      state.relations = [];
      if (state.projects.length > 0) {
        await selectProject(state.projects[0].id);
      }
    }
  }

  async function loadObjects() {
    if (!state.currentProjectId) return;
    state.objects = await api.objects.list(state.currentProjectId);
  }

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
      // History recording is best-effort.
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

    if (updated.component_id && !updated.is_independent) {
      const syncData: Partial<FurnitureObject> = {};
      if (data.width !== undefined) syncData.width = data.width;
      if (data.height !== undefined) syncData.height = data.height;
      if (data.depth !== undefined) syncData.depth = data.depth;
      if (data.color !== undefined) syncData.color = data.color;
      if (data.material_template_id !== undefined) {
        syncData.material_template_id = data.material_template_id;
      }

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

    if (objectHasRelations(id)) {
      await loadObjects();
    }

    const label = (() => {
      if (data.color !== undefined) return `Zmieniono kolor: ${updated.name}`;
      if (
        data.width !== undefined ||
        data.height !== undefined ||
        data.depth !== undefined
      ) {
        return `Zmieniono wymiary: ${updated.name}`;
      }
      if (data.name !== undefined) return `Zmieniono nazwę: ${updated.name}`;
      if (data.material_template_id !== undefined) {
        return `Zmieniono materiał: ${updated.name}`;
      }
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

    // Reload all objects when:
    // 1. The moved object is the SOURCE of outgoing relations (syncRelations ran
    //    on the server and may have moved other objects).
    // 2. The object is a non-independent component member (the server propagated
    //    the position delta to all other members).
    const needsReload =
      objectHasOutgoingRelations(id) ||
      objectIsNonIndependentComponentMember(id);

    if (needsReload) {
      await loadObjects();
    }

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
    state.selectedObjectIds = state.selectedObjectIds.filter(
      (sid) => sid !== id,
    );
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
      // When the user is in the components panel they are likely selecting
      // objects to form a component – keep the panel visible so the create
      // button stays accessible.
      if (!multiSelect && state.activePanel !== "components") {
        state.activePanel = "object-props";
      }
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

  async function loadComponents() {
    if (!state.currentProjectId) return;
    state.componentGroups = await api.components.list(state.currentProjectId);
  }

  async function loadRelations() {
    if (!state.currentProjectId) return;
    state.relations = await api.relations.list(state.currentProjectId);
  }

  async function createComponent(name: string, objectIds: string[]) {
    if (!state.currentProjectId) return;
    const group = await api.components.create(state.currentProjectId, {
      name,
      object_ids: objectIds,
    });
    state.componentGroups.push(group);
    await loadObjects();
    return group;
  }

  async function deleteComponent(id: string) {
    if (!state.currentProjectId) return;
    await api.components.delete(state.currentProjectId, id);
    state.componentGroups = state.componentGroups.filter((g) => g.id !== id);
    await loadObjects();
  }

  async function createRelation(data: Partial<ObjectRelation>) {
    if (!state.currentProjectId) return;
    const relation = await api.relations.create(state.currentProjectId, data);
    state.relations.push(relation);
    await loadObjects();
    await recordHistory("create_relation", "Dodano relację");
    return relation;
  }

  async function deleteRelation(id: string) {
    if (!state.currentProjectId) return;
    await api.relations.delete(state.currentProjectId, id);
    state.relations = state.relations.filter((relation) => relation.id !== id);
    await recordHistory("delete_relation", "Usunięto relację");
  }

  function setRelationEditorMode(mode: RelationEditorMode) {
    state.relationEditorMode = mode;
    state.relationAttachSourceId = null;
  }

  function setRelationAttachSource(id: string | null) {
    state.relationAttachSourceId = id;
  }

  function setRelationAttachField(
    field: Extract<
      ObjectRelation["source_field"],
      "position_x" | "position_y" | "position_z"
    >,
  ) {
    state.relationAttachField = field;
  }

  function setRelationAttachAnchors(
    source: NonNullable<ObjectRelation["source_anchor"]>,
    target: NonNullable<ObjectRelation["target_anchor"]>,
  ) {
    state.relationAttachSourceAnchor = source;
    state.relationAttachTargetAnchor = target;
  }

  function setRelationBuilderMode(
    mode: Extract<ObjectRelation["mode"], "direct" | "relative">,
  ) {
    state.relationBuilderMode = mode;
  }

  async function createAttachRelationFromSelection(targetId: string) {
    if (
      !state.relationAttachSourceId ||
      state.relationAttachSourceId === targetId
    ) {
      return;
    }

    await createRelation({
      source_object_id: state.relationAttachSourceId,
      target_object_id: targetId,
      relation_type: "attachment",
      source_field: state.relationAttachField,
      target_field: state.relationAttachField,
      mode: "anchor",
      source_anchor: state.relationAttachSourceAnchor,
      target_anchor: state.relationAttachTargetAnchor,
    });

    state.relationAttachSourceId = null;
  }

  function resetRelationEditor() {
    state.relationEditorMode = "visual";
    state.relationAttachSourceId = null;
  }

  async function toggleObjectIndependent(objectId: string) {
    const obj = state.objects.find((o) => o.id === objectId);
    if (!obj) return;
    await updateObject(objectId, {
      is_independent: obj.is_independent ? 0 : 1,
    });
  }

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
    state.materialTemplates = state.materialTemplates.filter(
      (m) => m.id !== id,
    );
  }

  function setGridConfig(config: Partial<GridConfig>) {
    Object.assign(state.grid, config);
    if (state.currentProjectId) {
      updateProject({
        grid_size_mm: state.grid.sizeX,
        grid_visible: state.grid.visible ? 1 : 0,
      });
    }
  }

  function setActivePanel(panel: AppPanel) {
    state.activePanel = panel;
    if (panel !== "relations") {
      resetRelationEditor();
    }
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
    await loadHistory();
  }

  function copySelected() {
    if (state.selectedObjectIds.length === 0) return;
    state.clipboard = state.objects.filter((o) =>
      state.selectedObjectIds.includes(o.id),
    );
  }

  async function pasteClipboard() {
    if (!state.clipboard || state.clipboard.length === 0) return;
    if (!state.currentProjectId) return;

    const PASTE_OFFSET = 50;
    const pasted: FurnitureObject[] = [];

    for (const src of state.clipboard) {
      const obj = await api.objects.create(state.currentProjectId, {
        ...src,
        id: undefined,
        name: `${src.name} (kopia)`,
        position_x: src.position_x + PASTE_OFFSET,
        position_z: src.position_z + PASTE_OFFSET,
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

  function snapObjectToEdge(
    movingId: string,
    targetId: string,
    faceNormal?: { x: number; y: number; z: number } | null,
  ) {
    const moving = state.objects.find((o) => o.id === movingId);
    const target = state.objects.find((o) => o.id === targetId);
    if (!moving || !target) return null;

    const movingRight = moving.position_x + moving.width / 2;
    const movingLeft = moving.position_x - moving.width / 2;
    const targetRight = target.position_x + target.width / 2;
    const targetLeft = target.position_x - target.width / 2;
    const movingFront = moving.position_z + moving.depth / 2;
    const movingBack = moving.position_z - moving.depth / 2;
    const targetFront = target.position_z + target.depth / 2;
    const targetBack = target.position_z - target.depth / 2;

    // When a specific face normal is provided, snap to that exact face.
    // The face normal is in the target's LOCAL mesh space; transform it to
    // world space using the target's rotation_y so the snap direction is correct
    // even for rotated objects.
    if (faceNormal) {
      const ry = target.rotation_y;
      const lx = faceNormal.x;
      const lz = faceNormal.z;
      // Rotate local normal by rotation_y to get world-space direction.
      // Do NOT round yet — keep full precision to find the dominant axis.
      const wx = lx * Math.cos(ry) + lz * Math.sin(ry);
      const wz = -lx * Math.sin(ry) + lz * Math.cos(ry);
      const wy = faceNormal.y;

      // Determine dominant world-space axis by magnitude comparison.
      const absX = Math.abs(wx);
      const absY = Math.abs(wy);
      const absZ = Math.abs(wz);

      if (absX >= absY && absX >= absZ && absX > 0.5) {
        if (wx > 0) {
          // Target's +X (right) face → moving's left edge touches target's right edge
          return {
            position_x: targetRight + moving.width / 2,
            position_z: moving.position_z,
          };
        }
        // Target's -X (left) face → moving's right edge touches target's left edge
        return {
          position_x: targetLeft - moving.width / 2,
          position_z: moving.position_z,
        };
      }
      if (absZ >= absX && absZ >= absY && absZ > 0.5) {
        if (wz > 0) {
          // Target's +Z (front) face → moving's back edge touches target's front edge
          return {
            position_x: moving.position_x,
            position_z: targetFront + moving.depth / 2,
          };
        }
        // Target's -Z (back) face → moving's front edge touches target's back edge
        return {
          position_x: moving.position_x,
          position_z: targetBack - moving.depth / 2,
        };
      }
      if (absY >= absX && absY >= absZ && absY > 0.5) {
        if (wy > 0) {
          // Target's +Y (top) face → moving sits on top of target
          return {
            position_x: moving.position_x,
            position_z: moving.position_z,
            position_y: target.position_y + target.height,
          };
        }
        // Target's -Y (bottom) face → moving is placed below target
        return {
          position_x: moving.position_x,
          position_z: moving.position_z,
          position_y: target.position_y - moving.height,
        };
      }
      // Face normal didn't resolve to a dominant axis — fall through to auto-snap
    }

    // Auto-snap: pick the edge pair with the smallest displacement
    const snapOptions = [
      { delta_x: targetRight - movingLeft, delta_z: 0 },
      { delta_x: targetLeft - movingRight, delta_z: 0 },
      { delta_x: 0, delta_z: targetFront - movingBack },
      { delta_x: 0, delta_z: targetBack - movingFront },
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
    loadRelations,
    createComponent,
    deleteComponent,
    createRelation,
    deleteRelation,
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
    setRelationEditorMode,
    setRelationAttachSource,
    setRelationAttachField,
    setRelationAttachAnchors,
    setRelationBuilderMode,
    createAttachRelationFromSelection,
    resetRelationEditor,
    loadHistory,
    revertToHistory,
    recordHistory,
    copySelected,
    pasteClipboard,
    snapObjectToEdge,
  };
});
