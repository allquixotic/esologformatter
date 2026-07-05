import { defineStore } from 'pinia'
import { Dark } from 'quasar'
import type { TimeFormat } from '@/core/formats/time'
import type { OutputFormat } from '@/core/pipeline'
import { builtinPresets, validatePreset, type PresetDefinition } from '@/core/presets'

export type ThemePreference = 'dark' | 'light' | 'system'
export type DateMode = 'all' | 'preset' | 'custom'
export type AiProviderId = 'openrouter' | 'prompt-api'
export type ModelMode = 'auto' | 'curated' | 'manual'

export interface SettingsState {
  theme: ThemePreference
  dateMode: DateMode
  activePreset: string
  customPresets: PresetDefinition[]
  weeksAgo: number
  durationOverrideEnabled: boolean
  durationOverrideHours: number
  /** Custom range bounds, `YYYY-MM-DDTHH:mm` in the viewer's local timezone. */
  customStart: string
  customEnd: string
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

function defaults(): SettingsState {
  return {
    theme: 'dark',
    dateMode: 'all',
    activePreset: builtinPresets()[0]!.name,
    customPresets: [],
    weeksAgo: 0,
    durationOverrideEnabled: false,
    durationOverrideHours: 1.0,
    customStart: '',
    customEnd: '',
    timeFormat: 'friendly',
    outputFormat: 'plain',
    sortByTime: false,
    cleanup: true,
    useAi: false,
    aiProvider: 'openrouter',
    keepOriginal: false,
    showDiff: true,
    modelMode: 'auto',
    modelId: '',
    freeModelsOnly: false,
    openrouterApiKey: null,
    channelNames: {},
    channelAliases: {},
    channelsDisabled: [],
    showTechnicalLog: false,
    followTechnicalLog: true,
  }
}

function loadState(): SettingsState {
  const base = defaults()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return base
    }
    const parsed = JSON.parse(raw) as Partial<SettingsState>
    return { ...base, ...parsed }
  } catch {
    return base
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => loadState(),
  getters: {
    presets(state): PresetDefinition[] {
      return [...builtinPresets(), ...state.customPresets]
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
      if (idx < 0) {
        return ['Built-in presets cannot be modified.']
      }
      const otherNames = this.presets.map((p) => p.name).filter((n) => n !== originalName)
      const problems = validatePreset({ ...preset, builtin: false }, otherNames)
      if (problems.length === 0) {
        this.customPresets[idx] = { ...preset, builtin: false }
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
      if (this.activePreset === name) {
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
