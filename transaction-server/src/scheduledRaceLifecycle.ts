import {
  SCHEDULED_RACE_CAR_TRACKS,
  type ScheduledRaceStatus,
  type ScheduledRaceTrackName,
} from './scheduledRaceTypes.js'

export const SCHEDULED_RACE_MAX_ENTRANTS = 6
export const SCHEDULED_RACE_LAPS_REQUIRED = 3
export const SCHEDULED_RACE_MIN_ENTRANTS = 2
export const SCHEDULED_RACE_STAGING_WINDOW_MS = 5 * 60 * 1000
export const SCHEDULED_RACE_SIGNUP_CLOSE_MS = 60 * 1000
export const SCHEDULED_RACE_COUNTDOWN_WINDOW_MS = 15 * 1000
export const SCHEDULED_RACE_LATE_ENTRY_GRACE_MS = 30 * 1000
export const SCHEDULED_RACE_TIMEOUT_MS = 15 * 60 * 1000
export const SCHEDULED_RACE_DEFAULT_INTERVAL_MS = 60 * 60 * 1000

const TRACK_ID_SLUGS: Record<ScheduledRaceTrackName, string> = {
  Australia: 'australia',
  'San Luis': 'san-luis',
  Belgium: 'belgium',
  'United Kingdom': 'united-kingdom',
  Germany: 'germany',
  Volcanoes: 'volcanoes',
}

export const isScheduledRaceTrackName = (trackName: string | null | undefined): trackName is ScheduledRaceTrackName => (
  Boolean(trackName && (SCHEDULED_RACE_CAR_TRACKS as readonly string[]).includes(trackName))
)

export const normalizeScheduledRaceTrackName = (trackName: string | null | undefined): ScheduledRaceTrackName | null => {
  const trimmed = trackName?.trim()
  return isScheduledRaceTrackName(trimmed) ? trimmed : null
}

export const floorToUtcHourMs = (timestampMs: number): number => {
  const date = new Date(timestampMs)
  date.setUTCMinutes(0, 0, 0)
  return date.getTime()
}

export const nextUtcHourMs = (timestampMs: number): number => floorToUtcHourMs(timestampMs) + 60 * 60 * 1000

export const normalizeScheduledRaceIntervalMs = (intervalMs: number | null | undefined): number => {
  if (!Number.isFinite(intervalMs) || !intervalMs) return SCHEDULED_RACE_DEFAULT_INTERVAL_MS
  return Math.max(60 * 1000, Math.floor(intervalMs))
}

export const floorToScheduledRaceIntervalMs = (
  timestampMs: number,
  intervalMs = SCHEDULED_RACE_DEFAULT_INTERVAL_MS
): number => {
  const normalizedIntervalMs = normalizeScheduledRaceIntervalMs(intervalMs)
  return Math.floor(timestampMs / normalizedIntervalMs) * normalizedIntervalMs
}

export const nextScheduledRaceStartMs = (
  timestampMs: number,
  intervalMs = SCHEDULED_RACE_DEFAULT_INTERVAL_MS
): number => {
  const normalizedIntervalMs = normalizeScheduledRaceIntervalMs(intervalMs)
  return floorToScheduledRaceIntervalMs(timestampMs, normalizedIntervalMs) + normalizedIntervalMs
}

export const buildScheduledRaceId = (trackName: ScheduledRaceTrackName, startsAtMs: number): string => {
  const isoHour = new Date(startsAtMs).toISOString().replace(/[-:]/g, '').replace('.000Z', 'Z')
  return `${TRACK_ID_SLUGS[trackName]}-${isoHour}`
}

export const getUpcomingScheduledRaceStarts = (
  nowMs: number,
  limit: number,
  intervalMs = SCHEDULED_RACE_DEFAULT_INTERVAL_MS
): number[] => {
  const normalizedIntervalMs = normalizeScheduledRaceIntervalMs(intervalMs)
  const starts: number[] = []
  const firstStartMs = nextScheduledRaceStartMs(nowMs, normalizedIntervalMs)
  for (let index = 0; index < limit; index++) {
    starts.push(firstStartMs + index * normalizedIntervalMs)
  }
  return starts
}

export const getScheduledRaceTrackForStart = (
  startsAtMs: number,
  intervalMs = SCHEDULED_RACE_DEFAULT_INTERVAL_MS
): ScheduledRaceTrackName => {
  const normalizedIntervalMs = normalizeScheduledRaceIntervalMs(intervalMs)
  const slotIndex = Math.floor(floorToScheduledRaceIntervalMs(startsAtMs, normalizedIntervalMs) / normalizedIntervalMs)
  return SCHEDULED_RACE_CAR_TRACKS[((slotIndex % SCHEDULED_RACE_CAR_TRACKS.length) + SCHEDULED_RACE_CAR_TRACKS.length) % SCHEDULED_RACE_CAR_TRACKS.length]
}

export interface ResolveScheduledRaceStatusInput {
  startsAtMs: number
  nowMs: number
  signupCount: number
  stagedCount: number
  currentStatus?: ScheduledRaceStatus
}

export const resolveScheduledRaceStatus = ({
  startsAtMs,
  nowMs,
  signupCount,
  stagedCount,
  currentStatus = 'scheduled',
}: ResolveScheduledRaceStatusInput): ScheduledRaceStatus => {
  if (['finalizing', 'settled', 'cancelled', 'no_contest'].includes(currentStatus)) {
    return currentStatus
  }

  const untilStartMs = startsAtMs - nowMs

  if (untilStartMs <= -SCHEDULED_RACE_TIMEOUT_MS) {
    return 'finalizing'
  }

  if (untilStartMs <= -SCHEDULED_RACE_LATE_ENTRY_GRACE_MS) {
    return stagedCount >= SCHEDULED_RACE_MIN_ENTRANTS ? 'racing' : 'cancelled'
  }

  if (untilStartMs <= 0) {
    return stagedCount >= SCHEDULED_RACE_MIN_ENTRANTS ? 'racing' : 'countdown'
  }

  if (untilStartMs <= SCHEDULED_RACE_COUNTDOWN_WINDOW_MS) {
    return signupCount >= SCHEDULED_RACE_MIN_ENTRANTS ? 'countdown' : 'cancelled'
  }

  if (untilStartMs <= SCHEDULED_RACE_SIGNUP_CLOSE_MS && signupCount < SCHEDULED_RACE_MIN_ENTRANTS) {
    return 'cancelled'
  }

  if (untilStartMs <= SCHEDULED_RACE_STAGING_WINDOW_MS) {
    return 'staging'
  }

  return 'scheduled'
}
