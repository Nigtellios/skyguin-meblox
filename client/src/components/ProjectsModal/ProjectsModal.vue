<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="$emit('close')"
    >
      <div class="panel-glass rounded-2xl shadow-2xl border border-slate-700 w-full max-w-lg mx-4 overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
          <div class="flex items-center gap-3">
            <svg class="text-blue-400 shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 6h-2.18c.07-.44.18-.86.18-1a3 3 0 0 0-6 0c0 .14.11.56.18 1H10C8.9 6 8 6.9 8 8v12c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-1c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14h-4v-1h4v1zm2-3h-6v-1h6v1zm0-3h-6v-1h6v1z"/>
            </svg>
            <h2 class="text-base font-semibold text-slate-100">Projekty</h2>
          </div>
          <button class="btn-icon text-slate-400 hover:text-slate-100" @click="$emit('close')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <!-- Project list -->
        <div class="overflow-y-auto max-h-80">
          <div v-if="projects.length === 0" class="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" class="opacity-30">
              <path d="M20 6h-2.18c.07-.44.18-.86.18-1a3 3 0 0 0-6 0c0 .14.11.56.18 1H10C8.9 6 8 6.9 8 8v12c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
            </svg>
            <span class="text-sm">Brak projektów</span>
          </div>
          <button
            v-for="project in projects"
            :key="project.id"
            class="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-700/60 transition-colors text-left border-b border-slate-700/30 last:border-b-0"
            :class="project.id === currentProjectId ? 'bg-blue-900/30 border-l-2 border-l-blue-500' : ''"
            @click="onSelectProject(project.id)"
          >
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              :class="project.id === currentProjectId ? 'bg-blue-600' : 'bg-slate-700'"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-slate-100 truncate">{{ project.name }}</div>
              <div class="text-xs text-slate-500">{{ formatDate(project.updated_at) }}</div>
            </div>
            <svg v-if="project.id === currentProjectId" class="text-blue-400 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          </button>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 border-t border-slate-700/60 flex items-center gap-2">
          <button
            class="btn-primary flex items-center gap-1.5 text-sm"
            @click="onNewProject"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/>
            </svg>
            Nowy projekt
          </button>
          <div class="flex-1" />
          <button
            v-if="currentProjectId"
            class="btn-danger text-sm flex items-center gap-1.5"
            @click="onDeleteProject"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
            Usuń projekt
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useAppStore } from "../../composables/useAppStore";
import type { Project } from "../../types";
import { DEFAULT_PROJECT_NAME, formatDate } from "./projectsModalUtils";

defineProps<{
  projects: readonly Project[];
  currentProjectId: string | null;
}>();

const emit = defineEmits<{
  close: [];
  "select-project": [id: string];
}>();

const store = useAppStore();

async function onSelectProject(id: string) {
  emit("select-project", id);
  emit("close");
}

async function onNewProject() {
  const name = prompt("Nazwa nowego projektu:", DEFAULT_PROJECT_NAME);
  if (name?.trim()) {
    await store.createProject(name.trim());
    emit("close");
  }
}

async function onDeleteProject() {
  const proj = store.state.projects.find(
    (p) => p.id === store.state.currentProjectId,
  );
  if (!proj) return;
  if (
    confirm(`Usunąć projekt "${proj.name}"? Tej operacji nie można cofnąć.`)
  ) {
    await store.deleteProject(proj.id);
    emit("close");
  }
}
</script>
