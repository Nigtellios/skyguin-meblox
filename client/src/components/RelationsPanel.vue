<template>
  <Teleport to="body">
    <div
      v-if="store.state.activePanel === 'relations'"
      class="fixed inset-0 z-50 backdrop-blur-sm"
      :class="isAttachEditor ? 'pointer-events-none bg-slate-950/35' : 'bg-slate-950/85'"
    >
      <div
        class="absolute inset-4 flex flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 shadow-2xl shadow-black/50"
        :class="isAttachEditor ? 'pointer-events-none bg-slate-950/45' : ''"
      >
        <div
          class="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-5 py-4"
          :class="isAttachEditor ? 'pointer-events-auto' : ''"
        >
          <div>
            <div class="text-xs uppercase tracking-[0.24em] text-blue-300/80">
              Visual Builder Relacji
            </div>
            <h2 class="text-xl font-semibold text-slate-100">
              Relacje między obiektami
            </h2>
          </div>

          <div class="ml-auto flex items-center gap-3">
            <div class="inline-flex rounded-xl border border-slate-700 bg-slate-900/80 p-1">
              <button
                class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
                :class="
                  store.state.relationEditorMode === 'visual'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/30'
                    : 'text-slate-400 hover:text-slate-200'
                "
                @click="store.setRelationEditorMode('visual')"
              >
                Visual builder
              </button>
              <button
                class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
                :class="
                  store.state.relationEditorMode === 'attach'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-950/30'
                    : 'text-slate-400 hover:text-slate-200'
                "
                @click="store.setRelationEditorMode('attach')"
              >
                Attach na scenie
              </button>
            </div>

            <div class="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-sm text-blue-200">
              {{ relations.length }} relacji
            </div>
            <button class="btn-icon text-slate-300" title="Zamknij" @click="closeModal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
        </div>

        <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px]">
          <div
            class="relative min-h-0 overflow-auto"
            :class="isAttachEditor ? 'pointer-events-none bg-transparent' : 'bg-slate-950'"
          >
            <template v-if="!isAttachEditor">
              <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_35%),linear-gradient(rgba(30,41,59,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(30,41,59,0.45)_1px,transparent_1px)] bg-[length:100%_100%,32px_32px,32px_32px]" />

              <div class="relative min-h-[1100px] min-w-[1400px] p-8">
                <svg class="pointer-events-none absolute inset-0 h-full w-full">
                  <defs>
                    <marker
                      id="builder-arrow"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="8"
                      markerHeight="8"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa" />
                    </marker>
                  </defs>

                  <g v-for="edge in builderEdges" :key="edge.id">
                    <path
                      :d="edge.path"
                      fill="none"
                      stroke="#60a5fa"
                      stroke-width="2.5"
                      :stroke-dasharray="edge.type === 'attachment' ? '8 5' : '0'"
                      marker-end="url(#builder-arrow)"
                    />
                    <g>
                      <rect
                        :x="edge.label.x - edge.label.width / 2"
                        :y="edge.label.y - 11"
                        :width="edge.label.width"
                        height="22"
                        rx="11"
                        fill="rgba(15, 23, 42, 0.88)"
                        stroke="rgba(96, 165, 250, 0.5)"
                      />
                      <text
                        :x="edge.label.x"
                        :y="edge.label.y + 4"
                        fill="#dbeafe"
                        font-size="11"
                        font-weight="600"
                        text-anchor="middle"
                      >
                        {{ edge.label.text }}
                      </text>
                    </g>
                  </g>
                </svg>

                <div
                  v-for="object in store.state.objects"
                  :key="object.id"
                  class="absolute w-[280px] overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-xl shadow-slate-950/60"
                  :style="{
                    transform: `translate(${layoutFor(object.id).x}px, ${layoutFor(object.id).y}px)`,
                  }"
                >
                  <div
                    class="flex cursor-move items-center justify-between border-b border-slate-700/80 bg-slate-800/90 px-4 py-3"
                    @mousedown="beginNodeDrag(object.id, $event)"
                  >
                    <div>
                      <div class="text-sm font-semibold text-slate-100">{{ object.name }}</div>
                      <div class="text-[11px] text-slate-400">
                        {{ Math.round(object.width) }} × {{ Math.round(object.height) }} × {{ Math.round(object.depth) }} mm
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="h-3 w-3 rounded-full border border-white/10" :style="{ backgroundColor: object.color }" />
                      <button
                        class="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 transition hover:border-blue-400 hover:text-blue-200"
                        @click="focusObject(object.id)"
                      >
                        Zaznacz
                      </button>
                    </div>
                  </div>

                  <div class="space-y-3 p-4">
                    <div v-for="group in fieldGroups" :key="group.label" class="space-y-2">
                      <div class="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                        {{ group.label }}
                      </div>

                      <button
                        v-for="field in group.fields"
                        :key="field"
                        type="button"
                        class="flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition"
                        :class="fieldClass(field)"
                        :draggable="canDragField(field)"
                        data-field-chip
                        @dragstart="onFieldDragStart(object.id, field, $event)"
                        @dragend="clearFieldDrag"
                        @dragover.prevent="onFieldDragOver(field)"
                        @drop.prevent="onFieldDrop(object.id, field)"
                      >
                        <span
                          class="h-2.5 w-2.5 shrink-0 rounded-full"
                          :class="
                            isFieldActive(object.id, field)
                              ? 'bg-blue-400'
                              : getFieldKind(field) === 'dimension'
                                ? 'bg-emerald-400'
                                : 'bg-amber-400'
                          "
                        />
                        <span class="flex-1 truncate text-slate-200">
                          {{ RELATION_FIELD_LABELS[field] }}
                        </span>
                        <span class="text-xs text-slate-400">{{ formatFieldValue(object, field) }}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  v-if="store.state.objects.length === 0"
                  class="flex h-full min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-slate-700/80 bg-slate-900/40 text-center text-slate-400"
                >
                  Dodaj co najmniej dwa obiekty, aby zbudować relacje w visual builderze.
                </div>
              </div>
            </template>

            <div
              v-else
              class="pointer-events-none flex h-full min-h-[720px] items-start justify-center p-10"
            >
              <div class="max-w-xl rounded-2xl border border-amber-500/30 bg-slate-950/70 px-6 py-5 text-center text-sm leading-6 text-amber-50/90 shadow-xl shadow-black/30">
                Tryb attach jest aktywny. Klikaj obiekty bezpośrednio na scenie 3D: pierwszy klik wybiera źródło, drugi tworzy połączenie „magnes” z aktualnymi kotwicami.
              </div>
            </div>
          </div>

          <aside
            class="flex min-h-0 flex-col border-l border-slate-800 bg-slate-950/95"
            :class="isAttachEditor ? 'pointer-events-auto' : ''"
          >
            <div class="border-b border-slate-800 p-4">
              <div class="text-sm font-semibold text-slate-100">
                {{ store.state.relationEditorMode === 'visual' ? 'Sterowanie builderem' : 'Sterowanie attach' }}
              </div>
              <p class="mt-2 text-sm leading-6 text-slate-400">
                {{
                  store.state.relationEditorMode === 'visual'
                    ? 'Przeciągnij właściwość z jednego obiektu na właściwość drugiego, aby utworzyć relację jak w visual builderze.'
                    : 'Kliknij obiekt źródłowy w scenie 3D, a potem kliknij obiekt docelowy. Strzałki w scenie pokazują aktywne zależności.'
                }}
              </p>
            </div>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div v-if="store.state.relationEditorMode === 'visual'" class="space-y-4">
                <div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <label class="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                    Tryb przeciągnięcia właściwości
                  </label>
                  <select v-model="relationBuilderMode" class="input-field">
                    <option value="direct">{{ RELATION_MODE_LABELS.direct }}</option>
                    <option value="relative">{{ RELATION_MODE_LABELS.relative }}</option>
                  </select>
                  <p class="mt-3 text-xs text-slate-500">
                    Builder tworzy relacje wymiarów. Do połączeń typu „magnes” przełącz się na tryb attach i klikaj obiekty na scenie.
                  </p>
                </div>

                <div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-400">
                  <div class="font-medium text-slate-200">Szybkie wskazówki</div>
                  <ul class="mt-3 space-y-2">
                    <li>• Chwyć nagłówek karty, aby przesunąć obiekt po builderze.</li>
                    <li>• Przeciągnij np. „Wysokość (Y)” z Bok A na „Wysokość (Y)” w Plecach.</li>
                    <li>• Niebieskie strzałki pokazują aktualne połączenia między parametrami.</li>
                  </ul>
                </div>
              </div>

              <div v-else class="space-y-4">
                <div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
                  <div>
                    <label class="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                      Oś attach
                    </label>
                    <select v-model="attachField" class="input-field">
                      <option v-for="field in RELATION_POSITION_FIELDS" :key="field" :value="field">
                        {{ RELATION_FIELD_LABELS[field] }}
                      </option>
                    </select>
                  </div>

                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                        Kotwica źródła
                      </label>
                      <select v-model="attachSourceAnchor" class="input-field">
                        <option v-for="(label, key) in RELATION_ANCHOR_LABELS" :key="key" :value="key">
                          {{ label }}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label class="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                        Kotwica celu
                      </label>
                      <select v-model="attachTargetAnchor" class="input-field">
                        <option v-for="(label, key) in RELATION_ANCHOR_LABELS" :key="key" :value="key">
                          {{ label }}
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                <div class="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <div class="font-medium">Źródło attach</div>
                  <div class="mt-2 text-amber-50/90">
                    {{ attachSourceLabel }}
                  </div>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <button
                      class="rounded-lg border border-amber-400/40 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="store.state.selectedObjectIds.length !== 1"
                      @click="useSelectedObjectAsAttachSource"
                    >
                      Użyj zaznaczonego obiektu
                    </button>
                    <button
                      class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
                      @click="store.setRelationAttachSource(null)"
                    >
                      Wyczyść źródło
                    </button>
                  </div>
                </div>
              </div>

              <div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div class="flex items-center justify-between gap-3">
                  <div class="text-sm font-semibold text-slate-100">Aktywne relacje</div>
                  <div class="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {{ relations.length }} szt.
                  </div>
                </div>

                <div class="mt-4 space-y-3">
                  <div
                    v-for="relation in relations"
                    :key="relation.id"
                    class="rounded-xl border border-slate-800 bg-slate-950/80 p-3"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <div class="text-sm text-slate-200">
                          {{ objectName(relation.source_object_id) }} → {{ objectName(relation.target_object_id) }}
                        </div>
                        <div class="mt-1 text-xs text-slate-500">
                          {{ relationSummary(relation) }}
                        </div>
                      </div>
                      <button
                        class="btn-icon h-7 w-7 text-red-400"
                        title="Usuń relację"
                        @click="removeRelation(relation.id)"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                      </button>
                    </div>
                  </div>

                  <div
                    v-if="relations.length === 0"
                    class="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500"
                  >
                    Brak relacji. Utwórz pierwszą strzałkę w builderze lub przełącz się na attach.
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from "vue";
import { useAppStore } from "../composables/useAppStore";
import {
  BUILDER_BOUNDARY_HEIGHT,
  BUILDER_LAYOUT_PADDING,
  BUILDER_NODE_HEADER_HEIGHT,
  BUILDER_NODE_ROW_HEIGHT,
  type BuilderField,
  type BuilderNodeLayout,
  canConnectFields,
  createBuilderEdgePath,
  createBuilderLayout,
  estimateRelationLabelWidth,
  getFieldAnchorPoint,
  getRelationFieldKind,
} from "../lib/relationsBuilder";
import {
  type FurnitureObject,
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
const isAttachEditor = computed(
  () => store.state.relationEditorMode === "attach",
);
const EDGE_LABEL_MIN_WIDTH = 120;
const BUILDER_MIN_BOUNDARY_PADDING = 24;
const fieldGroups = [
  { label: "Wymiary", fields: RELATION_DIMENSION_FIELDS },
  { label: "Pozycja", fields: RELATION_POSITION_FIELDS },
] as const;
const builderFields = [
  ...RELATION_DIMENSION_FIELDS,
  ...RELATION_POSITION_FIELDS,
] as const;

const nodeLayout = ref<Record<string, BuilderNodeLayout>>({});
const dragState = reactive<{
  objectId: string | null;
  field: BuilderField | null;
}>({
  objectId: null,
  field: null,
});

let detachNodeDrag: (() => void) | null = null;

watch(
  () => store.state.objects,
  (objects) => {
    nodeLayout.value = createBuilderLayout(objects, nodeLayout.value);
  },
  { deep: true, immediate: true },
);

onUnmounted(() => {
  detachNodeDrag?.();
});

const relationBuilderMode = computed({
  get: () => store.state.relationBuilderMode,
  set: (mode) => store.setRelationBuilderMode(mode),
});

const attachField = computed({
  get: () => store.state.relationAttachField,
  set: (field) =>
    store.setRelationAttachField(
      field as Extract<
        ObjectRelation["source_field"],
        "position_x" | "position_y" | "position_z"
      >,
    ),
});

const attachSourceAnchor = computed({
  get: () => store.state.relationAttachSourceAnchor,
  set: (anchor) =>
    store.setRelationAttachAnchors(
      anchor as NonNullable<ObjectRelation["source_anchor"]>,
      store.state.relationAttachTargetAnchor,
    ),
});

const attachTargetAnchor = computed({
  get: () => store.state.relationAttachTargetAnchor,
  set: (anchor) =>
    store.setRelationAttachAnchors(
      store.state.relationAttachSourceAnchor,
      anchor as NonNullable<ObjectRelation["target_anchor"]>,
    ),
});

const attachSourceLabel = computed(() => {
  if (!store.state.relationAttachSourceId) {
    return "Kliknij obiekt źródłowy bezpośrednio na scenie 3D.";
  }

  return `Źródło: ${objectName(store.state.relationAttachSourceId)}`;
});

const builderEdges = computed(() =>
  relations.value
    .map((relation) => {
      const sourceNode = nodeLayout.value[relation.source_object_id];
      const targetNode = nodeLayout.value[relation.target_object_id];
      const sourceFieldIndex = builderFields.indexOf(relation.source_field);
      const targetFieldIndex = builderFields.indexOf(relation.target_field);
      if (
        !sourceNode ||
        !targetNode ||
        sourceFieldIndex < 0 ||
        targetFieldIndex < 0
      ) {
        return null;
      }

      const start = getFieldAnchorPoint(sourceNode, sourceFieldIndex, "right");
      const end = getFieldAnchorPoint(targetNode, targetFieldIndex, "left");
      const labelText =
        relation.relation_type === "dimension"
          ? `${RELATION_FIELD_LABELS[relation.source_field]} → ${RELATION_FIELD_LABELS[relation.target_field]}`
          : `${RELATION_TYPE_LABELS.attachment} · ${RELATION_FIELD_LABELS[relation.target_field]}`;

      return {
        id: relation.id,
        path: createBuilderEdgePath(start, end),
        type: relation.relation_type,
        label: {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2 - 16,
          text: labelText,
          width: estimateRelationLabelWidth(labelText, EDGE_LABEL_MIN_WIDTH),
        },
      };
    })
    .filter((edge) => edge !== null),
);

function closeModal() {
  clearFieldDrag();
  store.setActivePanel("none");
}

function layoutFor(id: string) {
  return (
    nodeLayout.value[id] ?? {
      id,
      x: BUILDER_LAYOUT_PADDING,
      y: BUILDER_LAYOUT_PADDING,
    }
  );
}

function objectName(id: string) {
  return (
    store.state.objects.find((object) => object.id === id)?.name ??
    "Usunięty obiekt"
  );
}

function relationSummary(relation: ObjectRelation) {
  if (relation.relation_type === "dimension") {
    return `${RELATION_MODE_LABELS[relation.mode]} · ${RELATION_FIELD_LABELS[relation.source_field]} → ${RELATION_FIELD_LABELS[relation.target_field]}`;
  }

  return `${RELATION_TYPE_LABELS.attachment} · ${RELATION_FIELD_LABELS[relation.target_field]} · ${RELATION_ANCHOR_LABELS[relation.source_anchor ?? "center"]} → ${RELATION_ANCHOR_LABELS[relation.target_anchor ?? "center"]}`;
}

function getFieldKind(field: BuilderField) {
  return getRelationFieldKind(field);
}

function formatFieldValue(object: FurnitureObject, field: BuilderField) {
  return `${Math.round(object[field])} mm`;
}

function canDragField(field: BuilderField) {
  return (
    store.state.relationEditorMode === "visual" &&
    getFieldKind(field) === "dimension"
  );
}

function isFieldActive(objectId: string, field: BuilderField) {
  return relations.value.some(
    (relation) =>
      (relation.source_object_id === objectId &&
        relation.source_field === field) ||
      (relation.target_object_id === objectId &&
        relation.target_field === field),
  );
}

function fieldClass(field: BuilderField) {
  if (store.state.relationEditorMode === "visual") {
    return canDragField(field)
      ? "border-slate-700 bg-slate-950/80 hover:border-blue-400 hover:bg-blue-500/10"
      : "cursor-not-allowed border-slate-800 bg-slate-900/60 opacity-60";
  }

  return getFieldKind(field) === "position"
    ? "border-amber-500/20 bg-amber-500/10 hover:border-amber-400/50"
    : "cursor-not-allowed border-slate-800 bg-slate-900/60 opacity-60";
}

function focusObject(id: string) {
  store.selectObject(id, false);
  store.setActivePanel("relations");
}

function useSelectedObjectAsAttachSource() {
  if (store.state.selectedObjectIds.length === 1) {
    store.setRelationAttachSource(store.state.selectedObjectIds[0]);
  }
}

function onFieldDragStart(
  objectId: string,
  field: BuilderField,
  event: DragEvent,
) {
  if (!canDragField(field)) {
    event.preventDefault();
    return;
  }

  dragState.objectId = objectId;
  dragState.field = field;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", `${objectId}:${field}`);
  }
}

