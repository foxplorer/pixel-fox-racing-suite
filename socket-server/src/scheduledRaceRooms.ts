export type ScheduledRaceRoomStatus = 'staging' | 'countdown' | 'racing'

export interface ScheduledRaceRoomJoinInput {
  raceId: string
  trackName: string
  entrantId: string
  gridSlot: number
  startsAt: string
}

export interface ScheduledRaceRoomEntrant {
  playerId: string
  identityKey: string
  name: string
  carColor: string
  originOutpoint?: string | null
  entrantId: string
  gridSlot: number
  joinedAt: number
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  speed: number
  headlightsEnabled?: boolean
  gameStatus: string
}

export interface ScheduledRaceRoomSnapshot {
  raceId: string
  roomId: string
  trackName: string
  startsAt: string
  serverTime: string
  status: ScheduledRaceRoomStatus
  secondsUntilStart: number
  entrants: ScheduledRaceRoomEntrant[]
}

export interface ScheduledRaceFinishReport {
  raceId: string
  entrantId: string
  totalTimeMs: number
  lapTimesMs: number[]
}

export interface ScheduledRaceLapProgressReport {
  raceId: string
  entrantId: string
  lapTimesMs: number[]
}

export const SCHEDULED_RACE_COUNTDOWN_WINDOW_MS = 15_000
export const SCHEDULED_RACE_TIMEOUT_MS = 15 * 60 * 1000
export const SCHEDULED_RACE_MAX_GRID_SLOT = 6

export const getScheduledRaceRoomId = (raceId: string): string => `scheduled_race:${raceId}`

export const isValidScheduledRaceRoomJoinInput = (input: Partial<ScheduledRaceRoomJoinInput>): input is ScheduledRaceRoomJoinInput => {
  if (!input.raceId?.trim()) return false
  if (!input.trackName?.trim()) return false
  if (!input.entrantId?.trim()) return false
  const gridSlot = input.gridSlot
  if (!Number.isInteger(gridSlot) || gridSlot === undefined || gridSlot < 1 || gridSlot > SCHEDULED_RACE_MAX_GRID_SLOT) return false
  const startsAtMs = Date.parse(input.startsAt || '')
  return Number.isFinite(startsAtMs)
}

export const getScheduledRaceRoomStatus = (startsAtMs: number, nowMs: number): ScheduledRaceRoomStatus => {
  const msUntilStart = startsAtMs - nowMs
  if (msUntilStart <= 0) return 'racing'
  if (msUntilStart <= SCHEDULED_RACE_COUNTDOWN_WINDOW_MS) return 'countdown'
  return 'staging'
}

export const isValidScheduledRaceFinishReport = (input: Partial<ScheduledRaceFinishReport>): input is ScheduledRaceFinishReport => {
  if (!input.raceId?.trim()) return false
  if (!input.entrantId?.trim()) return false
  const totalTimeMs = input.totalTimeMs
  if (!Number.isFinite(totalTimeMs) || totalTimeMs === undefined || totalTimeMs <= 0) return false
  if (!Array.isArray(input.lapTimesMs) || input.lapTimesMs.length === 0) return false
  return input.lapTimesMs.every(lapTimeMs => Number.isFinite(lapTimeMs) && lapTimeMs > 0)
}

export const isValidScheduledRaceLapProgressReport = (input: Partial<ScheduledRaceLapProgressReport>): input is ScheduledRaceLapProgressReport => {
  if (!input.raceId?.trim()) return false
  if (!input.entrantId?.trim()) return false
  if (!Array.isArray(input.lapTimesMs)) return false
  if (input.lapTimesMs.length > 10) return false
  return input.lapTimesMs.every(lapTimeMs => Number.isFinite(lapTimeMs) && lapTimeMs > 0)
}

export class ScheduledRaceRoomRegistry {
  private readonly entrantsByRace = new Map<string, Map<string, ScheduledRaceRoomEntrant>>()
  private readonly roomMetadata = new Map<string, { raceId: string; trackName: string; startsAt: string }>()
  private readonly raceByPlayerId = new Map<string, string>()

