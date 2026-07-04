export interface ScheduledRaceRoomJoinPayload {
  raceId: string
  trackName: string
  entrantId: string
  gridSlot: number
  startsAt: string
}

export interface ScheduledRaceReconnectState {
  roomJoin: ScheduledRaceRoomJoinPayload
  spawnPosition: { x: number; y: number; z: number }
  rotationY: number
}

export interface ScheduledRaceReconnectSocket {
  on(event: 'connect', listener: () => void): void
  emit(event: string, payload?: unknown): void
}

export interface RegisterScheduledRaceReconnectOptions<TJoinGamePayload> {
  socket: ScheduledRaceReconnectSocket
  getActiveRaceId: () => string | null
  getReconnectState: () => ScheduledRaceReconnectState | null
  buildJoinGamePayload: (state: ScheduledRaceReconnectState) => TJoinGamePayload | null
  getGameStatus?: () => string | null
}

/**
 * A socket.io reconnect creates a fresh connection with a new socket id: the
 * server has no player record and no scheduled-room membership for it, so
 * every position/progress/finish emit would be silently dropped and the racer
 * would DNF. This listener re-runs the scheduled-entry socket sequence
 * (joinGame → updateGameStatus → updatePosition grid pose → room join)
 * whenever the socket (re)connects while a scheduled race is active. On the
 * initial connection the active race is still null, so it is a no-op.
 */
export const registerScheduledRaceReconnectListener = <TJoinGamePayload>({
  socket,
  getActiveRaceId,
  getReconnectState,
  buildJoinGamePayload,
  getGameStatus,
}: RegisterScheduledRaceReconnectOptions<TJoinGamePayload>): void => {
  socket.on('connect', () => {
    const activeRaceId = getActiveRaceId()
    const state = getReconnectState()
    if (!activeRaceId || !state || state.roomJoin.raceId !== activeRaceId) return

    const joinGamePayload = buildJoinGamePayload(state)
    if (joinGamePayload) {
      socket.emit('joinGame', joinGamePayload)
    }
    const gameStatus = getGameStatus?.()
    if (gameStatus) {
      socket.emit('updateGameStatus', { gameStatus })
    }
    socket.emit('updatePosition', {
      position: state.spawnPosition,
      rotation: { x: 0, y: state.rotationY, z: 0 },
      speed: 0,
      headlightsEnabled: true,
    })
    socket.emit('joinScheduledRaceRoom', state.roomJoin)
  })
}
