<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore, type SectionId } from '@/stores/settings'

const props = defineProps<{ sectionId: SectionId; title: string }>()
const settings = useSettingsStore()
const collapsed = computed(() => settings.collapsedSections[props.sectionId] === true)
</script>

<template>
  <q-card flat bordered :data-section="sectionId">
    <q-card-section class="row items-center no-wrap q-gutter-sm">
      <div class="text-h6 section-title">{{ title }}</div>
      <q-space />
      <q-btn
        flat round dense
        :icon="collapsed ? 'expand_more' : 'expand_less'"
        :aria-label="`${collapsed ? 'Expand' : 'Collapse'} ${title}`"
        :aria-expanded="!collapsed"
        :aria-controls="`section-${sectionId}`"
        @click="settings.setSectionCollapsed(sectionId, !collapsed)"
      />
    </q-card-section>
    <div v-show="!collapsed" :id="`section-${sectionId}`">
      <q-card-section v-if="$slots.description" class="q-pt-none text-caption text-grey">
        <slot name="description" />
      </q-card-section>
      <slot />
    </div>
  </q-card>
</template>

<style scoped>
.section-title { min-width: 0; overflow-wrap: anywhere; }
</style>
