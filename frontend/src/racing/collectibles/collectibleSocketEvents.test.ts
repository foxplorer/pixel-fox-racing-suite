import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addSpawnedItemIfMissing,
  applyCollectedItemScore,
  registerCollectibleSocketListeners,
  removeCollectedItem,
  scheduleCollectibleTransactionAfterPickup
} from './collectibleSocketEvents'

test('removeCollectedItem removes the collected item by id', () => {
  assert.deepEqual(
    removeCollectedItem([
      { id: 'a', value: 1 },
      { id: 'b', value: 2 }
    ], 'a'),
    [{ id: 'b', value: 2 }]
  )
})

test('removeCollectedItem preserves the item array when the item is already gone', () => {
  const item = { id: 'b', value: 2 }
  const items = [item]

  assert.equal(removeCollectedItem(items, 'a'), items)
})

test('addSpawnedItemIfMissing ignores duplicate spawned items', () => {
  const item = { id: 'a', value: 1 }
  const items = [item]

  assert.equal(addSpawnedItemIfMissing(items, item), items)
  assert.deepEqual(addSpawnedItemIfMissing(items, { id: 'b', value: 2 }), [item, { id: 'b', value: 2 }])
})

test('applyCollectedItemScore updates only the collecting player score', () => {
  assert.deepEqual(
    applyCollectedItemScore({
      gameId: 'race',
      players: [
        { id: 'a', score: 1, name: 'A' },
        { id: 'b', score: 2, name: 'B' }
      ]
    }, {
      itemId: 'item',
      playerId: 'b',
      score: 12,
      itemType: 'rabbit'
    }),
    {
      gameId: 'race',
      players: [
        { id: 'a', score: 1, name: 'A' },
        { id: 'b', score: 12, name: 'B' }
      ]
    }
  )
})

test('registerCollectibleSocketListeners applies collected and spawned item updates', () => {
  const listeners = new Map<string, (data: any) => void>()
  let items = [
    { id: 'item-1', type: 'salad' as const, position: { x: 0, y: 0, z: 0 }, value: 20 }
  ]
  let gameState = {
    players: [
      { id: 'socket-1', score: 0 },
      { id: 'socket-2', score: 0 }
    ]
  }
  const submittedItems: Array<{ type: string, id: string }> = []
  const scheduledCallbacks: Array<() => void> = []

  registerCollectibleSocketListeners({
    socket: {
      on(event, listener) {
        listeners.set(event, listener)
      }
    },
    socketId: 'socket-1',
    getCurrentSocketId: () => undefined,
    setItems: updater => {
      items = updater(items)
    },
    setGameState: updater => {
      gameState = updater(gameState)!
    },
    submitItemTransaction: (itemType, itemId) => {
      submittedItems.push({ type: itemType, id: itemId })
    },
    scheduleItemTransaction: callback => {
      scheduledCallbacks.push(callback)
    }
  })

  listeners.get('itemCollected')?.({
    itemId: 'item-1',
    playerId: 'socket-1',
    score: 20,
    itemType: 'salad'
  })
  listeners.get('itemSpawned')?.({
    item: { id: 'item-2', type: 'rabbit', position: { x: 1, y: 0, z: 1 }, value: 50 }
  })

  assert.deepEqual(items.map(item => item.id), ['item-2'])
  assert.deepEqual(gameState.players, [
    { id: 'socket-1', score: 20 },
    { id: 'socket-2', score: 0 }
  ])
  assert.deepEqual(submittedItems, [])
  scheduledCallbacks.forEach(callback => callback())
  assert.deepEqual(submittedItems, [{ type: 'salad', id: 'item-1' }])
})

test('registerCollectibleSocketListeners defers current-player item transaction scheduling', () => {
  const listeners = new Map<string, (data: any) => void>()
  const scheduledCallbacks: Array<() => void> = []
  const submittedItems: Array<{ type: string, id: string }> = []

  registerCollectibleSocketListeners({
    socket: {
      on(event, listener) {
        listeners.set(event, listener)
      }
    },
    socketId: 'socket-1',
    getCurrentSocketId: () => 'socket-1',
    setItems: () => {},
    setGameState: () => {},
    submitItemTransaction: (itemType, itemId) => {
      submittedItems.push({ type: itemType, id: itemId })
    },
    scheduleItemTransaction: callback => {
      scheduledCallbacks.push(callback)
    }
  })

  listeners.get('itemCollected')?.({
    itemId: 'item-1',
    playerId: 'socket-1',
    score: 20,
    itemType: 'salad'
  })

  assert.deepEqual(submittedItems, [])
  assert.equal(scheduledCallbacks.length, 1)

  scheduledCallbacks[0]()

  assert.deepEqual(submittedItems, [{ type: 'salad', id: 'item-1' }])
})

test('registerCollectibleSocketListeners does not submit transactions for other players', () => {
  const listeners = new Map<string, (data: any) => void>()
  let submitCount = 0

  registerCollectibleSocketListeners({
    socket: {
      on(event, listener) {
        listeners.set(event, listener)
      }
    },
    socketId: 'socket-1',
    getCurrentSocketId: () => 'socket-1',
    setItems: () => {},
    setGameState: () => {},
    submitItemTransaction: () => {
      submitCount += 1
    }
  })

  listeners.get('itemCollected')?.({
    itemId: 'item-1',
    playerId: 'socket-2',
    score: 20,
    itemType: 'salad'
  })

  assert.equal(submitCount, 0)
})

test('scheduleCollectibleTransactionAfterPickup prefers idle callback scheduling', () => {
  const originalRequestIdleCallback = (globalThis as any).requestIdleCallback
  const originalSetTimeout = globalThis.setTimeout
  let idleOptions: { timeout: number } | undefined
  let idleCallback: (() => void) | null = null
  let timeoutCalled = false
  let callbackCalled = false

  ;(globalThis as any).requestIdleCallback = (callback: () => void, options?: { timeout: number }) => {
    idleCallback = callback
    idleOptions = options
    return 1
  }
  ;(globalThis as any).setTimeout = () => {
    timeoutCalled = true
    return 1
  }

  try {
    scheduleCollectibleTransactionAfterPickup(() => {
      callbackCalled = true
    })

    assert.equal(timeoutCalled, false)
    assert.deepEqual(idleOptions, { timeout: 1500 })
    assert.equal(callbackCalled, false)

    idleCallback?.()

    assert.equal(callbackCalled, true)
  } finally {
    ;(globalThis as any).requestIdleCallback = originalRequestIdleCallback
    ;(globalThis as any).setTimeout = originalSetTimeout
  }
})
