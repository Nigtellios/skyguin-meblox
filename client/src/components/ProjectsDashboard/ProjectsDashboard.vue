<template>
  <div class="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="px-8 py-5 border-b border-slate-800 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <svg class="text-blue-400" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18s-.41-.06-.57-.18l-7.9-4.44A1 1 0 0 1 3 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18s.41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9z"/>
        </svg>
        <div>
          <h1 class="text-xl font-bold text-slate-100">Meblox</h1>
          <p class="text-xs text-slate-500">Wybierz projekt lub utwórz nowy</p>
        </div>
      </div>
      <button
        class="btn-primary flex items-center gap-2 text-sm"
        @click="onNewProject"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/>
        </svg>
        Nowy projekt
      </button>
    </div>

    <!-- Project grid -->
    <div class="flex-1 overflow-y-auto p-8">
      <!-- Empty state -->
      <div
        v-if="store.state.projects.length === 0"
        class="flex flex-col items-center justify-center h-full gap-4 text-slate-500"
      >
        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" class="opacity-20">
          <path d="M20 6h-2.18c.07-.44.18-.86.18-1a3 3 0 0 0-6 0c0 .14.11.56.18 1H10C8.9 6 8 6.9 8 8v12c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
        </svg>
        <p class="text-lg font-medium">Brak projektów</p>
        <p class="text-sm">Utwórz swój pierwszy projekt, aby zacząć</p>
        <button class="btn-primary mt-2" @click="onNewProject">
          Utwórz projekt
        </button>
      </div>

      <!-- Tiles grid -->
      <div
        v-else
        class="grid gap-5"
        style="grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))"
      >
        <div
          v-for="project in store.state.projects"
          :key="project.id"
          class="group relative rounded-xl border border-slate-700/60 bg-slate-900 overflow-hidden hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-900/20 transition-all duration-200 cursor-pointer"
          @click="onOpenProject(project.id)"
        >
          <!-- Thumbnail -->
          <div class="relative aspect-video bg-slate-800 overflow-hidden">
            <img
              v-if="project.thumbnail"
              :src="project.thumbnail"
              :alt="project.name"
              class="w-full h-full object-cover"
            />
            <div
              v-else
              class="w-full h-full flex items-center justify-center"
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" class="text-slate-700">
                <path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18s-.41-.06-.57-.18l-7.9-4.44A1 1 0 0 1 3 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18s.41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9z"/>
              </svg>
            </div>

            <!-- Hover overlay with open button -->
            <div class="absolute inset-0 bg-blue-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span class="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-lg">
                Otwórz
              </span>
            </div>
          </div>

          <!-- Info row -->
          <div class="px-3 py-2.5 flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-semibold text-slate-100 truncate leading-tight">
                {{ project.name }}
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">
                {{ formatDate(project.updated_at) }}
              </p>
            </div>

            <!-- Three-dot menu button -->
            <button
              class="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors mt-0.5"
              title="Opcje"
              @click.stop="toggleMenu(project.id)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
          </div>

          <!-- Dropdown menu -->
          <div
            v-if="openMenuId === project.id"
            class="absolute right-2 bottom-12 z-10 min-w-40 rounded-lg border border-slate-700 py-1 shadow-xl panel-glass"
            @click.stop
          >
            <button
              class="w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
              @click="onRename(project)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
              Zmień nazwę
            </button>
            <button
              class="w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
              @click="onDuplicate(project)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
              Duplikuj
            </button>
            <div class="border-t border-slate-700/60 my-1" />
            <button
              class="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
              @click="onDeleteStart(project)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
              Usuń
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirmation dialog -->
    <Teleport to="body">
      <div
        v-if="deleteDialog.visible"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        @click.self="cancelDelete"
      >
        <div class="panel-glass rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-4 p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-red-900/50 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="text-red-400">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-base font-semibold text-slate-100">Usuń projekt</h3>
              <p class="text-xs text-slate-400">Tej operacji nie można cofnąć.</p>
            </div>
          </div>
          <p class="text-sm text-slate-300 mb-3">
            Aby potwierdzić, wpisz pełną nazwę projektu:
            <strong class="text-slate-100 font-semibold">{{ deleteDialog.projectName }}</strong>
          </p>
          <input
            ref="deleteInputRef"
            v-model="deleteConfirmName"
            type="text"
            class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-red-500 mb-4"
            placeholder="Wpisz nazwę projektu..."
            @keydown.enter="confirmDelete"
            @keydown.escape="cancelDelete"
          />
          <div class="flex gap-2 justify-end">
            <button class="btn-ghost text-sm" @click="cancelDelete">
              Anuluj
            </button>
            <button
              class="btn-danger text-sm"
              :disabled="deleteConfirmName !== deleteDialog.projectName"
              @click="confirmDelete"
            >
              Usuń projekt
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import { useAppStore } from "../../composables/useAppStore";
import type { Project } from "../../types";
import { formatDate } from "../ProjectsModal/projectsModalUtils";

const emit = defineEmits<{
  "open-project": [id: string];
  "new-project": [];
}>();

const store = useAppStore();

const openMenuId = ref<string | null>(null);

const deleteDialog = ref<{
  visible: boolean;
  projectId: string;
  projectName: string;
}>({ visible: false, projectId: "", projectName: "" });
const deleteConfirmName = ref("");
const deleteInputRef = ref<HTMLInputElement | null>(null);

function toggleMenu(id: string) {
  openMenuId.value = openMenuId.value === id ? null : id;
}

function closeMenu() {
  openMenuId.value = null;
}

function onOpenProject(id: string) {
  closeMenu();
  emit("open-project", id);
}

function onNewProject() {
  closeMenu();
  emit("new-project");
}

async function onRename(project: Project) {
  closeMenu();
  const newName = prompt("Nowa nazwa projektu:", project.name);
  if (newName?.trim() && newName.trim() !== project.name) {
    await store.renameProject(project.id, newName.trim());
  }
}

async function onDuplicate(project: Project) {
  closeMenu();
  await store.duplicateProject(project.id);
}

function onDeleteStart(project: Project) {
  closeMenu();
  deleteDialog.value = {
    visible: true,
    projectId: project.id,
    projectName: project.name,
  };
  deleteConfirmName.value = "";
  nextTick(() => deleteInputRef.value?.focus());
}

function cancelDelete() {
  deleteDialog.value.visible = false;
  deleteConfirmName.value = "";
}

async function confirmDelete() {
  if (deleteConfirmName.value !== deleteDialog.value.projectName) return;
  const id = deleteDialog.value.projectId;
  deleteDialog.value.visible = false;
  deleteConfirmName.value = "";
  await store.deleteProject(id);
}
</script>
