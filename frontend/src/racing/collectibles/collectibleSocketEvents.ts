import type { RacingCollectibleType, RacingGameCollectibleItem } from './collectibleTypes'

export interface ItemCollectedSocketPayload {
  itemId: string
  playerId: string
  score: number
  itemType: RacingCollectibleType
}

export interface ItemSpawnedSocketPayload<TItem extends RacingGameCollectibleItem = RacingGameCollectibleItem> {
  item: TItem
}

interface CollectibleSocketLike<TItem extends RacingGameCollectibleItem> {
  on(event: 'itemCollected', listener: (data: ItemCollectedSocketPayload) => void): void
  on(event: 'itemSpawned', listener: (data: ItemSpawnedSocketPayload<TItem>) => void): void
}

interface ScoredPlayer {
  id: string
  score: number
}

interface GameStateWithPlayers<TPlayer extends ScoredPlayer> {
  players: TPlayer[]
}

type IdleCallbackScheduler = typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
}

export const scheduleCollectibleTransactionAfterPickup = (callback: () => void): void => {
  const scheduler = globalThis as IdleCallbackScheduler
  if (scheduler.requestIdleCallback) {
    scheduler.requestIdleCallback(callback, { timeout: 1500 })
    return
  }

  globalThis.setTimeout(callback, 1000)
}

export const removeCollectedItem = <TItem extends { id: string }>(
  items: TItem[],
  itemId: string
): TItem[] => {
  const nextItems = items.filter(item => item.id !== itemId)
  return nextItems.length === items.length ? items : nextItems
}

export const addSpawnedItemIfMissing = <TItem extends { id: string }>(
  items: TItem[],
  item: TItem
): TItem[] => {
  if (items.find(existingItem => existingItem.id === item.id)) {
    return items
  }

  return [...items, item]
}

export const applyCollectedItemScore = <
  TPlayer extends ScoredPlayer,
  TGameState extends GameStateWithPlayers<TPlayer>
>(
  gameState: TGameState | null,
  payload: ItemCollectedSocketPayload
): TGameState | null => {
  if (!gameState) return gameState

  return {
    ...gameState,
    players: gameState.players.map(player =>
      player.id === payload.playerId ? { ...player, score: payload.score } : player
    )
  }
}

export interface RegisterCollectibleSocketListenersOptions<
  TItem extends RacingGameCollectibleItem,
  TPlayer extends ScoredPlayer,
  TGameState extends GameStateWithPlayers<TPlayer>
> {
  socket: CollectibleSocketLike<TItem>
  socketId?: string
  getCurrentSocketId: () => string | undefined
  setItems: (updater: (items: TItem[]) => TItem[]) => void
  setGameState: (updater: (gameState: TGameState | null) => TGameState | null) => void
  submitItemTransaction: (itemType: RacingCollectibleType, itemId: string) => void
  scheduleItemTransaction?: (callback: () => void) => void
}

export const registerCollectibleSocketListeners = <
  TItem extends RacingGameCollectibleItem,
  TPlayer extends ScoredPlayer,
  TGameState extends GameStateWithPlayers<TPlayer>
>({
  socket,
  socketId,
  getCurrentSocketId,
  setItems,
  setGameState,
  submitItemTransaction,
  scheduleItemTransaction = scheduleCollectibleTransactionAfterPickup
}: RegisterCollectibleSocketListenersOptions<TItem, TPlayer, TGameState>): void => {
  socket.on('itemCollected', data => {
    setItems(prev => removeCollectedItem(prev, data.itemId))
    setGameState(prev => applyCollectedItemScore(prev, data))

    const currentSocketId = getCurrentSocketId() || socketId
    if (data.playerId === currentSocketId) {
      scheduleItemTransaction(() => {
        submitItemTransaction(data.itemType, data.itemId)
      })
    }
  })

  socket.on('itemSpawned', data => {
    setItems(prev => addSpawnedItemIfMissing(prev, data.item))
  })
}
