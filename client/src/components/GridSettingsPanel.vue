<template>
  <div class="flex flex-col h-full">
    <div class="panel-section">
      <h2 class="text-sm font-semibold text-slate-200">Ustawienia siatki</h2>
    </div>

    <div class="flex-1 overflow-y-auto p-3 space-y-4">
      <!-- Visibility -->
      <div class="flex items-center justify-between">
        <label class="text-sm text-slate-300">Widoczna siatka</label>
        <button
          class="relative w-10 h-5 rounded-full transition-colors"
          :class="store.state.grid.visible ? 'bg-blue-600' : 'bg-slate-600'"
          @click="toggle('visible', !store.state.grid.visible)"
        >
          <div
            class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
            :class="store.state.grid.visible ? 'translate-x-5' : 'translate-x-0.5'"
          />
        </button>
      </div>

      <!-- Unit selector -->
      <div>
        <label class="label-text block mb-2">Jednostka</label>
        <div class="flex rounded overflow-hidden border border-slate-600">
          <button
            class="flex-1 py-1.5 text-sm transition-colors"
            :class="store.state.grid.unit === 'mm' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'"
            @click="setUnit('mm')"
          >mm</button>
          <button
            class="flex-1 py-1.5 text-sm transition-colors"
            :class="store.state.grid.unit === 'cm' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'"
            @click="setUnit('cm')"
          >cm</button>
        </div>
      </div>

      <!-- Grid size per axis -->
      <div class="space-y-3">
        <div class="label-text">Rozmiar komórki siatki</div>

        <div v-for="axis in axes" :key="axis.key">
          <label class="text-sm text-slate-400 block mb-1">
            Oś {{ axis.label }} – {{ displayValue(axis.key) }} {{ store.state.grid.unit }}
          </label>
          <input
            :value="displayValue(axis.key)"
            type="range"
            :min="store.state.grid.unit === 'mm' ? 10 : 1"
            :max="store.state.grid.unit === 'mm' ? 500 : 50"
            :step="store.state.grid.unit === 'mm' ? 10 : 1"
            class="w-full accent-blue-500"
            @input="onRange(axis.key, $event)"
          />
          <div class="flex justify-between text-xs text-slate-600 mt-0.5">
            <span>{{ store.state.grid.unit === 'mm' ? '10mm' : '1cm' }}</span>
            <span>{{ store.state.grid.unit === 'mm' ? '500mm' : '50cm' }}</span>
          </div>
        </div>
      </div>

      <!-- Quick presets -->
      <div>
        <div class="label-text mb-2">Szybkie ustawienia</div>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="preset in presets"
            :key="preset.label"
            class="text-xs px-2 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            @click="applyPreset(preset)"
          >
            {{ preset.label }}
          </button>
        </div>
      </div>

      <!-- Info -->
      <div class="rounded-lg bg-slate-800/50 p-3 text-xs text-slate-500 space-y-1">
        <div>Aktualny rozmiar siatki:</div>
        <div>X: {{ store.state.grid.sizeX }}mm ({{ (store.state.grid.sizeX / 10).toFixed(1) }}cm)</div>
        <div>Y: {{ store.state.grid.sizeY }}mm ({{ (store.state.grid.sizeY / 10).toFixed(1) }}cm)</div>
        <div>Z: {{ store.state.grid.sizeZ }}mm ({{ (store.state.grid.sizeZ / 10).toFixed(1) }}cm)</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "../composables/useAppStore";
import type { GridConfig } from "../types";

const store = useAppStore();

const axes = [
  { key: "sizeX" as keyof GridConfig, label: "X" },
  { key: "sizeY" as keyof GridConfig, label: "Y" },
  { key: "sizeZ" as keyof GridConfig, label: "Z" },
];

const presets = [
  { label: "10mm", sizeX: 10, sizeY: 10, sizeZ: 10 },
  { label: "50mm", sizeX: 50, sizeY: 50, sizeZ: 50 },
  { label: "100mm", sizeX: 100, sizeY: 100, sizeZ: 100 },
  { label: "200mm", sizeX: 200, sizeY: 200, sizeZ: 200 },
  { label: "500mm", sizeX: 500, sizeY: 500, sizeZ: 500 },
  { label: "1cm", sizeX: 10, sizeY: 10, sizeZ: 10 },
];

function displayValue(key: keyof GridConfig): number {
  const v = store.state.grid[key] as number;
  return store.state.grid.unit === "cm" ? v / 10 : v;
}

function toggle(key: keyof GridConfig, val: boolean) {
  store.setGridConfig({ [key]: val } as any);
}

function setUnit(unit: "mm" | "cm") {
  store.setGridConfig({ unit });
}

function onRange(key: keyof GridConfig, e: Event) {
  let val = parseFloat((e.target as HTMLInputElement).value);
  if (store.state.grid.unit === "cm") val = val * 10; // convert to mm
  store.setGridConfig({ [key]: val } as any);
}

function applyPreset(p: { sizeX: number; sizeY: number; sizeZ: number }) {
  store.setGridConfig({ sizeX: p.sizeX, sizeY: p.sizeY, sizeZ: p.sizeZ });
}
</script>
