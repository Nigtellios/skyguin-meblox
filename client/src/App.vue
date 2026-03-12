<template>
  <div class="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
    <!-- Left Sidebar: History panel (when active) -->
    <transition name="slide-panel-left">
      <HistoryPanel
        v-if="store.state.activePanel === 'history'"
        class="w-72 shrink-0 panel-glass border-r border-slate-700/50 overflow-y-auto z-10"
      />
    </transition>

    <!-- Left Toolbar -->
    <div class="w-14 flex flex-col items-center py-3 gap-2 panel-glass border-r border-slate-700/50 z-10 shrink-0">
      <!-- Hamburger / Projects button -->
      <button
        class="btn-icon text-blue-400 hover:text-blue-300 mb-1"
        title="Projekty"
        @click="onHamburgerClick"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
        </svg>
      </button>

      <!-- Tool buttons -->
      <ToolButton
        v-for="tool in tools"
        :key="tool.mode"
        :title="tool.label"
        :active="store.state.sceneMode === tool.mode"
        @click="store.setSceneMode(tool.mode)"
      >
        <span v-html="tool.icon" />
      </ToolButton>

      <div class="border-t border-slate-700/50 w-8 my-1" />

      <!-- Panel toggles -->
      <ToolButton
        v-for="panel in panelToggles"
        :key="panel.id"
        :title="panel.label"
        :active="store.state.activePanel === panel.id"
        @click="togglePanel(panel.id)"
      >
        <span v-html="panel.icon" />
      </ToolButton>
    </div>

    <!-- Main Canvas Area -->
    <div class="flex-1 relative overflow-hidden">
      <SceneCanvas
        @snap-target-selected="onSnapTargetSelected"
      />

      <!-- Top HUD bar -->
      <div class="absolute top-3 left-3 right-3 flex items-center gap-2 pointer-events-none">
        <!-- Project name indicator -->
        <div class="pointer-events-auto panel-glass rounded-lg px-3 py-2 flex items-center gap-2">
          <svg class="text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
          </svg>
          <span class="text-slate-200 text-sm font-medium">
            {{ currentProjectName }}
          </span>
        </div>

        <div class="flex-1" />

        <!-- Mode indicator -->
        <div class="pointer-events-auto panel-glass rounded-lg px-3 py-2 flex items-center gap-2">
          <span class="text-slate-400 text-xs">Tryb:</span>
          <span class="text-blue-300 text-sm font-medium">{{ modeLabel }}</span>
        </div>
      </div>

      <!-- Context Bar (bottom) -->
      <ContextBar
        :context-mode="store.state.contextMode"
        :scene-mode="store.state.sceneMode"
        :selected-count="store.state.selectedObjectIds.length"
        :first-selected="store.firstSelectedObject"
        @add-object="store.setActivePanel('objects')"
        @open-materials="store.setActivePanel('object-props')"
        @set-scene-mode="store.setSceneMode"
        @enter-move-controls="store.setContextMode('move-controls')"
        @exit-move-controls="onExitMoveControls"
        @toggle-snap="onToggleSnap"
        @exit-snap-mode="onExitSnapMode"
        @copy="store.copySelected()"
        @duplicate="onDuplicate"
        @delete="onDeleteSelected"
        @deselect="onDeselect"
        @move-object="onContextBarMove"
      />
    </div>

    <!-- Right Panel -->
    <transition name="slide-panel">
      <component
        :is="activePanelComponent"
        v-if="store.state.activePanel !== 'none' && store.state.activePanel !== 'history'"
        class="w-80 shrink-0 panel-glass border-l border-slate-700/50 overflow-y-auto z-10"
      />
    </transition>

    <!-- Projects Modal -->
    <ProjectsModal
      v-if="store.state.showProjectsModal"
      :projects="store.state.projects"
      :current-project-id="store.state.currentProjectId"
      @close="store.setShowProjectsModal(false)"
      @select-project="onProjectSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import ComponentsPanel from "./components/ComponentsPanel.vue";
