<template>
  <canvas
    ref="canvasRef"
    class="w-full h-full block"
    @mousedown="onMouseDown"
    @click="onClick"
    @contextmenu.prevent="onContextMenu"
  />

  <!-- Context menu -->
  <Teleport to="body">
    <div
      v-if="contextMenu.visible"
      class="fixed z-50 panel-glass rounded-lg shadow-xl border border-slate-700 py-1 min-w-40"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <button v-if="contextMenu.objectId" class="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 text-slate-200" @click="onCtxDuplicate">
        Duplikuj
      </button>
      <button v-if="contextMenu.objectId" class="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 text-red-400" @click="onCtxDelete">
        Usuń
      </button>
      <button v-if="!contextMenu.objectId" class="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 text-slate-200" @click="openAddObject">
        Dodaj element tutaj
      </button>
      <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 text-slate-400" @click="closeContextMenu">
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
</template>

<script setup lang="ts">
import { ref, onMounted, watch, watchEffect } from "vue";
import { useScene } from "../composables/useScene";
import { useAppStore } from "../composables/useAppStore";
import AddObjectDialog from "./AddObjectDialog.vue";

const canvasRef = ref<HTMLCanvasElement | null>(null);
const store = useAppStore();
let scene: ReturnType<typeof useScene> | null = null;

const showAddDialog = ref(false);
const addPosition = ref({ x: 0, z: 0 });

const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  objectId: null as string | null,
});

onMounted(() => {
  if (!canvasRef.value) return;
  scene = useScene(canvasRef.value);

  // Initial sync
  syncScene();

  // Close context menu on outside click
  document.addEventListener("click", closeContextMenu);
});

function syncScene() {
  if (!scene) return;
  scene.syncObjects([...store.state.objects] as any, [...store.state.selectedObjectIds]);
  scene.buildGrid(store.state.grid);
}

// Watch for state changes
watch(
  () => [...store.state.objects],
  () => syncScene(),
  { deep: true }
);

watch(
  () => [...store.state.selectedObjectIds],
  () => syncScene()
);

watch(
  () => ({ ...store.state.grid }),
  () => scene?.buildGrid(store.state.grid),
  { deep: true }
);

function onMouseDown(e: MouseEvent) {
  if (!scene) return;
  if (e.button !== 0) return;

  const id = scene.pickObject(e);

  if (store.state.sceneMode === "move" && id) {
    store.selectObject(id, false);
    scene.startDrag(e, id, async (objId, x, z) => {
      // Update position in store (debounced would be ideal, but this is simple)
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
    return;
  }
}

function onClick(e: MouseEvent) {
  if (!scene) return;
  if (scene.isDragging.value) return;
  if (contextMenu.value.visible) {
    closeContextMenu();
    return;
  }

  const id = scene.pickObject(e);
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
  if (!scene) return;
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
