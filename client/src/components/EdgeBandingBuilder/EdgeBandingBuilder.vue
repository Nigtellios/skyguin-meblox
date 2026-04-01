<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      @click.self="onClose"
    >
      <div
        class="relative panel-glass rounded-xl shadow-2xl border border-slate-700 flex flex-col"
        style="width: 90vw; height: 90vh; max-width: 1400px; max-height: 900px"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 class="text-lg font-semibold text-slate-100">
              Oklejanie — {{ obj.name }}
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">
              Wymiary bazowe: {{ obj.width }} × {{ obj.height }} × {{ obj.depth }} mm
              <span v-if="hasAnyBanding" class="text-blue-400 ml-2">
                → Efektywne: {{ effectiveWidth.toFixed(1) }} × {{ effectiveHeight.toFixed(1) }} × {{ effectiveDepth.toFixed(1) }} mm
              </span>
            </p>
          </div>
          <button
            class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
            title="Zamknij (zapisuje)"
            @click="onClose"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 flex overflow-hidden">
          <!-- Left: 2D Preview -->
          <div class="flex-1 flex flex-col items-center justify-center p-6">
            <!-- View toggle -->
            <div class="flex gap-2 mb-4">
              <button
                class="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                :class="viewMode === 'front' ? 'bg-blue-600 text-white' : 'bg-slate-700/60 text-slate-400 hover:bg-slate-600'"
                @click="viewMode = 'front'"
              >
                Front
              </button>
              <button
                class="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                :class="viewMode === 'back' ? 'bg-blue-600 text-white' : 'bg-slate-700/60 text-slate-400 hover:bg-slate-600'"
                @click="viewMode = 'back'"
              >
                Rewers
              </button>
            </div>

            <!-- 2D Object Preview with detached edges -->
            <div class="relative" :style="previewContainerStyle">
              <!-- Main body -->
              <div
                class="absolute border-2 border-slate-500 rounded"
                :style="mainBodyStyle"
                :class="selectedEdge === (viewMode === 'front' ? 'front' : 'back') ? 'bg-blue-900/40 border-blue-500' : 'bg-slate-800/60'"
                @click="selectEdge(viewMode === 'front' ? 'front' : 'back')"
              >
                <span class="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                  {{ viewMode === 'front' ? 'Front' : 'Rewers' }}
                  <template v-if="(viewMode === 'front' ? config.frontThickness : config.backThickness) > 0">
                    <br/>{{ (viewMode === 'front' ? config.frontThickness : config.backThickness) }}mm
                  </template>
                </span>
              </div>

              <!-- Top edge -->
              <div
                class="absolute border-2 rounded cursor-pointer transition-colors"
                :style="topEdgeStyle"
                :class="selectedEdge === 'top' ? 'bg-amber-900/50 border-amber-500' : (config.topThickness > 0 ? 'bg-amber-900/20 border-amber-600/50' : 'bg-slate-800/40 border-slate-600/50 border-dashed')"
                @click="selectEdge('top')"
              >
                <span class="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                  Góra {{ config.topThickness > 0 ? `${config.topThickness}mm` : '' }}
                </span>
              </div>

              <!-- Bottom edge -->
              <div
                class="absolute border-2 rounded cursor-pointer transition-colors"
                :style="bottomEdgeStyle"
                :class="selectedEdge === 'bottom' ? 'bg-amber-900/50 border-amber-500' : (config.bottomThickness > 0 ? 'bg-amber-900/20 border-amber-600/50' : 'bg-slate-800/40 border-slate-600/50 border-dashed')"
                @click="selectEdge('bottom')"
              >
                <span class="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                  Dół {{ config.bottomThickness > 0 ? `${config.bottomThickness}mm` : '' }}
                </span>
              </div>

              <!-- Left edge -->
              <div
                class="absolute border-2 rounded cursor-pointer transition-colors"
                :style="leftEdgeStyle"
                :class="selectedEdge === 'left' ? 'bg-amber-900/50 border-amber-500' : (config.leftThickness > 0 ? 'bg-amber-900/20 border-amber-600/50' : 'bg-slate-800/40 border-slate-600/50 border-dashed')"
                @click="selectEdge('left')"
              >
                <span class="absolute inset-0 flex items-center justify-center text-xs text-slate-400 [writing-mode:vertical-lr]">
                  Lewo {{ config.leftThickness > 0 ? `${config.leftThickness}mm` : '' }}
                </span>
              </div>

              <!-- Right edge -->
              <div
                class="absolute border-2 rounded cursor-pointer transition-colors"
                :style="rightEdgeStyle"
                :class="selectedEdge === 'right' ? 'bg-amber-900/50 border-amber-500' : (config.rightThickness > 0 ? 'bg-amber-900/20 border-amber-600/50' : 'bg-slate-800/40 border-slate-600/50 border-dashed')"
                @click="selectEdge('right')"
              >
                <span class="absolute inset-0 flex items-center justify-center text-xs text-slate-400 [writing-mode:vertical-lr]">
                  Prawo {{ config.rightThickness > 0 ? `${config.rightThickness}mm` : '' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Right: Settings panel -->
          <div class="w-72 border-l border-slate-700 p-4 overflow-y-auto space-y-4">
            <h3 class="text-sm font-semibold text-slate-200">
              {{ selectedEdge ? edgeLabels[selectedEdge] : 'Wybierz krawędź' }}
            </h3>

            <template v-if="selectedEdge">
              <!-- Thickness -->
              <div>
                <label class="text-xs text-slate-400 block mb-1">
                  Grubość {{ selectedEdge === 'front' || selectedEdge === 'back' ? 'okleiny' : 'obrzeża' }} (mm)
                </label>
                <input
                  :value="getThickness(selectedEdge)"
                  type="number"
                  min="0"
                  step="0.1"
                  class="w-full px-3 py-2 rounded-lg bg-slate-700/60 text-slate-200 border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
                  @change="onThicknessChange(selectedEdge, $event)"
                />
                <!-- Quick presets -->
                <div class="flex gap-1 mt-1 flex-wrap">
                  <button
                    v-for="preset in thicknessPresets"
                    :key="preset"
                    class="px-2 py-0.5 rounded text-xs transition-colors"
                    :class="getThickness(selectedEdge) === preset ? 'bg-blue-600 text-white' : 'bg-slate-700/60 text-slate-400 hover:bg-slate-600'"
                    @click="setThickness(selectedEdge, preset)"
                  >
                    {{ preset }}mm
                  </button>
                </div>
              </div>

              <!-- Color -->
              <div>
                <label class="text-xs text-slate-400 block mb-1">Kolor</label>
                <div class="flex items-center gap-2">
                  <input
                    :value="getColor(selectedEdge)"
                    type="color"
                    class="w-10 h-8 rounded cursor-pointer border border-slate-600 bg-transparent"
                    @input="onColorChange(selectedEdge, $event)"
                  />
                  <input
                    :value="getColor(selectedEdge)"
                    class="flex-1 px-3 py-2 rounded-lg bg-slate-700/60 text-slate-200 border border-slate-600 focus:border-blue-500 focus:outline-none text-sm font-mono"
                    @change="onColorChange(selectedEdge, $event)"
                  />
                </div>
              </div>

              <!-- Remove -->
              <button
                v-if="getThickness(selectedEdge) > 0"
                class="w-full px-3 py-1.5 rounded-lg text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors"
                @click="setThickness(selectedEdge, 0)"
              >
                Usuń oklejanie
              </button>
            </template>

            <!-- Summary -->
            <div class="border-t border-slate-700 pt-3 space-y-1">
              <h4 class="text-xs font-semibold text-slate-300 mb-2">Podsumowanie</h4>
              <div v-for="edge in allEdges" :key="edge" class="flex justify-between text-xs">
                <span class="text-slate-400">{{ edgeLabels[edge] }}:</span>
                <span :class="getThickness(edge) > 0 ? 'text-amber-400' : 'text-slate-600'">
                  {{ getThickness(edge) > 0 ? `${getThickness(edge)}mm` : '—' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { MaterialType } from "../../lib/materialTypes";
import { EDGE_BANDING_MATERIALS } from "../../lib/materialTypes";
import type { EdgeBandingConfig, FurnitureObject } from "../../types";
import { DEFAULT_EDGE_BANDING } from "../../types";

const props = defineProps<{
  obj: FurnitureObject;
}>();

const emit = defineEmits<{
  save: [config: EdgeBandingConfig];
  close: [];
}>();

type EdgeKey = "front" | "back" | "top" | "bottom" | "left" | "right";

const allEdges: EdgeKey[] = ["front", "back", "top", "bottom", "left", "right"];

const edgeLabels: Record<EdgeKey, string> = {
  front: "Front (przód)",
  back: "Rewers (tył)",
  top: "Górna krawędź",
  bottom: "Dolna krawędź",
  left: "Lewa krawędź",
  right: "Prawa krawędź",
};

const thicknessPresets = [0, 0.4, 0.5, 1, 1.5, 2];

// Parse existing config or use defaults
const initialConfig: EdgeBandingConfig = props.obj.edge_banding_json
  ? { ...DEFAULT_EDGE_BANDING, ...JSON.parse(props.obj.edge_banding_json) }
  : { ...DEFAULT_EDGE_BANDING };

const config = reactive<EdgeBandingConfig>({ ...initialConfig });

const viewMode = ref<"front" | "back">("front");
const selectedEdge = ref<EdgeKey | null>(null);

const hasAnyBanding = computed(
  () =>
    config.frontThickness > 0 ||
    config.backThickness > 0 ||
    config.topThickness > 0 ||
    config.bottomThickness > 0 ||
    config.leftThickness > 0 ||
    config.rightThickness > 0,
);

const effectiveWidth = computed(
  () => props.obj.width + config.leftThickness + config.rightThickness,
);
const effectiveHeight = computed(
  () => props.obj.height + config.topThickness + config.bottomThickness,
);
const effectiveDepth = computed(
  () => props.obj.depth + config.frontThickness + config.backThickness,
);

// 2D preview sizing
const PREVIEW_W = 350;
const PREVIEW_H = 300;
const EDGE_GAP = 12;
const EDGE_THICKNESS = 24;

const previewContainerStyle = computed(() => ({
  width: `${PREVIEW_W + EDGE_THICKNESS * 2 + EDGE_GAP * 2}px`,
  height: `${PREVIEW_H + EDGE_THICKNESS * 2 + EDGE_GAP * 2}px`,
}));

const mainBodyStyle = computed(() => ({
  left: `${EDGE_THICKNESS + EDGE_GAP}px`,
  top: `${EDGE_THICKNESS + EDGE_GAP}px`,
  width: `${PREVIEW_W}px`,
  height: `${PREVIEW_H}px`,
}));

const topEdgeStyle = computed(() => ({
  left: `${EDGE_THICKNESS + EDGE_GAP}px`,
  top: "0px",
  width: `${PREVIEW_W}px`,
  height: `${EDGE_THICKNESS}px`,
}));

const bottomEdgeStyle = computed(() => ({
  left: `${EDGE_THICKNESS + EDGE_GAP}px`,
  bottom: "0px",
  width: `${PREVIEW_W}px`,
  height: `${EDGE_THICKNESS}px`,
}));

const leftEdgeStyle = computed(() => ({
  left: "0px",
  top: `${EDGE_THICKNESS + EDGE_GAP}px`,
  width: `${EDGE_THICKNESS}px`,
  height: `${PREVIEW_H}px`,
}));

const rightEdgeStyle = computed(() => ({
  right: "0px",
  top: `${EDGE_THICKNESS + EDGE_GAP}px`,
  width: `${EDGE_THICKNESS}px`,
  height: `${PREVIEW_H}px`,
}));

function selectEdge(edge: EdgeKey) {
  selectedEdge.value = edge;
}

function getThickness(edge: EdgeKey): number {
  return config[`${edge}Thickness`];
}

function getColor(edge: EdgeKey): string {
  return config[`${edge}Color`];
}

function setThickness(edge: EdgeKey, value: number) {
  config[`${edge}Thickness`] = value;
  saveConfig();
}

function onThicknessChange(edge: EdgeKey, e: Event) {
  const val = Number.parseFloat((e.target as HTMLInputElement).value);
  if (!Number.isNaN(val) && val >= 0) {
    config[`${edge}Thickness`] = val;
    saveConfig();
  }
}

function onColorChange(edge: EdgeKey, e: Event) {
  config[`${edge}Color`] = (e.target as HTMLInputElement).value;
  saveConfig();
}

function saveConfig() {
  emit("save", { ...config });
}

function onClose() {
  saveConfig();
  emit("close");
}

// Check if the material supports edge banding
const supportsEdgeBanding = computed(() =>
  EDGE_BANDING_MATERIALS.has(
    (props.obj.material_type ?? "wood") as MaterialType,
  ),
);
</script>
