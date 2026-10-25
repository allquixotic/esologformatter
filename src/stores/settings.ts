import { defineStore } from 'pinia'
import { Dark } from 'quasar'
import type { TimeFormat } from '@/core/formats/time'
import type { OutputFormat } from '@/core/pipeline'
import { builtinPresets, validatePreset, type PresetDefinition } from '@/core/presets'
import { detectBrowserTimeZone } from '@/core/timezones'
import { preferredDefaultModel, type CuratedCatalog } from '@/llm/curated'

export type ThemePreference = 'dark' | 'light' | 'system'
export type DateMode = 'all' | 'preset' | 'custom'
export type AiProviderId = 'openrouter' | 'prompt-api'
export type ModelMode = 'auto' | 'curated' | 'manual'
export type SectionId = 'instructions' | 'options' | 'channels' | 'ai' | 'input' | 'run' | 'preview' | 'diff'
export type ModelSelectionOrigin = 'pending' | 'default' | 'user'

export interface SettingsState {
  theme: ThemePreference
  dateMode: DateMode
  activePreset: string
  customPresets: PresetDefinition[]
  weeksAgo: number
  durationOverrideEnabled: boolean
  durationOverrideHours: number
  /** Timezone of the computer that recorded raw log wall-clock timestamps. */
  logTimezone: string
  /** Custom range bounds, `YYYY-MM-DDTHH:mm`, interpreted in customRangeTimezone. */
  customStart: string
  customEnd: string
  customRangeTimezone: string
  timeFormat: TimeFormat
  outputFormat: OutputFormat
  sortByTime: boolean
  cleanup: boolean
  useAi: boolean
  aiProvider: AiProviderId
  keepOriginal: boolean
  showDiff: boolean
  modelMode: ModelMode
  modelId: string
  modelSelectionOrigin: ModelSelectionOrigin
  collapsedSections: Partial<Record<SectionId, boolean>>
  freeModelsOnly: boolean
  openrouterApiKey: string | null
  /** Channel display-name dropdown selection (base channel name). */
  channelNames: Record<number, string>
  /** Free-text alias per channel; wins over the dropdown selection. */
  channelAliases: Record<number, string>
  /** Channels excluded from plain/table output. */
  channelsDisabled: number[]
  showTechnicalLog: boolean
  followTechnicalLog: boolean
}

const STORAGE_KEY = 'esologformatter.settings.v1'

function defaults(browserTimezone = detectBrowserTimeZone()): SettingsState {
  return {
    theme: 'dark',
    dateMode: 'all',
    activePreset: builtinPresets()[0]!.name,
    customPresets: [],
    weeksAgo: 0,
    durationOverrideEnabled: false,
    durationOverrideHours: 1.0,
    logTimezone: browserTimezone,
    customStart: '',
    customEnd: '',
    customRangeTimezone: browserTimezone,
    timeFormat: 'friendly',
    outputFormat: 'plain',
    sortByTime: false,
    cleanup: true,
    useAi: false,
    aiProvider: 'openrouter',
    keepOriginal: false,
    showDiff: true,
    modelMode: 'curated',
    modelId: '',
    modelSelectionOrigin: 'pending',
    collapsedSections: { diff: true },
    freeModelsOnly: false,
    openrouterApiKey: null,
    channelNames: {},
    channelAliases: {},
    channelsDisabled: [],
    showTechnicalLog: false,
    followTechnicalLog: true,
  }
}

/** Merge old/new persisted payloads while defaulting missing zone roles to browser context. */
export function mergeStoredSettings(
  persisted: Partial<SettingsState>,
  browserTimezone = detectBrowserTimeZone(),
): SettingsState {
  const base = defaults(browserTimezone)
  const origin = persisted.modelSelectionOrigin ?? (
    persisted.modelId?.trim() || persisted.freeModelsOnly
      ? 'user' : 'pending'
  )
  return {
    ...base, ...persisted,
    modelSelectionOrigin: origin,
    modelMode: origin === 'pending' ? 'curated' : (persisted.modelMode ?? base.modelMode),
    collapsedSections: { ...base.collapsedSections, ...persisted.collapsedSections },
  }
}

