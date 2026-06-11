export interface GameJoinedSocketPayload {
  gameId: string
  position?: { x: number; y: number; z: number }
}

export interface RacingSpawnPosition {
  x: number
  y: number
  z: number
}

export interface GameJoinedCurrentPlayerInput {
  socketId?: string | null
  identityKey?: string | null
  name?: string | null
  ordinalAddress?: string | null
  originOutpoint?: string | null
  carColor: string
  trackName: string
}

export interface GameJoinedCurrentPlayer {
  id: string
  identityKey: string
  name: string
  score: number
  ordinalAddress: string | null
  originOutpoint: string | null
  carColor: string
  trackName: string
}

export interface ApplyCarTrackGameJoinedInput<GameState extends { players: GameJoinedCurrentPlayer[] }> {
  payload: GameJoinedSocketPayload
  previousSpawnPosition: RacingSpawnPosition | null
  previousGameState: GameState | null
  socketId?: string | null
  identityKey?: string | null
  name?: string | null
  ordinalAddress?: string | null
  originOutpoint?: string | null
  carColor: string
  trackName: string
  preserveExistingSpawn?: boolean
  mergeExistingPlayer?: boolean
}

export interface AppliedCarTrackGameJoined<GameState extends { players: GameJoinedCurrentPlayer[] }> {
  spawnPosition: RacingSpawnPosition
  gameState: GameState
  currentPlayer: GameJoinedCurrentPlayer
}

export const DEFAULT_RACING_SPAWN_POSITION: RacingSpawnPosition = { x: 0, y: 0.1, z: 0 }

export const resolveGameJoinedSpawnPosition = (
  payload: Pick<GameJoinedSocketPayload, 'position'>,
  defaultPosition: RacingSpawnPosition = DEFAULT_RACING_SPAWN_POSITION
): RacingSpawnPosition => payload.position || defaultPosition

export const preserveExistingSpawnPosition = (
  previousPosition: RacingSpawnPosition | null,
  payload: Pick<GameJoinedSocketPayload, 'position'>,
  defaultPosition: RacingSpawnPosition = DEFAULT_RACING_SPAWN_POSITION
): RacingSpawnPosition => previousPosition || resolveGameJoinedSpawnPosition(payload, defaultPosition)

export const buildGameJoinedCurrentPlayer = ({
  socketId,
  identityKey,
  name,
  ordinalAddress,
  originOutpoint,
  carColor,
  trackName
}: GameJoinedCurrentPlayerInput): GameJoinedCurrentPlayer => ({
  id: socketId || '',
  identityKey: identityKey || '',
  name: name || 'Fox',
  score: 0,
  ordinalAddress: ordinalAddress || null,
  originOutpoint: originOutpoint || null,
  carColor,
  trackName
})

export const applyCarTrackGameJoined = <GameState extends {
  gameId: string
  players: GameJoinedCurrentPlayer[]
}>({
  payload,
  previousSpawnPosition,
  previousGameState,
  socketId,
  identityKey,
  name,
  ordinalAddress,
  originOutpoint,
  carColor,
  trackName,
  preserveExistingSpawn = true,
  mergeExistingPlayer = true
}: ApplyCarTrackGameJoinedInput<GameState>): AppliedCarTrackGameJoined<GameState> => {
  const currentPlayer = buildGameJoinedCurrentPlayer({
    socketId,
    identityKey,
    name,
    ordinalAddress,
    originOutpoint,
    carColor,
    trackName
  })
  const spawnPosition = preserveExistingSpawn
    ? preserveExistingSpawnPosition(previousSpawnPosition, payload)
    : resolveGameJoinedSpawnPosition(payload)

  const previousState = previousGameState || {
    gameId: payload.gameId,
    players: []
  } as GameState
  const existingPlayerIndex = previousState.players.findIndex(player => (
    player.id === currentPlayer.id || (!!identityKey && player.identityKey === identityKey)
  ))
  const players = existingPlayerIndex >= 0
    ? previousState.players.map((player, index) => (
      index === existingPlayerIndex && mergeExistingPlayer
        ? { ...player, ...currentPlayer }
        : index === existingPlayerIndex
          ? currentPlayer
          : player
    ))
    : [...previousState.players, currentPlayer]

  return {
    spawnPosition,
    gameState: {
      ...previousState,
      gameId: payload.gameId,
      players
    },
    currentPlayer
  }
}
