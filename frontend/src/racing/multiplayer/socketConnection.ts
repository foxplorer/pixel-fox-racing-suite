interface RacingConnectionSocketLike {
  id?: string
  on(event: 'connect', listener: () => void): void
  on(event: 'disconnect', listener: (reason: string) => void): void
  on(event: 'connect_error', listener: (error: unknown) => void): void
}

interface RacingJoinSocketLike {
  on(event: 'gameJoined', listener: (payload: any) => void): void
  on(event: 'playerJoined', listener: (payload: any) => void): void
  on(event: 'playerLeft', listener: (payload: any) => void): void
}

export interface RegisterRacingSocketConnectionListenersOptions {
  socket: RacingConnectionSocketLike
  serverUrl: string
  setIsConnected: (isConnected: boolean) => void
  setSocketId: (socketId: string | undefined) => void
  onConnect?: () => void
  onDisconnect?: (reason: string) => void
  onConnectError?: (error: unknown) => void
}

export const registerRacingSocketConnectionListeners = ({
  socket,
  serverUrl,
  setIsConnected,
  setSocketId,
  onConnect,
  onDisconnect,
  onConnectError
}: RegisterRacingSocketConnectionListenersOptions): void => {
  socket.on('connect', () => {
    console.log('✅ Connected to Pixel Fox Racing server:', socket.id, 'at', serverUrl)
    setIsConnected(true)
    setSocketId(socket.id)
    onConnect?.()
  })

  socket.on('disconnect', reason => {
    console.log('❌ Disconnected from Pixel Fox Racing server:', reason)
    setIsConnected(false)
    onDisconnect?.(reason)
  })

  socket.on('connect_error', error => {
    console.error('❌ Socket connection error to', serverUrl, ':', error)
    setIsConnected(false)
    onConnectError?.(error)
  })
}

export interface RegisterCarTrackJoinSocketListenersOptions<GameJoinedPayload, PlayerJoinedPayload, PlayerLeftPayload> {
  socket: RacingJoinSocketLike
  trackLabel: string
  onGameJoined: (payload: GameJoinedPayload) => void
  onPlayerJoined: (payload: PlayerJoinedPayload) => void
  onPlayerLeft: (payload: PlayerLeftPayload) => void
  logPlayerJoined?: (payload: PlayerJoinedPayload) => void
}

export const registerCarTrackJoinSocketListeners = <GameJoinedPayload extends { gameId: string; position?: unknown }, PlayerJoinedPayload, PlayerLeftPayload>({
  socket,
  trackLabel,
  onGameJoined,
  onPlayerJoined,
  onPlayerLeft,
  logPlayerJoined
}: RegisterCarTrackJoinSocketListenersOptions<GameJoinedPayload, PlayerJoinedPayload, PlayerLeftPayload>): void => {
  socket.on('gameJoined', payload => {
    console.log(`✅ Joined Pixel Racing game${trackLabel ? ` (${trackLabel})` : ''}:`, payload.gameId)
    if (payload.position) {
      console.log('📍 Spawn position from server:', payload.position)
    }
    onGameJoined(payload)
  })

  socket.on('playerJoined', payload => {
    if (logPlayerJoined) {
      logPlayerJoined(payload)
    } else {
      console.log('Player joined Pixel Racing:', payload)
    }
    onPlayerJoined(payload)
  })

  socket.on('playerLeft', payload => {
    console.log('Player left Pixel Racing:', payload)
    onPlayerLeft(payload)
  })
}
