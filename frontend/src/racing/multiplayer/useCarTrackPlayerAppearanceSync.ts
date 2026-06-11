import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { Socket } from 'socket.io-client'
import { patchCurrentMultiplayerPlayer, type MultiplayerPlayerIdentityLike } from './playerIdentity'

export interface CarTrackAppearanceGameState<Player extends MultiplayerPlayerIdentityLike> {
  players: Player[]
}

export interface UseCarTrackPlayerAppearanceSyncOptions<Player extends MultiplayerPlayerIdentityLike & {
  carColor?: string
  trackName?: string
}> {
  socketRef: MutableRefObject<Socket | null>
  hasJoined: boolean
  identityKey?: string | null
  playerColor?: string | null
  trackName?: string | null
  setGameState: Dispatch<SetStateAction<CarTrackAppearanceGameState<Player> | null>>
}

export const useCarTrackPlayerAppearanceSync = <Player extends MultiplayerPlayerIdentityLike & {
  carColor?: string
  trackName?: string
}>({
  socketRef,
  hasJoined,
  identityKey,
  playerColor,
  trackName,
  setGameState
}: UseCarTrackPlayerAppearanceSyncOptions<Player>) => {
  useEffect(() => {
    if (!socketRef.current || !hasJoined || !playerColor) {
      return
    }

    console.log(`🎨 Sending carColor update to server:`, playerColor)
    socketRef.current.emit('updateCarColor', { carColor: playerColor })

    setGameState(prev => {
      if (!prev) return prev

      return {
        ...prev,
        players: patchCurrentMultiplayerPlayer(prev.players, {
          socketId: socketRef.current?.id,
          identityKey
        }, { carColor: playerColor } as Partial<Player>)
      }
    })
  }, [playerColor, hasJoined, identityKey, setGameState, socketRef])

  useEffect(() => {
    if (!socketRef.current || !hasJoined || !trackName) {
      return
    }

    console.log(`🏁 Sending trackName update to server:`, trackName)
    socketRef.current.emit('updateTrackName', { trackName })

    setGameState(prev => {
      if (!prev) return prev

      return {
        ...prev,
        players: patchCurrentMultiplayerPlayer(prev.players, {
          socketId: socketRef.current?.id,
          identityKey
        }, { trackName } as Partial<Player>)
      }
    })
  }, [trackName, hasJoined, identityKey, setGameState, socketRef])
}
