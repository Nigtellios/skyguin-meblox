<template>
  <button
    class="w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150"
    :class="getToolButtonClass(active ?? false)"
    :title="title"
    v-bind="$attrs"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { getToolButtonClass } from "./toolButtonUtils";

defineProps<{
  title?: string;
  active?: boolean;
}>();
</script>
