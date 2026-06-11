import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_RACING_SPAWN_POSITION,
  applyCarTrackGameJoined,
  buildGameJoinedCurrentPlayer,
  preserveExistingSpawnPosition,
  resolveGameJoinedSpawnPosition
} from './gameJoined'

test('resolveGameJoinedSpawnPosition uses server position when present', () => {
  assert.deepEqual(resolveGameJoinedSpawnPosition({
    position: { x: 1, y: 2, z: 3 }
  }), { x: 1, y: 2, z: 3 })
})

test('resolveGameJoinedSpawnPosition falls back to default position', () => {
  assert.deepEqual(resolveGameJoinedSpawnPosition({}), DEFAULT_RACING_SPAWN_POSITION)
})

test('preserveExistingSpawnPosition keeps previous position when already set', () => {
  assert.deepEqual(preserveExistingSpawnPosition(
    { x: 9, y: 9, z: 9 },
    { position: { x: 1, y: 2, z: 3 } }
  ), { x: 9, y: 9, z: 9 })
})

test('buildGameJoinedCurrentPlayer normalizes current player fields', () => {
  assert.deepEqual(buildGameJoinedCurrentPlayer({
    socketId: 'socket-1',
    identityKey: 'identity',
    name: '',
    ordinalAddress: undefined,
    originOutpoint: 'origin',
    carColor: '#ffcc00',
    trackName: 'Belgium'
  }), {
    id: 'socket-1',
    identityKey: 'identity',
    name: 'Fox',
    score: 0,
    ordinalAddress: null,
    originOutpoint: 'origin',
    carColor: '#ffcc00',
    trackName: 'Belgium'
  })
})

test('applyCarTrackGameJoined preserves existing spawn and merges current player by default', () => {
  assert.deepEqual(applyCarTrackGameJoined({
    payload: {
      gameId: 'game-2',
      position: { x: 1, y: 2, z: 3 }
    },
    previousSpawnPosition: { x: 9, y: 9, z: 9 },
    previousGameState: {
      gameId: 'game-1',
      players: [
        {
          id: 'socket-1',
          identityKey: 'identity',
          name: 'Old',
          score: 5,
          ordinalAddress: null,
          originOutpoint: null,
          carColor: '#old',
          trackName: 'Australia'
        }
      ]
    },
    socketId: 'socket-1',
    identityKey: 'identity',
    name: 'Fox',
    ordinalAddress: 'owner',
    originOutpoint: 'origin',
    carColor: '#new',
    trackName: 'Belgium'
  }), {
    spawnPosition: { x: 9, y: 9, z: 9 },
    gameState: {
      gameId: 'game-2',
      players: [
        {
          id: 'socket-1',
          identityKey: 'identity',
          name: 'Fox',
          score: 0,
          ordinalAddress: 'owner',
          originOutpoint: 'origin',
          carColor: '#new',
          trackName: 'Belgium'
        }
      ]
    },
    currentPlayer: {
      id: 'socket-1',
      identityKey: 'identity',
      name: 'Fox',
      score: 0,
      ordinalAddress: 'owner',
      originOutpoint: 'origin',
      carColor: '#new',
      trackName: 'Belgium'
    }
  })
})

test('applyCarTrackGameJoined can replace existing current player while preserving spawn', () => {
  assert.deepEqual(applyCarTrackGameJoined({
    payload: {
      gameId: 'game-2',
      position: { x: 1, y: 2, z: 3 }
    },
    previousSpawnPosition: { x: 9, y: 9, z: 9 },
    previousGameState: {
      gameId: 'game-1',
      players: [
        {
          id: 'socket-1',
          identityKey: 'identity',
          name: 'Old',
          score: 5,
          ordinalAddress: null,
          originOutpoint: null,
          carColor: '#old',
          trackName: 'San Luis'
        }
      ]
    },
    socketId: 'socket-1',
    identityKey: 'identity',
    name: 'New',
    carColor: '#new',
    trackName: 'San Luis',
    mergeExistingPlayer: false
  }), {
    spawnPosition: { x: 9, y: 9, z: 9 },
    gameState: {
      gameId: 'game-2',
      players: [
        {
          id: 'socket-1',
          identityKey: 'identity',
          name: 'New',
          score: 0,
          ordinalAddress: null,
          originOutpoint: null,
          carColor: '#new',
          trackName: 'San Luis'
        }
      ]
    },
    currentPlayer: {
      id: 'socket-1',
      identityKey: 'identity',
      name: 'New',
      score: 0,
      ordinalAddress: null,
      originOutpoint: null,
      carColor: '#new',
      trackName: 'San Luis'
    }
  })
})
