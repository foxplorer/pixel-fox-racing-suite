import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef } from 'react'
import {
  applyQueuedPlayerPositionUpdates,
  toQueuedPlayerPositionUpdate,
  type PlayerPositionSocketPayload,
  type PositionSyncedPlayer,
  type QueuedPlayerPositionUpdate
} from './playerPosition'

export const DEFAULT_PLAYER_POSITION_BATCH_INTERVAL_MS = 30

export const useBatchedPlayerPositionUpdates = <TPlayer extends PositionSyncedPlayer>(
  setPlayers: Dispatch<SetStateAction<TPlayer[]>>,
  intervalMs: number = DEFAULT_PLAYER_POSITION_BATCH_INTERVAL_MS
): ((payload: PlayerPositionSocketPayload) => void) => {
  const pendingPositionUpdatesRef = useRef<Map<string, QueuedPlayerPositionUpdate>>(new Map())

  const queuePlayerPositionUpdate = useCallback((payload: PlayerPositionSocketPayload) => {
    pendingPositionUpdatesRef.current.set(payload.playerId, toQueuedPlayerPositionUpdate(payload))
  }, [])

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      if (pendingPositionUpdatesRef.current.size === 0) return

      const updates = new Map(pendingPositionUpdatesRef.current)
      pendingPositionUpdatesRef.current.clear()
      setPlayers(prev => applyQueuedPlayerPositionUpdates(prev, updates))
    }, intervalMs)

    return () => {
      globalThis.clearInterval(intervalId)
    }
  }, [intervalMs, setPlayers])

  return queuePlayerPositionUpdate
}
