<template>
  <div class="flex flex-col h-full" v-if="obj">
    <!-- Header -->
    <div class="panel-section flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-200 truncate">{{ obj.name }}</h2>
      <div class="flex items-center gap-1">
        <button class="btn-icon text-green-400" title="Duplikuj" @click="onDuplicate">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        </button>
        <button class="btn-icon text-red-400" title="Usuń" @click="onDelete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <!-- Name -->
      <div class="panel-section">
        <label class="label-text block mb-1">Nazwa</label>
        <input
          :value="obj.name"
          class="input-field"
          @change="updateObjectField('name', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <!-- Dimensions -->
      <div class="panel-section">
        <div class="label-text mb-2">Wymiary (mm)</div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="text-xs text-slate-500 block mb-1">Szerokość</label>
            <input
              :value="obj.width"
              type="number"
              min="1"
              class="input-field"
              @change="updateNumberField('width', $event)"
            />
          </div>
          <div>
            <label class="text-xs text-slate-500 block mb-1">Wysokość</label>
            <input
              :value="obj.height"
              type="number"
              min="1"
              class="input-field"
              @change="updateNumberField('height', $event)"
            />
          </div>
          <div>
            <label class="text-xs text-slate-500 block mb-1">Głębokość</label>
            <input
              :value="obj.depth"
              type="number"
              min="1"
              class="input-field"
              @change="updateNumberField('depth', $event)"
            />
          </div>
        </div>
        <!-- Real dimensions display -->
        <div class="mt-2 text-xs text-slate-500 space-y-0.5">
          <div>Szerokość: {{ (obj.width / 10).toFixed(1) }} cm = {{ (obj.width / 1000).toFixed(3) }} m</div>
          <div>Wysokość: {{ (obj.height / 10).toFixed(1) }} cm = {{ (obj.height / 1000).toFixed(3) }} m</div>
          <div>Głębokość: {{ (obj.depth / 10).toFixed(1) }} cm = {{ (obj.depth / 1000).toFixed(3) }} m</div>
        </div>
      </div>

      <!-- Position -->
      <div class="panel-section">
        <div class="label-text mb-2">Pozycja (mm)</div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="text-xs text-slate-500 block mb-1">X</label>
            <input
              :value="Math.round(obj.position_x)"
              type="number"
              class="input-field"
              @change="updateNumberField('position_x', $event)"
            />
          </div>
          <div>
            <label class="text-xs text-slate-500 block mb-1">Y</label>
            <input
              :value="Math.round(obj.position_y)"
              type="number"
              class="input-field"
              @change="updateNumberField('position_y', $event)"
            />
          </div>
          <div>
            <label class="text-xs text-slate-500 block mb-1">Z</label>
            <input
              :value="Math.round(obj.position_z)"
              type="number"
              class="input-field"
              @change="updateNumberField('position_z', $event)"
            />
          </div>
        </div>
        <div class="mt-2">
          <label class="text-xs text-slate-500 block mb-1">Obrót Y (°)</label>
          <input
            :value="Math.round((obj.rotation_y * 180) / Math.PI)"
            type="number"
            class="input-field"
            @change="(event) => updateNumberField('rotation_y', event, Math.PI / 180)"
          />
        </div>
      </div>

      <!-- Color -->
      <div class="panel-section">
        <div class="label-text mb-2">Kolor</div>
        <div class="flex items-center gap-3">
          <input
            :value="obj.color"
            type="color"
            class="w-12 h-9 rounded cursor-pointer border border-slate-600 bg-transparent"
            @input="(event) => updateObjectField('color', (event.target as HTMLInputElement).value)"
          />
          <input
            :value="obj.color"
            class="input-field font-mono"
            @change="updateObjectField('color', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <!-- Color palette -->
        <div class="mt-2 flex flex-wrap gap-1">
          <button
            v-for="c in colorPalette"
            :key="c"
            class="w-6 h-6 rounded border-2 transition-transform hover:scale-110"
            :class="obj.color === c ? 'border-blue-400' : 'border-transparent'"
            :style="{ backgroundColor: c }"
            @click="updateObjectField('color', c)"
          />
        </div>
      </div>

      <!-- Material Template -->
      <div class="panel-section">
        <div class="label-text mb-2">Szablon materiału</div>
        <select
          :value="obj.material_template_id || ''"
          class="input-field"
          @change="updateObjectField('material_template_id', ($event.target as HTMLSelectElement).value || null)"
        >
          <option value="">— brak —</option>
          <option v-for="mat in store.state.materialTemplates" :key="mat.id" :value="mat.id">
            {{ mat.name }}
          </option>
        </select>
      </div>

      <!-- Component info -->
      <div class="panel-section" v-if="obj.component_id">
        <div class="label-text mb-2">Komponent</div>
        <div class="rounded-lg p-2 bg-slate-800/50 space-y-2">
          <div class="text-xs text-slate-400">
            {{ obj.is_independent ? "⚠ Edytowany osobno (brak synchronizacji)" : "⬡ Zsynchronizowany z komponentem" }}
          </div>
          <button
            class="text-xs px-2 py-1 rounded w-full transition-colors"
            :class="obj.is_independent ? 'bg-purple-700/50 hover:bg-purple-700 text-purple-300' : 'bg-yellow-700/50 hover:bg-yellow-700 text-yellow-300'"
            @click="toggleIndependent"
          >
            {{ obj.is_independent ? "Zsynchronizuj z komponentem" : "Edytuj osobno" }}
          </button>
        </div>
      </div>

      <!-- Multiple selection -->
    </div>
  </div>

  <!-- No selection -->
  <div v-else class="flex flex-col items-center justify-center h-full text-slate-500 p-6 text-center gap-2">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" class="opacity-30">
      <path d="M4 0L0 14l4-2 3 6 2-1-3-6 4-2L4 0z"/>
    </svg>
    <div class="text-sm">Zaznacz element,<br/>aby zobaczyć właściwości</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useAppStore } from "../composables/useAppStore";
import { OBJECT_COLOR_PALETTE } from "../lib/objectPresets";
import type { FurnitureObject } from "../types";

const store = useAppStore();

const obj = computed(() => store.firstSelectedObject.value);

const colorPalette = OBJECT_COLOR_PALETTE;

type EditableObjectField =
  | "name"
  | "width"
  | "height"
  | "depth"
  | "position_x"
  | "position_y"
  | "position_z"
  | "rotation_y"
  | "color"
  | "material_template_id";

type NumericObjectField =
  | "width"
  | "height"
  | "depth"
  | "position_x"
  | "position_y"
  | "position_z"
  | "rotation_y";

function updateObjectField<Key extends EditableObjectField>(
  field: Key,
  value: FurnitureObject[Key],
) {
  if (!obj.value) return;
  store.updateObject(obj.value.id, { [field]: value });
}

function updateNumberField(
  field: NumericObjectField,
  event: Event,
  multiplier = 1,
) {
  const value =
    Number.parseFloat((event.target as HTMLInputElement).value) * multiplier;
  if (!Number.isNaN(value)) {
    updateObjectField(field, value);
  }
}

async function onDuplicate() {
  if (obj.value) await store.duplicateObject(obj.value.id);
}

async function onDelete() {
  if (obj.value && confirm(`Usunąć "${obj.value.name}"?`)) {
    await store.deleteObject(obj.value.id);
    store.setActivePanel("none");
  }
}

async function toggleIndependent() {
  if (obj.value) await store.toggleObjectIndependent(obj.value.id);
}
</script>
