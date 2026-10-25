// End-to-end run orchestration: resolve the date window, run the pure
// pipeline, then optionally apply LLM corrections (rconv contract: any AI
// failure falls back to the uncorrected text) and compute a diff.

import { diffLines, type Change } from 'diff'
import { CHAT_CHANNELS } from '@/core/channels'
import { formatResolvedTimeWindow, resolveDateFilter } from '@/core/dateFilter'
import { defaultOutputName, uneditedName, type NamingContext } from '@/core/naming'
import { runPipeline, type DateWindowMs } from '@/core/pipeline'
import { detectBrowserTimeZone } from '@/core/timezones'
import type { InputFile } from '@/core/types'
import { verifyPermission, writeFileToDirectory } from '@/fs/access'
import { correctText } from '@/llm/correction'
import { loadCuratedCatalog, resolveModel } from '@/llm/curated'
import { OpenRouterProvider } from '@/llm/openrouter'
import { PromptApiProvider } from '@/llm/promptApi'
import type { CorrectionProvider } from '@/llm/types'
import { useSessionStore, type RunResult } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'

/** User-facing failure that should be shown as a notification. */
export class RunError extends Error {}

interface ResolvedWindow {
  window: DateWindowMs | null
  naming: NamingContext
  descriptions: string[]
}

function resolveWindow(): ResolvedWindow {
  const settings = useSettingsStore()
  const format = settings.outputFormat
  let resolved
  try {
    resolved = resolveDateFilter({
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
  } catch (error) {
    throw new RunError((error as Error).message)
  }

  const descriptions = [
    `Browser timezone (context only): ${detectBrowserTimeZone()}`,
    `Log-recording timezone: ${settings.logTimezone}`,
  ]

  if (settings.dateMode === 'preset') {
    const window = resolved.zonedWindow!
    const text = formatResolvedTimeWindow(window)
    descriptions.push(`Event window: ${text.sourceRange}`)
    descriptions.push(`Effective raw-log filter: ${text.rawLogRange} (inclusive to minute)`)
    return {
      window: resolved.window,
      naming: {
        dateMode: 'preset',
        format,
        filePrefix: resolved.filePrefix!,
        fileDate: resolved.fileDate!,
      },
      descriptions,
    }
  }

  if (settings.dateMode === 'custom') {
    const window = resolved.zonedWindow!
    const text = formatResolvedTimeWindow(window)
    descriptions.push(`Custom range: ${text.sourceRange}`)
    descriptions.push(`Effective raw-log filter: ${text.rawLogRange} (inclusive to minute)`)
    return {
      window: resolved.window,
      naming: {
        dateMode: 'custom',
        format,
        startIso: settings.customStart,
        endIso: settings.customEnd,
      },
      descriptions,
    }
  }

  descriptions.push('Processing entire log (no start/end filter)')
  return {
    window: null,
    naming: { dateMode: 'all', format },
    descriptions,
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
  if (settings.modelMode !== 'auto' && !settings.modelId.trim()) {
    throw new Error('Choose a model or use Automatic.')
  }
  const catalog = await loadCuratedCatalog()
  onNote('Current OpenRouter models loaded.')
  const preference = settings.modelMode === 'auto' ? 'auto' : settings.modelId
  const resolution = resolveModel(preference, settings.freeModelsOnly, catalog)
  onNote(resolution.note)
  return new OpenRouterProvider(
    settings.openrouterApiKey!,
    resolution.modelSlug,
    resolution.entry?.contextLength,
    { freeOnly: settings.freeModelsOnly, supportedParameters: resolution.entry.supportedParameters },
  )
}

/** Execute a full processing run based on the current stores. */
export async function generate(): Promise<void> {
  const settings = useSettingsStore()
  const session = useSessionStore()

  const folderMode = session.workDir !== null
  if (folderMode && session.logHandles.length === 0) {
    throw new RunError('Choose a log file inside your folder first.')
  }
  if (!folderMode && !session.hasInput) {
    throw new RunError('Load at least one chat log file first.')
  }

  session.startRun()
  try {
    if (folderMode) {
      // Re-read the selected files fresh from disk: the game may have
      // appended lines since the folder was connected.
      session.beginStage('Read log files')
      const dir = session.workDir!
      if (!(await verifyPermission(dir, true))) {
        throw new RunError('Access to the log folder was not granted.')
      }
      const inputs: InputFile[] = []
      for (const handle of session.logHandles) {
        const file = await handle.getFile()
        inputs.push({ name: file.name, text: await file.text() })
      }
      session.setFiles(inputs)
      session.note(
        `Read ${inputs.length} file(s) fresh from \u201c${dir.name}\u201d — ${session.lines.length.toLocaleString()} chat lines`,
      )
      session.endStage('Read log files')
    }

    session.beginStage('Calculate date filters')
    const { window, naming, descriptions } = resolveWindow()
    for (const description of descriptions) {
      session.note(description)
    }
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
      let provider: CorrectionProvider | null = null
      try {
        provider = await makeProvider((m) => session.note(m))
        if (provider) {
          unedited = content
          finalContent = await correctText(provider, content, {
            onProgress: (m) => session.note(m),
          })
          session.note(`Applied ${provider.label} grammar and spelling corrections`)
        }
      } catch (err) {
        session.error(
          `Warning: Could not apply AI corrections: ${(err as Error).message}. Using original text.`,
        )
        finalContent = content
        unedited = undefined
      } finally {
        await provider?.dispose?.()
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

    const result: RunResult = {
      filename,
      content: finalContent,
      unedited: settings.keepOriginal ? unedited : undefined,
      mime: settings.outputFormat === 'table' ? 'text/html' : 'text/plain',
    }

    if (folderMode) {
      // Folder mode saves outputs straight back into the connected folder.
      session.beginStage('Write output files')
      try {
        await writeFileToDirectory(session.workDir!, result.filename, result.content)
        let written = result.filename
        if (result.unedited !== undefined) {
          const sibling = uneditedName(result.filename)
          await writeFileToDirectory(session.workDir!, sibling, result.unedited)
          written += `, ${sibling}`
        }
        result.writtenTo = session.workDir!.name
        session.note(`Wrote ${written} to \u201c${session.workDir!.name}\u201d`)
      } catch (err) {
        session.error(
          `Could not write output to the folder: ${(err as Error).message} — use Download instead.`,
        )
      }
      session.endStage('Write output files')
    }

    session.note(`Finished processing. Output ready as ${filename}`)
    session.finishRun(result, diffParts)
  } catch (err) {
    if (session.running) {
      session.error((err as Error).message)
      session.finishRun(null)
    }
    throw err
  }
}
