import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyPlayerPositionUpdate,
  applyQueuedPlayerPositionUpdates,
  toQueuedPlayerPositionUpdate,
  type PlayerPositionSocketPayload,
  type PositionSyncedPlayer,
  type SpeedSyncedPlayer
} from './playerPosition'

interface TestPlayer extends PositionSyncedPlayer {
  name: string
}

interface TestSpeedPlayer extends SpeedSyncedPlayer {
  name: string
}

const payload: PlayerPositionSocketPayload = {
  playerId: 'remote-1',
  position: { x: 3, y: 4, z: 5 },
  rotation: { x: 0, y: 1.25, z: 0 },
  speed: 7
}

test('applyPlayerPositionUpdate syncs a matching remote player', () => {
  const players: TestPlayer[] = [
    { id: 'remote-1', name: 'One', position: [0, 0, 0], rotation: [0, 0, 0], isWalking: false },
    { id: 'remote-2', name: 'Two', position: [1, 1, 1], rotation: [0, 0, 0], isWalking: false }
  ]

  assert.deepEqual(applyPlayerPositionUpdate(players, payload), [
    { id: 'remote-1', name: 'One', position: [3, 4, 5], rotation: [0, 1.25, 0], isWalking: true },
    { id: 'remote-2', name: 'Two', position: [1, 1, 1], rotation: [0, 0, 0], isWalking: false }
  ])
})

test('applyPlayerPositionUpdate returns the same array when no player matches', () => {
  const players: TestPlayer[] = [
    { id: 'remote-2', name: 'Two', position: [1, 1, 1], rotation: [0, 0, 0], isWalking: false }
  ]

  assert.equal(applyPlayerPositionUpdate(players, payload), players)
})

test('toQueuedPlayerPositionUpdate converts socket vectors to tuple state', () => {
  assert.deepEqual(toQueuedPlayerPositionUpdate(payload), {
    position: [3, 4, 5],
    rotation: [0, 1.25, 0],
    speed: 7
  })
})

test('applyQueuedPlayerPositionUpdates syncs queued speed-aware players', () => {
  const players: TestSpeedPlayer[] = [
    { id: 'remote-1', name: 'One', position: [0, 0, 0], rotation: [0, 0, 0], isWalking: false, speed: 0 },
    { id: 'remote-2', name: 'Two', position: [1, 1, 1], rotation: [0, 0, 0], isWalking: true, speed: 3 }
  ]
  const updates = new Map([
    ['remote-1', toQueuedPlayerPositionUpdate(payload)]
  ])

  assert.deepEqual(applyQueuedPlayerPositionUpdates(players, updates), [
    { id: 'remote-1', name: 'One', position: [3, 4, 5], rotation: [0, 1.25, 0], isWalking: true, speed: 7 },
    { id: 'remote-2', name: 'Two', position: [1, 1, 1], rotation: [0, 0, 0], isWalking: true, speed: 3 }
  ])
})

test('applyQueuedPlayerPositionUpdates syncs players without adding speed fields', () => {
  const players: TestPlayer[] = [
    { id: 'remote-1', name: 'One', position: [0, 0, 0], rotation: [0, 0, 0], isWalking: false }
  ]
  const updates = new Map([
    ['remote-1', toQueuedPlayerPositionUpdate(payload)]
  ])

  assert.deepEqual(applyQueuedPlayerPositionUpdates(players, updates), [
    { id: 'remote-1', name: 'One', position: [3, 4, 5], rotation: [0, 1.25, 0], isWalking: true }
  ])
})
