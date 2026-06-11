export interface RaceStartStateHandlers {
  setGameStatus: (gameStatus: 'loading') => void
  setScore: (score: number) => void
  setDistanceTraveled: (distanceTraveled: number) => void
  setLapTime: (lapTime: number) => void
  setLapTimes: (lapTimes: number[]) => void
  setLapTxids: (lapTxids: Record<number, string>) => void
  setCountdown: (countdown: number) => void
}

export interface JoinedRaceStartStateHandlers extends RaceStartStateHandlers {
  setHasJoined: (hasJoined: boolean) => void
}

export interface StartRaceForSelectedTrackInput extends JoinedRaceStartStateHandlers {
  selectedTrackName: string
  localTrackName: string
  selectedColor: string
  onTrackChange?: (trackName: string, selectedColor?: string) => void
  spawnPosition?: { x: number; y: number; z: number } | null
  carPosition?: { x: number; y: number; z: number } | null
  setCarPosition?: (position: { x: number; y: number; z: number }) => void
}

export type StartRaceForSelectedTrackResult = 'handoff' | 'started'

export interface ImmediateRaceStartInput extends RaceStartStateHandlers {
  startRaceImmediately: boolean
  hasFoxOriginOutpoint: boolean
  gameStatus: string
  hasStartedRace: boolean
  spawnPosition?: { x: number; y: number; z: number } | null
  carPosition?: { x: number; y: number; z: number } | null
  fallbackPosition?: { x: number; y: number; z: number }
  setCarPosition?: (position: { x: number; y: number; z: number }) => void
  setHasStartedRace: (hasStartedRace: boolean) => void
}

export type ImmediateRaceStartResult = 'started' | 'reset' | 'unchanged'

export interface RaceShowroomResetStateHandlers {
  setGameStatus: (gameStatus: 'showroom') => void
  setHasJoined: (hasJoined: boolean) => void
  setScore: (score: number) => void
  setDistanceTraveled: (distanceTraveled: number) => void
  setLapTime: (lapTime: number) => void
  setLapTimes: (lapTimes: number[]) => void
  setLapTxids: (lapTxids: Record<number, string>) => void
}

export const applyRaceLoadingStartState = (handlers: RaceStartStateHandlers): void => {
  handlers.setGameStatus('loading')
  handlers.setScore(0)
  handlers.setDistanceTraveled(0)
  handlers.setLapTime(0)
  handlers.setLapTimes([])
  handlers.setLapTxids({})
  handlers.setCountdown(3)
}

export const shouldAutoEnterRaceShowroom = ({
  hasFoxOriginOutpoint,
  gameStatus,
  startRaceImmediately = false
}: {
  hasFoxOriginOutpoint: boolean
  gameStatus: string
  startRaceImmediately?: boolean
}): boolean => {
  return hasFoxOriginOutpoint && gameStatus === 'idle' && !startRaceImmediately
}

export const applyRaceStartState = (handlers: JoinedRaceStartStateHandlers): void => {
  handlers.setHasJoined(true)
  applyRaceLoadingStartState(handlers)
}

export const startImmediateRaceIfNeeded = ({
  startRaceImmediately,
  hasFoxOriginOutpoint,
  gameStatus,
  hasStartedRace,
  spawnPosition,
  carPosition,
  fallbackPosition,
  setCarPosition,
  setHasStartedRace,
  ...handlers
}: ImmediateRaceStartInput): ImmediateRaceStartResult => {
  if (!startRaceImmediately) {
    if (hasStartedRace) {
      setHasStartedRace(false)
      return 'reset'
    }
    return 'unchanged'
  }

  if (!hasFoxOriginOutpoint || gameStatus !== 'idle' || hasStartedRace) {
    return 'unchanged'
  }

  setHasStartedRace(true)
  applyRaceLoadingStartState(handlers)

  const nextCarPosition = spawnPosition ?? fallbackPosition
  if (nextCarPosition && !carPosition) {
    setCarPosition?.(nextCarPosition)
  }

  return 'started'
}

export const startRaceForSelectedTrack = ({
  selectedTrackName,
  localTrackName,
  selectedColor,
  onTrackChange,
  spawnPosition,
  carPosition,
  setCarPosition,
  ...handlers
}: StartRaceForSelectedTrackInput): StartRaceForSelectedTrackResult => {
  if (selectedTrackName !== localTrackName && onTrackChange) {
    onTrackChange(selectedTrackName, selectedColor)
    return 'handoff'
  }

  applyRaceStartState(handlers)

  if (spawnPosition && !carPosition) {
    setCarPosition?.(spawnPosition)
  }

  return 'started'
}

export const applyRaceShowroomResetState = (handlers: RaceShowroomResetStateHandlers): void => {
  handlers.setGameStatus('showroom')
  handlers.setHasJoined(false)
  handlers.setScore(0)
  handlers.setDistanceTraveled(0)
  handlers.setLapTime(0)
  handlers.setLapTimes([])
  handlers.setLapTxids({})
}
