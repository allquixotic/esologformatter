// End-to-end run orchestration: resolve the date window, run the pure
// pipeline, then optionally apply LLM corrections (rconv contract: any AI
// failure falls back to the uncorrected text) and compute a diff.

import { diffLines, type Change } from 'diff'
import { DateTime } from 'luxon'
import { CHAT_CHANNELS } from '@/core/channels'
import { defaultOutputName, type NamingContext } from '@/core/naming'
import { runPipeline, type DateWindowMs } from '@/core/pipeline'
import { validateDurationHours } from '@/core/presets'
import { calculateEventWindow, effectiveWeeksAgo } from '@/core/schedule'
import { correctText } from '@/llm/correction'
import { loadCuratedCatalog, resolveModel } from '@/llm/curated'
import { OpenRouterProvider } from '@/llm/openrouter'
import { PromptApiProvider } from '@/llm/promptApi'
import type { CorrectionProvider } from '@/llm/types'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'

/** User-facing failure that should be shown as a notification. */
export class RunError extends Error {}

interface ResolvedWindow {
  window: DateWindowMs | null
  naming: NamingContext
  description: string
}

function resolveWindow(): ResolvedWindow {
  const settings = useSettingsStore()
  const format = settings.outputFormat

  if (settings.dateMode === 'preset') {
    const preset = settings.activePresetDef
    if (!preset) {
      throw new RunError(`Preset "${settings.activePreset}" not found.`)
    }
    let durationOverride: number | undefined
    if (settings.durationOverrideEnabled) {
      const problem = validateDurationHours(settings.durationOverrideHours)
      if (problem) {
        throw new RunError(problem)
      }
      durationOverride = Math.round(settings.durationOverrideHours * 60)
    }
    const weeks = effectiveWeeksAgo(settings.weeksAgo, preset)
    const w = calculateEventWindow(preset, weeks, durationOverride)
    return {
      window: { startMs: w.startMs, endMs: w.endMs },
      naming: {
        dateMode: 'preset',
        format,
        filePrefix: preset.filePrefix,
        fileDate: w.fileDate,
      },
      description: `Processing window: ${w.start.toFormat("yyyy-MM-dd'T'HH:mm")} → ${w.end.toFormat("yyyy-MM-dd'T'HH:mm")} (${preset.timezone})`,
    }
  }

  if (settings.dateMode === 'custom') {
    const start = DateTime.fromISO(settings.customStart)
    const end = DateTime.fromISO(settings.customEnd)
    if (!start.isValid || !end.isValid) {
      throw new RunError('Custom date range requires valid start and end times.')
    }
    if (end.toMillis() < start.toMillis()) {
      throw new RunError('Custom range end must be after its start.')
    }
    return {
      window: { startMs: start.toMillis(), endMs: end.toMillis() },
      naming: {
        dateMode: 'custom',
        format,
        startIso: settings.customStart,
        endIso: settings.customEnd,
      },
      description: `Processing window: ${settings.customStart} → ${settings.customEnd} (local time)`,
    }
  }

  return {
    window: null,
    naming: { dateMode: 'all', format },
    description: 'Processing entire log (no start/end filter)',
  }
}

function buildLabels(): Record<number, string> {
  const settings = useSettingsStore()
  const labels: Record<number, string> = {}
  for (const [key, baseName] of Object.entries(CHAT_CHANNELS)) {
    const channel = Number(key)
    labels[channel] = settings.channelLabel(channel, baseName)
  }
  return labels
}

async function makeProvider(onNote: (message: string) => void): Promise<CorrectionProvider | null> {
  const settings = useSettingsStore()
  if (settings.aiProvider === 'prompt-api') {
    return new PromptApiProvider((fraction) => {
      onNote(`Downloading on-device model: ${Math.round(fraction * 100)}%`)
    })
  }

  if (!settings.hasApiKey) {
    onNote('Warning: OpenRouter API key not configured; skipping AI corrections.')
    return null
  }
  const catalog = await loadCuratedCatalog().catch(() => null)
  if (catalog) {
    onNote(`Curated model snapshot loaded (${catalog.source}).`)
  }
  const preference = settings.modelMode === 'auto' ? 'auto' : settings.modelId
  const resolution = resolveModel(preference, settings.freeModelsOnly, catalog)
  onNote(resolution.note)
  return new OpenRouterProvider(
    settings.openrouterApiKey!,
    resolution.modelSlug,
    resolution.entry?.contextLength,
  )
}

/** Execute a full processing run based on the current stores. */
export async function generate(): Promise<void> {
  const settings = useSettingsStore()
  const session = useSessionStore()

  if (!session.hasInput) {
    throw new RunError('Load at least one chat log file first.')
  }

  session.startRun()
  try {
    session.beginStage('Calculate date filters')
    const { window, naming, description } = resolveWindow()
    session.note(description)
    const filename = defaultOutputName(naming)
    session.note(`Output file: ${filename}`)
    session.endStage('Calculate date filters')

    session.beginStage('Parse and filter lines')
    const content = runPipeline(session.lines, {
      format: settings.outputFormat,
      window,
      sortByTime: settings.sortByTime,
      cleanup: settings.cleanup,
      timeFormat: settings.timeFormat,
      channelEnabled: (ch) => settings.isChannelEnabled(ch),
      labels: buildLabels(),
      title: filename,
    })
    session.endStage('Parse and filter lines')

    if (content === '') {
      session.error('No log data found for the specified filters!')
      if (window) {
        session.note('  The log may not contain data for this time period.')
      }
      session.finishRun(null)
      throw new RunError('No log data matched the current filters.')
    }

    let finalContent = content
    let unedited: string | undefined
    let diffParts: Change[] | null = null

    const aiApplies = settings.useAi && settings.outputFormat !== 'table'
    if (aiApplies) {
      session.beginStage('Apply LLM corrections')
      const provider = await makeProvider((m) => session.note(m))
      if (provider) {
        unedited = content
        try {
          finalContent = await correctText(provider, content, {
            onProgress: (m) => session.note(m),
          })
          session.note(`Applied ${provider.label} grammar and spelling corrections`)
        } catch (err) {
          session.error(
            `Warning: Could not apply AI corrections: ${(err as Error).message}. Using original text.`,
          )
          finalContent = content
          unedited = undefined
        } finally {
          await provider.dispose?.()
        }
      }
      session.endStage('Apply LLM corrections')

      if (unedited !== undefined && settings.showDiff) {
        session.beginStage('Generate diff')
        diffParts = diffLines(unedited, finalContent)
        session.endStage('Generate diff')
      }
    } else if (settings.useAi) {
      session.note('AI corrections are not applied to HTML Table output.')
    }

    session.note(`Finished processing. Output ready as ${filename}`)
    session.finishRun(
      {
        filename,
        content: finalContent,
        unedited: settings.keepOriginal ? unedited : undefined,
        mime: settings.outputFormat === 'table' ? 'text/html' : 'text/plain',
      },
      diffParts,
    )
  } catch (err) {
    if (session.running) {
      session.error((err as Error).message)
      session.finishRun(null)
    }
    throw err
  }
}
