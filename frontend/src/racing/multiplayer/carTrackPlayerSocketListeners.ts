import {
  applyPlayerCarColorUpdate,
  applyPlayerTrackNameUpdate,
  type CarColorSyncedPlayer,
  type PlayerCarColorSocketPayload,
  type PlayerTrackNameSocketPayload,
  type TrackNameSyncedPlayer
} from './playerAppearance'
import {
  applyRemotePlayerChatMessage,
  getIncomingPlayerChatTarget,
  type ChatSyncedPlayer,
  type PlayerChatSocketPayload,
  type PlayerChatTrackLike
} from './playerChat'
import {
  applyPlayerCollisionUpdate,
  type CollisionSyncedPlayer,
  type PlayerCollisionSocketPayload
} from './playerCollision'
import type { PlayerPositionSocketPayload } from './playerPosition'

type StateUpdater<TState> = (value: TState | ((previous: TState) => TState)) => void

interface CarTrackLivePlayerSocketLike {
  on(event: 'playerPositionUpdate', listener: (payload: PlayerPositionSocketPayload) => void): void
  on(event: 'playerCarColorUpdate', listener: (payload: PlayerCarColorSocketPayload) => void): void
  on(event: 'playerTrackNameUpdate', listener: (payload: PlayerTrackNameSocketPayload) => void): void
  on(event: 'playerChat', listener: (payload: PlayerChatSocketPayload) => void): void
  on(event: 'playerCollision', listener: (payload: PlayerCollisionSocketPayload) => void): void
}

interface CarTrackGameStatePlayers {
  players: Array<CarColorSyncedPlayer & TrackNameSyncedPlayer & PlayerChatTrackLike>
}

export interface RegisterCarTrackLivePlayerSocketListenersOptions<
  TGameState extends CarTrackGameStatePlayers,
  TRemotePlayer extends CarColorSyncedPlayer & CollisionSyncedPlayer & ChatSyncedPlayer
> {
  socket: CarTrackLivePlayerSocketLike
  defaultTrackName: string
  getSocketId: () => string | undefined
  getCurrentTrackName: () => string | null | undefined
  getGameStatePlayers: () => PlayerChatTrackLike[] | undefined
  queueRemotePlayerPositionUpdate: (payload: PlayerPositionSocketPayload) => void
  setGameState: StateUpdater<TGameState | null>
  setOtherPlayers: StateUpdater<TRemotePlayer[]>
  setLocalChatMessage: (message: { text: string; timestamp: number }) => void
}

export const registerCarTrackLivePlayerSocketListeners = <
  TGameState extends CarTrackGameStatePlayers,
  TRemotePlayer extends CarColorSyncedPlayer & CollisionSyncedPlayer & ChatSyncedPlayer
>({
  socket,
  defaultTrackName,
  getSocketId,
  getCurrentTrackName,
  getGameStatePlayers,
  queueRemotePlayerPositionUpdate,
  setGameState,
  setOtherPlayers,
  setLocalChatMessage
}: RegisterCarTrackLivePlayerSocketListenersOptions<TGameState, TRemotePlayer>): void => {
  socket.on('playerPositionUpdate', data => {
    queueRemotePlayerPositionUpdate(data)
  })

  socket.on('playerCarColorUpdate', data => {
    setOtherPlayers(prev => applyPlayerCarColorUpdate(prev, data))

    setGameState(prev => {
      if (!prev) return prev
      return {
        ...prev,
        players: applyPlayerCarColorUpdate(prev.players, data)
      }
    })
  })

  socket.on('playerTrackNameUpdate', data => {
    setGameState(prev => {
      if (!prev) return prev
      return {
        ...prev,
        players: applyPlayerTrackNameUpdate(prev.players, data)
      }
    })
  })

  socket.on('playerChat', data => {
    const timestamp = Date.now()
    const chatTarget = getIncomingPlayerChatTarget({
      payload: data,
      socketId: getSocketId(),
      currentTrackName: getCurrentTrackName(),
      defaultTrackName,
      players: getGameStatePlayers()
    })

    if (chatTarget === 'ignore') return

    if (chatTarget === 'local') {
      setLocalChatMessage({ text: data.message, timestamp })
    } else {
      setOtherPlayers(prev => applyRemotePlayerChatMessage(prev, data, timestamp))
    }
  })

  socket.on('playerCollision', data => {
    setOtherPlayers(prev => applyPlayerCollisionUpdate(prev, data, getSocketId()))
    console.log(`💥 Collision detected between ${data.playerId1} and ${data.playerId2}`)
  })
}
