<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="panel-section flex items-center gap-2">
      <button class="btn-icon" @click="$emit('back')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
      </button>
      <h2 class="text-sm font-semibold text-slate-200 flex-1 truncate">{{ template.name }}</h2>
    </div>

    <div class="flex-1 overflow-y-auto p-3 space-y-4">
      <!-- Basic info -->
      <div class="space-y-2">
        <div>
          <label class="label-text block mb-1">Nazwa</label>
          <input
            :value="template.name"
            class="input-field"
            @change="save('name', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div>
          <label class="label-text block mb-1">Kolor bazowy</label>
          <div class="flex gap-2">
            <input
              :value="template.base_color"
              type="color"
              class="w-10 h-8 rounded cursor-pointer border border-slate-600 bg-transparent"
              @input="save('base_color', ($event.target as HTMLInputElement).value)"
            />
            <input
              :value="template.base_color"
              class="input-field font-mono"
              @change="save('base_color', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </div>

      <!-- Panel face diagram -->
      <div>
        <div class="label-text mb-3">Boki i warstwy</div>

        <!-- Visual face selector: 3x3 grid -->
        <div class="grid grid-cols-3 gap-1.5 max-w-48 mx-auto">
          <!-- Top row: empty, top, empty -->
          <div />
          <SideTile side="top" :layers="layersFor('top')" @add="addLayer('top')" @click="selectedSide = 'top'" :active="selectedSide === 'top'" />
          <div />

          <!-- Middle row: left, center (panel), right -->
          <SideTile side="left" :layers="layersFor('left')" @add="addLayer('left')" @click="selectedSide = 'left'" :active="selectedSide === 'left'" />
          <div class="rounded border-2 border-slate-500 bg-slate-700/40 flex items-center justify-center aspect-square">
            <span class="text-xs text-slate-400">Płyta</span>
          </div>
          <SideTile side="right" :layers="layersFor('right')" @add="addLayer('right')" @click="selectedSide = 'right'" :active="selectedSide === 'right'" />

          <!-- Bottom row: empty, bottom, empty -->
          <div />
          <SideTile side="bottom" :layers="layersFor('bottom')" @add="addLayer('bottom')" @click="selectedSide = 'bottom'" :active="selectedSide === 'bottom'" />
          <div />
        </div>

        <!-- Front/Back row -->
        <div class="grid grid-cols-2 gap-1.5 max-w-48 mx-auto mt-1.5">
          <SideTile side="front" :layers="layersFor('front')" @add="addLayer('front')" @click="selectedSide = 'front'" :active="selectedSide === 'front'" />
          <SideTile side="back" :layers="layersFor('back')" @add="addLayer('back')" @click="selectedSide = 'back'" :active="selectedSide === 'back'" />
        </div>
      </div>

      <!-- Layer editor for selected side -->
      <div v-if="selectedSide">
        <div class="flex items-center justify-between mb-2">
          <div class="label-text">{{ sideLabel }} – warstwy</div>
          <button class="text-xs text-green-400 hover:text-green-300 flex items-center gap-1" @click="openAddLayer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/></svg>
            Dodaj
          </button>
        </div>

        <div class="space-y-1">
          <div
            v-for="layer in layersFor(selectedSide)"
            :key="layer.id"
            class="flex items-center gap-2 p-2 rounded bg-slate-800/50 group"
          >
            <div class="w-4 h-4 rounded shrink-0 border border-slate-600" :style="{ backgroundColor: layer.color }" />
            <div class="flex-1 min-w-0">
              <div class="text-xs text-slate-300">{{ layerTypeLabel(layer.layer_type) }}</div>
              <div class="text-xs text-slate-500">{{ layer.thickness }} mm {{ layer.is_bilateral ? '(obustronne)' : '' }}</div>
            </div>
            <input
              :value="layer.color"
              type="color"
              class="w-6 h-6 rounded cursor-pointer bg-transparent border border-slate-600"
              @input="updateLayer(layer.id, { color: ($event.target as HTMLInputElement).value })"
            />
            <input
              :value="layer.thickness"
              type="number"
              min="0.1"
              step="0.1"
              class="w-14 input-field text-xs"
              @change="updateLayer(layer.id, { thickness: parseFloat(($event.target as HTMLInputElement).value) })"
            />
            <button class="btn-icon text-red-500 opacity-0 group-hover:opacity-100 w-6 h-6" @click="removeLayer(layer.id)">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </div>

          <div v-if="!layersFor(selectedSide).length" class="text-xs text-slate-600 text-center py-3">
            Brak warstw. Kliknij "Dodaj".
          </div>
        </div>
      </div>

      <!-- Add Layer dialog -->
      <div v-if="showAddLayerForm" class="rounded-lg bg-slate-800 p-3 space-y-2 border border-slate-600">
        <div class="label-text mb-1">Nowa warstwa – {{ sideLabel }}</div>

        <div>
          <label class="text-xs text-slate-500 block mb-1">Typ warstwy</label>
          <select v-model="newLayer.layer_type" class="input-field">
            <option v-for="(label, key) in layerTypes" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div class="flex gap-2">
          <div class="flex-1">
            <label class="text-xs text-slate-500 block mb-1">Kolor</label>
            <div class="flex gap-1">
              <input v-model="newLayer.color" type="color" class="w-8 h-7 rounded cursor-pointer border border-slate-600 bg-transparent" />
              <input v-model="newLayer.color" class="input-field font-mono text-xs" />
            </div>
          </div>
          <div class="w-24">
            <label class="text-xs text-slate-500 block mb-1">Grubość (mm)</label>
            <input v-model.number="newLayer.thickness" type="number" min="0.1" step="0.1" class="input-field" />
          </div>
        </div>
        <div class="flex items-center gap-2">
          <input id="bilateral" type="checkbox" v-model="newLayer.is_bilateral" class="rounded" />
          <label for="bilateral" class="text-xs text-slate-400 cursor-pointer">
            Dwustronne (automatycznie dodaj na przeciwległą stronę: {{ oppositeSideLabel }})
          </label>
        </div>
        <div class="flex gap-2 justify-end">
          <button class="btn-secondary text-xs" @click="showAddLayerForm = false">Anuluj</button>
          <button class="btn-primary text-xs" @click="submitAddLayer">Dodaj warstwę</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { api } from "../../composables/useApi";