function onFieldDragOver(field: BuilderField) {
  if (!dragState.field) return;
  if (!canConnectFields(dragState.field, field, "visual")) {
    return;
  }
}

async function onFieldDrop(targetObjectId: string, targetField: BuilderField) {
  if (!dragState.objectId || !dragState.field) return;
  if (dragState.objectId === targetObjectId) {
    clearFieldDrag();
    return;
  }
  if (!canConnectFields(dragState.field, targetField, "visual")) {
    clearFieldDrag();
    return;
  }

  await store.createRelation({
    source_object_id: dragState.objectId,
    target_object_id: targetObjectId,
    relation_type: "dimension",
    source_field: dragState.field,
    target_field: targetField,
    mode: relationBuilderMode.value,
  });

  clearFieldDrag();
}

function clearFieldDrag() {
  dragState.objectId = null;
  dragState.field = null;
}

function beginNodeDrag(objectId: string, event: MouseEvent) {
  if (event.button !== 0) return;
  const layout = layoutFor(objectId);
  const startX = event.clientX;
  const startY = event.clientY;
  const originX = layout.x;
  const originY = layout.y;

  const onMove = (moveEvent: MouseEvent) => {
    nodeLayout.value = {
      ...nodeLayout.value,
      [objectId]: {
        id: objectId,
        x: Math.max(
          BUILDER_MIN_BOUNDARY_PADDING,
          originX + moveEvent.clientX - startX,
        ),
        y: Math.max(
          BUILDER_MIN_BOUNDARY_PADDING,
          Math.min(
            BUILDER_BOUNDARY_HEIGHT -
              BUILDER_NODE_HEADER_HEIGHT -
              BUILDER_NODE_ROW_HEIGHT,
            originY + moveEvent.clientY - startY,
          ),
        ),
      },
    };
  };

  const onUp = () => {
    detachNodeDrag?.();
  };

  detachNodeDrag?.();
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  detachNodeDrag = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    detachNodeDrag = null;
  };
}

async function removeRelation(id: string) {
  if (confirm("Usunąć relację? Obiekty zachowają aktualne parametry.")) {
    await store.deleteRelation(id);
  }
}
</script>
