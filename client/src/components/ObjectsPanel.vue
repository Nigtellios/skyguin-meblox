<template>
  <div class="flex flex-col h-full">
    <div class="panel-section flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-200">Elementy projektu</h2>
      <button class="btn-icon text-green-400" title="Dodaj element" @click="showAdd = true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/></svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-2 space-y-1">
      <div
        v-for="obj in store.state.objects"
        :key="obj.id"
        class="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors group"
        :class="isSelected(obj.id) ? 'bg-blue-600/20 border border-blue-500/40' : 'hover:bg-slate-700/40 border border-transparent'"
        @click="selectObj(obj.id, $event)"
      >
        <!-- Color swatch -->
        <div class="w-3 h-3 rounded-full shrink-0 border border-slate-600" :style="{ backgroundColor: obj.color }" />

        <!-- Name and dims -->
        <div class="flex-1 min-w-0">
          <div class="text-sm text-slate-200 truncate">{{ obj.name }}</div>
          <div class="text-xs text-slate-500">{{ obj.width }}×{{ obj.height }}×{{ obj.depth }} mm</div>
        </div>

        <!-- Component badge -->
        <div
          v-if="obj.component_id"
          class="text-xs px-1 py-0.5 rounded shrink-0"
          :class="obj.is_independent ? 'bg-yellow-900/50 text-yellow-400' : 'bg-purple-900/50 text-purple-400'"
          :title="obj.is_independent ? 'Edytowany osobno' : 'Część komponentu'"
        >
          {{ obj.is_independent ? "★" : "⬡" }}
        </div>

        <!-- Actions (show on hover) -->
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button class="btn-icon text-slate-500 hover:text-blue-400 w-6 h-6" title="Właściwości" @click.stop="openProps(obj.id)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
          </button>
          <button class="btn-icon text-slate-500 hover:text-green-400 w-6 h-6" title="Duplikuj" @click.stop="duplicate(obj.id)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </button>
          <button class="btn-icon text-slate-500 hover:text-red-400 w-6 h-6" title="Usuń" @click.stop="remove(obj.id)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>

      <div v-if="store.state.objects.length === 0" class="text-center text-slate-500 text-sm py-8">
        Brak elementów.<br />Kliknij + aby dodać.
      </div>
    </div>

    <!-- Add Object Dialog -->
    <AddObjectDialog
      v-if="showAdd"
      @close="showAdd = false"
      @created="showAdd = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useAppStore } from "../composables/useAppStore";
import AddObjectDialog from "./AddObjectDialog.vue";

const store = useAppStore();
const showAdd = ref(false);

function isSelected(id: string) {
  return store.state.selectedObjectIds.includes(id);
}

function selectObj(id: string, e: MouseEvent) {
  store.selectObject(id, e.ctrlKey || e.metaKey || e.shiftKey);
  store.setActivePanel("object-props");
}

function openProps(id: string) {
  store.selectObject(id, false);
  store.setActivePanel("object-props");
}

async function duplicate(id: string) {
  await store.duplicateObject(id);
}

async function remove(id: string) {
  if (confirm("Usunąć ten element?")) {
    await store.deleteObject(id);
  }
}
</script>
