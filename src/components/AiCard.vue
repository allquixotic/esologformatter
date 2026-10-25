<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { allEntries, loadCuratedCatalog, resolveModel, type CuratedCatalog, type CuratedEntry } from '@/llm/curated'
import { startOAuthLogin } from '@/llm/openrouter'
import { promptApiAvailability, type PromptApiAvailability } from '@/llm/promptApi'
import { useSettingsStore } from '@/stores/settings'
import SectionCard from '@/components/SectionCard.vue'

const $q = useQuasar()
const settings = useSettingsStore()

const catalog = ref<CuratedCatalog | null>(null)
const loadingModels = ref(false)
const catalogError = ref('')
const modelSearch = ref('')
const promptAvail = ref<PromptApiAvailability>('unsupported')
const manualKey = ref('')
const showManualKey = ref(false)

async function refreshModels(): Promise<void> {
  if (loadingModels.value) return
  loadingModels.value = true
  catalogError.value = ''
  catalog.value = null
  try {
    catalog.value = await loadCuratedCatalog()
    settings.initializeModel(catalog.value)
  } catch (err) {
    catalogError.value = `Could not load models: ${(err as Error).message}`
  } finally {
    loadingModels.value = false
  }
}

onMounted(() => {
  void refreshModels()
  void promptApiAvailability().then((availability) => { promptAvail.value = availability })
    .catch(() => { promptAvail.value = 'unavailable' })
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
  { label: 'Model list', value: 'curated' },
  { label: 'Manual', value: 'manual' },
]

function entryCaption(e: CuratedEntry): string {
  const parts = [e.tier === 'cheap' ? 'Low cost' : e.tier === 'free' ? 'Free' : 'Paid',
    e.aaii === undefined ? 'Not benchmarked' : `AA intelligence ${e.aaii.toFixed(1)}`]
  if (e.priceInPerMillion !== undefined && e.priceOutPerMillion !== undefined) {
    parts.push(`$${e.priceInPerMillion}/M in · $${e.priceOutPerMillion}/M out`)
  }
  if (e.contextLength !== undefined) {
    parts.push(`${Math.round(e.contextLength / 1024)}k ctx`)
  }
  if (e.pricePerRequest > 0) parts.push(`$${e.pricePerRequest}/request`)
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
  const search = modelSearch.value.trim().toLowerCase()
  entries = entries.filter((e) => `${e.displayName} ${e.slug}`.toLowerCase().includes(search))
  return entries.map((e) => ({
    label: e.displayName,
    value: e.slug,
    caption: entryCaption(e),
  }))
})

function filterModels(value: string, update: (fn: () => void) => void): void {
  update(() => { modelSearch.value = value })
}

const selection = computed(() => {
  if (!catalog.value) return { error: '', entry: null }
  if (settings.modelMode !== 'auto' && !settings.modelId.trim()) {
    return { error: 'Choose a model or use Automatic.', entry: null }
  }
  try {
    const resolved = resolveModel(settings.modelMode === 'auto' ? 'auto' : settings.modelId,
      settings.freeModelsOnly, catalog.value)
    return { error: '', entry: resolved.entry }
  } catch (err) {
    return { error: (err as Error).message, entry: null }
  }
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
  <SectionCard section-id="ai" title="AI corrections (optional)">
    <template #description>
        Fix spelling and grammar with an LLM while preserving names, fantasy terms, and the
        dialogue format. Off by default — nothing is sent anywhere until you enable it.
    </template>

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
                :model-value="settings.modelMode"
                :options="modelModeOptions"
                toggle-color="primary"
                unelevated
                no-caps
                @update:model-value="settings.selectModelMode"
              />
              <q-toggle v-model="settings.freeModelsOnly" label="Free models only" @update:model-value="settings.modelSelectionOrigin = 'user'" />
            </div>

            <q-select
              v-if="settings.modelMode === 'curated'"
              :model-value="settings.modelId"
              :options="curatedOptions"
              emit-value
              map-options
              filled
              dense
              class="q-mt-sm"
              label="Search current OpenRouter models"
              style="max-width: 560px"
              use-input
              fill-input
              hide-selected
              :input-debounce="0"
              :loading="loadingModels"
              :disable="loadingModels || catalog === null"
              @update:model-value="settings.selectModel"
              @filter="filterModels"
            >
              <template #no-option>
                <q-item><q-item-section>No matching models. Try Refresh models.</q-item-section></q-item>
              </template>
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
              :model-value="settings.modelId"
              filled
              dense
              class="q-mt-sm"
              label="OpenRouter model id (e.g. google/gemini-2.5-flash-lite)"
              style="max-width: 560px"
              @update:model-value="settings.selectModel"
            />

            <div class="row items-center q-gutter-sm q-mt-xs">
              <q-btn flat dense no-caps icon="refresh" label="Refresh models" :loading="loadingModels" @click="refreshModels" />
              <span v-if="catalog" class="text-caption text-grey">
                {{ allEntries(catalog).length }} text models · {{ catalog.free.length }} free · updated {{ new Date(catalog.generatedAt).toLocaleTimeString() }}
              </span>
            </div>
            <q-banner v-if="catalogError || selection.error" dense rounded class="bg-negative text-white q-mt-sm" role="alert">
              {{ catalogError || selection.error }}
            </q-banner>
            <div v-if="selection.entry" class="text-caption q-mt-sm">
              Selected: {{ selection.entry.displayName }} ({{ selection.entry.slug }})<br>
              {{ entryCaption(selection.entry) }}
            </div>
            <div class="text-caption text-grey q-mt-sm">
              Automatic selects the highest-scoring model priced up to $1.50/M input and $6/M output,
              or a free model when Free models only is enabled. Prices shown use the highest published text rates.
              <a href="https://artificialanalysis.ai/" target="_blank" rel="noopener noreferrer">Artificial Analysis</a>
              scores are supplied by OpenRouter; unscored models appear last within each price group.
            </div>
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
  </SectionCard>
</template>
