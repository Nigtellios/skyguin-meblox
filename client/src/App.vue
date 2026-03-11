<template>
  <div class="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
    <!-- Left Sidebar: Tools -->
    <div class="w-14 flex flex-col items-center py-3 gap-2 panel-glass border-r border-slate-700/50 z-10 shrink-0">
      <!-- Logo -->
      <div class="mb-2 text-blue-400">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 4h16v2H4zm0 7h16v2H4zm0 7h16v2H4z"/>
        </svg>
      </div>

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
      <SceneCanvas />

      <!-- Top HUD bar -->
      <div class="absolute top-3 left-3 right-3 flex items-center gap-2 pointer-events-none">
        <!-- Project selector -->
        <div class="pointer-events-auto panel-glass rounded-lg px-3 py-2 flex items-center gap-3">
          <span class="text-slate-400 text-xs">Projekt:</span>
          <select
            class="bg-transparent text-slate-200 text-sm border-none outline-none cursor-pointer"
            :value="store.state.currentProjectId"
            @change="onProjectChange"
          >
            <option v-for="p in store.state.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <button class="btn-icon pointer-events-auto text-green-400" title="Nowy projekt" @click="onNewProject">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/></svg>
          </button>
        </div>

        <div class="flex-1" />

        <!-- Mode indicator -->
        <div class="pointer-events-auto panel-glass rounded-lg px-3 py-2 flex items-center gap-2">
          <span class="text-slate-400 text-xs">Tryb:</span>
          <span class="text-blue-300 text-sm font-medium">{{ modeLabel }}</span>
        </div>
      </div>

      <!-- Bottom HUD: quick actions -->
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-auto">
        <button class="btn-primary flex items-center gap-1.5" @click="store.setActivePanel('objects')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/></svg>
          Dodaj element
        </button>
        <button
          v-if="hasSelection"
          class="btn-secondary flex items-center gap-1.5"
          @click="onDuplicate"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          Duplikuj
        </button>
        <button
          v-if="hasSelection"
          class="btn-danger flex items-center gap-1.5"
          @click="onDeleteSelected"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          Usuń
        </button>
      </div>
    </div>

    <!-- Right Panel -->
    <transition name="slide-panel">
      <component
        :is="activePanelComponent"
        v-if="store.state.activePanel !== 'none'"
        class="w-80 shrink-0 panel-glass border-l border-slate-700/50 overflow-y-auto z-10"
      />
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import SceneCanvas from "./components/SceneCanvas.vue";
import ToolButton from "./components/ToolButton.vue";
import ObjectsPanel from "./components/ObjectsPanel.vue";
import ObjectPropertiesPanel from "./components/ObjectPropertiesPanel.vue";
import MaterialsPanel from "./components/MaterialsPanel.vue";
import GridSettingsPanel from "./components/GridSettingsPanel.vue";
import ComponentsPanel from "./components/ComponentsPanel.vue";
import { useAppStore } from "./composables/useAppStore";
import type { AppPanel, SceneMode } from "./types";

const store = useAppStore();

onMounted(async () => {
  await store.loadProjects();
  await store.loadMaterials();
});

const tools: Array<{ mode: SceneMode; label: string; icon: string }> = [
  {
    mode: "select",
    label: "Zaznacz (S)",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 0L0 14l4-2 3 6 2-1-3-6 4-2L4 0z"/></svg>`,
  },
  {
    mode: "move",
    label: "Przesuń (M)",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 6v5h5l-6-6-6 6h5v5h2V6zm-2 13v-5H6l6 6 6-6h-5v-5h-2v10z"/></svg>`,
  },
  {
    mode: "rotate",
    label: "Obróć (R)",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/></svg>`,
  },
];

const panelToggles: Array<{ id: AppPanel; label: string; icon: string }> = [
  {
    id: "objects",
    label: "Elementy",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 3l7 4-7 4-7-4 7-4zm0 9l-7-4v2l7 4 7-4v-2l-7 4z"/></svg>`,
  },
  {
    id: "materials",
    label: "Materiały",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3C8.22 20.56 10 22 12 22c4.97 0 9-4.03 9-9 0-4-2.5-7.4-6-8.8L17 8zM12 20c-1.03 0-1.99-.31-2.79-.84l.79-1.83C10.64 17.44 11.3 17.5 12 17.5c2.59 0 4.5-1.91 4.5-4.5 0-.5-.08-.98-.23-1.43.24-.43.43-.89.57-1.37C18.52 11.41 19 13.13 19 15c0 3.86-3.14 5-7 5z"/></svg>`,
  },
  {
    id: "components",
    label: "Komponenty",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>`,
  },
  {
    id: "grid",
    label: "Siatka",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-5 15H9v-2h6v2zm0-4H9v-2h6v2zm0-4H9V7h6v2z"/></svg>`,
  },
];

function togglePanel(id: AppPanel) {
  store.setActivePanel(store.state.activePanel === id ? "none" : id);
}

const activePanelComponent = computed(() => {
  switch (store.state.activePanel) {
    case "objects": return ObjectsPanel;
    case "object-props": return ObjectPropertiesPanel;
    case "materials": return MaterialsPanel;
    case "components": return ComponentsPanel;
    case "grid": return GridSettingsPanel;
    default: return null;
  }
});

const modeLabel = computed(() => {
  const labels: Record<string, string> = { select: "Zaznaczanie", move: "Przesuwanie", rotate: "Obracanie" };
  return labels[store.state.sceneMode] ?? "";
});

const hasSelection = computed(() => store.state.selectedObjectIds.length > 0);

async function onDuplicate() {
  if (store.state.selectedObjectIds.length === 1) {
    await store.duplicateObject(store.state.selectedObjectIds[0]);
  }
}

async function onDeleteSelected() {
  for (const id of [...store.state.selectedObjectIds]) {
    await store.deleteObject(id);
  }
}

async function onProjectChange(e: Event) {
  const id = (e.target as HTMLSelectElement).value;
  await store.selectProject(id);
}

async function onNewProject() {
  const name = prompt("Nazwa nowego projektu:", "Nowy projekt");
  if (name?.trim()) {
    await store.createProject(name.trim());
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
</style>
