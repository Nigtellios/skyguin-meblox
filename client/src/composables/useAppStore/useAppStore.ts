import { defineStore } from "pinia";
import { computed, reactive, readonly } from "vue";
import {
  computeSnapPosition,
  getObjectSnapAnchors,
} from "../../lib/snapAnchors";
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
} from "../../types";
import { api } from "../useApi";

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
    historyCurrentIndex: -1 as number,

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

    // Snap-anchor state
    snapPhase: "none" as "none" | "select-source" | "select-target",
    snapSourceObjectId: null as string | null,
    snapSourceAnchorIndex: null as number | null,

    // Loading states
    loading: false,
    error: null as string | null,
  };
}

export const useAppStore = defineStore("app", () => {
  const state = reactive(createInitialState());

  // ---- Pending move history debounce ----
  const MOVE_DEBOUNCE_MS = 800;
  let _pendingMoveTimer: ReturnType<typeof setTimeout> | null = null;
  let _pendingMoveLabel = "";
  let _pendingMoveType = "";

  async function _flushPendingMoveHistory() {
    if (_pendingMoveTimer !== null) {
      clearTimeout(_pendingMoveTimer);
      _pendingMoveTimer = null;
      const type = _pendingMoveType;
      const label = _pendingMoveLabel;
      _pendingMoveType = "";
      _pendingMoveLabel = "";
      await recordHistory(type, label);
    }
  }

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
    // Cancel any pending debounced move history for the old project
    if (_pendingMoveTimer !== null) {
      clearTimeout(_pendingMoveTimer);
      _pendingMoveTimer = null;
      _pendingMoveLabel = "";
      _pendingMoveType = "";
    }
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

    // When we have navigated backwards (undo), trim all future entries before
    // recording the new state so that the history stays linear.
    let trim_after_id: string | undefined;
    if (
      state.historyCurrentIndex >= 0 &&
      state.historyCurrentIndex < state.historyEntries.length - 1
    ) {
      trim_after_id = state.historyEntries[state.historyCurrentIndex].id;
      // Trim locally to keep client in sync
      state.historyEntries = state.historyEntries.slice(
        0,
        state.historyCurrentIndex + 1,
      );
    }

    try {
      const entry = await api.history.add(state.currentProjectId, {
        action_type: actionType,
        action_label: label,
        snapshot,
        trim_after_id,
      });
      state.historyEntries.push(entry);
      state.historyCurrentIndex = state.historyEntries.length - 1;
    } catch {
      // History recording is best-effort.
    }
  }

  async function createObject(data: Partial<FurnitureObject>) {
    if (!state.currentProjectId) return;
    await _flushPendingMoveHistory();
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
    await _flushPendingMoveHistory();

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
    options?: { suppressHistory?: boolean },
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

    if (!options?.suppressHistory) {
      const obj = state.objects.find((o) => o.id === id);
      const label =
        pos.rotation_y !== undefined
          ? `Obrócono: ${obj?.name ?? id}`
          : `Przesunięto: ${obj?.name ?? id}`;
      const actionType = "move_object";

      // Debounce: group rapid consecutive moves into a single history entry
      if (_pendingMoveTimer !== null) {
        clearTimeout(_pendingMoveTimer);
      }
      _pendingMoveLabel = label;
      _pendingMoveType = actionType;
      const scheduledProjectId = state.currentProjectId;
      _pendingMoveTimer = setTimeout(() => {
        _pendingMoveTimer = null;
        // If the project has changed (or been cleared) since scheduling, skip recording.
        if (!state.currentProjectId || state.currentProjectId !== scheduledProjectId) {
          _pendingMoveLabel = "";
          _pendingMoveType = "";
          return;
        }
        const pendingLabel = _pendingMoveLabel;
        const pendingType = _pendingMoveType;
        _pendingMoveLabel = "";
        _pendingMoveType = "";
        recordHistory(pendingType, pendingLabel);
      }, MOVE_DEBOUNCE_MS);
    }
  }

  async function deleteObject(id: string) {
    if (!state.currentProjectId) return;
    await _flushPendingMoveHistory();
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
    await _flushPendingMoveHistory();
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
    await _flushPendingMoveHistory();
    const relation = await api.relations.create(state.currentProjectId, data);
    state.relations.push(relation);
    await loadObjects();
    await recordHistory("create_relation", "Dodano relację");
    return relation;
  }

  async function deleteRelation(id: string) {
    if (!state.currentProjectId) return;
    await _flushPendingMoveHistory();
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
      state.historyCurrentIndex = state.historyEntries.length - 1;
    } catch (error) {
      console.error("Failed to load history:", error);
      state.historyEntries = [];
      state.historyCurrentIndex = -1;
    }
  }

  async function revertToHistory(historyId: string) {
    if (!state.currentProjectId) return;
    await _flushPendingMoveHistory();
    const result = await api.history.revert(state.currentProjectId, historyId);
    state.objects = result.objects;
    state.selectedObjectIds = [];
    state.contextMode = "none";
    await loadHistory();
  }

  async function undoHistory() {
    if (!state.currentProjectId) return;
    await _flushPendingMoveHistory();
    const targetIndex = state.historyCurrentIndex - 1;
    if (targetIndex < 0 || state.historyEntries.length === 0) return;
    const targetEntry = state.historyEntries[targetIndex];
    if (!targetEntry) return;
    try {
      const result = await api.history.navigate(
        state.currentProjectId,
        targetEntry.id,
      );
      state.objects = result.objects;
      state.selectedObjectIds = [];
      state.contextMode = "none";
      state.historyCurrentIndex = targetIndex;
    } catch (error) {
      console.error("Failed to undo history:", error);
    }
  }

  async function redoHistory() {
    if (!state.currentProjectId) return;
    await _flushPendingMoveHistory();
    const targetIndex = state.historyCurrentIndex + 1;
    if (targetIndex >= state.historyEntries.length) return;
    const targetEntry = state.historyEntries[targetIndex];
    if (!targetEntry) return;
    try {
      const result = await api.history.navigate(
        state.currentProjectId,
        targetEntry.id,
      );
      state.objects = result.objects;
      state.selectedObjectIds = [];
      state.contextMode = "none";
      state.historyCurrentIndex = targetIndex;
    } catch (error) {
      console.error("Failed to redo history entry", error);
    }
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
    await _flushPendingMoveHistory();

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

  function snapObjectToEdge(movingId: string, targetId: string) {
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

  // ---- Snap-anchor workflow ----

  function startSnapAnchor(objectId: string) {
    state.snapSourceObjectId = objectId;
    state.snapPhase = "select-source";
    state.snapSourceAnchorIndex = null;
    state.sceneMode = "snap";
    state.contextMode = "snap-mode";
  }

  function selectSnapSourceAnchor(anchorIndex: number) {
    state.snapSourceAnchorIndex = anchorIndex;
    state.snapPhase = "select-target";
  }

  async function performSnap(
    targetObjectId: string,
    targetAnchorIndex: number,
  ) {
    const sourceId = state.snapSourceObjectId;
    const sourceAnchorIdx = state.snapSourceAnchorIndex;
    if (!sourceId || sourceAnchorIdx === null) return;

    const source = state.objects.find((o) => o.id === sourceId);
    const target = state.objects.find((o) => o.id === targetObjectId);
    if (!source || !target) return;

    const sourceAnchors = getObjectSnapAnchors(source);
    const targetAnchors = getObjectSnapAnchors(target);
    const sourceAnchor = sourceAnchors[sourceAnchorIdx];
    const targetAnchor = targetAnchors[targetAnchorIndex];
    if (!sourceAnchor || !targetAnchor) return;

    const newPos = computeSnapPosition(
      source,
      sourceAnchor,
      target,
      targetAnchor,
    );

    try {
      await updateObjectPosition(sourceId, newPos, { suppressHistory: true });
      await linkObjectsTogether(sourceId, targetObjectId);
      await recordHistory(
        "snap_attach",
        `Doczepiono: ${source.name} → ${target.name}`,
      );
      exitSnapAnchor();
    } catch (error) {
      console.error("performSnap failed", error);
    }
  }

  /**
   * Ensures objectA and objectB are in the same component so they move as a
   * rigid group.  Merges existing components when necessary.
   */
  async function linkObjectsTogether(idA: string, idB: string) {
    const objA = state.objects.find((o) => o.id === idA);
    const objB = state.objects.find((o) => o.id === idB);
    if (!objA || !objB) return;

    const compAId = objA.component_id;
    const compBId = objB.component_id;

    // Already in the same (non-null) component — nothing to do.
    if (compAId !== null && compAId === compBId) return;

    // Collect all members from both groups (or the objects themselves when
    // they are not part of a component yet), regardless of is_independent.
    const memberIds = new Set<string>();
    for (const o of state.objects) {
      if (compAId && o.component_id === compAId) memberIds.add(o.id);
      if (compBId && o.component_id === compBId) memberIds.add(o.id);
    }
    if (!compAId) memberIds.add(idA);
    if (!compBId) memberIds.add(idB);

    await createComponent(`${objA.name}+${objB.name}`, Array.from(memberIds));

    // After merging, delete the now-empty original component groups (if any)
    // to avoid leaving orphan/empty components in state and the DB.
    if (compAId && compAId !== compBId) {
      await deleteComponent(compAId);
    }
    if (compBId && compBId !== compAId) {
      await deleteComponent(compBId);
    }
  }

  function exitSnapAnchor() {
    state.snapSourceObjectId = null;
    state.snapPhase = "none";
    state.snapSourceAnchorIndex = null;
    state.sceneMode = "select";
    state.contextMode =
      state.selectedObjectIds.length > 0 ? "object-actions" : "none";
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
    undoHistory,
    redoHistory,
    recordHistory,
    copySelected,
    pasteClipboard,
    snapObjectToEdge,
    startSnapAnchor,
    selectSnapSourceAnchor,
    performSnap,
    exitSnapAnchor,
  };
});
