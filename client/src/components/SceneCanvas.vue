<template>
  <div ref="viewportRef" class="relative h-full w-full overflow-hidden">
    <canvas
      ref="canvasRef"
      class="block h-full w-full"
      :class="store.state.sceneMode === 'snap' || isAttachMode ? 'cursor-crosshair' : ''"
      @mousedown="onMouseDown"
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
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa" />
        </marker>
      </defs>

      <g v-for="item in relationOverlay" :key="item.id">
        <line
          :x1="item.start.x"
          :y1="item.start.y"
          :x2="item.end.x"
          :y2="item.end.y"
          stroke="#60a5fa"
          stroke-width="2.5"
          stroke-dasharray="6 4"
          marker-end="url(#scene-relation-arrow)"
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
        transform: 'translate(-50%, -150%)',
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
import { useAppStore } from "../composables/useAppStore";
import { useScene } from "../composables/useScene";
import {
  RELATION_FIELD_LABELS,
  RELATION_MODE_LABELS,
  RELATION_TYPE_LABELS,
} from "../types";
import AddObjectDialog from "./AddObjectDialog.vue";

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
const showRelationOverlay = computed(
  () => store.state.activePanel === "relations",
);

onMounted(() => {
  if (!canvasRef.value) return;
  scene = useScene(canvasRef.value);

  syncScene();
  updateRelationOverlay();

  document.addEventListener("click", closeContextMenu);
});

onUnmounted(() => {
  document.removeEventListener("click", closeContextMenu);
  cancelAnimationFrame(overlayFrame);
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

function updateRelationOverlay() {
  cancelAnimationFrame(overlayFrame);

  const next = () => {
    if (!scene || !viewportRef.value || !showRelationOverlay.value) {
      relationOverlay.value = [];
      attachSourceOverlay.value = null;
      overlayFrame = requestAnimationFrame(next);
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
          end,
          label: {
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2 - 12,
            text: labelText,
            width: Math.max(140, labelText.length * 7.2),
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

function onMouseDown(e: MouseEvent) {
  if (!scene) return;
  if (e.button !== 0) return;

  if (store.state.sceneMode === "snap" || isAttachMode.value) return;

  const id = scene.pickObject(e);

  if (store.state.sceneMode === "move" && id) {
    store.selectObject(id, false);
    scene.startDrag(e, id, async (objId, x, z) => {
      const obj = store.state.objects.find((o) => o.id === objId);
      if (obj) {
        const mesh = scene?.objectMeshMap.get(objId);
        if (mesh) {
          await store.updateObjectPosition(objId, {
            position_x: Math.round(x),
            position_z: Math.round(z),
          });
        }
      }
    });
  }
}

async function onClick(e: MouseEvent) {
  if (!scene) return;
  if (scene.isDragging.value) return;
  if (contextMenu.value.visible) {
    closeContextMenu();
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
  } else {
    store.deselectAll();
    if (store.state.activePanel === "object-props") {
      store.setActivePanel("none");
    }
  }
}

function onContextMenu(e: MouseEvent) {
  if (!scene || isAttachMode.value) return;
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

function openAddObject() {
  showAddDialog.value = true;
  closeContextMenu();
}
</script>
