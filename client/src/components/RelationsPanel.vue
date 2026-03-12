<template>
  <div class="flex h-full flex-col">
    <div class="panel-section flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-200">Relacje</h2>
      <span class="rounded-full bg-blue-900/40 px-2 py-0.5 text-[11px] text-blue-300">
        {{ relations.length }}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto p-2 space-y-3">
      <div class="rounded-lg bg-slate-800/50 p-3 text-xs text-slate-400 space-y-2">
        <div class="font-medium text-slate-300">Panel relacji</div>
        <p>
          Łącz obiekty bezpośrednio, relatywnie albo przez „magnes”.
          Usunięcie relacji pozostawia obiektom aktualne parametry, więc możesz
          bezpiecznie odpiąć błędne połączenie i dodać je ponownie.
        </p>
        <ul class="space-y-1 text-slate-500">
          <li>• Bezpośrednia: docelowy parametr zawsze kopiuje źródło 1:1.</li>
          <li>• Relatywna: zachowywana jest różnica między źródłem i celem.</li>
          <li>• Magnes: wskazana krawędź celu trzyma offset względem źródła.</li>
        </ul>
      </div>

      <div class="rounded-lg border border-slate-700 bg-slate-800/30 p-3 space-y-3">
        <div class="text-xs font-medium text-slate-300">Nowa relacja</div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-xs text-slate-500 block mb-1">Obiekt źródłowy</label>
            <select v-model="form.source_object_id" class="input-field">
              <option value="">— wybierz —</option>
              <option v-for="object in store.state.objects" :key="object.id" :value="object.id">
                {{ object.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="text-xs text-slate-500 block mb-1">Obiekt docelowy</label>
            <select v-model="form.target_object_id" class="input-field">
              <option value="">— wybierz —</option>
              <option v-for="object in targetOptions" :key="object.id" :value="object.id">
                {{ object.name }}
              </option>
            </select>
          </div>
        </div>

        <div>
          <label class="text-xs text-slate-500 block mb-1">Typ relacji</label>
          <select v-model="form.relation_type" class="input-field" @change="onRelationTypeChange">
            <option value="dimension">{{ RELATION_TYPE_LABELS.dimension }}</option>
            <option value="attachment">{{ RELATION_TYPE_LABELS.attachment }}</option>
          </select>
        </div>

        <template v-if="form.relation_type === 'dimension'">
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs text-slate-500 block mb-1">Parametr źródła</label>
              <select v-model="form.source_field" class="input-field">
                <option v-for="field in RELATION_DIMENSION_FIELDS" :key="field" :value="field">
                  {{ RELATION_FIELD_LABELS[field] }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-xs text-slate-500 block mb-1">Parametr celu</label>
              <select v-model="form.target_field" class="input-field">
                <option v-for="field in RELATION_DIMENSION_FIELDS" :key="field" :value="field">
                  {{ RELATION_FIELD_LABELS[field] }}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label class="text-xs text-slate-500 block mb-1">Tryb synchronizacji</label>
            <select v-model="form.mode" class="input-field">
              <option value="direct">{{ RELATION_MODE_LABELS.direct }}</option>
              <option value="relative">{{ RELATION_MODE_LABELS.relative }}</option>
            </select>
          </div>
        </template>

        <template v-else>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs text-slate-500 block mb-1">Oś źródła</label>
              <select v-model="form.source_field" class="input-field">
                <option v-for="field in RELATION_POSITION_FIELDS" :key="field" :value="field">
                  {{ RELATION_FIELD_LABELS[field] }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-xs text-slate-500 block mb-1">Oś celu</label>
              <select v-model="form.target_field" class="input-field">
                <option v-for="field in RELATION_POSITION_FIELDS" :key="field" :value="field">
                  {{ RELATION_FIELD_LABELS[field] }}
                </option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs text-slate-500 block mb-1">Kotwica źródła</label>
              <select v-model="form.source_anchor" class="input-field">
                <option v-for="(label, key) in RELATION_ANCHOR_LABELS" :key="key" :value="key">
                  {{ label }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-xs text-slate-500 block mb-1">Kotwica celu</label>
              <select v-model="form.target_anchor" class="input-field">
                <option v-for="(label, key) in RELATION_ANCHOR_LABELS" :key="key" :value="key">
                  {{ label }}
                </option>
              </select>
            </div>
          </div>
        </template>

        <button
          class="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          :disabled="!canCreate"
          @click="createRelation"
        >
          Dodaj relację
        </button>
      </div>

      <div class="space-y-2">
        <div class="text-xs font-medium uppercase tracking-wide text-slate-500">Aktywne relacje</div>

        <div
          v-for="relation in relations"
          :key="relation.id"
          class="rounded-lg border border-slate-700 bg-slate-800/30 overflow-hidden"
        >
          <div class="flex items-center justify-between gap-2 bg-slate-800/60 px-3 py-2">
            <div>
              <div class="text-sm text-slate-200">{{ objectName(relation.source_object_id) }} → {{ objectName(relation.target_object_id) }}</div>
              <div class="text-[11px] text-slate-500">{{ RELATION_TYPE_LABELS[relation.relation_type] }}</div>
            </div>
            <button class="btn-icon h-6 w-6 text-red-400" title="Usuń relację" @click="removeRelation(relation.id)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </div>

          <div class="px-3 py-2 text-xs text-slate-400 space-y-1">
            <div>{{ relationSummary(relation) }}</div>
            <div v-if="relation.relation_type === 'attachment'" class="text-slate-500">
              Offset: {{ Math.round(relation.offset_mm) }} mm
            </div>
          </div>
        </div>

        <div v-if="relations.length === 0" class="rounded-lg border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">
          Brak relacji. Dodaj pierwszą, aby synchronizować wymiary lub pozycję.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import { useAppStore } from "../composables/useAppStore";
import {
  type ObjectRelation,
  RELATION_ANCHOR_LABELS,
  RELATION_DIMENSION_FIELDS,
  RELATION_FIELD_LABELS,
  RELATION_MODE_LABELS,
  RELATION_POSITION_FIELDS,
  RELATION_TYPE_LABELS,
} from "../types";

const store = useAppStore();
const relations = computed(() => store.state.relations);

const form = reactive({
  source_object_id: "",
  target_object_id: "",
  relation_type: "dimension" as ObjectRelation["relation_type"],
  source_field: "height" as ObjectRelation["source_field"],
  target_field: "height" as ObjectRelation["target_field"],
  mode: "direct" as ObjectRelation["mode"],
  source_anchor: "end" as NonNullable<ObjectRelation["source_anchor"]>,
  target_anchor: "start" as NonNullable<ObjectRelation["target_anchor"]>,
});

const targetOptions = computed(() =>
  store.state.objects.filter((object) => object.id !== form.source_object_id),
);

const canCreate = computed(
  () =>
    store.state.objects.length >= 2 &&
    form.source_object_id.length > 0 &&
    form.target_object_id.length > 0,
);

function onRelationTypeChange() {
  if (form.relation_type === "dimension") {
    form.source_field = "height";
    form.target_field = "height";
    form.mode = "direct";
    return;
  }

  form.source_field = "position_x";
  form.target_field = "position_x";
  form.mode = "anchor";
  form.source_anchor = "end";
  form.target_anchor = "start";
}

function objectName(id: string) {
  return (
    store.state.objects.find((object) => object.id === id)?.name ??
    "Usunięty obiekt"
  );
}

function relationSummary(relation: ObjectRelation) {
  if (relation.relation_type === "dimension") {
    return `${RELATION_FIELD_LABELS[relation.target_field]} ← ${RELATION_FIELD_LABELS[relation.source_field]} · ${RELATION_MODE_LABELS[relation.mode]}`;
  }

  return `${RELATION_FIELD_LABELS[relation.target_field]} · ${RELATION_ANCHOR_LABELS[relation.target_anchor ?? "center"]} do ${RELATION_FIELD_LABELS[relation.source_field]} · ${RELATION_ANCHOR_LABELS[relation.source_anchor ?? "center"]}`;
}

async function createRelation() {
  if (!canCreate.value) return;
  await store.createRelation({
    source_object_id: form.source_object_id,
    target_object_id: form.target_object_id,
    relation_type: form.relation_type,
    source_field: form.source_field,
    target_field: form.target_field,
    mode: form.relation_type === "dimension" ? form.mode : "anchor",
    source_anchor:
      form.relation_type === "attachment" ? form.source_anchor : null,
    target_anchor:
      form.relation_type === "attachment" ? form.target_anchor : null,
  });
}

async function removeRelation(id: string) {
  if (confirm("Usunąć relację? Obiekty zachowają aktualne parametry.")) {
    await store.deleteRelation(id);
  }
}
</script>
