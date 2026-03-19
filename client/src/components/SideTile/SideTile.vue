<template>
  <button
    class="aspect-square rounded border-2 flex flex-col items-center justify-center text-xs relative transition-all"
    :class="[
      active ? 'border-blue-500 bg-blue-900/30' : 'border-slate-600 bg-slate-800/50 hover:border-slate-500',
    ]"
    :title="SIDE_LABELS[side]"
    @click="$emit('click')"
  >
    <!-- Side name -->
    <span class="text-slate-400 text-xs">{{ SIDE_LABELS[side] }}</span>

    <!-- Layer dots -->
    <div class="flex gap-0.5 mt-0.5">
      <div
        v-for="layer in layers.slice(0, 4)"
        :key="layer.id"
        class="w-2 h-2 rounded-full border border-slate-700"
        :style="{ backgroundColor: layer.color }"
        :title="layer.layer_type + ' ' + layer.thickness + 'mm'"
      />
    </div>

    <!-- Add button -->
    <button
      class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center text-white transition-colors"
      @click.stop="$emit('add')"
      title="Dodaj warstwę"
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/></svg>
    </button>
  </button>
</template>

<script setup lang="ts">
import type { MaterialLayer, Side } from "../../types";
import { SIDE_LABELS } from "../../types";

defineProps<{
  side: Side;
  layers: MaterialLayer[];
  active?: boolean;
}>();

defineEmits<{
  click: [];
  add: [];
}>();
</script>
