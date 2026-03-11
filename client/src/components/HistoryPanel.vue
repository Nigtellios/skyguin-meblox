<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="panel-section flex items-center justify-between">
      <div class="flex items-center gap-2">
        <svg class="text-amber-400" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 3a9 9 0 1 0 0 18A9 9 0 0 0 13 3zm-1 5h1.5l.5 5 3.5 2.1-.75 1.3L13 14.27V8zM3 13c0-4.08 2.91-7.47 6.74-8.24L10 6.26A7 7 0 0 0 5 13H3z"/>
        </svg>
        <h2 class="text-sm font-semibold text-slate-200">Historia zmian</h2>
      </div>
    </div>

    <!-- History list -->
    <div class="flex-1 overflow-y-auto">
      <div
        v-if="historyEntries.length === 0"
        class="flex flex-col items-center justify-center h-40 text-slate-500 gap-2 p-6 text-center"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" class="opacity-30">
          <path d="M13 3a9 9 0 1 0 0 18A9 9 0 0 0 13 3zm-1 5h1.5l.5 5 3.5 2.1-.75 1.3L13 14.27V8z"/>
        </svg>
        <div class="text-sm">Brak historii zmian.<br/>Wykonaj akcję, aby ją zarejestrować.</div>
      </div>

      <div v-else class="py-1">
        <div
          v-for="(entry, index) in reversedEntries"
          :key="entry.id"
          class="relative"
        >
          <!-- Timeline line -->
          <div
            v-if="index < reversedEntries.length - 1"
            class="absolute left-8 top-10 bottom-0 w-px bg-slate-700/50"
          />

          <!-- Entry -->
          <button
            class="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-700/40 transition-colors text-left"
            :class="[
              selectedHistoryId === entry.id ? 'bg-amber-900/20' : '',
              isGrayed(entry) ? 'opacity-40' : '',
            ]"
            @click="onSelectEntry(entry.id)"
          >
            <!-- Icon dot -->
            <div
              class="mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 z-10"
              :class="
                selectedHistoryId === entry.id
                  ? 'bg-amber-500 border-amber-400'
                  : isGrayed(entry)
                    ? 'bg-slate-700 border-slate-600'
                    : 'bg-blue-600 border-blue-400'
              "
            />

            <div class="flex-1 min-w-0">
              <div
                class="text-xs font-medium truncate"
                :class="isGrayed(entry) ? 'text-slate-500' : 'text-slate-200'"
              >
                {{ entry.action_label }}
              </div>
              <div class="text-xs text-slate-500 mt-0.5">
                {{ formatTime(entry.created_at) }}
              </div>
            </div>
          </button>

          <!-- Revert button shown below selected entry -->
          <div
            v-if="selectedHistoryId === entry.id"
            class="mx-4 mb-3 -mt-1"
          >
            <button
              class="w-full btn-primary text-xs py-2 flex items-center justify-center gap-1.5"
              @click="onRevert(entry.id)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
              </svg>
              Cofnij do tego momentu
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useAppStore } from "../composables/useAppStore";
import type { HistoryEntry } from "../types";

const store = useAppStore();

const selectedHistoryId = ref<string | null>(null);

const historyEntries = computed(() => store.state.historyEntries);

const reversedEntries = computed(() => [...historyEntries.value].reverse());

function isGrayed(entry: HistoryEntry) {
  if (!selectedHistoryId.value) return false;
  const selectedIndex = historyEntries.value.findIndex(
    (e) => e.id === selectedHistoryId.value,
  );
  const entryIndex = historyEntries.value.findIndex((e) => e.id === entry.id);
  return entryIndex > selectedIndex;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "numeric",
    month: "short",
  });
}

function onSelectEntry(id: string) {
  selectedHistoryId.value = selectedHistoryId.value === id ? null : id;
}

async function onRevert(historyId: string) {
  const confirmed = confirm(
    "Historia zostanie zresetowana do tego momentu. Wszystkie późniejsze zmiany zostaną usunięte. Czy jesteś pewny?",
  );
  if (!confirmed) return;
  await store.revertToHistory(historyId);
  selectedHistoryId.value = null;
}
</script>
