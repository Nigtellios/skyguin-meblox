<template>
  <!-- Bottom Context Bar -->
  <div class="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
    <!-- No selection: Add element button -->
    <div
      v-if="contextMode === 'none'"
      class="flex items-center gap-2"
    >
      <button class="btn-primary flex items-center gap-1.5" @click="$emit('add-object')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/>
        </svg>
        Dodaj element
      </button>
    </div>

    <!-- Object selected: action icons -->
    <div
      v-else-if="contextMode === 'object-actions'"
      class="flex items-center gap-1 panel-glass rounded-2xl px-3 py-2 border border-slate-700/50 shadow-xl"
    >
      <!-- Object name label -->
      <span v-if="firstSelected" class="text-xs text-slate-400 mr-2 max-w-28 truncate">
        {{ selectedCount > 1 ? `${selectedCount} elem.` : firstSelected.name }}
      </span>

      <div class="w-px h-6 bg-slate-700/60 mx-1" />

      <!-- Move -->
      <button
        v-if="selectedCount === 1"
        class="btn-icon-bar"
        :class="{ 'btn-icon-bar-active': sceneMode === 'move' }"
        title="Przesuń (M)"
        @click="onMoveClick"
      >
        <!-- 4-directional arrow -->
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/>
        </svg>
      </button>

      <!-- Rotate -->
      <button
        v-if="selectedCount === 1"
        class="btn-icon-bar"
        :class="{ 'btn-icon-bar-active': sceneMode === 'rotate' }"
        title="Obróć (R)"
        @click="$emit('set-scene-mode', 'rotate')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/>
        </svg>
      </button>

      <!-- Materials -->
      <button
        class="btn-icon-bar"
        title="Materiały"
        @click="$emit('open-materials')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        </svg>
      </button>

      <!-- Snap to edge (magnet) - single selection only -->
      <button
        v-if="selectedCount === 1"
        class="btn-icon-bar"
        :class="{ 'btn-icon-bar-active': sceneMode === 'snap' }"
        title="Przyklej do krawędzi"
        @click="$emit('toggle-snap')"
      >
        <!-- Magnet icon -->
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99l1.5 1.5z"/>
          <path d="M5 5h3v5.5c0 2.49 2.01 4.5 4.5 4.5S17 12.99 17 10.5V5h3v5.5C20 14.64 16.64 18 12.5 18S5 14.64 5 10.5V5z"/>
        </svg>
      </button>

      <div class="w-px h-6 bg-slate-700/60 mx-1" />

      <!-- Copy single -->
      <button
        v-if="selectedCount === 1"
        class="btn-icon-bar"
        title="Kopiuj (Ctrl+C)"
        @click="$emit('copy')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      </button>

      <!-- Copy multiple -->
      <button
        v-if="selectedCount > 1"
        class="btn-icon-bar flex items-center gap-1 px-2 text-xs"
        title="Kopiuj zaznaczone"
        @click="$emit('copy')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
        Kopiuj {{ selectedCount }}
      </button>

      <!-- Duplicate -->
      <button
        v-if="selectedCount === 1"
        class="btn-icon-bar"
        title="Duplikuj"
        @click="$emit('duplicate')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 8h-4v4h-2v-4H7v-2h4V5h2v4h4v2z"/>
        </svg>
      </button>

      <div class="w-px h-6 bg-slate-700/60 mx-1" />

      <!-- Delete -->
      <button
        class="btn-icon-bar text-red-400 hover:text-red-300 hover:bg-red-900/30"
        title="Usuń"
        @click="$emit('delete')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      </button>

      <!-- Deselect -->
      <button
        class="btn-icon-bar text-slate-500"
        title="Odznacz"
        @click="$emit('deselect')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>

    <!-- Move controls mode -->
    <div
      v-else-if="contextMode === 'move-controls'"
      class="flex flex-col items-center gap-2"
    >
      <div class="panel-glass rounded-2xl px-4 py-3 border border-slate-700/50 shadow-xl">
        <!-- Axis selector -->
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xs text-slate-400 mr-1">Oś:</span>
          <button
            v-for="axis in axes"
            :key="axis"
            class="px-3 py-1 rounded-lg text-xs font-bold transition-colors"
            :class="
              activeAxis === axis
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700/60 text-slate-400 hover:bg-slate-600'
            "
            @click="activeAxis = axis"
          >
            {{ axis }}
          </button>

          <div class="w-px h-4 bg-slate-700/60 mx-1" />

          <!-- Step size -->
          <span class="text-xs text-slate-400 mr-1">Krok:</span>
          <button
            v-for="step in steps"
            :key="step"
            class="px-2 py-1 rounded-lg text-xs transition-colors"
            :class="
              activeStep === step
                ? 'bg-slate-500 text-white'
                : 'bg-slate-700/60 text-slate-400 hover:bg-slate-600'
            "
            @click="activeStep = step"
          >
            {{ step }}mm
          </button>
        </div>

        <!-- Direction controls -->
        <div class="flex items-center gap-3">
          <!-- Compass arrows -->
          <div class="grid grid-cols-3 gap-1">
            <div />
            <button
              class="btn-icon-bar"
              :title="upLabel"
              @click="onMoveDir('up')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14l5-5 5 5H7z"/>
              </svg>
            </button>
            <div />
            <button
              class="btn-icon-bar"
              :title="leftLabel"
              @click="onMoveDir('left')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 17l-5-5 5-5v10z"/>
              </svg>
            </button>
            <!-- Center indicator -->
            <div class="w-8 h-8 flex items-center justify-center">
              <div class="w-2 h-2 rounded-full bg-slate-600" />
            </div>
            <button
              class="btn-icon-bar"
              :title="rightLabel"
              @click="onMoveDir('right')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 7v10l5-5-5-5z"/>
              </svg>
            </button>
            <div />
            <button
              class="btn-icon-bar"
              :title="downLabel"
              @click="onMoveDir('down')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5H7z"/>
              </svg>
            </button>
            <div />
          </div>

          <div class="w-px h-12 bg-slate-700/60" />

          <!-- Rotate buttons -->
          <div class="flex flex-col gap-1">
            <button
              class="btn-icon-bar"
              title="Obróć w lewo (CCW)"
              @click="onRotate(-1)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
              </svg>
            </button>
            <button
              class="btn-icon-bar"
              title="Obróć w prawo (CW)"
              @click="onRotate(1)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 7H7v3L3 6l4-4v3h12v6h-2V7zM7 17h10v-3l4 4-4 4v-3H5v-6h2v4z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Back button -->
      <button
        class="btn-secondary text-xs flex items-center gap-1.5"
        @click="$emit('exit-move-controls')"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
        Wróć
      </button>
    </div>

    <!-- Snap mode -->
    <div
      v-else-if="contextMode === 'snap-mode'"
      class="flex items-center gap-2 panel-glass rounded-2xl px-4 py-2.5 border border-amber-700/50 shadow-xl"
    >
      <svg class="text-amber-400 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 5h3v5.5c0 2.49 2.01 4.5 4.5 4.5S17 12.99 17 10.5V5h3v5.5C20 14.64 16.64 18 12.5 18S5 14.64 5 10.5V5z"/>
      </svg>
      <span class="text-sm text-amber-300">Tryb przyklejania — kliknij inny obiekt</span>
      <button
        class="btn-secondary text-xs ml-2"
        @click="$emit('exit-snap-mode')"
      >
        Anuluj
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { ContextMode, FurnitureObject, SceneMode } from "../types";

