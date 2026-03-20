<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="panel-section flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-200">Szablony materiałów</h2>
      <button class="btn-icon text-green-400" @click="createNew">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/></svg>
      </button>
    </div>

    <!-- Template List + Editor -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="!activeMat" class="p-2 space-y-1">
        <div
          v-for="mat in store.state.materialTemplates"
          :key="mat.id"
          class="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer hover:bg-slate-700/40 group border border-transparent"
          @click="activeMat = mat.id"
        >
          <div class="w-6 h-6 rounded border border-slate-600 shrink-0" :style="{ backgroundColor: mat.base_color }" />
          <div class="flex-1 min-w-0">
            <div class="text-sm text-slate-200 truncate">{{ mat.name }}</div>
            <div class="text-xs text-slate-500">{{ mat.layers.length }} warstw</div>
          </div>
          <button class="btn-icon text-red-500 opacity-0 group-hover:opacity-100 w-6 h-6" @click.stop="deleteMat(mat.id)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
        <div v-if="!store.state.materialTemplates.length" class="text-center text-slate-500 text-sm py-8">
          Brak szablonów materiałów.<br/>Kliknij + aby dodać.
        </div>
      </div>

      <!-- Template Editor -->
      <MaterialTemplateEditor
        v-else-if="currentTemplate"
        :template="currentTemplate"
        @back="activeMat = null"
        @reload="store.loadMaterials()"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useAppStore } from "../../composables/useAppStore";
import MaterialTemplateEditor from "../MaterialTemplateEditor/MaterialTemplateEditor.vue";

const store = useAppStore();
const activeMat = ref<string | null>(null);

const currentTemplate = computed(
  () =>
    store.state.materialTemplates.find((m) => m.id === activeMat.value) ?? null,
);

async function createNew() {
  const name = prompt("Nazwa szablonu materiału:", "Nowy materiał");
  if (name?.trim()) {
    const mat = await store.createMaterial({ name: name.trim() });
    activeMat.value = mat.id;
  }
}

async function deleteMat(id: string) {
  if (confirm("Usunąć szablon materiału?")) {
    await store.deleteMaterial(id);
    if (activeMat.value === id) activeMat.value = null;
  }
}
</script>
