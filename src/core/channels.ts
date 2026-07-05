/** ESO chat channels as of API 100025 (Murkmire/v4.2). */
export const CHAT_CHANNELS: Readonly<Record<number, string>> = {
  0: 'Say',
  1: 'Yell',
  2: 'Whisper',
  3: 'Group',
  4: 'Outgoing Whisper',
  5: 'Unused 1',
  6: 'Emote',
  7: 'NPC Say',
  8: 'NPC Yell',
  9: 'NPC Whisper',
  10: 'NPC Emote',
  11: 'System',
  12: 'Guild 1',
  13: 'Guild 2',
  14: 'Guild 3',
  15: 'Guild 4',
  16: 'Guild 5',
  17: 'Officer 1',
  18: 'Officer 2',
  19: 'Officer 3',
  20: 'Officer 4',
  21: 'Officer 5',
  22: 'Custom 1',
  23: 'Custom 2',
  24: 'Custom 3',
  25: 'Custom 4',
  26: 'Custom 5',
  27: 'Custom 6',
  28: 'Custom 7',
  29: 'Custom 8',
  30: 'Custom 9',
  31: 'Zone',
  32: 'Zone Intl 1',
  33: 'Zone Intl 2',
  34: 'Zone Intl 3',
  35: 'Zone Intl 4',
}

export const CHANNEL_SAY = 0
export const CHANNEL_EMOTE = 6

export function channelName(channel: number): string {
  return CHAT_CHANNELS[channel] ?? `Channel ${channel}`
}

/** All known channel names, for the rename dropdown. */
export const ALL_CHANNEL_NAMES: readonly string[] = Object.values(CHAT_CHANNELS)
