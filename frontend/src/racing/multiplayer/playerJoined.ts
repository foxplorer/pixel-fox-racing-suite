import { DEFAULT_RACING_SPAWN_POSITION, type RacingSpawnPosition } from './gameJoined'
import { isCurrentMultiplayerPlayer, removeMultiplayerPlayerById } from './playerIdentity'
import {
  appendJoinedRacingWorldPlayerIfMissing,
  buildJoinedRacingWorldPlayer,
  type RacingWorldPlayer
} from './worldPlayers'

export interface PlayerJoinedSocketPayload {
  playerId: string
  identityKey: string
  name?: string | null
  ordinalAddress?: string | null
  originOutpoint?: string | null
  score?: number | null
  carColor?: string | null
  trackName?: string | null
}

export interface JoinedGameStatePlayer {
  id: string
  identityKey: string
  name: string
  score: number
  ordinalAddress: string | null
  originOutpoint: string | null
  carColor?: string | null
  position?: RacingSpawnPosition
  rotation?: { x: number; y: number; z: number }
  speed?: number
  trackName: string
}

export interface BuildJoinedGameStatePlayerOptions {
  defaultTrackName: string
  includeCarColor?: boolean
  includeInitialMovement?: boolean
  defaultPosition?: RacingSpawnPosition
}

export interface IsJoinedPlayerCurrentInput {
  player: PlayerJoinedSocketPayload
  socketId?: string | null
  identityKey?: string | null
  ordinalAddress?: string | null
  socketIdOnlyWhenAvailable?: boolean
}

export interface ApplyJoinedCarTrackPlayerInput<GameStatePlayer extends { id: string }> {
  gameStatePlayers: GameStatePlayer[]
  renderedPlayers: RacingWorldPlayer[]
  player: PlayerJoinedSocketPayload
  socketId?: string | null
  identityKey?: string | null
  ordinalAddress?: string | null
  defaultTrackName: string
  getFallbackColor: (index: number) => string
  includeCarColor?: boolean
  includeInitialMovement?: boolean
  includeSpeed?: boolean
  socketIdOnlyWhenAvailable?: boolean
  appendRenderedPlayer?: 'shared' | 'manual'
}

export interface ApplyLeftCarTrackPlayerInput<GameStatePlayer extends { id: string }> {
  gameStatePlayers: GameStatePlayer[]
  renderedPlayers: RacingWorldPlayer[]
  playerId: string
}

export const buildJoinedGameStatePlayer = (
  player: PlayerJoinedSocketPayload,
  {
    defaultTrackName,
    includeCarColor = false,
    includeInitialMovement = false,
    defaultPosition = DEFAULT_RACING_SPAWN_POSITION
  }: BuildJoinedGameStatePlayerOptions
): JoinedGameStatePlayer => ({
  id: player.playerId,
  identityKey: player.identityKey,
  name: player.name || 'Fox',
  score: player.score || 0,
  ordinalAddress: player.ordinalAddress || null,
  originOutpoint: player.originOutpoint || null,
  ...(includeCarColor ? { carColor: player.carColor } : {}),
  ...(includeInitialMovement ? {
    position: defaultPosition,
    rotation: { x: 0, y: 0, z: 0 },
    speed: 0
  } : {}),
  trackName: player.trackName || defaultTrackName
})

export const appendJoinedGameStatePlayerIfMissing = <Player extends { id: string }>(
  players: Player[],
  player: PlayerJoinedSocketPayload,
  options: BuildJoinedGameStatePlayerOptions
): Array<Player | JoinedGameStatePlayer> => {
  if (players.find(existingPlayer => existingPlayer.id === player.playerId)) {
    return players
  }

  return [...players, buildJoinedGameStatePlayer(player, options)]
}

export const isJoinedPlayerCurrent = ({
  player,
  socketId,
  identityKey,
  ordinalAddress,
  socketIdOnlyWhenAvailable = false
}: IsJoinedPlayerCurrentInput): boolean => {
  if (socketIdOnlyWhenAvailable && socketId) {
    return player.playerId === socketId
  }

  if (socketIdOnlyWhenAvailable) {
    if (identityKey) {
      return player.identityKey === identityKey
    }

    return !!ordinalAddress && player.ordinalAddress === ordinalAddress
  }

  return isCurrentMultiplayerPlayer({ player, socketId, identityKey, ordinalAddress })
}

export const applyJoinedCarTrackPlayer = <GameStatePlayer extends { id: string }>({
  gameStatePlayers,
  renderedPlayers,
  player,
  socketId,
  identityKey,
  ordinalAddress,
  defaultTrackName,
  getFallbackColor,
  includeCarColor = false,
  includeInitialMovement = false,
  includeSpeed = false,
  socketIdOnlyWhenAvailable = false,
  appendRenderedPlayer = 'shared'
}: ApplyJoinedCarTrackPlayerInput<GameStatePlayer>): {
  gameStatePlayers: Array<GameStatePlayer | JoinedGameStatePlayer>
  renderedPlayers: RacingWorldPlayer[]
  isCurrentPlayer: boolean
} => {
  const nextGameStatePlayers = appendJoinedGameStatePlayerIfMissing(gameStatePlayers, player, {
    defaultTrackName,
    includeCarColor,
    includeInitialMovement
  })

  const isCurrentPlayer = isJoinedPlayerCurrent({
    player,
    socketId,
    identityKey,
    ordinalAddress,
    socketIdOnlyWhenAvailable
  })

  if (isCurrentPlayer) {
    return {
      gameStatePlayers: nextGameStatePlayers,
      renderedPlayers,
      isCurrentPlayer
    }
  }

  return {
    gameStatePlayers: nextGameStatePlayers,
    renderedPlayers: appendRenderedPlayer === 'shared'
      ? appendJoinedRacingWorldPlayerIfMissing(renderedPlayers, player, {
        getFallbackColor,
        includeSpeed
      })
      : renderedPlayers.find(existingPlayer => existingPlayer.id === player.playerId)
        ? renderedPlayers
        : [
          ...renderedPlayers,
          buildJoinedRacingWorldPlayer({
            player,
            index: renderedPlayers.length,
            getFallbackColor,
            includeSpeed
          })
        ],
    isCurrentPlayer
  }
}

export const applyLeftCarTrackPlayer = <GameStatePlayer extends { id: string }>({
  gameStatePlayers,
  renderedPlayers,
  playerId
}: ApplyLeftCarTrackPlayerInput<GameStatePlayer>): {
  gameStatePlayers: GameStatePlayer[]
  renderedPlayers: RacingWorldPlayer[]
} => ({
  gameStatePlayers: removeMultiplayerPlayerById(gameStatePlayers, playerId),
  renderedPlayers: removeMultiplayerPlayerById(renderedPlayers, playerId)
})
