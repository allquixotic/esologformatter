<script setup lang="ts">
import { ref } from 'vue'
import { isValidTimeZone, supportedTimeZones } from '@/core/timezones'

defineProps<{
  label: string
  hint: string
}>()

const model = defineModel<string>({ required: true })
const allZones = supportedTimeZones()
const options = ref(allZones)

function filterZones(value: string, update: (callback: () => void) => void): void {
  update(() => {
    const needle = value.trim().toLowerCase()
    options.value = needle === '' ? allZones : allZones.filter((zone) => zone.toLowerCase().includes(needle))
  })
}
</script>

<template>
  <q-select
    v-model="model"
    :options="options"
    :label="label"
    :hint="hint"
    :error="!isValidTimeZone(model)"
    error-message="Choose a valid IANA timezone."
    filled
    dense
    use-input
    fill-input
    hide-selected
    input-debounce="0"
    new-value-mode="add-unique"
    @filter="filterZones"
  >
    <template #prepend>
      <q-icon name="public" />
    </template>
  </q-select>
</template>
