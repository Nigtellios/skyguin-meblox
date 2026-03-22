<template>
  <div ref="viewportRef" class="relative h-full w-full overflow-hidden">
    <canvas
      ref="canvasRef"
      class="block h-full w-full"
      :class="shouldShowHoverPreview ? 'cursor-crosshair' : ''"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
      @click="onClick"
      @contextmenu.prevent="onContextMenu"
    />

    <svg
      v-if="showRelationOverlay && relationOverlay.length > 0"
      class="pointer-events-none absolute inset-0 z-20"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="scene-relation-arrow"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa" />
        </marker>
      </defs>

      <g v-for="item in relationOverlay" :key="item.id">
        <polyline
          :points="`${item.start.x},${item.start.y} ${item.mid.x},${item.mid.y} ${item.end.x},${item.end.y}`"
          fill="none"
          stroke="#60a5fa"
          stroke-width="2.5"
          stroke-dasharray="6 4"
          marker-mid="url(#scene-relation-arrow)"
        />
        <g>
          <rect
            :x="item.label.x - item.label.width / 2"
            :y="item.label.y - 12"
            :width="item.label.width"
            height="24"
            rx="12"
            fill="rgba(15, 23, 42, 0.85)"
            stroke="rgba(96, 165, 250, 0.65)"
          />
          <text
            :x="item.label.x"
            :y="item.label.y + 4"
            fill="#dbeafe"
            font-size="11"
            font-weight="600"
            text-anchor="middle"
          >
            {{ item.label.text }}
          </text>
        </g>
      </g>
    </svg>

    <div
      v-if="showRelationOverlay && attachSourceOverlay"
      class="pointer-events-none absolute z-20 rounded-full border border-amber-400 bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-200 shadow-lg"
      :style="{
        left: `${attachSourceOverlay.x}px`,
        top: `${attachSourceOverlay.y}px`,
        transform: `translate(-50%, ${ATTACH_SOURCE_BADGE_Y_OFFSET})`,
      }"
    >
      Źródło attach: {{ attachSourceOverlay.name }}
    </div>

    <!-- Context menu -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="fixed z-50 min-w-40 rounded-lg border border-slate-700 py-1 shadow-xl panel-glass"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        @click.stop
      >
        <button
          v-if="contextMenu.objectId"
          class="w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-700"
          @click="onCtxDuplicate"
        >
          Duplikuj
        </button>
        <button
          v-if="contextMenu.objectId"
          class="w-full px-3 py-1.5 text-left text-sm text-blue-300 hover:bg-slate-700 flex items-center gap-2"
          @click="onCtxMagnet"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 5h3v5.5c0 2.49 2.01 4.5 4.5 4.5S17 12.99 17 10.5V5h3v5.5C20 14.64 16.64 18 12.5 18S5 14.64 5 10.5V5z"/>
          </svg>
          Magnes
        </button>
        <button
          v-if="contextMenu.objectId"
          class="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-slate-700"
          @click="onCtxDelete"
        >
          Usuń
        </button>
        <button
          v-if="!contextMenu.objectId"
          class="w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-700"
          @click="openAddObject"
        >
          Dodaj element tutaj
        </button>
        <button
          class="w-full px-3 py-1.5 text-left text-sm text-slate-400 hover:bg-slate-700"
          @click="closeContextMenu"
        >
          Zamknij
        </button>
      </div>
    </Teleport>

    <!-- Add Object Dialog -->
    <AddObjectDialog
      v-if="showAddDialog"
      :initial-position="addPosition"
      @close="showAddDialog = false"
      @created="showAddDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useAppStore } from "../../composables/useAppStore";
import { useScene } from "../../composables/useScene";
import { estimateRelationLabelWidth } from "../../lib/relationsBuilder";
import {
  anchorMarkerWorldPos,
  getObjectSnapAnchors,
} from "../../lib/snapAnchors";
import {
  RELATION_FIELD_LABELS,
  RELATION_MODE_LABELS,
  RELATION_TYPE_LABELS,
} from "../../types";
import AddObjectDialog from "../AddObjectDialog/AddObjectDialog.vue";

const ATTACH_SOURCE_BADGE_Y_OFFSET = "-150%";