  joinRace(input: ScheduledRaceRoomJoinInput, entrant: Omit<ScheduledRaceRoomEntrant, 'entrantId' | 'gridSlot' | 'joinedAt'>, nowMs: number): ScheduledRaceRoomSnapshot {
    this.leavePlayer(entrant.playerId, nowMs)

    const roomEntrants = this.entrantsByRace.get(input.raceId) || new Map<string, ScheduledRaceRoomEntrant>()
    for (const [playerId, existingEntrant] of roomEntrants) {
      if (existingEntrant.entrantId === input.entrantId) {
        roomEntrants.delete(playerId)
        this.raceByPlayerId.delete(playerId)
      }
    }
    roomEntrants.set(entrant.playerId, {
      ...entrant,
      entrantId: input.entrantId,
      gridSlot: input.gridSlot,
      joinedAt: nowMs,
      headlightsEnabled: entrant.headlightsEnabled ?? true,
    })

    this.entrantsByRace.set(input.raceId, roomEntrants)
    this.roomMetadata.set(input.raceId, {
      raceId: input.raceId,
      trackName: input.trackName,
      startsAt: input.startsAt,
    })
    this.raceByPlayerId.set(entrant.playerId, input.raceId)

    return this.getSnapshot(input.raceId, nowMs)
  }

  updateEntrant(playerId: string, updates: Partial<Pick<ScheduledRaceRoomEntrant, 'position' | 'rotation' | 'speed' | 'headlightsEnabled' | 'gameStatus'>>): ScheduledRaceRoomSnapshot | null {
    const raceId = this.raceByPlayerId.get(playerId)
    if (!raceId) return null
    const entrant = this.entrantsByRace.get(raceId)?.get(playerId)
    if (!entrant) return null

    Object.assign(entrant, updates)
    return this.getSnapshot(raceId, Date.now())
  }

  leavePlayer(playerId: string, nowMs = Date.now()): string | null {
    const raceId = this.raceByPlayerId.get(playerId)
    if (!raceId) return null

    this.raceByPlayerId.delete(playerId)
    const roomEntrants = this.entrantsByRace.get(raceId)
    const entrant = roomEntrants?.get(playerId)
    const metadata = this.roomMetadata.get(raceId)
    const startsAtMs = Date.parse(metadata?.startsAt || '')
    if (entrant && Number.isFinite(startsAtMs) && getScheduledRaceRoomStatus(startsAtMs, nowMs) === 'racing') {
      entrant.speed = 0
      entrant.gameStatus = 'disconnected'
    } else {
      roomEntrants?.delete(playerId)
    }
    if (roomEntrants && roomEntrants.size === 0) {
      this.entrantsByRace.delete(raceId)
      this.roomMetadata.delete(raceId)
    }
    return raceId
  }

  getRaceIdForPlayer(playerId: string): string | null {
    return this.raceByPlayerId.get(playerId) || null
  }

  getEntrantForPlayer(playerId: string): ScheduledRaceRoomEntrant | null {
    const raceId = this.raceByPlayerId.get(playerId)
    if (!raceId) return null
    return this.entrantsByRace.get(raceId)?.get(playerId) || null
  }

  getActiveRaceIds(): string[] {
    return Array.from(this.entrantsByRace.keys())
  }

  getSnapshot(raceId: string, nowMs: number): ScheduledRaceRoomSnapshot {
    const metadata = this.roomMetadata.get(raceId)
    if (!metadata) {
      throw new Error(`Unknown scheduled race room: ${raceId}`)
    }

    const startsAtMs = Date.parse(metadata.startsAt)
    return {
      ...metadata,
      roomId: getScheduledRaceRoomId(raceId),
      serverTime: new Date(nowMs).toISOString(),
      status: getScheduledRaceRoomStatus(startsAtMs, nowMs),
      secondsUntilStart: Math.max(0, Math.ceil((startsAtMs - nowMs) / 1000)),
      entrants: Array.from(this.entrantsByRace.get(raceId)?.values() || [])
        .sort((a, b) => a.gridSlot - b.gridSlot || a.joinedAt - b.joinedAt),
    }
  }
}
