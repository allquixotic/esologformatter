import { beforeEach, describe, expect, test } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'
import { builtinPresets } from '../src/core/presets'
import { mergeStoredSettings, useSettingsStore } from '../src/stores/settings'
import { preferredDefaultModel, type CuratedCatalog, type CuratedEntry } from '../src/llm/curated'
import { generate } from '../src/app/runner'

const luna = '~openai/gpt-luna-latest'
const flash = '~google/gemini-flash-latest'
const haiku = '~anthropic/claude-haiku-latest'
function catalog(...slugs: string[]): CuratedCatalog {
  const cheap: CuratedEntry[] = slugs.map((slug) => ({
    slug, displayName: slug, provider: slug.split('/')[0]!, tier: 'cheap',
    priceInPerMillion: 1, priceOutPerMillion: 2, pricePerRequest: 0,
    contextLength: 32_768, supportedParameters: [],
  }))
  return { cheap, free: [], paid: [], source: 'live', generatedAt: 'now' }
}

beforeEach(() => setActivePinia(createPinia()))

describe('saved event presets', () => {
  test('V14_EditBuiltinCreatesRememberedCustomOverrideAndDeletionRestoresFactory', () => {
    const settings = useSettingsStore()
    const original = builtinPresets()[0]!
    expect(settings.updatePreset(original.name, { ...original, weekday: 'monday', startTime: '18:30' })).toEqual([])
    expect(settings.presets.filter((p) => p.name === original.name)).toHaveLength(1)
    expect(settings.activePresetDef?.builtin).toBe(false)
    expect(settings.activePresetDef?.weekday).toBe('monday')
    expect(builtinPresets()[0]).toEqual(original)
    const restored = mergeStoredSettings(JSON.parse(JSON.stringify(settings.$state)))
    settings.$patch(restored)
    expect(settings.activePresetDef?.startTime).toBe('18:30')
    expect(settings.deletePreset(original.name)).toBe(true)
    expect(settings.activePresetDef).toEqual(original)
  })

  test('V14_RenamedBuiltinCopyBecomesActiveWithoutRemovingFactoryPreset', () => {
    const settings = useSettingsStore()
    const original = builtinPresets()[0]!
    expect(settings.updatePreset(original.name, { ...original, name: 'My evening event' })).toEqual([])
    expect(settings.activePreset).toBe('My evening event')
    expect(settings.presets.find((p) => p.name === original.name)).toEqual(original)
    expect(settings.activePresetDef?.builtin).toBe(false)
    expect(settings.updatePreset('My evening event', { ...original, name: builtinPresets()[1]!.name })).not.toEqual([])
  })
})

test('V15_CollapseChoicesRoundTripWithoutChangingAiOrPresets', () => {
  const settings = useSettingsStore()
  settings.useAi = true
  settings.setSectionCollapsed('ai', true)
  settings.setSectionCollapsed('options', true)
  settings.setSectionCollapsed('preview', true)
  const restored = mergeStoredSettings(JSON.parse(JSON.stringify(settings.$state)))
  expect(restored.collapsedSections).toEqual({ diff: true, ai: true, options: true, preview: true })
  expect(restored.useAi).toBe(true)
  expect(restored.activePreset).toBe(settings.activePreset)
  expect(mergeStoredSettings({}).collapsedSections).toEqual({ diff: true })
})

describe('first model default', () => {
  test('V16_BlankSelectionAlsoBlocksWhileDiscoveryIsPending', async () => {
    const settings = useSettingsStore()
    settings.useAi = true
    await expect(generate()).rejects.toThrow('Select an AI model')
  })

  test.each([
    [[haiku, flash, luna], luna], [[haiku, flash], flash], [[haiku], haiku], [[], undefined],
  ] as [string[], string | undefined][])('V16_UsesExactFallbackOrder_%j', (slugs, expected) => {
    expect(preferredDefaultModel(catalog(...slugs))?.slug).toBe(expected)
    const settings = useSettingsStore()
    settings.initializeModel(catalog(...slugs))
    expect(settings.modelMode).toBe('curated')
    expect(settings.modelId).toBe(expected ?? '')
    expect(settings.modelSelectionOrigin).toBe('default')
  })

  test('V16_NoMatchStopsRetryingEvenAfterReloadAndBlocksAiGeneration', async () => {
    const settings = useSettingsStore()
    settings.initializeModel(catalog())
    settings.$patch(mergeStoredSettings(JSON.parse(JSON.stringify(settings.$state))))
    settings.initializeModel(catalog(luna))
    expect(settings.modelId).toBe('')
    settings.useAi = true
    await expect(generate()).rejects.toThrow('Select an AI model')
  })

  test('V16_ExplicitSelectionSurvivesAsyncCatalogAndSubsequentVisits', () => {
    const settings = useSettingsStore()
    settings.selectModel('vendor/my-model')
    settings.initializeModel(catalog(luna))
    expect(settings.modelId).toBe('vendor/my-model')
    expect(mergeStoredSettings(JSON.parse(JSON.stringify(settings.$state))).modelSelectionOrigin).toBe('user')
    settings.selectModelMode('auto')
    settings.initializeModel(catalog(luna))
    expect(settings.modelMode).toBe('auto')
  })

  test('V16_MigrationPreservesExistingModelsAndExplicitModes', () => {
    expect(mergeStoredSettings({ modelMode: 'manual', modelId: 'vendor/custom' }).modelSelectionOrigin).toBe('user')
    expect(mergeStoredSettings({ modelMode: 'curated', modelId: '' }).modelSelectionOrigin).toBe('pending')
    const freeAutomatic = mergeStoredSettings({ modelMode: 'auto', freeModelsOnly: true })
    expect(freeAutomatic.modelMode).toBe('auto')
    expect(freeAutomatic.modelSelectionOrigin).toBe('user')
    const oldDefaults = mergeStoredSettings({ modelMode: 'auto', modelId: '' })
    expect(oldDefaults.modelMode).toBe('curated')
    expect(oldDefaults.modelSelectionOrigin).toBe('pending')
  })
})
