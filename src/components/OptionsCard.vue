<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatResolvedTimeWindow, resolveDateFilter } from '@/core/dateFilter'
import { TIME_FORMAT_OPTIONS } from '@/core/formats/time'
import { detectBrowserTimeZone } from '@/core/timezones'
import { useSettingsStore } from '@/stores/settings'
import PresetManagerDialog from '@/components/PresetManagerDialog.vue'
import TimezoneSelect from '@/components/TimezoneSelect.vue'

const settings = useSettingsStore()
const showPresetManager = ref(false)
const browserTimezone = detectBrowserTimeZone()

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

interface FilterPreview {
  sourceLabel: string
  sourceRange: string
  rawLogRange: string
  filename?: string
}

interface FilterPreviewState {
  preview: FilterPreview | null
  error: string
}

const filterPreviewState = computed<FilterPreviewState>(() => {
  if (settings.dateMode === 'all') {
    return { preview: null, error: '' }
  }
  if (settings.dateMode === 'custom' && settings.customStart === '' && settings.customEnd === '') {
    return { preview: null, error: '' }
  }

  try {
    const resolved = resolveDateFilter({
      mode: settings.dateMode,
      logTimezone: settings.logTimezone,
      preset: settings.activePresetDef,
      presetName: settings.activePreset,
      weeksAgo: settings.weeksAgo,
      durationOverrideEnabled: settings.durationOverrideEnabled,
      durationOverrideHours: settings.durationOverrideHours,
      customStart: settings.customStart,
      customEnd: settings.customEnd,
      customRangeTimezone: settings.customRangeTimezone,
    })
    if (!resolved.zonedWindow) {
      return { preview: null, error: '' }
    }
    const text = formatResolvedTimeWindow(resolved.zonedWindow)

    return {
      preview: {
        sourceLabel: settings.dateMode === 'preset' ? 'Event time' : 'Custom range',
        sourceRange: text.sourceRange,
        rawLogRange: text.rawLogRange,
        filename:
          resolved.filePrefix && resolved.fileDate
            ? `${resolved.filePrefix}-${resolved.fileDate}`
            : undefined,
      },
      error: '',
    }
  } catch (error) {
    return { preview: null, error: (error as Error).message }
  }
})

function useBrowserForLog(): void {
  settings.logTimezone = browserTimezone
}
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

      <div class="timezone-context rounded-borders q-pa-md">
        <div class="text-subtitle2">Timezone context</div>
        <div class="text-caption text-grey q-mb-sm">
          Event/range time defines intent. Log-recording time matches timestamps written in the
          file. Browser time is context only.
        </div>
        <div class="timezone-grid">
          <div class="timezone-readout">
            <div class="text-caption text-grey">Browser timezone</div>
            <div class="text-body2 text-weight-medium">{{ browserTimezone }}</div>
            <div class="text-caption text-grey">Detected from this browser · read-only</div>
          </div>

          <div>
            <TimezoneSelect
              v-model="settings.logTimezone"
              label="Log-recording timezone"
              hint="Timezone of the computer that created this log"
            />
            <q-btn
              v-if="settings.logTimezone !== browserTimezone"
              flat
              dense
              no-caps
              color="secondary"
              label="Use browser timezone"
              class="q-mt-xs"
              @click="useBrowserForLog"
            />
          </div>

          <TimezoneSelect
            v-if="settings.dateMode === 'custom'"
            v-model="settings.customRangeTimezone"
            label="Custom-range timezone"
            hint="Timezone used to interpret custom start and end"
          />
          <div v-else class="timezone-readout">
            <div class="text-caption text-grey">Event/range timezone</div>
            <div class="text-body2 text-weight-medium">
              {{
                settings.dateMode === 'preset'
                  ? (settings.activePresetDef?.timezone ?? 'Preset unavailable')
                  : 'Not used'
              }}
            </div>
            <div class="text-caption text-grey">
              {{ settings.dateMode === 'preset' ? 'Defined by selected preset' : 'No date filter' }}
            </div>
          </div>
        </div>
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
      </div>

      <div v-if="settings.dateMode === 'custom'" class="row q-gutter-sm">
        <q-input
          v-model="settings.customStart"
          filled
          dense
          label="Start (custom-range time)"
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
          label="End (custom-range time)"
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

      <q-banner
        v-if="filterPreviewState.preview"
        dense
        rounded
        class="effective-range bg-grey-9 text-white"
      >
        <div>
          <q-icon name="event" class="q-mr-sm" />
          <strong>{{ filterPreviewState.preview.sourceLabel }}:</strong>
          {{ filterPreviewState.preview.sourceRange }}
        </div>
        <div>
          <q-icon name="filter_alt" class="q-mr-sm" />
          <strong>Effective raw-log filter:</strong>
          {{ filterPreviewState.preview.rawLogRange }} · inclusive to minute
        </div>
        <div v-if="filterPreviewState.preview.filename" class="text-caption q-mt-xs">
          Output prefix: {{ filterPreviewState.preview.filename }}
        </div>
      </q-banner>
      <q-banner
        v-else-if="filterPreviewState.error"
        dense
        rounded
        class="bg-negative text-white"
      >
        <q-icon name="error" class="q-mr-sm" />{{ filterPreviewState.error }}
      </q-banner>

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

<style scoped>
.timezone-context {
  border: 1px solid rgba(128, 128, 128, 0.35);
}

.timezone-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.timezone-readout {
  min-height: 56px;
  padding: 8px 12px;
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 4px;
}

.effective-range > div + div {
  margin-top: 4px;
}

@media (max-width: 700px) {
  .timezone-grid {
    grid-template-columns: 1fr;
  }
}
</style>
