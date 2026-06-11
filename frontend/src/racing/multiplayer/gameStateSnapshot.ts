import { findMultiplayerPlayerBySocketId, preserveCurrentMultiplayerPlayerTrackName } from './playerIdentity'
import {
  buildRacingWorldPlayersForTrack,
  type BuildRacingWorldPlayersForTrackInput,
  type RacingWorldGameStatePlayer,
  type RacingWorldPlayer
} from './worldPlayers'

export interface CarTrackGameStateSnapshot<Player extends RacingWorldGameStatePlayer, Item = unknown> {
  gameId: string
  players: Player[]
  items?: Item[]
  trackName?: string
}

export interface ApplyCarTrackGameStateSnapshotInput<Player extends RacingWorldGameStatePlayer, Item = unknown> {
  state: CarTrackGameStateSnapshot<Player, Item>
  previousCurrentPlayers?: Player[]
  previousRenderedPlayers: RacingWorldPlayer[]
  socketId?: string | null
  identityKey?: string | null
  ordinalAddress?: string | null
  currentTrackName?: string | null
  defaultTrackName: string
  getFallbackColor: (index: number) => string
  defaultPosition?: [number, number, number]
  includeSpeed?: boolean
  isCurrentPlayer?: BuildRacingWorldPlayersForTrackInput<Player>['isCurrentPlayer']
}

export interface AppliedCarTrackGameStateSnapshot<Player extends RacingWorldGameStatePlayer, Item = unknown> {
  gameState: CarTrackGameStateSnapshot<Player, Item>
  renderedPlayers: RacingWorldPlayer[]
  currentPlayerInSnapshot: Player | undefined
}

export const applyCarTrackGameStateSnapshot = <Player extends RacingWorldGameStatePlayer, Item = unknown>({
  state,
  previousCurrentPlayers,
  previousRenderedPlayers,
  socketId,
  identityKey,
  ordinalAddress,
  currentTrackName,
  defaultTrackName,
  getFallbackColor,
  defaultPosition,
  includeSpeed = false,
  isCurrentPlayer
}: ApplyCarTrackGameStateSnapshotInput<Player, Item>): AppliedCarTrackGameStateSnapshot<Player, Item> => {
  return {
    gameState: {
      ...state,
      players: preserveCurrentMultiplayerPlayerTrackName(state.players, previousCurrentPlayers, {
        socketId,
        identityKey
      }, currentTrackName)
    },
    renderedPlayers: buildRacingWorldPlayersForTrack({
      players: state.players,
      existingPlayers: previousRenderedPlayers,
      socketId,
      identityKey,
      ordinalAddress,
      currentTrackName,
      defaultTrackName,
      getFallbackColor,
      defaultPosition,
      includeSpeed,
      isCurrentPlayer
    }),
    currentPlayerInSnapshot: socketId
      ? findMultiplayerPlayerBySocketId(state.players, socketId)
      : undefined
  }
}