import ContextBar from "./components/ContextBar.vue";
import GridSettingsPanel from "./components/GridSettingsPanel.vue";
import HistoryPanel from "./components/HistoryPanel.vue";
import MaterialsPanel from "./components/MaterialsPanel.vue";
import ObjectPropertiesPanel from "./components/ObjectPropertiesPanel.vue";
import ObjectsPanel from "./components/ObjectsPanel.vue";
import ProjectsModal from "./components/ProjectsModal.vue";
import SceneCanvas from "./components/SceneCanvas.vue";
import ToolButton from "./components/ToolButton.vue";
import { useAppStore } from "./composables/useAppStore";
import type { AppPanel, SceneMode } from "./types";

const store = useAppStore();

onMounted(async () => {
  await store.loadProjects();
  await store.loadMaterials();
  document.addEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", onKeyDown);
});

// ---- Icons ----
const tools: Array<{ mode: SceneMode; label: string; icon: string }> = [
  {
    mode: "select",
    label: "Zaznacz (S)",
    // Cursor / pointer icon
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13.64 21.97C13.14 22.21 12.54 22 12.31 21.5L10.13 16.76L7.62 19.78C7.45 19.98 7.21 20.09 6.96 20.09C6.72 20.09 6.48 19.98 6.31 19.78C6.13 19.59 6.04 19.35 6.04 19.09V3.04C6.04 2.49 6.48 2.05 7.04 2.05C7.23 2.05 7.41 2.11 7.58 2.22L19.6 9.72C20.05 10 20.15 10.59 19.85 11.04C19.75 11.21 19.6 11.34 19.42 11.41L15.76 12.81L17.93 17.55C18.16 18.06 17.95 18.65 17.45 18.88L13.64 21.97Z"/></svg>`,
  },
  {
    mode: "move",
    label: "Przesuń (M)",
    // 4-directional arrow (compass rose)
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/></svg>`,
  },
  {
    mode: "rotate",
    label: "Obróć (R)",
    // Circular arrows (refresh/rotate)
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/></svg>`,
  },
];

const panelToggles: Array<{ id: AppPanel; label: string; icon: string }> = [
  {
    id: "objects",
    label: "Elementy",
    // Box / package icon
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zm-8.5 11.77L6.04 12H9v-2h6v2h2.96l-6 5z"/></svg>`,
  },
  {
    id: "materials",
    label: "Materiały",
    // Palette icon
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`,
  },
  {
    id: "components",
    label: "Komponenty",
    // Layers icon
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zm.01-2.99l7.36-5.73L21 8.07l-9-7-9 7 1.63 1.26 7.37 5.72zm0-11.06l6.61 5.14L12 15.13l-6.62-5.5L12 4.49z"/></svg>`,
  },
  {
    id: "grid",
    label: "Siatka",
    // Grid icon
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z"/></svg>`,
  },
  {
    id: "history",
    label: "Historia zmian",
    // Clock icon
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3a9 9 0 1 0 0 18A9 9 0 0 0 13 3zm-1 5h1.5l.5 5 3.5 2.1-.75 1.3L13 14.27V8zM3 13c0-4.08 2.91-7.47 6.74-8.24L10 6.26A7 7 0 0 0 5 13H3z"/></svg>`,
  },
];

function togglePanel(id: AppPanel) {
  store.setActivePanel(store.state.activePanel === id ? "none" : id);
}

const activePanelComponent = computed(() => {
  switch (store.state.activePanel) {
    case "objects":
      return ObjectsPanel;
    case "object-props":
      return ObjectPropertiesPanel;
    case "materials":
      return MaterialsPanel;
    case "components":
      return ComponentsPanel;
    case "grid":
      return GridSettingsPanel;
    default:
      return null;
  }
});

const modeLabel = computed(() => {
  const labels: Record<string, string> = {
    select: "Zaznaczanie",
    move: "Przesuwanie",
    rotate: "Obracanie",
    snap: "Przyklejanie",
  };
  return labels[store.state.sceneMode] ?? "";
});

const currentProjectName = computed(() => {
  const proj = store.state.projects.find(
    (p) => p.id === store.state.currentProjectId,
  );
  return proj?.name ?? "Brak projektu";
});

// ---- Hamburger / Projects modal ----
function onHamburgerClick() {
  store.setShowProjectsModal(true);
}

async function onProjectSelect(id: string) {
  if (id !== store.state.currentProjectId) {
    await store.selectProject(id);
  }
}

