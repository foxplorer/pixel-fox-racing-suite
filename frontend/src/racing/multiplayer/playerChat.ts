import { isSameMultiplayerTrack } from './playerIdentity'

export interface PlayerChatSocketPayload {
  playerId: string
  message: string
}

export interface PlayerChatTrackLike {
  id?: string
  trackName?: string | null
}

export interface ChatSyncedPlayer {
  id: string
  chatMessage?: string
  chatTimestamp?: number
}

export type IncomingPlayerChatTarget = 'ignore' | 'local' | 'remote'

export interface IncomingPlayerChatInput {
  payload: PlayerChatSocketPayload
  socketId?: string
  currentTrackName?: string | null
  defaultTrackName: string
  players?: PlayerChatTrackLike[]
}

export const getIncomingPlayerChatTarget = ({
  payload,
  socketId,
  currentTrackName,
  defaultTrackName,
  players
}: IncomingPlayerChatInput): IncomingPlayerChatTarget => {
  if (!payload.message || !payload.message.trim()) {
    return 'ignore'
  }

  if (payload.playerId === socketId) {
    return 'local'
  }

  const sendingPlayer = players?.find(player => player.id === payload.playerId)
  if (!isSameMultiplayerTrack({
    player: sendingPlayer || {},
    currentTrackName,
    defaultTrackName
  })) {
    return 'ignore'
  }

  return 'remote'
}

export const applyRemotePlayerChatMessage = <TPlayer extends ChatSyncedPlayer>(
  players: TPlayer[],
  payload: PlayerChatSocketPayload,
  timestamp: number
): TPlayer[] => {
  let didChange = false

  const nextPlayers = players.map(player => {
    if (player.id !== payload.playerId) {
      return player
    }

    didChange = true
    return {
      ...player,
      chatMessage: payload.message,
      chatTimestamp: timestamp
    }
  })

  return didChange ? nextPlayers : players
}
