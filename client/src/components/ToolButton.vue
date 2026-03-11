<template>
  <button
    class="w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150"
    :class="active
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'"
    :title="title"
    v-bind="$attrs"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  active?: boolean;
}>();
</script>
