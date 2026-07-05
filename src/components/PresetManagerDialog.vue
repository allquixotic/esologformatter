<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { WEEKDAYS, type PresetDefinition, type Weekday } from '@/core/presets'
import { useSettingsStore } from '@/stores/settings'

const model = defineModel<boolean>({ required: true })

const $q = useQuasar()
const settings = useSettingsStore()

const editingOriginalName = ref<string | null>(null)
const formVisible = ref(false)
const problems = ref<string[]>([])

const blankForm = (): PresetDefinition => ({
  name: '',
  weekday: 'saturday',
  timezone: 'America/New_York',
  startTime: '20:00',
  durationMinutes: 60,
  filePrefix: '',
  defaultWeeksAgo: 0,
  builtin: false,
})
const form = ref<PresetDefinition>(blankForm())

function startCreate(): void {
  editingOriginalName.value = null
  form.value = blankForm()
  problems.value = []
  formVisible.value = true
}

function startEdit(preset: PresetDefinition): void {
  editingOriginalName.value = preset.name
  form.value = { ...preset }
  problems.value = []
  formVisible.value = true
}

function save(): void {
  const result =
    editingOriginalName.value === null
      ? settings.addPreset({ ...form.value })
      : settings.updatePreset(editingOriginalName.value, { ...form.value })
  problems.value = result
  if (result.length === 0) {
    formVisible.value = false
    $q.notify({ type: 'positive', message: 'Preset saved.' })
  }
}

function remove(preset: PresetDefinition): void {
  $q.dialog({
    title: 'Delete preset',
    message: `Delete "${preset.name}"? This cannot be undone.`,
    cancel: true,
  }).onOk(() => {
    settings.deletePreset(preset.name)
    $q.notify({ type: 'info', message: `Deleted preset "${preset.name}".` })
  })
}
</script>

<template>
  <q-dialog v-model="model">
    <q-card style="min-width: 560px; max-width: 95vw">
      <q-card-section class="row items-center">
        <div class="text-h6">Event presets</div>
        <q-space />
        <q-btn v-close-popup flat round dense icon="close" aria-label="Close" />
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-list bordered separator>
          <q-item v-for="preset in settings.presets" :key="preset.name">
            <q-item-section>
              <q-item-label>
                {{ preset.name }}
                <q-badge v-if="preset.builtin" color="grey-7" class="q-ml-sm">built-in</q-badge>
              </q-item-label>
              <q-item-label caption>
                {{ preset.weekday }} {{ preset.startTime }} · {{ preset.durationMinutes }} min ·
                {{ preset.timezone }} · prefix "{{ preset.filePrefix }}"
                <span v-if="preset.defaultWeeksAgo > 0">
                  · default {{ preset.defaultWeeksAgo }} week(s) ago</span
                >
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-btn
                  v-if="!preset.builtin"
                  flat
                  dense
                  round
                  icon="edit"
                  aria-label="Edit preset"
                  @click="startEdit(preset)"
                />
                <q-btn
                  v-if="!preset.builtin"
                  flat
                  dense
                  round
                  icon="delete"
                  color="negative"
                  aria-label="Delete preset"
                  @click="remove(preset)"
                />
                <q-icon v-else name="lock" class="q-mt-sm" color="grey" />
              </div>
            </q-item-section>
          </q-item>
        </q-list>

        <q-btn
          class="q-mt-md"
          color="primary"
          icon="add"
          label="New preset"
          @click="startCreate"
        />
      </q-card-section>

      <q-card-section v-if="formVisible" class="q-pt-none">
        <q-separator class="q-mb-md" />
        <div class="text-subtitle1 q-mb-sm">
          {{ editingOriginalName === null ? 'New preset' : `Edit "${editingOriginalName}"` }}
        </div>
        <div class="row q-col-gutter-sm">
          <q-input v-model="form.name" class="col-6" filled dense label="Name" />
          <q-select
            v-model="form.weekday"
            class="col-6"
            :options="WEEKDAYS as unknown as Weekday[]"
            filled
            dense
            label="Weekday"
          />
          <q-input
            v-model="form.startTime"
            class="col-4"
            filled
            dense
            label="Start time (HH:MM)"
            mask="##:##"
          />
          <q-input
            v-model.number="form.durationMinutes"
            class="col-4"
            filled
            dense
            type="number"
            min="1"
            label="Duration (minutes)"
          />
          <q-input
            v-model.number="form.defaultWeeksAgo"
            class="col-4"
            filled
            dense
            type="number"
            min="0"
            label="Default weeks ago"
          />
          <q-input
            v-model="form.timezone"
            class="col-6"
            filled
            dense
            label="IANA timezone"
            hint="e.g. America/New_York, Europe/London"
          />
          <q-input v-model="form.filePrefix" class="col-6" filled dense label="File prefix" />
        </div>

        <q-banner v-if="problems.length > 0" dense rounded class="bg-negative text-white q-mt-sm">
          <div v-for="p in problems" :key="p">{{ p }}</div>
        </q-banner>

        <div class="row q-gutter-sm q-mt-sm">
          <q-btn color="primary" label="Save preset" @click="save" />
          <q-btn flat label="Cancel" @click="formVisible = false" />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
