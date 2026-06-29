import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyPlayerCollisionUpdate,
  buildReportPlayerCollisionPayload,
  shouldApplyPlayerCollisionSequence,
  type CollisionSyncedPlayer,
  type PlayerCollisionSocketPayload
} from './playerCollision'

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

test('buildReportPlayerCollisionPayload builds a server collision report from local contact data', () => {
  assert.deepEqual(buildReportPlayerCollisionPayload({
    localPlayerId: 'local-1',
    trackName: 'Australia',
    sequence: 7,
    report: {
      remotePlayerId: 'remote-1',
      localPosition: { x: 1, y: 0.1, z: 2 },
      remotePosition: { x: 3, y: 0.1, z: 4 },
      localRotationY: 0.5,
      remoteRotationY: 0.75,
      localSpeed: 40,
      remoteSpeed: 35,
      resultLocalSpeed: 38,
      collisionKind: 'rear-end',
      contactNormal: { x: 0, z: 1 },
      overlapDepth: 0.4,
      occurredAt: 123
    }
  }), {
    collisionId: 'local-1:remote-1:7',
    sequence: 7,
    trackName: 'Australia',
    playerId1: 'local-1',
    playerId2: 'remote-1',
    position1: { x: 1, y: 0.1, z: 2 },
    position2: { x: 3, y: 0.1, z: 4 },
    rotation1: { x: 0, y: 0.5, z: 0 },
    rotation2: { x: 0, y: 0.75, z: 0 },
    speed1: 40,
    speed2: 35,
    resultSpeed1: 38,
    resultSpeed2: 35,
    collisionKind: 'rear-end',
    contactNormal: { x: 0, z: 1 },
    overlapDepth: 0.4,
    occurredAt: 123
  })
})

test('shouldApplyPlayerCollisionSequence rejects stale or duplicate pair events', () => {
  const sequenceState = new Map<string, number>()
  const sequencePayload = {
    ...payload,
    playerId1: 'a',
    playerId2: 'b',
    sequence: 10
  }

  assert.equal(shouldApplyPlayerCollisionSequence(sequencePayload, sequenceState), true)
  assert.equal(shouldApplyPlayerCollisionSequence({ ...sequencePayload, sequence: 10 }, sequenceState), false)
  assert.equal(shouldApplyPlayerCollisionSequence({ ...sequencePayload, sequence: 9 }, sequenceState), false)
  assert.equal(shouldApplyPlayerCollisionSequence({ ...sequencePayload, sequence: 11 }, sequenceState), true)
  assert.equal(shouldApplyPlayerCollisionSequence({ ...sequencePayload, playerId1: 'b', playerId2: 'a', sequence: 11 }, sequenceState), false)
  assert.equal(shouldApplyPlayerCollisionSequence({ ...sequencePayload, sequence: undefined }, sequenceState), true)
})
