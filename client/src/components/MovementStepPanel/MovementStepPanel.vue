<template>
  <div class="p-4 space-y-4 text-sm text-slate-200">
    <h3 class="text-base font-semibold text-slate-100 mb-2">Ustawienia skoku ruchu</h3>

    <!-- Mode selector -->
    <div class="space-y-2">
      <label class="text-xs text-slate-400">Tryb:</label>
      <div class="flex gap-2">
        <button
          class="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          :class="
            stepConfig.mode === 'shared'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700/60 text-slate-400 hover:bg-slate-600'
          "
          @click="setMode('shared')"
        >
          Skok wspólny
        </button>
        <button
          class="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          :class="
            stepConfig.mode === 'custom'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700/60 text-slate-400 hover:bg-slate-600'
          "
          @click="setMode('custom')"
        >
          Skok niestandardowy
        </button>
      </div>
    </div>

    <!-- Shared step -->
    <div v-if="stepConfig.mode === 'shared'" class="space-y-2">
      <label class="text-xs text-slate-400">Skok dla wszystkich osi (mm):</label>
      <input
        :value="stepConfig.sharedStep"
        type="number"
        min="0.001"
        step="0.1"
        class="w-full px-3 py-2 rounded-lg bg-slate-700/60 text-slate-200 border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
        @change="onSharedStepChange"
      />
      <!-- Quick presets -->
      <div class="flex gap-1 flex-wrap">
        <button
          v-for="preset in STEP_PRESETS"
          :key="preset"
          class="px-2 py-1 rounded text-xs transition-colors"
          :class="
            stepConfig.sharedStep === preset
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700/60 text-slate-400 hover:bg-slate-600'
          "
          @click="setSharedStep(preset)"
        >
          {{ preset }}mm
        </button>
      </div>
    </div>

    <!-- Custom per-axis steps -->
    <div v-else class="space-y-3">
      <div>
        <label class="text-xs text-slate-400">Skok oś X (mm):</label>
        <input
          :value="stepConfig.stepX"
          type="number"
          min="0.001"
          step="0.1"
          class="w-full px-3 py-2 rounded-lg bg-slate-700/60 text-slate-200 border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
          @change="onAxisStepChange('stepX', $event)"
        />
      </div>
      <div>
        <label class="text-xs text-slate-400">Skok oś Y — góra/dół (mm):</label>
        <input
          :value="stepConfig.stepY"
          type="number"
          min="0.001"
          step="0.1"
          class="w-full px-3 py-2 rounded-lg bg-slate-700/60 text-slate-200 border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
          @change="onAxisStepChange('stepY', $event)"
        />
      </div>
      <div>
        <label class="text-xs text-slate-400">Skok oś Z (mm):</label>
        <input
          :value="stepConfig.stepZ"
          type="number"
          min="0.001"
          step="0.1"
          class="w-full px-3 py-2 rounded-lg bg-slate-700/60 text-slate-200 border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
          @change="onAxisStepChange('stepZ', $event)"
        />
      </div>
    </div>

    <!-- Info -->
    <div class="text-xs text-slate-500 mt-2 space-y-1">
      <p>Skok dotyczy klawiszy: ↑↓←→, R (góra), F (dół)</p>
      <p>Aktualny skok X: <span class="text-slate-300">{{ store.getStepForAxis('X') }}mm</span></p>
      <p>Aktualny skok Y: <span class="text-slate-300">{{ store.getStepForAxis('Y') }}mm</span></p>
      <p>Aktualny skok Z: <span class="text-slate-300">{{ store.getStepForAxis('Z') }}mm</span></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useAppStore } from "../../composables/useAppStore";
import type { MovementStepMode } from "../../types";

const store = useAppStore();

const STEP_PRESETS = [0.1, 0.5, 1, 2, 5, 10, 50, 100];

const stepConfig = computed(() => store.state.movementStep);

function setMode(mode: MovementStepMode) {
  store.setMovementStepConfig({ mode });
}

function setSharedStep(value: number) {
  store.setMovementStepConfig({ sharedStep: value });
}

function onSharedStepChange(e: Event) {
  const val = Number.parseFloat((e.target as HTMLInputElement).value);
  if (!Number.isNaN(val) && val > 0) {
    store.setMovementStepConfig({ sharedStep: val });
  }
}

function onAxisStepChange(field: "stepX" | "stepY" | "stepZ", e: Event) {
  const val = Number.parseFloat((e.target as HTMLInputElement).value);
  if (!Number.isNaN(val) && val > 0) {
    store.setMovementStepConfig({ [field]: val });
  }
}
</script>
