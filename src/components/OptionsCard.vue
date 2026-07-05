<script setup lang="ts">
import { computed, ref } from 'vue'
import { TIME_FORMAT_OPTIONS } from '@/core/formats/time'
import { calculateEventWindow, effectiveWeeksAgo } from '@/core/schedule'
import { useSettingsStore } from '@/stores/settings'
import PresetManagerDialog from '@/components/PresetManagerDialog.vue'

const settings = useSettingsStore()
const showPresetManager = ref(false)

const formatOptions = [
  { label: 'Plain Text', value: 'plain' },
  { label: 'Roleplay Narrative', value: 'narrative' },
  { label: 'HTML Table (legacy)', value: 'table' },
]

const dateModeOptions = [
  { label: 'Everything', value: 'all' },
  { label: 'Event preset', value: 'preset' },
  { label: 'Custom range', value: 'custom' },
]

const presetOptions = computed(() =>
  settings.presets.map((p) => ({
    label: p.builtin ? p.name : `${p.name} (custom)`,
    value: p.name,
  })),
)

const schedulePreview = computed(() => {
  const preset = settings.activePresetDef
  if (!preset || settings.dateMode !== 'preset') {
    return ''
  }
  try {
    const weeks = effectiveWeeksAgo(settings.weeksAgo, preset)
    const override = settings.durationOverrideEnabled
      ? Math.round(settings.durationOverrideHours * 60)
      : undefined
    const w = calculateEventWindow(preset, weeks, override)
    return `${w.start.toFormat('EEE yyyy-MM-dd HH:mm')} → ${w.end.toFormat('EEE yyyy-MM-dd HH:mm')} ${preset.timezone} · files: ${preset.filePrefix}-${w.fileDate}`
  } catch {
    return ''
  }
})
</script>

<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">Step 1 — Options</div>
    </q-card-section>

    <q-card-section class="q-pt-none column q-gutter-md">
      <div>
        <div class="text-subtitle2 q-mb-xs">Output format</div>
        <q-btn-toggle
          v-model="settings.outputFormat"
          :options="formatOptions"
          toggle-color="primary"
          unelevated
          no-caps
        />
        <div v-if="settings.outputFormat === 'table'" class="text-caption text-warning q-mt-xs">
          The HTML table format is deprecated; prefer Plain Text or Roleplay Narrative.
        </div>
        <div v-if="settings.outputFormat === 'narrative'" class="text-caption text-grey q-mt-xs">
          Narrative mode keeps only say + emote and formats them as clean prose.
        </div>
      </div>

      <div>
        <div class="text-subtitle2 q-mb-xs">Date filter</div>
        <q-btn-toggle
          v-model="settings.dateMode"
          :options="dateModeOptions"
          toggle-color="primary"
          unelevated
          no-caps
        />
      </div>

      <div v-if="settings.dateMode === 'preset'" class="column q-gutter-sm">
        <div class="row q-gutter-sm items-start">
          <q-select
            v-model="settings.activePreset"
            :options="presetOptions"
            emit-value
            map-options
            filled
            dense
            label="Event preset"
            style="min-width: 260px"
          />
          <q-input
            v-model.number="settings.weeksAgo"
            filled
            dense
            type="number"
            min="0"
            label="Weeks ago"
            style="width: 120px"
          />
          <q-btn
            outline
            dense
            color="secondary"
            icon="edit_calendar"
            label="Manage presets"
            class="q-mt-xs"
            @click="showPresetManager = true"
          />
        </div>
        <div class="row q-gutter-sm items-center">
          <q-toggle v-model="settings.durationOverrideEnabled" label="Override duration" />
          <q-input
            v-if="settings.durationOverrideEnabled"
            v-model.number="settings.durationOverrideHours"
            filled
            dense
            type="number"
            min="1"
            step="0.25"
            suffix="hours"
            style="width: 140px"
          />
        </div>
        <q-banner v-if="schedulePreview" dense rounded class="bg-grey-9 text-white">
          <q-icon name="schedule" class="q-mr-sm" />{{ schedulePreview }}
        </q-banner>
      </div>

      <div v-if="settings.dateMode === 'custom'" class="row q-gutter-sm">
        <q-input
          v-model="settings.customStart"
          filled
          dense
          label="Start (local)"
          placeholder="YYYY-MM-DDTHH:mm"
          style="min-width: 240px"
        >
          <template #prepend>
            <q-icon name="event" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-date v-model="settings.customStart" mask="YYYY-MM-DDTHH:mm" />
              </q-popup-proxy>
            </q-icon>
          </template>
          <template #append>
            <q-icon name="access_time" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-time v-model="settings.customStart" mask="YYYY-MM-DDTHH:mm" format24h />
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>
        <q-input
          v-model="settings.customEnd"
          filled
          dense
          label="End (local)"
          placeholder="YYYY-MM-DDTHH:mm"
          style="min-width: 240px"
        >
          <template #prepend>
            <q-icon name="event" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-date v-model="settings.customEnd" mask="YYYY-MM-DDTHH:mm" />
              </q-popup-proxy>
            </q-icon>
          </template>
          <template #append>
            <q-icon name="access_time" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-time v-model="settings.customEnd" mask="YYYY-MM-DDTHH:mm" format24h />
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>
      </div>

      <div class="row q-gutter-md items-center">
        <q-select
          v-if="settings.outputFormat !== 'narrative'"
          v-model="settings.timeFormat"
          :options="TIME_FORMAT_OPTIONS"
          emit-value
          map-options
          filled
          dense
          label="Timestamp format"
          style="min-width: 320px"
        />
        <q-toggle v-model="settings.sortByTime" label="Sort by time" />
        <q-toggle
          v-if="settings.outputFormat === 'narrative'"
          v-model="settings.cleanup"
          label="Cleanup (OOC removal, punctuation)"
        />
      </div>
    </q-card-section>

    <PresetManagerDialog v-model="showPresetManager" />
  </q-card>
</template>
