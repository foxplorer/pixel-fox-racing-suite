import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectFirstNearbyItem,
  DEFAULT_COLLECTIBLE_COLLECTION_RADIUS,
  findCollectiblePickup
} from './collectiblePickup'
import type { RacingGameCollectibleItem } from './collectibleTypes'

const createItem = (id: string, x: number, y: number, z: number): RacingGameCollectibleItem => ({
  id,
  type: 'blueberry',
  position: { x, y, z },
  value: 10
})

test('findCollectiblePickup preserves the existing two-unit collection radius', () => {
  assert.equal(DEFAULT_COLLECTIBLE_COLLECTION_RADIUS, 2)

  const inside = createItem('inside', 1.99, 0, 0)
  const boundary = createItem('boundary', 2, 0, 0)

  assert.equal(findCollectiblePickup({
    items: [inside],
    position: { x: 0, y: 0, z: 0 }
  }), inside)

  assert.equal(findCollectiblePickup({
    items: [boundary],
    position: { x: 0, y: 0, z: 0 }
  }), null)
})

test('findCollectiblePickup uses horizontal distance so elevated tracks can collect raised items', () => {
  const raised = createItem('raised', 1, 100, 0)

  assert.equal(findCollectiblePickup({
    items: [raised],
    position: { x: 0, y: 0, z: 0 }
  }), raised)
})

test('collectFirstNearbyItem collects only the first nearby item', () => {
  const collectedIds: string[] = []
  const first = createItem('first', 0, 0, 0)
  const second = createItem('second', 0.5, 0, 0)

  const item = collectFirstNearbyItem({
    items: [first, second],
    position: { x: 0, y: 0, z: 0 },
    onCollectItem: itemId => collectedIds.push(itemId)
  })

  assert.equal(item, first)
  assert.deepEqual(collectedIds, ['first'])
})

test('collectFirstNearbyItem does nothing without a callback', () => {
  assert.equal(collectFirstNearbyItem({
    items: [createItem('nearby', 0, 0, 0)],
    position: { x: 0, y: 0, z: 0 }
  }), null)
})
