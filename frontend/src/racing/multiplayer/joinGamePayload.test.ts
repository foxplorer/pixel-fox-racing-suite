import assert from 'node:assert/strict'
import test from 'node:test'
import { buildJoinGamePayload, shouldEmitJoinGame } from './joinGamePayload'

test('buildJoinGamePayload creates the shared joinGame payload shape', () => {
  assert.deepEqual(buildJoinGamePayload({
    identityKey: 'identity',
    foxName: 'Fast Fox',
    ordinalAddress: 'owner',
    foxOriginOutpoint: 'origin',
    playerColor: '#ff0000',
    trackName: 'Australia',
    startFinishPosition: { x: 1, y: 2, z: 3 },
    createGuestIdentityKey: () => 'guest'
  }), {
    identityKey: 'identity',
    name: 'Fast Fox',
    ordinalAddress: 'owner',
    originOutpoint: 'origin',
    carColor: '#ff0000',
    startFinishPosition: { x: 1, y: 2, z: 3 },
    trackName: 'Australia'
  })
})

test('buildJoinGamePayload falls back to guest identity and fox defaults', () => {
  assert.deepEqual(buildJoinGamePayload({
    identityKey: null,
    foxName: '',
    ordinalAddress: '',
    foxOriginOutpoint: '',
    playerColor: '#00ff00',
    trackName: 'San Luis',
    createGuestIdentityKey: () => 'guest'
  }), {
    identityKey: 'guest',
    name: 'Fox',
    ordinalAddress: null,
    originOutpoint: null,
    carColor: '#00ff00',
    trackName: 'San Luis'
  })
})

test('buildJoinGamePayload canonicalizes dot-form origin outpoints', () => {
  const txid = 'a'.repeat(64)
  const payload = buildJoinGamePayload({
    identityKey: 'identity',
    foxName: 'Fast Fox',
    ordinalAddress: 'owner',
    foxOriginOutpoint: `${txid}.2`,
    playerColor: '#ff0000',
    trackName: 'Australia'
  })

  assert.equal(payload.originOutpoint, `${txid}_2`)
})

test('shouldEmitJoinGame supports showroom-only joins', () => {
  assert.equal(shouldEmitJoinGame({
    gameStatus: 'showroom',
    hasFoxOriginOutpoint: true,
    hasSocket: true,
    hasJoined: false
  }), true)

  assert.equal(shouldEmitJoinGame({
    gameStatus: 'racing',
    hasFoxOriginOutpoint: true,
    hasSocket: true,
    hasJoined: false
  }), false)
})

test('shouldEmitJoinGame supports connected active-race joins for immediate starts', () => {
  assert.equal(shouldEmitJoinGame({
    gameStatus: 'loading',
    hasFoxOriginOutpoint: true,
    hasSocket: true,
    hasJoined: false,
    isConnected: true,
    requireConnection: true,
    startRaceImmediately: true,
    allowActiveRaceJoin: true
  }), true)

  assert.equal(shouldEmitJoinGame({
    gameStatus: 'loading',
    hasFoxOriginOutpoint: true,
    hasSocket: true,
    hasJoined: false,
    isConnected: true,
    requireConnection: true,
    startRaceImmediately: false,
    allowActiveRaceJoin: true
  }), false)

  assert.equal(shouldEmitJoinGame({
    gameStatus: 'countdown',
    hasFoxOriginOutpoint: true,
    hasSocket: true,
    hasJoined: false,
    isConnected: false,
    requireConnection: true,
    allowActiveRaceJoin: true
  }), false)
})