// ---- Context bar actions ----
function onDeselect() {
  store.deselectAll();
  store.setActivePanel("none");
}

async function onDuplicate() {
  if (store.state.selectedObjectIds.length === 1) {
    await store.duplicateObject(store.state.selectedObjectIds[0]);
  }
}

async function onDeleteSelected() {
  const count = store.state.selectedObjectIds.length;
  const msg =
    count === 1
      ? `Usunąć "${store.firstSelectedObject?.name}"?`
      : `Usunąć ${count} elementy?`;
  if (!confirm(msg)) return;
  for (const id of [...store.state.selectedObjectIds]) {
    await store.deleteObject(id);
  }
  store.setActivePanel("none");
}

async function onContextBarMove(delta: {
  dx: number;
  dy: number;
  dz: number;
  dr: number;
}) {
  const id = store.state.selectedObjectIds[0];
  if (!id) return;
  const obj = store.state.objects.find((o) => o.id === id);
  if (!obj) return;
  await store.updateObjectPosition(id, {
    position_x: Math.round(obj.position_x + delta.dx),
    position_y: Math.round(obj.position_y + delta.dy),
    position_z: Math.round(obj.position_z + delta.dz),
    rotation_y: obj.rotation_y + delta.dr,
  });
}

function onExitMoveControls() {
  store.setContextMode("object-actions");
  store.setSceneMode("select");
}

function onToggleSnap() {
  if (store.state.sceneMode === "snap") {
    store.setSceneMode("select");
    store.setContextMode("object-actions");
  } else {
    store.setSceneMode("snap");
    store.setContextMode("snap-mode");
  }
}

function onExitSnapMode() {
  store.setSceneMode("select");
  store.setContextMode("object-actions");
}

function onSnapTargetSelected(targetId: string) {
  const movingId = store.state.selectedObjectIds[0];
  if (!movingId) return;
  const newPos = store.snapObjectToEdge(movingId, targetId);
  if (newPos) {
    store.updateObjectPosition(movingId, newPos);
  }
  store.setSceneMode("select");
  store.setContextMode("object-actions");
}

// ---- Keyboard shortcuts ----
function onKeyDown(e: KeyboardEvent) {
  const ctrl = e.ctrlKey || e.metaKey;

  // Ctrl+C: copy
  if (ctrl && e.key === "c" && !e.shiftKey) {
    if (store.state.selectedObjectIds.length > 0) {
      store.copySelected();
      e.preventDefault();
    }
    return;
  }

  // Ctrl+V: paste
  if (ctrl && e.key === "v") {
    store.pasteClipboard();
    e.preventDefault();
    return;
  }

  // Ctrl+D: duplicate selected
  if (ctrl && e.key === "d") {
    if (store.state.selectedObjectIds.length === 1) {
      onDuplicate();
      e.preventDefault();
    }
    return;
  }

  // Delete: delete selected
  if (e.key === "Delete" || e.key === "Backspace") {
    const active = document.activeElement?.tagName;
    if (active === "INPUT" || active === "TEXTAREA" || active === "SELECT")
      return;
    if (store.state.selectedObjectIds.length > 0) {
      onDeleteSelected();
    }
    return;
  }

  // Escape: deselect / exit mode
  if (e.key === "Escape") {
    if (store.state.contextMode !== "none") {
      onDeselect();
    }
    return;
  }

  // Tool shortcuts
  if (!ctrl) {
    if (e.key === "s" || e.key === "S") {
      const active = document.activeElement?.tagName;
      if (active === "INPUT" || active === "TEXTAREA") return;
      store.setSceneMode("select");
    }
    if (e.key === "m" || e.key === "M") {
      const active = document.activeElement?.tagName;
      if (active === "INPUT" || active === "TEXTAREA") return;
      store.setSceneMode("move");
    }
    if (e.key === "r" || e.key === "R") {
      const active = document.activeElement?.tagName;
      if (active === "INPUT" || active === "TEXTAREA") return;
      store.setSceneMode("rotate");
    }
  }
}
</script>

<style scoped>
.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.slide-panel-enter-from,
.slide-panel-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

.slide-panel-left-enter-active,
.slide-panel-left-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.slide-panel-left-enter-from,
.slide-panel-left-leave-to {
  transform: translateX(-20px);
  opacity: 0;
}
</style>
