import assert from 'node:assert/strict'
import test from 'node:test'
import { applyPlayerCollisionUpdate, type CollisionSyncedPlayer, type PlayerCollisionSocketPayload } from './playerCollision'

interface TestPlayer extends CollisionSyncedPlayer {
  name: string
}

const payload: PlayerCollisionSocketPayload = {
  playerId1: 'remote-1',
  playerId2: 'remote-2',
  position1: { x: 10, y: 0, z: 20 },
  position2: { x: -5, y: 1, z: 8 },
  rotation1: { x: 0, y: 1.5, z: 0 },
  rotation2: { x: 0, y: 2.25, z: 0 },
  speed1: 4,
  speed2: 0
}

test('applyPlayerCollisionUpdate syncs both remote collision players', () => {
  const players: TestPlayer[] = [
    { id: 'remote-1', name: 'One', position: [0, 0, 0], rotation: [0, 0, 0], isWalking: false },
    { id: 'remote-2', name: 'Two', position: [1, 1, 1], rotation: [0, 0, 0], isWalking: true },
    { id: 'remote-3', name: 'Three', position: [2, 2, 2], rotation: [0, 0, 0], isWalking: true }
  ]

  assert.deepEqual(applyPlayerCollisionUpdate(players, payload, 'local'), [
    { id: 'remote-1', name: 'One', position: [10, 0, 20], rotation: [0, 1.5, 0], isWalking: true },
    { id: 'remote-2', name: 'Two', position: [-5, 1, 8], rotation: [0, 2.25, 0], isWalking: false },
    { id: 'remote-3', name: 'Three', position: [2, 2, 2], rotation: [0, 0, 0], isWalking: true }
  ])
})

test('applyPlayerCollisionUpdate leaves the current socket player unchanged', () => {
  const players: TestPlayer[] = [
    { id: 'remote-1', name: 'One', position: [0, 0, 0], rotation: [0, 0, 0], isWalking: false },
    { id: 'remote-2', name: 'Two', position: [1, 1, 1], rotation: [0, 0, 0], isWalking: true }
  ]

  assert.deepEqual(applyPlayerCollisionUpdate(players, payload, 'remote-1'), [
    { id: 'remote-1', name: 'One', position: [0, 0, 0], rotation: [0, 0, 0], isWalking: false },
    { id: 'remote-2', name: 'Two', position: [-5, 1, 8], rotation: [0, 2.25, 0], isWalking: false }
  ])
})