const emit = defineEmits<{
  "snap-target-selected": [targetId: string];
}>();

const viewportRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const store = useAppStore();
let scene: ReturnType<typeof useScene> | null = null;
let overlayFrame = 0;

const showAddDialog = ref(false);
const addPosition = ref({ x: 0, z: 0 });
const relationOverlay = ref<
  Array<{
    id: string;
    start: { x: number; y: number };
    mid: { x: number; y: number };
    end: { x: number; y: number };
    label: { x: number; y: number; text: string; width: number };
  }>
>([]);
const attachSourceOverlay = ref<{
  x: number;
  y: number;
  name: string;
} | null>(null);

const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  objectId: null as string | null,
});

const isAttachMode = computed(
  () =>
    store.state.activePanel === "relations" &&
    store.state.relationEditorMode === "attach",
);
const isSnapAnchorMode = computed(() => store.state.snapPhase !== "none");
const shouldShowHoverPreview = computed(
  () =>
    (store.state.sceneMode === "snap" && !isSnapAnchorMode.value) ||
    isAttachMode.value,
);
const showRelationOverlay = computed(
  () => store.state.activePanel === "relations",
);

onMounted(() => {
  if (!canvasRef.value) return;
  scene = useScene(canvasRef.value);

  syncScene();
  updateRelationOverlay();
  updateSnapAnchorMarkers();

  document.addEventListener("click", closeContextMenu);
});

onUnmounted(() => {
  document.removeEventListener("click", closeContextMenu);
  cancelAnimationFrame(overlayFrame);
  scene?.clearSnapAnchors();
});

function syncScene() {
  if (!scene) return;
  scene.syncObjects(store.state.objects, store.state.selectedObjectIds);
  scene.buildGrid(store.state.grid);
}

watch(
  () => [...store.state.objects],
  () => syncScene(),
  { deep: true },
);

watch(
  () => [...store.state.selectedObjectIds],
  () => syncScene(),
);

watch(
  () => ({ ...store.state.grid }),
  () => scene?.buildGrid(store.state.grid),
  { deep: true },
);

watch(
  () => shouldShowHoverPreview.value,
  (enabled) => {
    if (!enabled) {
      scene?.clearHoverHighlight();
    }
  },
);

watch(
  () => [
    store.state.activePanel,
    store.state.relationEditorMode,
    store.state.relationAttachSourceId,
    store.state.relations.length,
    store.state.objects.length,
  ],
  () => updateRelationOverlay(),
  { deep: true },
);

watch(
  () => [
    store.state.snapPhase,
    store.state.snapSourceObjectId,
    store.state.snapSourceAnchorIndex,
    store.state.objects,
  ],
  () => updateSnapAnchorMarkers(),
  { deep: true },
);

function updateRelationOverlay() {
  cancelAnimationFrame(overlayFrame);

  const next = () => {
    if (!scene || !viewportRef.value || !showRelationOverlay.value) {
      relationOverlay.value = [];
      attachSourceOverlay.value = null;
      return;
    }

    relationOverlay.value = store.state.relations
      .map((relation) => {
        const start = scene?.projectObjectToScreen(relation.source_object_id);
        const end = scene?.projectObjectToScreen(relation.target_object_id);
        if (!start || !end) return null;

        const labelText =
          relation.relation_type === "dimension"
            ? `${RELATION_FIELD_LABELS[relation.source_field]} → ${RELATION_FIELD_LABELS[relation.target_field]} · ${RELATION_MODE_LABELS[relation.mode]}`
            : `${RELATION_TYPE_LABELS.attachment} · ${RELATION_FIELD_LABELS[relation.target_field]}`;

        return {
          id: relation.id,
          start,
          mid: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
          end,
          label: {
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2 - 12,
            text: labelText,
            width: estimateRelationLabelWidth(labelText, 140),
          },
        };
      })
      .filter((item) => item !== null);

    if (store.state.relationAttachSourceId) {
      const point = scene.projectObjectToScreen(
        store.state.relationAttachSourceId,
      );
      const object = store.state.objects.find(
        (item) => item.id === store.state.relationAttachSourceId,
      );
      attachSourceOverlay.value =
        point && object
          ? {
              x: point.x,
              y: point.y,
              name: object.name,
            }
          : null;
    } else {
      attachSourceOverlay.value = null;
    }

    overlayFrame = requestAnimationFrame(next);
  };

  overlayFrame = requestAnimationFrame(next);
}

