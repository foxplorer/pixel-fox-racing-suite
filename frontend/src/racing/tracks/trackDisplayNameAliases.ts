export const TRACK_DISPLAY_NAME_ALIASES: Record<string, string> = {
  Melbourne: 'Australia',
  Spa: 'Belgium',
  Silverstone: 'United Kingdom',
  'Nürburgring': 'Germany',
  Nurburgring: 'Germany'
}

export const normalizeTrackDisplayName = (trackName: string): string => {
  const trimmed = trackName.trim()
  return TRACK_DISPLAY_NAME_ALIASES[trimmed] ?? trimmed
}
