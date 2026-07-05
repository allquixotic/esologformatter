<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { allEntries, loadCuratedCatalog, type CuratedCatalog, type CuratedEntry } from '@/llm/curated'
import { startOAuthLogin } from '@/llm/openrouter'
import { promptApiAvailability, type PromptApiAvailability } from '@/llm/promptApi'
import { useSettingsStore } from '@/stores/settings'

const $q = useQuasar()
const settings = useSettingsStore()

const catalog = ref<CuratedCatalog | null>(null)
const promptAvail = ref<PromptApiAvailability>('unsupported')
const manualKey = ref('')
const showManualKey = ref(false)

onMounted(async () => {
  promptAvail.value = await promptApiAvailability()
  try {
    catalog.value = await loadCuratedCatalog()
  } catch {
    catalog.value = null
  }
})

const providerOptions = computed(() => [
  { label: 'OpenRouter (cloud)', value: 'openrouter' },
  {
    label: 'Built-in browser AI (experimental)',
    value: 'prompt-api',
    disable: promptAvail.value === 'unsupported',
  },
])

const modelModeOptions = [
  { label: 'Automatic', value: 'auto' },
  { label: 'Curated list', value: 'curated' },
  { label: 'Manual', value: 'manual' },
]

function entryCaption(e: CuratedEntry): string {
  const parts = [`tier: ${e.tier}`, `AAII ${e.aaii.toFixed(1)}`]
  if (e.priceInPerMillion !== undefined && e.priceOutPerMillion !== undefined) {
    parts.push(`$${e.priceInPerMillion}/M in · $${e.priceOutPerMillion}/M out`)
  }
  if (e.contextLength !== undefined) {
    parts.push(`${Math.round(e.contextLength / 1024)}k ctx`)
  }
  return parts.join(' · ')
}

const curatedOptions = computed(() => {
  if (!catalog.value) {
    return []
  }
  let entries = allEntries(catalog.value)
  if (settings.freeModelsOnly) {
    entries = entries.filter((e) => e.tier === 'free')
  }
  return entries.map((e) => ({
    label: e.displayName,
    value: e.slug,
    caption: entryCaption(e),
  }))
})

const promptAvailLabel = computed(() => {
  switch (promptAvail.value) {
    case 'unsupported':
      return 'Not supported in this browser (requires Chrome 148+ on capable hardware).'
    case 'unavailable':
      return 'Unavailable on this device (hardware/storage requirements not met).'
    case 'downloadable':
      return 'Ready to use — Gemini Nano will download on first run (large download).'
    case 'downloading':
      return 'On-device model is downloading…'
    case 'available':
      return 'On-device model is ready.'
  }
  return ''
})

async function connect(): Promise<void> {
  try {
    await startOAuthLogin()
  } catch (err) {
    $q.notify({ type: 'negative', message: `Could not start OpenRouter login: ${(err as Error).message}` })
  }
}

function saveManualKey(): void {
  settings.setApiKey(manualKey.value)
  manualKey.value = ''
  showManualKey.value = false
  if (settings.hasApiKey) {
    $q.notify({ type: 'positive', message: 'API key saved in this browser.' })
  }
}

function clearKey(): void {
  settings.setApiKey(null)
  $q.notify({ type: 'info', message: 'OpenRouter API key removed.' })
}
</script>

<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">AI corrections (optional)</div>
      <div class="text-caption text-grey">
        Fix spelling and grammar with an LLM while preserving names, fantasy terms, and the
        dialogue format. Off by default — nothing is sent anywhere until you enable it.
      </div>
    </q-card-section>

    <q-card-section class="q-pt-none column q-gutter-md">
      <q-toggle v-model="settings.useAi" label="Enable AI grammar &amp; spelling correction" />

      <template v-if="settings.useAi">
        <div>
          <div class="text-subtitle2 q-mb-xs">Provider</div>
          <q-btn-toggle
            v-model="settings.aiProvider"
            :options="providerOptions"
            toggle-color="primary"
            unelevated
            no-caps
          />
        </div>

        <template v-if="settings.aiProvider === 'openrouter'">
          <div class="row q-gutter-sm items-center">
            <template v-if="!settings.hasApiKey">
              <q-btn color="primary" icon="login" label="Connect OpenRouter" @click="connect" />
              <q-btn
                flat
                no-caps
                label="Enter API key manually"
                @click="showManualKey = !showManualKey"
              />
            </template>
            <template v-else>
              <q-chip color="positive" text-color="white" icon="key">
                OpenRouter key saved
              </q-chip>
              <q-btn flat dense color="negative" label="Clear key" @click="clearKey" />
            </template>
          </div>

          <div v-if="showManualKey && !settings.hasApiKey" class="row q-gutter-sm items-center">
            <q-input
              v-model="manualKey"
              filled
              dense
              type="password"
              label="sk-or-…"
              style="min-width: 320px"
            />
            <q-btn color="primary" label="Save key" :disable="manualKey.trim() === ''" @click="saveManualKey" />
          </div>

          <div>
            <div class="text-subtitle2 q-mb-xs">Model</div>
            <div class="row q-gutter-md items-center">
              <q-btn-toggle
                v-model="settings.modelMode"
                :options="modelModeOptions"
                toggle-color="primary"
                unelevated
                no-caps
              />
              <q-toggle v-model="settings.freeModelsOnly" label="Free models only" />
            </div>

            <q-select
              v-if="settings.modelMode === 'curated'"
              v-model="settings.modelId"
              :options="curatedOptions"
              emit-value
              map-options
              filled
              dense
              class="q-mt-sm"
              label="Curated model"
              style="max-width: 560px"
              :loading="catalog === null"
            >
              <template #option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption>{{ scope.opt.caption }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>

            <q-input
              v-if="settings.modelMode === 'manual'"
              v-model="settings.modelId"
              filled
              dense
              class="q-mt-sm"
              label="OpenRouter model id (e.g. google/gemini-2.5-flash-lite)"
              style="max-width: 560px"
            />
          </div>
        </template>

        <q-banner
          v-if="settings.aiProvider === 'prompt-api'"
          dense
          rounded
          class="bg-grey-9 text-white"
        >
          <q-icon name="psychology" class="q-mr-sm" />
          {{ promptAvailLabel }}
        </q-banner>

        <div class="row q-gutter-md">
          <q-toggle v-model="settings.keepOriginal" label="Keep original (pre-AI) output" />
          <q-toggle v-model="settings.showDiff" label="Show diff of AI changes" />
        </div>
      </template>
    </q-card-section>
  </q-card>
</template>
