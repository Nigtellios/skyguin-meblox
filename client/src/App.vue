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
        :snap-phase="store.state.snapPhase"
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
        v-if="
          store.state.activePanel !== 'none' &&
          store.state.activePanel !== 'history' &&
          store.state.activePanel !== 'relations'
        "
        class="w-80 shrink-0 panel-glass border-l border-slate-700/50 overflow-y-auto z-10"
      />
    </transition>

    <RelationsPanel v-if="store.state.activePanel === 'relations'" />

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
import { computed, onMounted, onUnmounted, watch } from "vue";
import ComponentsPanel from "./components/ComponentsPanel/ComponentsPanel.vue";
import ContextBar from "./components/ContextBar/ContextBar.vue";
import GridSettingsPanel from "./components/GridSettingsPanel/GridSettingsPanel.vue";
import HistoryPanel from "./components/HistoryPanel/HistoryPanel.vue";
import MaterialsPanel from "./components/MaterialsPanel/MaterialsPanel.vue";
import ObjectPropertiesPanel from "./components/ObjectPropertiesPanel/ObjectPropertiesPanel.vue";
import ObjectsPanel from "./components/ObjectsPanel/ObjectsPanel.vue";
import ProjectsModal from "./components/ProjectsModal/ProjectsModal.vue";
import RelationsPanel from "./components/RelationsPanel/RelationsPanel.vue";
import SceneCanvas from "./components/SceneCanvas/SceneCanvas.vue";
import ToolButton from "./components/ToolButton/ToolButton.vue";
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

// Issue 2: Auto-enter move-controls when selecting an object while in move mode
watch(
  () => store.state.selectedObjectIds,
  (ids) => {
    if (
      ids.length > 0 &&
      store.state.sceneMode === "move" &&
      store.state.contextMode !== "move-controls"
    ) {
      store.setContextMode("move-controls");
    }
  },
);

// ---- Icons ----
const tools: Array<{ mode: SceneMode; label: string; icon: string }> = [
  {
    mode: "select",
    label: "Zaznacz (S)",
    // Standard mouse cursor arrow (pointing top-left)
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2l1.5 15L9 13.5l3 6 1.5-.75-3-6 4.5-1.5z"/></svg>`,
  },
  {
    mode: "move",
    label: "Przesuń (M)",
    // 4-directional arrow (compass rose)
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/></svg>`,
  },
];

const panelToggles: Array<{ id: AppPanel; label: string; icon: string }> = [
  {
    id: "objects",
    label: "Elementy projektu",
    // 3D cube / box icon - clearly represents physical objects/furniture
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18s-.41-.06-.57-.18l-7.9-4.44A1 1 0 0 1 3 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18s.41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L5.04 8 12 11.85 18.96 8 12 4.15zM5 9.58v5.84l6.5 3.66V13.24L5 9.58zm8.5 9.5 6.5-3.66V9.58l-6.5 3.66v5.84z"/></svg>`,
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
    // Puzzle piece / modular components icon
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V19c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V21H17c1.1 0 2-.9 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/></svg>`,
  },
  {
    id: "relations",
    label: "Relacje między obiektami",
    // Chain link icon - clearly represents connections/relations between objects
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`,
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
    // Standard clock with hands - clearly represents time/history
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>`,
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

function roundPos(v: number) {
  return parseFloat(v.toFixed(3));
}

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
    position_x: roundPos(obj.position_x + delta.dx),
    position_y: roundPos(obj.position_y + delta.dy),
    position_z: roundPos(obj.position_z + delta.dz),
    rotation_y: obj.rotation_y + delta.dr,
  });
}

function onExitMoveControls() {
  store.setContextMode("object-actions");
  store.setSceneMode("select");
}

function onToggleSnap() {
  if (store.state.sceneMode === "snap") {
    store.exitSnapAnchor();
  } else {
    const id = store.state.selectedObjectIds[0];
    if (id) {
      store.startSnapAnchor(id);
    }
  }
}

function onExitSnapMode() {
  store.exitSnapAnchor();
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

  // Ctrl+Z: undo
  if (ctrl && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
    e.preventDefault();
    store.undoHistory();
    return;
  }

  // Ctrl+Y or Ctrl+Shift+Z: redo
  if (
    (ctrl && (e.key === "y" || e.key === "Y")) ||
    (ctrl && e.shiftKey && (e.key === "z" || e.key === "Z"))
  ) {
    e.preventDefault();
    store.redoHistory();
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
    if (store.state.activePanel === "relations") {
      store.setActivePanel("none");
      return;
    }
    // Let ContextBar handle Escape when move-controls are active
    if (store.state.contextMode === "move-controls") return;
    if (store.state.contextMode !== "none") {
      onDeselect();
    }
    return;
  }

  // Tool shortcuts
  if (!ctrl) {
    // Don't handle tool shortcuts when move-controls are active (ContextBar handles them)
    if (store.state.contextMode === "move-controls") return;

    if (e.key === "s" || e.key === "S") {
      const active = document.activeElement?.tagName;
      if (active === "INPUT" || active === "TEXTAREA") return;
      store.setSceneMode("select");
    }
    if (e.key === "m" || e.key === "M") {
      const active = document.activeElement?.tagName;
      if (active === "INPUT" || active === "TEXTAREA") return;
      store.setSceneMode("move");
      // Auto-enter move-controls if object is already selected
      if (store.state.selectedObjectIds.length > 0) {
        store.setContextMode("move-controls");
      }
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
