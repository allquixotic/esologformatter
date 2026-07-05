<script setup lang="ts">
import type { Change } from 'diff'

defineProps<{ parts: Change[] }>()
</script>

<template>
  <pre class="diff-pre"><span
    v-for="(part, i) in parts"
    :key="i"
    :class="{ 'diff-added': part.added, 'diff-removed': part.removed }"
  >{{ part.value }}</span></pre>
</template>

<style scoped>
.diff-pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
.diff-added {
  background: rgba(33, 186, 69, 0.28);
}
.diff-removed {
  background: rgba(193, 0, 21, 0.28);
  text-decoration: line-through;
}
</style>
