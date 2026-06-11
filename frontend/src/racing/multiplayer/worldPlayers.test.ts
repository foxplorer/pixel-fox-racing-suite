import assert from 'node:assert/strict'
import test from 'node:test'
import {
  appendJoinedRacingWorldPlayerIfMissing,
  buildJoinedRacingWorldPlayer,
  buildRacingWorldPlayer,
  buildRacingWorldPlayersForTrack,
  getRacingWorldPlayerCollisionTargets,
  type RacingWorldPlayer
} from './worldPlayers'

test('getRacingWorldPlayerCollisionTargets keeps only ids and positions', () => {
  const players: RacingWorldPlayer[] = [
    {
      id: 'player-1',
      name: 'Fox',
      position: [1, 2, 3],
      rotation: [0, 1, 0],
      color: '#fff',
      carColor: '#f00',
      isWalking: true,
      foxTextureUrl: 'fox.png',
      chatMessage: 'hi',
      chatTimestamp: 123
    }
  ]

  assert.deepEqual(getRacingWorldPlayerCollisionTargets(players), [
    { id: 'player-1', position: [1, 2, 3] }
  ])
})

test('buildRacingWorldPlayer prefers server color, then existing color, then fallback color', () => {
  assert.deepEqual(buildRacingWorldPlayer({
    player: {
      id: 'player-1',
      name: 'Fox',
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 1, z: 0 },
      speed: 4,
      carColor: '#server',
      originOutpoint: 'origin'
    },
    existingPlayer: { color: '#existing-color', carColor: '#existing-car' },
    index: 2,
    getFallbackColor: index => `fallback-${index}`
  }), {
    id: 'player-1',
    name: 'Fox',
    position: [1, 2, 3],
    rotation: [0, 1, 0],
    color: '#existing-color',
    carColor: '#server',
    isWalking: true,
    originOutpoint: 'origin'
  })
})

test('buildRacingWorldPlayer can include speed and custom default position', () => {
  assert.deepEqual(buildRacingWorldPlayer({
    player: {
      id: 'player-1',
      speed: 0,
      carColor: ''
    },
    existingPlayer: { carColor: '#existing-car' },
    index: 1,
    getFallbackColor: index => `fallback-${index}`,
    defaultPosition: [0, 0.1, 0],
    includeSpeed: true
  }), {
    id: 'player-1',
    name: 'Fox',
    position: [0, 0.1, 0],
    rotation: [0, 0, 0],
    color: 'fallback-1',
    carColor: '#existing-car',
    isWalking: false,
    speed: 0,
    originOutpoint: undefined
  })
})

test('buildRacingWorldPlayersForTrack excludes current and different-track players', () => {
  assert.deepEqual(buildRacingWorldPlayersForTrack({
    players: [
      {
        id: 'socket-local',
        identityKey: 'local',
        name: 'Local',
        trackName: 'Australia',
        carColor: '#local'
      },
      {
        id: 'remote-1',
        identityKey: 'remote-1',
        name: 'Same Track',
        trackName: 'Australia',
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 1, z: 0 },
        speed: 2,
        carColor: '#remote'
      },
      {
        id: 'remote-2',
        identityKey: 'remote-2',
        name: 'Other Track',
        trackName: 'Belgium',
        carColor: '#other'
      }
    ],
    existingPlayers: [],
    socketId: 'socket-local',
    identityKey: 'local',
    currentTrackName: 'Australia',
    defaultTrackName: 'Australia',
    getFallbackColor: index => `fallback-${index}`
  }), [
    {
      id: 'remote-1',
      name: 'Same Track',
      position: [1, 2, 3],
      rotation: [0, 1, 0],
      color: 'fallback-0',
      carColor: '#remote',
      isWalking: true,
      originOutpoint: undefined
    }
  ])
})

test('buildRacingWorldPlayersForTrack preserves existing colors and supports custom current-player matching', () => {
  const existingPlayers: RacingWorldPlayer[] = [
    {
      id: 'remote-1',
      name: 'Existing',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      color: '#existing-color',
      carColor: '#existing-car',
      isWalking: false
    }
  ]

  assert.deepEqual(buildRacingWorldPlayersForTrack({
    players: [
      {
        id: 'same-identity-but-remote-socket',
        identityKey: 'local',
        name: 'Shared Identity Remote',
        trackName: 'San Luis'
      },
      {
        id: 'remote-1',
        name: 'Remote',
        trackName: 'San Luis'
      }
    ],
    existingPlayers,
    socketId: 'socket-local',
    identityKey: 'local',
    currentTrackName: 'San Luis',
    defaultTrackName: 'San Luis',
    defaultPosition: [0, 0.1, 0],
    getFallbackColor: index => `fallback-${index}`,
    isCurrentPlayer: player => player.id === 'socket-local'
  }), [
    {
      id: 'same-identity-but-remote-socket',
      name: 'Shared Identity Remote',
      position: [0, 0.1, 0],
      rotation: [0, 0, 0],
      color: 'fallback-0',
      carColor: 'fallback-0',
      isWalking: false,
      originOutpoint: undefined
    },
    {
      id: 'remote-1',
      name: 'Remote',
      position: [0, 0.1, 0],
      rotation: [0, 0, 0],
      color: '#existing-color',
      carColor: '#existing-car',
      isWalking: false,
      originOutpoint: undefined
    }
  ])
})

test('buildJoinedRacingWorldPlayer builds initial rendered joined-player state', () => {
  assert.deepEqual(buildJoinedRacingWorldPlayer({
    player: {
      playerId: 'player-1',
      name: 'Joined',
      carColor: '#car',
      originOutpoint: 'origin'
    },
    index: 3,
    getFallbackColor: index => `fallback-${index}`,
    includeSpeed: true
  }), {
    id: 'player-1',
    name: 'Joined',
    position: [0, 0.1, 0],
    rotation: [0, 0, 0],
    color: 'fallback-3',
    carColor: '#car',
    isWalking: false,
    speed: 0,
    originOutpoint: 'origin'
  })
})

test('appendJoinedRacingWorldPlayerIfMissing skips duplicate rendered players', () => {
  const players: RacingWorldPlayer[] = [
    {
      id: 'player-1',
      name: 'Existing',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      color: '#fff',
      carColor: '#f00',
      isWalking: false
    }
  ]

  assert.equal(appendJoinedRacingWorldPlayerIfMissing(players, {
    playerId: 'player-1',
    name: 'Duplicate'
  }, {
    getFallbackColor: index => `fallback-${index}`
  }), players)
})
