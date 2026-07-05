// Event preset system ported from rconv-core/src/config.rs.

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export const WEEKDAYS: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

export interface PresetDefinition {
  name: string
  weekday: Weekday
  /** IANA timezone the event is scheduled in, e.g. `America/New_York`. */
  timezone: string
  /** Local start time in the preset timezone, `HH:MM`. */
  startTime: string
  durationMinutes: number
  filePrefix: string
  defaultWeeksAgo: number
  builtin: boolean
}

export const SATURDAY_PRESET_NAME = 'Saturday 10pm-midnight'
export const TUESDAY_7_PRESET_NAME = 'Tuesday 7pm'
export const TUESDAY_8_PRESET_NAME = 'Tuesday 8pm'
export const FRIDAY_6_PRESET_NAME = 'Friday 6pm'

export function builtinPresets(): PresetDefinition[] {
  return [
    {
      name: SATURDAY_PRESET_NAME,
      weekday: 'saturday',
      timezone: 'America/New_York',
      startTime: '22:00',
      durationMinutes: 145,
      filePrefix: 'conv',
      defaultWeeksAgo: 0,
      builtin: true,
    },
    {
      name: TUESDAY_7_PRESET_NAME,
      weekday: 'tuesday',
      timezone: 'America/New_York',
      startTime: '19:00',
      durationMinutes: 60,
      filePrefix: 'rsm7',
      defaultWeeksAgo: 0,
      builtin: true,
    },
    {
      name: TUESDAY_8_PRESET_NAME,
      weekday: 'tuesday',
      timezone: 'America/New_York',
      startTime: '20:00',
      durationMinutes: 60,
      filePrefix: 'rsm8',
      defaultWeeksAgo: 0,
      builtin: true,
    },
    {
      name: FRIDAY_6_PRESET_NAME,
      weekday: 'friday',
      timezone: 'America/New_York',
      startTime: '18:00',
      durationMinutes: 60,
      filePrefix: 'tp6',
      defaultWeeksAgo: 0,
      builtin: true,
    },
  ]
}

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/

/** Validate a preset; returns a list of human-readable problems (empty = valid). */
export function validatePreset(
  preset: PresetDefinition,
  existingNames: readonly string[],
): string[] {
  const problems: string[] = []
  if (preset.name.trim() === '') {
    problems.push('Name is required.')
  }
  if (existingNames.some((n) => n === preset.name)) {
    problems.push(`A preset named "${preset.name}" already exists.`)
  }
  if (!WEEKDAYS.includes(preset.weekday)) {
    problems.push('Weekday is invalid.')
  }
  if (!TIME_RE.test(preset.startTime)) {
    problems.push('Start time must be HH:MM (24-hour).')
  }
  if (!Number.isFinite(preset.durationMinutes) || preset.durationMinutes <= 0) {
    problems.push('Duration must be greater than zero minutes.')
  }
  if (preset.filePrefix.trim() === '') {
    problems.push('File prefix is required.')
  }
  if (!Number.isInteger(preset.defaultWeeksAgo) || preset.defaultWeeksAgo < 0) {
    problems.push('Default weeks ago must be a non-negative integer.')
  }
  try {
    // Throws RangeError for unknown IANA zones.
    new Intl.DateTimeFormat('en-US', { timeZone: preset.timezone })
  } catch {
    problems.push(`Unknown timezone "${preset.timezone}".`)
  }
  return problems
}

/** rconv duration override validation (hours must be finite and >= 1). */
export function validateDurationHours(hours: number): string | null {
  if (!Number.isFinite(hours)) {
    return 'Duration override hours must be a finite number.'
  }
  if (hours < 1.0) {
    return 'Duration override hours must be at least 1.0.'
  }
  return null
}
