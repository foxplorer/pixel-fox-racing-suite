import type { RemotePlayerLodTier } from './remotePlayerLod'
import { isCurrentMultiplayerPlayer, isSameMultiplayerTrack } from './playerIdentity'

export interface RacingWorldPlayer {
  id: string
  name: string
  position: [number, number, number]
  rotation: [number, number, number]
  color: string
  carColor: string
  isWalking: boolean
  speed?: number
  originOutpoint?: string
  foxTextureUrl?: string
  chatMessage?: string
  chatTimestamp?: number
  remoteLodTier?: RemotePlayerLodTier
}

export interface RacingWorldGameStatePlayer {
  id: string
  identityKey?: string | null
  ordinalAddress?: string | null
  name?: string | null
  position?: { x: number; y: number; z: number }
  rotation?: { x: number; y: number; z: number }
  speed?: number
  carColor?: string | null
  originOutpoint?: string | null
  trackName?: string | null
}

export interface RacingWorldJoinedPlayer {
  playerId: string
  name?: string | null
  carColor?: string | null
  originOutpoint?: string | null
}

export interface RacingWorldPlayerCollisionTarget {
  id: string
  position: [number, number, number]
}

export interface BuildRacingWorldPlayerInput {
  player: RacingWorldGameStatePlayer
  existingPlayer?: Partial<RacingWorldPlayer>
  index: number
  getFallbackColor: (index: number) => string
  defaultPosition?: [number, number, number]
  includeSpeed?: boolean
}

export interface BuildRacingWorldPlayersForTrackInput<Player extends RacingWorldGameStatePlayer> {
  players: Player[]
  existingPlayers: RacingWorldPlayer[]
  socketId?: string | null
  identityKey?: string | null
  ordinalAddress?: string | null
  currentTrackName?: string | null
  defaultTrackName: string
  getFallbackColor: (index: number) => string
  defaultPosition?: [number, number, number]
  includeSpeed?: boolean
  isCurrentPlayer?: (player: Player) => boolean
}

export interface BuildJoinedRacingWorldPlayerInput {
  player: RacingWorldJoinedPlayer
  index: number
  getFallbackColor: (index: number) => string
  includeSpeed?: boolean
}

export const getRacingWorldPlayerCollisionTargets = (
  players: RacingWorldPlayer[]
): RacingWorldPlayerCollisionTarget[] => players.map(player => ({
  id: player.id,
  position: player.position
}))

export const buildRacingWorldPlayer = ({
  player,
  existingPlayer,
  index,
  getFallbackColor,
  defaultPosition = [0, 0, 0],
  includeSpeed = false
}: BuildRacingWorldPlayerInput): RacingWorldPlayer => {
  const serverCarColor = player.carColor && player.carColor.trim() !== '' ? player.carColor : null
  const existingCarColor = existingPlayer?.carColor && existingPlayer.carColor.trim() !== '' ? existingPlayer.carColor : null
  const speed = player.speed || 0

  return {
    id: player.id,
    name: player.name || 'Fox',
    position: player.position
      ? [player.position.x, player.position.y, player.position.z]
      : defaultPosition,
    rotation: player.rotation
      ? [player.rotation.x, player.rotation.y, player.rotation.z]
      : [0, 0, 0],
    color: existingPlayer?.color || getFallbackColor(index),
    carColor: serverCarColor || existingCarColor || getFallbackColor(index),
    isWalking: speed > 0,
    ...(includeSpeed ? { speed } : {}),
    originOutpoint: player.originOutpoint || undefined
  }
}

export const buildRacingWorldPlayersForTrack = <Player extends RacingWorldGameStatePlayer>({
  players,
  existingPlayers,
  socketId,
  identityKey,
  ordinalAddress,
  currentTrackName,
  defaultTrackName,
  getFallbackColor,
  defaultPosition,
  includeSpeed = false,
  isCurrentPlayer
}: BuildRacingWorldPlayersForTrackInput<Player>): RacingWorldPlayer[] => {
  const existingPlayersMap = new Map(existingPlayers.map(player => [player.id, player]))

  return players
    .filter(player => {
      const currentPlayer = isCurrentPlayer
        ? isCurrentPlayer(player)
        : isCurrentMultiplayerPlayer({ player, socketId, identityKey, ordinalAddress })

      if (currentPlayer) {
        return false
      }

      return isSameMultiplayerTrack({
        player,
        currentTrackName,
        defaultTrackName
      })
    })
    .map((player, index) => buildRacingWorldPlayer({
      player,
      existingPlayer: existingPlayersMap.get(player.id),
      index,
      getFallbackColor,
      defaultPosition,
      includeSpeed
    }))
}

export function buildJoinedRacingWorldPlayer(input: BuildJoinedRacingWorldPlayerInput & { includeSpeed: true }): RacingWorldPlayer & { speed: number }
export function buildJoinedRacingWorldPlayer(input: BuildJoinedRacingWorldPlayerInput): RacingWorldPlayer
export function buildJoinedRacingWorldPlayer({
  player,
  index,
  getFallbackColor,
  includeSpeed = false
}: BuildJoinedRacingWorldPlayerInput): RacingWorldPlayer {
  const fallbackColor = getFallbackColor(index)

  return {
    id: player.playerId,
    name: player.name || 'Fox',
    position: [0, 0.1, 0],
    rotation: [0, 0, 0],
    color: fallbackColor,
    carColor: player.carColor || fallbackColor,
    isWalking: false,
    ...(includeSpeed ? { speed: 0 } : {}),
    originOutpoint: player.originOutpoint || undefined
  }
}

export const appendJoinedRacingWorldPlayerIfMissing = (
  players: RacingWorldPlayer[],
  player: RacingWorldJoinedPlayer,
  options: Omit<BuildJoinedRacingWorldPlayerInput, 'player' | 'index'>
): RacingWorldPlayer[] => {
  if (players.find(existingPlayer => existingPlayer.id === player.playerId)) {
    return players
  }

  return [
    ...players,
    buildJoinedRacingWorldPlayer({
      ...options,
      player,
      index: players.length
    })
  ]
}
