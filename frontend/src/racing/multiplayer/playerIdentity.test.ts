import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findMultiplayerPlayerBySocketId,
  isCurrentMultiplayerPlayer,
  isSameMultiplayerTrack,
  patchCurrentMultiplayerPlayer,
  patchMultiplayerPlayerById,
  preserveCurrentMultiplayerPlayerTrackName,
  removeMultiplayerPlayerById,
  upsertCurrentMultiplayerPlayer
} from './playerIdentity'

test('isCurrentMultiplayerPlayer matches by socket id first', () => {
  assert.equal(isCurrentMultiplayerPlayer({
    player: { id: 'socket-1', identityKey: 'other' },
    socketId: 'socket-1',
    identityKey: 'identity'
  }), true)
})

test('isCurrentMultiplayerPlayer matches by identity key when socket id differs', () => {
  assert.equal(isCurrentMultiplayerPlayer({
    player: { id: 'socket-2', identityKey: 'identity' },
    socketId: 'socket-1',
    identityKey: 'identity'
  }), true)
})

test('isCurrentMultiplayerPlayer only uses ordinal fallback when enabled', () => {
  assert.equal(isCurrentMultiplayerPlayer({
    player: { ordinalAddress: 'owner' },
    ordinalAddress: 'owner'
  }), false)

  assert.equal(isCurrentMultiplayerPlayer({
    player: { ordinalAddress: 'owner' },
    ordinalAddress: 'owner',
    allowOrdinalFallback: true
  }), true)
})

test('isSameMultiplayerTrack compares track names with explicit defaults', () => {
  assert.equal(isSameMultiplayerTrack({
    player: { trackName: 'Belgium' },
    currentTrackName: 'Belgium',
    defaultTrackName: 'Australia'
  }), true)

  assert.equal(isSameMultiplayerTrack({
    player: {},
    currentTrackName: undefined,
    defaultTrackName: 'San Luis'
  }), true)

  assert.equal(isSameMultiplayerTrack({
    player: { trackName: 'Australia' },
    currentTrackName: 'Belgium',
    defaultTrackName: 'Australia'
  }), false)
})

test('patchMultiplayerPlayerById patches one player by id', () => {
  const players = [
    { id: 'a', trackName: 'Australia', carColor: 'red' },
    { id: 'b', trackName: 'Belgium', carColor: 'blue' }
  ]

  assert.deepEqual(patchMultiplayerPlayerById(players, 'b', { trackName: 'San Luis' }), [
    { id: 'a', trackName: 'Australia', carColor: 'red' },
    { id: 'b', trackName: 'San Luis', carColor: 'blue' }
  ])
})

test('removeMultiplayerPlayerById removes one player by id', () => {
  const players = [
    { id: 'a', name: 'One' },
    { id: 'b', name: 'Two' }
  ]

  assert.deepEqual(removeMultiplayerPlayerById(players, 'a'), [
    { id: 'b', name: 'Two' }
  ])
})

test('upsertCurrentMultiplayerPlayer creates state when none exists', () => {
  assert.deepEqual(upsertCurrentMultiplayerPlayer({
    previousState: null,
    gameId: 'game-1',
    player: { id: 'socket-1', identityKey: 'identity' }
  }), {
    gameId: 'game-1',
    players: [{ id: 'socket-1', identityKey: 'identity' }]
  })
})

test('upsertCurrentMultiplayerPlayer merges an existing current player by default', () => {
  assert.deepEqual(upsertCurrentMultiplayerPlayer({
    previousState: {
      gameId: 'old-game',
      players: [
        { id: 'socket-1', identityKey: 'identity', score: 10, trackName: 'Australia' },
        { id: 'socket-2', identityKey: 'other', score: 5 }
      ]
    },
    gameId: 'game-1',
    identityKey: 'identity',
    player: { id: 'socket-1', identityKey: 'identity', trackName: 'Belgium' }
  }), {
    gameId: 'game-1',
    players: [
      { id: 'socket-1', identityKey: 'identity', score: 10, trackName: 'Belgium' },
      { id: 'socket-2', identityKey: 'other', score: 5 }
    ]
  })
})

test('upsertCurrentMultiplayerPlayer can replace an existing current player', () => {
  assert.deepEqual(upsertCurrentMultiplayerPlayer({
    previousState: {
      gameId: 'old-game',
      players: [
        { id: 'socket-1', identityKey: 'identity', score: 10, trackName: 'Australia' }
      ]
    },
    gameId: 'game-1',
    identityKey: 'identity',
    mergeExisting: false,
    player: { id: 'socket-1', identityKey: 'identity', trackName: 'San Luis' }
  }), {
    gameId: 'game-1',
    players: [
      { id: 'socket-1', identityKey: 'identity', trackName: 'San Luis' }
    ]
  })
})

test('findMultiplayerPlayerBySocketId finds players by socket id', () => {
  const players = [
    { id: 'socket-1', name: 'One' },
    { id: 'socket-2', name: 'Two' }
  ]

  assert.deepEqual(findMultiplayerPlayerBySocketId(players, 'socket-2'), { id: 'socket-2', name: 'Two' })
  assert.equal(findMultiplayerPlayerBySocketId(players, 'missing'), undefined)
  assert.equal(findMultiplayerPlayerBySocketId(undefined, 'socket-2'), undefined)
})

test('patchCurrentMultiplayerPlayer patches by current socket or identity match', () => {
  const players = [
    { id: 'socket-1', identityKey: 'old', trackName: 'Australia' },
    { id: 'socket-2', identityKey: 'identity', trackName: 'Belgium' }
  ]

  assert.deepEqual(patchCurrentMultiplayerPlayer(players, {
    socketId: 'missing',
    identityKey: 'identity'
  }, { trackName: 'Aspen' }), [
    { id: 'socket-1', identityKey: 'old', trackName: 'Australia' },
    { id: 'socket-2', identityKey: 'identity', trackName: 'Aspen' }
  ])
})

test('preserveCurrentMultiplayerPlayerTrackName keeps previous track when server omits it', () => {
  const previousPlayers = [
    { id: 'socket-1', identityKey: 'identity', trackName: 'Aspen' },
    { id: 'socket-2', identityKey: 'other', trackName: 'Belgium' }
  ]
  const incomingPlayers = [
    { id: 'socket-1', identityKey: 'identity' },
    { id: 'socket-2', identityKey: 'other', trackName: 'Belgium' }
  ]

  assert.deepEqual(preserveCurrentMultiplayerPlayerTrackName(incomingPlayers, previousPlayers, {
    socketId: 'socket-1',
    identityKey: 'identity'
  }, 'Australia'), [
    { id: 'socket-1', identityKey: 'identity', trackName: 'Aspen' },
    { id: 'socket-2', identityKey: 'other', trackName: 'Belgium' }
  ])
})

test('preserveCurrentMultiplayerPlayerTrackName keeps server track when present', () => {
  const incomingPlayers = [
    { id: 'socket-1', identityKey: 'identity', trackName: 'San Luis' }
  ]

  assert.deepEqual(preserveCurrentMultiplayerPlayerTrackName(incomingPlayers, undefined, {
    socketId: 'socket-1',
    identityKey: 'identity'
  }, 'Australia'), [
    { id: 'socket-1', identityKey: 'identity', trackName: 'San Luis' }
  ])
})