// ---- Snap-anchor markers rendered directly in Three.js ----

function updateSnapAnchorMarkers() {
  if (!scene || store.state.snapPhase === "none") {
    scene?.clearSnapAnchors();
    return;
  }

  const phase = store.state.snapPhase;
  const sourceId = store.state.snapSourceObjectId;

  const markers = store.state.objects.flatMap((obj) => {
    if (phase === "select-source" && obj.id !== sourceId) return [];

    const anchors = getObjectSnapAnchors(obj).filter((anchor) => {
      if (phase !== "select-target" || obj.id !== sourceId) {
        return true;
      }

      return anchor.index === store.state.snapSourceAnchorIndex;
    });

    return anchors.map((anchor) => {
      const markerPos = anchorMarkerWorldPos(obj, anchor);
      return {
        x: markerPos.x * 0.001,
        y: markerPos.y * 0.001,
        z: markerPos.z * 0.001,
        type: anchor.type,
        objectId: obj.id,
        anchorIndex: anchor.index,
        selected:
          obj.id === sourceId &&
          anchor.index === store.state.snapSourceAnchorIndex,
      };
    });
  });

  scene.setSnapAnchors(markers);
}

const DRAG_SNAP_THRESHOLD_MM = 30;

function getSnapForDrag(
  objId: string,
  rawX: number,
  rawZ: number,
): { x: number; z: number } | null {
  const obj = store.state.objects.find((o) => o.id === objId);
  if (!obj) return null;

  const hw = obj.width / 2;
  const hd = obj.depth / 2;

  let bestX: { dist: number; value: number } | null = null;
  let bestZ: { dist: number; value: number } | null = null;

  for (const other of store.state.objects) {
    if (other.id === objId) continue;

    const oRight = other.position_x + other.width / 2;
    const oLeft = other.position_x - other.width / 2;
    const oFront = other.position_z + other.depth / 2;
    const oBack = other.position_z - other.depth / 2;

    const dRight = rawX + hw;
    const dLeft = rawX - hw;
    const dFront = rawZ + hd;
    const dBack = rawZ - hd;

    // X-axis: right edge of dragged ↔ left edge of other
    const distRL = Math.abs(dRight - oLeft);
    if (distRL < DRAG_SNAP_THRESHOLD_MM && (!bestX || distRL < bestX.dist)) {
      bestX = { dist: distRL, value: oLeft - hw };
    }
    // X-axis: left edge of dragged ↔ right edge of other
    const distLR = Math.abs(dLeft - oRight);
    if (distLR < DRAG_SNAP_THRESHOLD_MM && (!bestX || distLR < bestX.dist)) {
      bestX = { dist: distLR, value: oRight + hw };
    }
    // Z-axis: front edge of dragged ↔ back edge of other
    const distFB = Math.abs(dFront - oBack);
    if (distFB < DRAG_SNAP_THRESHOLD_MM && (!bestZ || distFB < bestZ.dist)) {
      bestZ = { dist: distFB, value: oBack - hd };
    }
    // Z-axis: back edge of dragged ↔ front edge of other
    const distBF = Math.abs(dBack - oFront);
    if (distBF < DRAG_SNAP_THRESHOLD_MM && (!bestZ || distBF < bestZ.dist)) {
      bestZ = { dist: distBF, value: oFront + hd };
    }
  }

  if (!bestX && !bestZ) return null;
  return {
    x: bestX ? bestX.value : rawX,
    z: bestZ ? bestZ.value : rawZ,
  };
}

