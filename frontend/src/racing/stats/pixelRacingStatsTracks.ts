import type { PixelRacingGameResult } from '../transactions/lapResult'
import { normalizeTrackDisplayName } from '../tracks/trackDisplayNameAliases'
import { OFFICIAL_TRACK_DISPLAY_NAMES } from '../tracks/trackEvents'

export const LEGACY_PIXEL_RACING_STATS_TRACK_NAME = 'San Luis'
export const PIXEL_RACING_CHAMPIONSHIP_TAB_ID = 'championship'

export const getPixelRacingStatsTrackName = (
  result: Pick<PixelRacingGameResult, 'trackname'>
): string => {
  const trackName = result.trackname?.trim()
  return trackName ? normalizeTrackDisplayName(trackName) : LEGACY_PIXEL_RACING_STATS_TRACK_NAME
}

export const getPixelRacingStatsTrackTabId = (trackName: string): string => {
  return trackName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'track'
}

export const getPixelRacingStatsTrackNames = (
  results: Array<Pick<PixelRacingGameResult, 'trackname'>>
): string[] => {
  const discoveredNames = new Set(results.map(getPixelRacingStatsTrackName))
  const orderedNames = OFFICIAL_TRACK_DISPLAY_NAMES.filter(trackName => discoveredNames.has(trackName))

  for (const trackName of OFFICIAL_TRACK_DISPLAY_NAMES) {
    discoveredNames.delete(trackName)
  }

  return [
    ...orderedNames,
    ...Array.from(discoveredNames).sort((a, b) => a.localeCompare(b))
  ]
}

export const groupPixelRacingResultsByStatsTrack = (
  results: PixelRacingGameResult[]
): Record<string, PixelRacingGameResult[]> => {
  const grouped: Record<string, PixelRacingGameResult[]> = {}

  for (const result of results) {
    const trackName = getPixelRacingStatsTrackName(result)
    grouped[trackName] = grouped[trackName] || []
    grouped[trackName].push(result)
  }

  for (const trackName of Object.keys(grouped)) {
    grouped[trackName] = grouped[trackName]
      .slice()
      .sort((a, b) => Number(a.laptime) - Number(b.laptime))
  }

  return grouped
}