const props = defineProps<{
  contextMode: ContextMode;
  sceneMode: SceneMode;
  selectedCount: number;
  firstSelected: FurnitureObject | null;
}>();

const emit = defineEmits<{
  "add-object": [];
  "open-materials": [];
  "set-scene-mode": [mode: SceneMode];
  "enter-move-controls": [];
  "exit-move-controls": [];
  "toggle-snap": [];
  "exit-snap-mode": [];
  copy: [];
  duplicate: [];
  delete: [];
  deselect: [];
  "move-object": [delta: { dx: number; dy: number; dz: number; dr: number }];
}>();

const axes = ["X", "Y", "Z"] as const;
type Axis = (typeof axes)[number];
const activeAxis = ref<Axis>("X");
const steps = [1, 10, 100] as const;
type Step = (typeof steps)[number];
const activeStep = ref<Step>(10);

const ROTATE_STEP_DEG = 15;

const upLabel = computed(() => {
  if (activeAxis.value === "X") return "+X";
  if (activeAxis.value === "Y") return "+Y";
  return "-Z";
});
const downLabel = computed(() => {
  if (activeAxis.value === "X") return "-X";
  if (activeAxis.value === "Y") return "-Y";
  return "+Z";
});
const leftLabel = computed(() => {
  if (activeAxis.value === "Z") return "+X";
  return "-Z";
});
const rightLabel = computed(() => {
  if (activeAxis.value === "Z") return "-X";
  return "+Z";
});

function onMoveDir(dir: "up" | "down" | "left" | "right") {
  const s = activeStep.value;
  const a = activeAxis.value;
  let dx = 0;
  let dy = 0;
  let dz = 0;

  if (a === "X") {
    if (dir === "up") dx = s;
    if (dir === "down") dx = -s;
    if (dir === "left") dz = s;
    if (dir === "right") dz = -s;
  } else if (a === "Y") {
    if (dir === "up") dy = s;
    if (dir === "down") dy = -s;
  } else {
    // Z
    if (dir === "up") dz = -s;
    if (dir === "down") dz = s;
    if (dir === "left") dx = -s;
    if (dir === "right") dx = s;
  }

  emit("move-object", { dx, dy, dz, dr: 0 });
}

function onRotate(sign: 1 | -1) {
  const dr = (sign * ROTATE_STEP_DEG * Math.PI) / 180;
  emit("move-object", { dx: 0, dy: 0, dz: 0, dr });
}

function onMoveClick() {
  emit("set-scene-mode", "move");
  emit("enter-move-controls");
}
</script>

<style scoped>
.btn-icon-bar {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  color: rgb(203 213 225);
  transition: background-color 0.15s, color 0.15s;
}
.btn-icon-bar:hover {
  background-color: rgb(71 85 105 / 0.6);
  color: rgb(241 245 249);
}
.btn-icon-bar-active {
  background-color: rgb(37 99 235 / 0.3);
  color: rgb(96 165 250);
}
</style>