import type {
  LayerType,
  MaterialLayer,
  MaterialTemplate,
  Side,
} from "../../types";
import { LAYER_TYPE_LABELS, OPPOSITE_SIDES, SIDE_LABELS } from "../../types";
import SideTile from "../SideTile/SideTile.vue";

type ReadonlyMaterialTemplate = Readonly<Omit<MaterialTemplate, "layers">> & {
  readonly layers: readonly MaterialLayer[];
};

const props = defineProps<{ template: ReadonlyMaterialTemplate }>();
const emit = defineEmits<{ back: []; reload: [] }>();

const selectedSide = ref<Side | null>(null);
const showAddLayerForm = ref(false);

const newLayer = reactive({
  layer_type: "veneer" as LayerType,
  color: "#D4A574",
  thickness: 0.5,
  is_bilateral: false,
});

const layerTypes = LAYER_TYPE_LABELS;

const sideLabel = computed(() =>
  selectedSide.value ? SIDE_LABELS[selectedSide.value] : "",
);
const oppositeSideLabel = computed(() =>
  selectedSide.value ? SIDE_LABELS[OPPOSITE_SIDES[selectedSide.value]] : "",
);

function layersFor(side: Side) {
  return props.template.layers.filter((layer) => layer.side === side);
}

function layerTypeLabel(type: string): string {
  return LAYER_TYPE_LABELS[type as LayerType] ?? type;
}

type MaterialTemplateField = "name" | "description" | "base_color";

async function save(field: MaterialTemplateField, value: string) {
  await api.materials.update(props.template.id, { [field]: value });
  emit("reload");
}

function addLayer(side: Side) {
  selectedSide.value = side;
  showAddLayerForm.value = true;
}

function openAddLayer() {
  showAddLayerForm.value = true;
}

async function submitAddLayer() {
  if (!selectedSide.value) return;
  await api.materials.layers.create(props.template.id, {
    side: selectedSide.value,
    layer_type: newLayer.layer_type,
    color: newLayer.color,
    thickness: newLayer.thickness,
    is_bilateral: newLayer.is_bilateral,
  });
  showAddLayerForm.value = false;
  emit("reload");
}

async function updateLayer(layerId: string, data: Partial<MaterialLayer>) {
  await api.materials.layers.update(props.template.id, layerId, data);
  emit("reload");
}

async function removeLayer(layerId: string) {
  await api.materials.layers.delete(props.template.id, layerId);
  emit("reload");
}
</script>
