import { defineStore } from 'pinia'
import type { Change } from 'diff'
import { CHAT_CHANNELS } from '@/core/channels'
import { groupByChannel, parseFiles } from '@/core/parser'
import type { ChatLine, InputFile } from '@/core/types'

export interface LogEvent {
  kind: 'begin' | 'end' | 'note' | 'error'
  stage?: string
  message: string
  /** ms since the run started */
  at: number
}

export interface RunResult {
  filename: string
  content: string
  /** Pre-AI text, retained when "keep original" is enabled. */
  unedited?: string
  mime: string
}

export interface ChannelSummary {
  channel: number
  baseName: string
  count: number
  examples: ChatLine[]
}

interface SessionState {
  files: InputFile[]
  lines: ChatLine[]
  running: boolean
  runStartedAt: number
  currentStage: string | null
  log: LogEvent[]
  diffParts: Change[] | null
  result: RunResult | null
}

export const useSessionStore = defineStore('session', {
  state: (): SessionState => ({
    files: [],
    lines: [],
    running: false,
    runStartedAt: 0,
    currentStage: null,
    log: [],
    diffParts: null,
    result: null,
  }),
  getters: {
    hasInput(state): boolean {
      return state.lines.length > 0
    },
    channelSummaries(state): ChannelSummary[] {
      const groups = groupByChannel(state.lines)
      return [...groups.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([channel, lines]) => ({
          channel,
          baseName: CHAT_CHANNELS[channel] ?? `Channel ${channel}`,
          count: lines.length,
          examples: lines.slice(0, 3),
        }))
    },
  },
  actions: {
    setFiles(files: InputFile[]) {
      this.files = files
      this.lines = parseFiles(files)
      this.result = null
      this.diffParts = null
      this.log = []
    },
    reset() {
      this.$reset()
    },
    startRun() {
      this.running = true
      this.runStartedAt = performance.now()
      this.currentStage = null
      this.log = []
      this.diffParts = null
      this.result = null
    },
    private_push(event: Omit<LogEvent, 'at'>) {
      this.log.push({ ...event, at: performance.now() - this.runStartedAt })
    },
    beginStage(stage: string) {
      this.currentStage = stage
      this.private_push({ kind: 'begin', stage, message: `BEGIN: ${stage}` })
    },
    endStage(stage: string) {
      this.private_push({ kind: 'end', stage, message: `END: ${stage}` })
      this.currentStage = null
    },
    note(message: string) {
      this.private_push({ kind: 'note', stage: this.currentStage ?? undefined, message })
    },
    error(message: string) {
      this.private_push({ kind: 'error', stage: this.currentStage ?? undefined, message })
    },
    finishRun(result: RunResult | null, diffParts: Change[] | null = null) {
      this.result = result
      this.diffParts = diffParts
      this.running = false
      this.currentStage = null
    },
  },
})
