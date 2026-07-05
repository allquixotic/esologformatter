import { DateTime } from 'luxon'

export type TimeFormat =
  | 'friendly'
  | 'friendlynotz'
  | 'minfriendly'
  | 'orig'
  | 'european'
  | 'none'

export const TIME_FORMAT_OPTIONS: readonly { value: TimeFormat; label: string }[] = [
  { value: 'friendly', label: 'US: 02/17/19 03:38PM UTC-5' },
  { value: 'friendlynotz', label: 'US without timezone: 02/17/19 03:38PM' },
  { value: 'minfriendly', label: 'Minimal US: 2/17/19 3:38PM' },
  { value: 'orig', label: 'Raw: 2019-02-17T15:38:15.052-05:00' },
  { value: 'european', label: 'European (DD/MM/YY): 17/02/19 15:38 UTC-5' },
  { value: 'none', label: 'None' },
]

/** Render a log timestamp in the selected display format (empty string for `none`). */
export function formatTimestamp(iso: string, format: TimeFormat): string {
  switch (format) {
    case 'none':
      return ''
    case 'orig':
      return iso
    case 'friendly':
      return DateTime.fromISO(iso, { setZone: true }).toFormat('LL/dd/yy hh:mm:ssa ZZZZ')
    case 'friendlynotz':
      return DateTime.fromISO(iso, { setZone: true }).toFormat('LL/dd/yy hh:mm:ssa')
    case 'minfriendly':
      return DateTime.fromISO(iso, { setZone: true }).toFormat('L/d/yy h:mm:ssa')
    case 'european':
      return DateTime.fromISO(iso, { setZone: true }).toFormat('dd/LL/yy HH:mm:ss ZZZZ')
  }
}
