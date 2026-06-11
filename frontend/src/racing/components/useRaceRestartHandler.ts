import { Dispatch, SetStateAction, useCallback } from 'react'
import { applyRaceShowroomResetState } from '../simulation/raceLifecycle'

interface ChatPlayerState {
  chatMessage?: string
  chatTimestamp?: number
}

interface LocalChatMessage {
  text: string
  timestamp: number
}

interface UseRaceRestartHandlerOptions<TPlayer extends ChatPlayerState> {
  setGameStatus: (gameStatus: 'showroom') => void
  setHasJoined: (hasJoined: boolean) => void
  setScore: (score: number) => void
  setDistanceTraveled: (distanceTraveled: number) => void
  setLapTime: (lapTime: number) => void
  setLapTimes: (lapTimes: number[]) => void
  setLapTxids: (lapTxids: Record<number, string>) => void
  collectedItemsRef: { current: Set<string> }
  setOtherPlayers: Dispatch<SetStateAction<TPlayer[]>>
  setLocalChatMessage: Dispatch<SetStateAction<LocalChatMessage | null>>
  resetPosition?: () => void
}

export const clearPlayerChatMessages = <TPlayer extends ChatPlayerState>(players: TPlayer[]): TPlayer[] => {
  return players.map(player => ({
    ...player,
    chatMessage: undefined,
    chatTimestamp: undefined
  }))
}

export const useRaceRestartHandler = <TPlayer extends ChatPlayerState>({
  setGameStatus,
  setHasJoined,
  setScore,
  setDistanceTraveled,
  setLapTime,
  setLapTimes,
  setLapTxids,
  collectedItemsRef,
  setOtherPlayers,
  setLocalChatMessage,
  resetPosition
}: UseRaceRestartHandlerOptions<TPlayer>) => {
  return useCallback(() => {
    applyRaceShowroomResetState({
      setGameStatus,
      setHasJoined,
      setScore,
      setDistanceTraveled,
      setLapTime,
      setLapTimes,
      setLapTxids
    })

    collectedItemsRef.current.clear()
    resetPosition?.()
    setOtherPlayers(clearPlayerChatMessages)
    setLocalChatMessage(null)
  }, [
    collectedItemsRef,
    resetPosition,
    setDistanceTraveled,
    setGameStatus,
    setHasJoined,
    setLapTime,
    setLapTimes,
    setLapTxids,
    setLocalChatMessage,
    setOtherPlayers,
    setScore
  ])
}
