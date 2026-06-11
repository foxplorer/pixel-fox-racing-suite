import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyJoinedCarTrackPlayer,
  applyLeftCarTrackPlayer,
  appendJoinedGameStatePlayerIfMissing,
  buildJoinedGameStatePlayer,
  isJoinedPlayerCurrent
} from './playerJoined'

test('buildJoinedGameStatePlayer normalizes joined player identity and track', () => {
  assert.deepEqual(buildJoinedGameStatePlayer({
    playerId: 'socket-1',
    identityKey: 'identity',
    score: null,
    ordinalAddress: undefined,
    originOutpoint: 'origin',
    trackName: undefined
  }, {
    defaultTrackName: 'Belgium'
  }), {
    id: 'socket-1',
    identityKey: 'identity',
    name: 'Fox',
    score: 0,
    ordinalAddress: null,
    originOutpoint: 'origin',
    trackName: 'Belgium'
  })
})

test('buildJoinedGameStatePlayer can include initial movement state', () => {
  assert.deepEqual(buildJoinedGameStatePlayer({
    playerId: 'socket-1',
    identityKey: 'identity',
    name: 'Racer',
    score: 3,
    trackName: 'Australia'
  }, {
    defaultTrackName: 'Belgium',
    includeInitialMovement: true
  }), {
    id: 'socket-1',
    identityKey: 'identity',
    name: 'Racer',
    score: 3,
    ordinalAddress: null,
    originOutpoint: null,
    position: { x: 0, y: 0.1, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    speed: 0,
    trackName: 'Australia'
  })
})

test('buildJoinedGameStatePlayer can preserve car color for tracks that store it in game state', () => {
  assert.deepEqual(buildJoinedGameStatePlayer({
    playerId: 'socket-1',
    identityKey: 'identity',
    carColor: '#00ff00'
  }, {
    defaultTrackName: 'San Luis',
    includeCarColor: true
  }), {
    id: 'socket-1',
    identityKey: 'identity',
    name: 'Fox',
    score: 0,
    ordinalAddress: null,
    originOutpoint: null,
    carColor: '#00ff00',
    trackName: 'San Luis'
  })
})

test('appendJoinedGameStatePlayerIfMissing skips duplicate joined players', () => {
  const players = [
    { id: 'socket-1', identityKey: 'identity', name: 'Existing', score: 2, trackName: 'Belgium' }
  ]

  assert.equal(appendJoinedGameStatePlayerIfMissing(players, {
    playerId: 'socket-1',
    identityKey: 'identity'
  }, {
    defaultTrackName: 'Belgium'
  }), players)
})

test('appendJoinedGameStatePlayerIfMissing appends a normalized player', () => {
  assert.deepEqual(appendJoinedGameStatePlayerIfMissing([], {
    playerId: 'socket-1',
    identityKey: 'identity',
    name: 'Racer'
  }, {
    defaultTrackName: 'Aspen'
  }), [{
    id: 'socket-1',
    identityKey: 'identity',
    name: 'Racer',
    score: 0,
    ordinalAddress: null,
    originOutpoint: null,
    trackName: 'Aspen'
  }])
})

test('isJoinedPlayerCurrent can use socket-first matching for local multi-client testing', () => {
  assert.equal(isJoinedPlayerCurrent({
    player: {
      playerId: 'remote-socket',
      identityKey: 'same-identity',
      ordinalAddress: 'same-owner'
    },
    socketId: 'local-socket',
    identityKey: 'same-identity',
    ordinalAddress: 'same-owner',
    socketIdOnlyWhenAvailable: true
  }), false)

  assert.equal(isJoinedPlayerCurrent({
    player: {
      playerId: 'remote-socket',
      identityKey: 'same-identity'
    },
    socketId: null,
    identityKey: 'same-identity',
    socketIdOnlyWhenAvailable: true
  }), true)
})

test('applyJoinedCarTrackPlayer appends joined game-state and rendered players', () => {
  const result = applyJoinedCarTrackPlayer({
    gameStatePlayers: [],
    renderedPlayers: [],
    player: {
      playerId: 'remote-1',
      identityKey: 'remote',
      name: 'Remote',
      trackName: 'Australia',
      carColor: '#123456'
    },
    socketId: 'local-socket',
    identityKey: 'local',
    defaultTrackName: 'Australia',
    includeInitialMovement: true,
    getFallbackColor: index => `fallback-${index}`
  })

  assert.equal(result.isCurrentPlayer, false)
  assert.deepEqual(result.gameStatePlayers, [{
    id: 'remote-1',
    identityKey: 'remote',
    name: 'Remote',
    score: 0,
    ordinalAddress: null,
    originOutpoint: null,
    position: { x: 0, y: 0.1, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    speed: 0,
    trackName: 'Australia'
  }])
  assert.deepEqual(result.renderedPlayers, [{
    id: 'remote-1',
    name: 'Remote',
    position: [0, 0.1, 0],
    rotation: [0, 0, 0],
    color: 'fallback-0',
    carColor: '#123456',
    isWalking: false,
    originOutpoint: undefined
  }])
})

test('applyJoinedCarTrackPlayer skips rendered append for current player', () => {
  const result = applyJoinedCarTrackPlayer({
    gameStatePlayers: [],
    renderedPlayers: [],
    player: {
      playerId: 'local-socket',
      identityKey: 'local',
      name: 'Local'
    },
    socketId: 'local-socket',
    identityKey: 'local',
    defaultTrackName: 'San Luis',
    includeCarColor: true,
    getFallbackColor: index => `fallback-${index}`,
    socketIdOnlyWhenAvailable: true
  })

  assert.equal(result.isCurrentPlayer, true)
  assert.deepEqual(result.renderedPlayers, [])
  assert.deepEqual(result.gameStatePlayers, [{
    id: 'local-socket',
    identityKey: 'local',
    name: 'Local',
    score: 0,
    ordinalAddress: null,
    originOutpoint: null,
    carColor: undefined,
    trackName: 'San Luis'
  }])
})

test('applyLeftCarTrackPlayer removes from game-state and rendered players', () => {
  const result = applyLeftCarTrackPlayer({
    gameStatePlayers: [
      { id: 'leaving', identityKey: 'one', trackName: 'Australia' },
      { id: 'staying', identityKey: 'two', trackName: 'Australia' }
    ],
    renderedPlayers: [
      {
        id: 'leaving',
        name: 'Leaving',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        color: '#111',
        carColor: '#111',
        isWalking: false
      },
      {
        id: 'staying',
        name: 'Staying',
        position: [1, 0, 0],
        rotation: [0, 0, 0],
        color: '#222',
        carColor: '#222',
        isWalking: false
      }
    ],
    playerId: 'leaving'
  })

  assert.deepEqual(result.gameStatePlayers, [
    { id: 'staying', identityKey: 'two', trackName: 'Australia' }
  ])
  assert.deepEqual(result.renderedPlayers, [
    {
      id: 'staying',
      name: 'Staying',
      position: [1, 0, 0],
      rotation: [0, 0, 0],
      color: '#222',
      carColor: '#222',
      isWalking: false
    }
  ])
})
