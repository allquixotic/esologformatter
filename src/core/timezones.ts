import { DateTime } from 'luxon'
import { wallClockMs } from './schedule'

const CUSTOM_INPUT_FORMAT = "yyyy-MM-dd'T'HH:mm"

type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[]
}

export class TimeZoneResolutionError extends Error {}

export interface ResolvedTimeWindow {
  /** Source event/range timezone. */
  sourceTimezone: string
  /** Timezone of the computer that recorded the raw log wall clock. */
  logTimezone: string
  sourceStart: DateTime
  sourceEnd: DateTime
  /** Source instants represented in the log-recording timezone. */
  logStart: DateTime
  logEnd: DateTime
  /** Inclusive naive wall-clock bounds used by the filtering pipeline. */
  startMs: number
  endMs: number
}

export function isValidTimeZone(zone: string): boolean {
  const value = zone.trim()
  if (value === '') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export function detectBrowserTimeZone(): string {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
  return detected && isValidTimeZone(detected) ? detected : 'UTC'
}

export function supportedTimeZones(): string[] {
  const supportedValuesOf = (Intl as IntlWithSupportedValues).supportedValuesOf
  const supported = supportedValuesOf ? supportedValuesOf('timeZone') : []
  return [...new Set(['UTC', detectBrowserTimeZone(), ...supported])].sort()
}

function requireTimeZone(zone: string, role: string): string {
  const value = zone.trim()
  if (!isValidTimeZone(value)) {
    throw new TimeZoneResolutionError(`Unknown ${role} timezone "${zone}".`)
  }
  return value
}

function requireDateTime(value: DateTime, role: string): void {
  if (!value.isValid) {
    throw new TimeZoneResolutionError(`Invalid ${role} date/time.`)
  }
}

/**
 * Convert source event/range instants into raw wall-clock values expected in a
 * log recorded in `logTimezone`. Browser timezone has no role in this step.
 */
export function projectWindowToLogTime(
  sourceStart: DateTime,
  sourceEnd: DateTime,
  logTimezone: string,
): ResolvedTimeWindow {
  requireDateTime(sourceStart, 'source start')
  requireDateTime(sourceEnd, 'source end')
  const targetZone = requireTimeZone(logTimezone, 'log-recording')
  const sourceZone = sourceStart.zoneName
  if (!sourceZone || !isValidTimeZone(sourceZone)) {
    throw new TimeZoneResolutionError(`Unknown event/range timezone "${sourceZone ?? ''}".`)
  }
  if (sourceEnd.toMillis() < sourceStart.toMillis()) {
    throw new TimeZoneResolutionError('Range end must be after its start.')
  }

  const logStart = sourceStart.setZone(targetZone)
  const logEnd = sourceEnd.setZone(targetZone)
  return {
    sourceTimezone: sourceZone,
    logTimezone: targetZone,
    sourceStart,
    sourceEnd,
    logStart,
    logEnd,
    startMs: wallClockMs(logStart, targetZone),
    endMs: wallClockMs(logEnd, targetZone),
  }
}

/** Parse custom wall-clock inputs in their explicit source zone, then project them to log time. */
export function resolveCustomTimeWindow(
  startText: string,
  endText: string,
  customRangeTimezone: string,
  logTimezone: string,
): ResolvedTimeWindow {
  const sourceZone = requireTimeZone(customRangeTimezone, 'custom-range')
  requireTimeZone(logTimezone, 'log-recording')

  const start = DateTime.fromFormat(startText, CUSTOM_INPUT_FORMAT, { zone: sourceZone })
  const end = DateTime.fromFormat(endText, CUSTOM_INPUT_FORMAT, { zone: sourceZone })
  if (!start.isValid || !end.isValid) {
    throw new TimeZoneResolutionError('Custom date range requires valid start and end times.')
  }
  if (end.toMillis() < start.toMillis()) {
    throw new TimeZoneResolutionError('Custom range end must be after its start.')
  }
  return projectWindowToLogTime(start, end, logTimezone)
}
