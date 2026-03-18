<template>
  <div class="flex flex-col h-full">
    <div class="panel-section flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-200">Komponenty</h2>
      <button
        class="btn-icon text-green-400"
        :disabled="store.state.selectedObjectIds.length < 2"
        :title="store.state.selectedObjectIds.length < 2 ? 'Zaznacz min. 2 elementy' : 'Utwórz komponent'"
        @click="createComp"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/></svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-2 space-y-1">
      <!-- Info banner -->
      <div class="rounded-lg bg-slate-800/50 p-3 text-xs text-slate-500 mb-2">
        <div class="font-medium text-slate-400 mb-1">Czym są komponenty?</div>
        Zaznacz kilka elementów (kliknij pierwszy, potem <kbd class="rounded bg-slate-700 px-1 text-slate-300">Ctrl</kbd>+kliknij kolejne) i kliknij + aby połączyć je w komponent.
        Pozycja i parametry są synchronizowane – elementy poruszają się razem jako jeden obiekt.
        Zmiana wymiarów jednego elementu zsynchronizuje wszystkie pozostałe
        (chyba że mają tryb "edytuj osobno").
      </div>

      <!-- Component list -->
      <div
        v-for="group in store.state.componentGroups"
        :key="group.id"
        class="rounded-lg border border-slate-700 bg-slate-800/30 overflow-hidden"
      >
        <div class="flex items-center justify-between px-3 py-2 bg-slate-800/50">
          <div>
            <div class="text-sm font-medium text-slate-200">{{ group.name }}</div>
            <div class="text-xs text-slate-500">{{ membersOf(group.id).length }} elementów</div>
          </div>
          <button class="btn-icon text-red-500 w-6 h-6" @click="removeGroup(group.id)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>

        <!-- Members -->
        <div class="px-3 pb-2 pt-1 space-y-1">
          <div
            v-for="obj in membersOf(group.id)"
            :key="obj.id"
            class="flex items-center gap-2 text-xs"
          >
            <div class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: obj.color }" />
            <span class="flex-1 truncate text-slate-300">{{ obj.name }}</span>
            <span
              class="px-1 py-0.5 rounded text-xs"
              :class="obj.is_independent ? 'bg-yellow-900/40 text-yellow-400' : 'bg-purple-900/40 text-purple-400'"
            >
              {{ obj.is_independent ? 'osobno' : 'sync' }}
            </span>
            <button
              class="text-slate-500 hover:text-blue-400"
              @click="store.selectObject(obj.id, false); store.setActivePanel('object-props')"
              title="Otwórz właściwości"
            >→</button>
          </div>
        </div>
      </div>

      <div v-if="!store.state.componentGroups.length" class="text-center text-slate-500 text-sm py-8">
        Brak komponentów.<br/>Zaznacz 2+ elementy i kliknij +.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "../composables/useAppStore";

const store = useAppStore();

function membersOf(groupId: string) {
  return store.state.objects.filter((o) => o.component_id === groupId);
}

async function createComp() {
  if (store.state.selectedObjectIds.length < 2) return;
  const name = prompt("Nazwa komponentu:", "Nowy komponent");
  if (!name?.trim()) return;
  await store.createComponent(name.trim(), [...store.state.selectedObjectIds]);
}

async function removeGroup(id: string) {
  if (confirm("Rozwiązać komponent? Elementy zostaną zachowane.")) {
    await store.deleteComponent(id);
  }
}
</script>