function onMouseDown(e: MouseEvent) {
  if (!scene) return;
  if (e.button !== 0) return;

  if (shouldShowHoverPreview.value || isSnapAnchorMode.value) return;

  const id = scene.pickObject(e);

  if (store.state.sceneMode === "move" && id) {
    store.selectObject(id, false);

    // When the dragged object is a non-independent component member, collect
    // all other members so they can be moved visually as a rigid group.
    const draggedObj = store.state.objects.find((o) => o.id === id);
    const companionIds: string[] = [];
    if (draggedObj?.component_id && !draggedObj.is_independent) {
      for (const other of store.state.objects) {
        if (
          other.id !== id &&
          other.component_id === draggedObj.component_id &&
          !other.is_independent
        ) {
          companionIds.push(other.id);
        }
      }
    }

    scene.startDrag(
      e,
      id,
      async (objId, x, z) => {
        await store.updateObjectPosition(objId, {
          position_x: parseFloat(x.toFixed(3)),
          position_z: parseFloat(z.toFixed(3)),
        });
      },
      getSnapForDrag,
      companionIds.length > 0 ? companionIds : undefined,
    );
  }
}

function onMouseMove(e: MouseEvent) {
  if (!scene) return;
  if (!shouldShowHoverPreview.value) return;

  const hit = scene.pickObjectWithFace(e);
  const isBlockedTarget =
    (store.state.relationAttachSourceId !== null &&
      hit?.id === store.state.relationAttachSourceId) ||
    (hit ? store.state.selectedObjectIds.includes(hit.id) : false);

  if (hit && !isBlockedTarget) {
    scene.setHoverHighlight(hit.id, hit.faceNormal);
  } else {
    scene.clearHoverHighlight();
  }
}

function onMouseLeave() {
  if (!scene) return;
  scene.clearHoverHighlight();
}

async function onClick(e: MouseEvent) {
  if (!scene) return;
  if (scene.isDragging.value) return;
  if (contextMenu.value.visible) {
    closeContextMenu();
    return;
  }

  // ---- Snap-anchor click handling ----
  if (isSnapAnchorMode.value) {
    const phase = store.state.snapPhase;
    const marker = scene.pickSnapAnchor(e);

    if (phase === "select-source") {
      if (marker && marker.objectId === store.state.snapSourceObjectId) {
        store.selectSnapSourceAnchor(marker.anchorIndex);
      }
      return;
    }

    if (phase === "select-target") {
      if (marker && marker.objectId !== store.state.snapSourceObjectId) {
        await store.performSnap(marker.objectId, marker.anchorIndex);
      }
      return;
    }
    return;
  }

  const id = scene.pickObject(e);

  if (isAttachMode.value) {
    if (!id) return;
    if (!store.state.relationAttachSourceId) {
      store.setRelationAttachSource(id);
      return;
    }

    if (store.state.relationAttachSourceId === id) {
      store.setRelationAttachSource(null);
      return;
    }

    await store.createAttachRelationFromSelection(id);
    return;
  }

  if (store.state.sceneMode === "snap") {
    if (id && !store.state.selectedObjectIds.includes(id)) {
      emit("snap-target-selected", id);
    }
    return;
  }

  const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;

  if (id) {
    store.selectObject(id, isMulti);
  } else if (!isMulti) {
    store.deselectAll();
    if (store.state.activePanel === "object-props") {
      store.setActivePanel("none");
    }
  }
}

function onContextMenu(e: MouseEvent) {
  if (!scene || isAttachMode.value || isSnapAnchorMode.value) return;
  e.preventDefault();
  const id = scene.pickObject(e);
  if (id) store.selectObject(id, false);
  contextMenu.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
    objectId: id,
  };
}

function closeContextMenu() {
  contextMenu.value.visible = false;
  contextMenu.value.objectId = null;
}

async function onCtxDuplicate() {
  if (contextMenu.value.objectId) {
    await store.duplicateObject(contextMenu.value.objectId);
  }
  closeContextMenu();
}

async function onCtxDelete() {
  if (contextMenu.value.objectId) {
    await store.deleteObject(contextMenu.value.objectId);
  }
  closeContextMenu();
}

function onCtxMagnet() {
  if (contextMenu.value.objectId) {
    store.startSnapAnchor(contextMenu.value.objectId);
  }
  closeContextMenu();
}

function openAddObject() {
  showAddDialog.value = true;
  closeContextMenu();
}

function captureScreenshot(): string | null {
  return scene?.captureScreenshot() ?? null;
}

defineExpose({ captureScreenshot });
</script>