function loadState(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return defaults()
    }
    const parsed = JSON.parse(raw) as Partial<SettingsState>
    return mergeStoredSettings(parsed)
  } catch {
    return defaults()
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => loadState(),
  getters: {
    presets(state): PresetDefinition[] {
      const builtins = builtinPresets()
      return [
        ...builtins.map((preset) => state.customPresets.find((custom) => custom.name === preset.name) ?? preset),
        ...state.customPresets.filter((custom) => !builtins.some((preset) => preset.name === custom.name)),
      ]
    },
    activePresetDef(state): PresetDefinition | undefined {
      return this.presets.find((p) => p.name === state.activePreset)
    },
    hasApiKey(state): boolean {
      return state.openrouterApiKey !== null && state.openrouterApiKey !== ''
    },
    channelLabel(state): (channel: number, baseName: string) => string {
      return (channel, baseName) => {
        const alias = state.channelAliases[channel]?.trim()
        if (alias) {
          return alias
        }
        return state.channelNames[channel] ?? baseName
      }
    },
  },
  actions: {
    setSectionCollapsed(section: SectionId, collapsed: boolean) {
      this.collapsedSections[section] = collapsed
    },
    initializeModel(catalog: CuratedCatalog) {
      if (this.modelSelectionOrigin !== 'pending') return
      this.$patch({ modelMode: 'curated', modelId: preferredDefaultModel(catalog)?.slug ?? '', modelSelectionOrigin: 'default' })
    },
    selectModelMode(mode: ModelMode) {
      this.$patch({ modelMode: mode, modelSelectionOrigin: 'user' })
    },
    selectModel(modelId: string | number | null) {
      this.$patch({ modelId: String(modelId ?? ''), modelSelectionOrigin: 'user' })
    },
    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state))
      } catch {
        // Storage may be unavailable (private mode quota etc.); ignore.
      }
    },
    applyTheme() {
      Dark.set(this.theme === 'system' ? 'auto' : this.theme === 'dark')
    },
    setTheme(theme: ThemePreference) {
      this.theme = theme
      this.applyTheme()
    },
    setApiKey(key: string | null) {
      const trimmed = key?.trim() ?? ''
      this.openrouterApiKey = trimmed === '' ? null : trimmed
    },
    /** Returns validation problems; empty array means the preset was added. */
    addPreset(preset: PresetDefinition): string[] {
      const problems = validatePreset(
        { ...preset, builtin: false },
        this.presets.map((p) => p.name),
      )
      if (problems.length === 0) {
        this.customPresets.push({ ...preset, builtin: false })
      }
      return problems
    },
    /** Returns validation problems; empty array means the preset was updated. */
    updatePreset(originalName: string, preset: PresetDefinition): string[] {
      const idx = this.customPresets.findIndex((p) => p.name === originalName)
      if (idx < 0 && !builtinPresets().some((p) => p.name === originalName)) {
        return ['Preset no longer exists.']
      }
      const otherNames = this.presets.map((p) => p.name).filter((n) => n !== originalName)
      const problems = validatePreset({ ...preset, builtin: false }, otherNames)
      if (problems.length === 0) {
        const custom = { ...preset, builtin: false }
        if (idx < 0) this.customPresets.push(custom)
        else this.customPresets[idx] = custom
        if (this.activePreset === originalName) {
          this.activePreset = preset.name
        }
      }
      return problems
    },
    deletePreset(name: string): boolean {
      const idx = this.customPresets.findIndex((p) => p.name === name)
      if (idx < 0) {
        return false
      }
      this.customPresets.splice(idx, 1)
      if (this.activePreset === name && !builtinPresets().some((p) => p.name === name)) {
        this.activePreset = builtinPresets()[0]!.name
      }
      return true
    },
    setChannelEnabled(channel: number, enabled: boolean) {
      const set = new Set(this.channelsDisabled)
      if (enabled) {
        set.delete(channel)
      } else {
        set.add(channel)
      }
      this.channelsDisabled = [...set]
    },
    isChannelEnabled(channel: number): boolean {
      return !this.channelsDisabled.includes(channel)
    },
  },
})
