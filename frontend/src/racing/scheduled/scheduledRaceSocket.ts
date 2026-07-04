export type ScheduledRaceRoomLiveStatus = 'staging' | 'countdown' | 'racing'

export interface ScheduledRaceRoomSnapshot {
  raceId: string
  roomId: string
  trackName: string
  startsAt: string
  serverTime: string
  status: ScheduledRaceRoomLiveStatus
  secondsUntilStart: number
  entrants?: ScheduledRaceRoomEntrant[]
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
  position?: { x: number; y: number; z: number }
  rotation?: { x: number; y: number; z: number }
  speed?: number
  headlightsEnabled?: boolean
  gameStatus?: string
}

export interface ScheduledRaceCountdownState {
  gameStatus: 'countdown' | 'racing'
  countdown: number
}

export interface ScheduledRaceLapProgressPayload {
  raceId: string
  entrantId: string
  playerId?: string
  identityKey?: string
  name?: string
  trackName?: string
  lapTimesMs: number[]
  totalTimeMs?: number
  finishedAt?: string
}

interface ScheduledRaceSocketLike {
  on(event: 'scheduledRaceRoomJoined', listener: (payload: ScheduledRaceRoomSnapshot) => void): void
  on(event: 'scheduledRaceRoomSnapshot', listener: (payload: ScheduledRaceRoomSnapshot | null) => void): void
  on(event: 'scheduledRaceCountdown', listener: (payload: ScheduledRaceRoomSnapshot) => void): void
  on(event: 'scheduledRaceLapProgress', listener: (payload: ScheduledRaceLapProgressPayload) => void): void
  on(event: 'scheduledRaceFinishAccepted', listener: (payload: ScheduledRaceLapProgressPayload) => void): void
}

export interface RegisterScheduledRaceSocketListenersOptions {
  socket: ScheduledRaceSocketLike
  getActiveRaceId: () => string | null | undefined
  onCountdownState: (state: ScheduledRaceCountdownState, snapshot: ScheduledRaceRoomSnapshot) => void
  onFinalCountdownStart?: (snapshot: ScheduledRaceRoomSnapshot) => void
  onRoomSnapshot?: (snapshot: ScheduledRaceRoomSnapshot) => void
  onLapProgress?: (payload: ScheduledRaceLapProgressPayload) => void
}

export const getScheduledRaceCountdownState = (
  snapshot: Pick<ScheduledRaceRoomSnapshot, 'status' | 'secondsUntilStart'>
): ScheduledRaceCountdownState => {
  if (snapshot.status === 'racing') {
    return { gameStatus: 'racing', countdown: 0 }
  }

  const secondsUntilStart = Math.max(0, Math.ceil(snapshot.secondsUntilStart))
  return {
    gameStatus: 'countdown',
    countdown: secondsUntilStart,
  }
}

export const shouldApplyScheduledRaceSnapshot = (
  snapshot: ScheduledRaceRoomSnapshot | null,
  activeRaceId: string | null | undefined
): snapshot is ScheduledRaceRoomSnapshot => {
  return Boolean(snapshot && activeRaceId && snapshot.raceId === activeRaceId)
}

export const registerScheduledRaceSocketListeners = ({
  socket,
  getActiveRaceId,
  onCountdownState,
  onFinalCountdownStart,
  onRoomSnapshot,
  onLapProgress,
}: RegisterScheduledRaceSocketListenersOptions): void => {
  const racesWithStartedBeeps = new Set<string>()

  const handleSnapshot = (snapshot: ScheduledRaceRoomSnapshot | null) => {
    if (!shouldApplyScheduledRaceSnapshot(snapshot, getActiveRaceId())) return
    onRoomSnapshot?.(snapshot)
    const countdownState = getScheduledRaceCountdownState(snapshot)
    if (countdownState.gameStatus === 'countdown' && countdownState.countdown > 0 && countdownState.countdown <= 3 && !racesWithStartedBeeps.has(snapshot.raceId)) {
      racesWithStartedBeeps.add(snapshot.raceId)
      onFinalCountdownStart?.(snapshot)
    }
    onCountdownState(countdownState, snapshot)
  }

  socket.on('scheduledRaceRoomJoined', handleSnapshot)
  socket.on('scheduledRaceRoomSnapshot', handleSnapshot)
  socket.on('scheduledRaceCountdown', handleSnapshot)
  socket.on('scheduledRaceLapProgress', payload => {
    if (payload.raceId !== getActiveRaceId()) return
    onLapProgress?.(payload)
  })
  socket.on('scheduledRaceFinishAccepted', payload => {
    if (payload.raceId !== getActiveRaceId()) return
    onLapProgress?.(payload)
  })
}
