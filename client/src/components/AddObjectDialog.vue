<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="panel-section flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-200">Dodaj element</h2>
      <button class="btn-icon" @click="$emit('close')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    </div>

    <!-- Teleport to center modal -->
    <Teleport to="body">
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60" @click.self="$emit('close')">
        <div class="panel-glass rounded-xl w-96 shadow-2xl border border-slate-700">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-slate-700">
            <h2 class="text-lg font-semibold text-slate-100">Nowy element mebla</h2>
            <button class="btn-icon" @click="$emit('close')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>

          <!-- Form -->
          <div class="p-4 space-y-4">
            <div>
              <label class="label-text block mb-1">Nazwa</label>
              <input v-model="form.name" class="input-field" placeholder="np. Bok korpusu" />
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="label-text block mb-1">Szerokość (mm)</label>
                <input v-model.number="form.width" type="number" min="1" class="input-field" />
              </div>
              <div>
                <label class="label-text block mb-1">Wysokość (mm)</label>
                <input v-model.number="form.height" type="number" min="1" class="input-field" />
              </div>
              <div>
                <label class="label-text block mb-1">Głębokość (mm)</label>
                <input v-model.number="form.depth" type="number" min="1" class="input-field" />
              </div>
            </div>

            <div>
              <label class="label-text block mb-1">Kolor</label>
              <div class="flex items-center gap-2">
                <input v-model="form.color" type="color" class="w-10 h-8 rounded cursor-pointer border border-slate-600 bg-transparent" />
                <input v-model="form.color" class="input-field font-mono" placeholder="#8B7355" />
              </div>
            </div>

            <div>
              <label class="label-text block mb-1">Szablon materiału (opcjonalnie)</label>
              <select v-model="form.material_template_id" class="input-field">
                <option value="">— brak —</option>
                <option v-for="mat in store.state.materialTemplates" :key="mat.id" :value="mat.id">
                  {{ mat.name }}
                </option>
              </select>
            </div>

            <!-- Preset dimensions -->
            <div>
              <label class="label-text block mb-2">Szybkie presety</label>
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="preset in presets"
                  :key="preset.label"
                  class="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                  @click="applyPreset(preset)"
                >
                  {{ preset.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="p-4 border-t border-slate-700 flex justify-end gap-2">
            <button class="btn-secondary" @click="$emit('close')">Anuluj</button>
            <button class="btn-primary" :disabled="!isValid" @click="onCreate">Dodaj element</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from "vue";
import { useAppStore } from "../composables/useAppStore";

const props = defineProps<{
  initialPosition?: { x: number; z: number };
}>();

const emit = defineEmits<{
  close: [];
  created: [];
}>();

const store = useAppStore();

const presets = [
  { label: "Bok 720×600×18", width: 18, height: 720, depth: 600, name: "Bok korpusu" },
  { label: "Półka 600×30×580", width: 600, height: 30, depth: 580, name: "Półka" },
  { label: "Dno 600×18×580", width: 600, height: 18, depth: 580, name: "Dno korpusu" },
  { label: "Front 200×720×18", width: 200, height: 720, depth: 18, name: "Front" },
  { label: "Blat 800×38×600", width: 800, height: 38, depth: 600, name: "Blat" },
];

const form = reactive({
  name: "Nowy element",
  width: 600,
  height: 720,
  depth: 18,
  color: "#8B7355",
  material_template_id: "",
});

const isValid = computed(() => form.name.trim() && form.width > 0 && form.height > 0 && form.depth > 0);

function applyPreset(p: typeof presets[0]) {
  form.name = p.name;
  form.width = p.width;
  form.height = p.height;
  form.depth = p.depth;
}

async function onCreate() {
  if (!isValid.value) return;
  await store.createObject({
    name: form.name.trim(),
    width: form.width,
    height: form.height,
    depth: form.depth,
    color: form.color,
    material_template_id: form.material_template_id || null,
    position_x: props.initialPosition?.x ?? 0,
    position_z: props.initialPosition?.z ?? 0,
  });
  emit("created");
}
</script>
