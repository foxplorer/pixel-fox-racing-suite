import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyRemotePlayerChatMessage,
  getIncomingPlayerChatTarget,
  type ChatSyncedPlayer
} from './playerChat'

interface TestPlayer extends ChatSyncedPlayer {
  trackName?: string
}

test('getIncomingPlayerChatTarget ignores blank messages', () => {
  assert.equal(getIncomingPlayerChatTarget({
    payload: { playerId: 'remote-1', message: '   ' },
    socketId: 'local',
    defaultTrackName: 'Australia'
  }), 'ignore')
})

test('getIncomingPlayerChatTarget identifies local echoed messages', () => {
  assert.equal(getIncomingPlayerChatTarget({
    payload: { playerId: 'local', message: 'hello' },
    socketId: 'local',
    defaultTrackName: 'Australia'
  }), 'local')
})

test('getIncomingPlayerChatTarget ignores remote messages from other tracks', () => {
  assert.equal(getIncomingPlayerChatTarget({
    payload: { playerId: 'remote-1', message: 'hello' },
    socketId: 'local',
    currentTrackName: 'Belgium',
    defaultTrackName: 'Australia',
    players: [{ id: 'remote-1', trackName: 'San Luis' }]
  }), 'ignore')
})

test('getIncomingPlayerChatTarget accepts remote messages from the same track', () => {
  assert.equal(getIncomingPlayerChatTarget({
    payload: { playerId: 'remote-1', message: 'hello' },
    socketId: 'local',
    currentTrackName: 'Belgium',
    defaultTrackName: 'Australia',
    players: [{ id: 'remote-1', trackName: 'Belgium' }]
  }), 'remote')
})

test('applyRemotePlayerChatMessage patches the matching rendered player', () => {
  const players: TestPlayer[] = [
    { id: 'remote-1' },
    { id: 'remote-2', chatMessage: 'old', chatTimestamp: 1 }
  ]

  assert.deepEqual(applyRemotePlayerChatMessage(players, {
    playerId: 'remote-2',
    message: 'new'
  }, 123), [
    { id: 'remote-1' },
    { id: 'remote-2', chatMessage: 'new', chatTimestamp: 123 }
  ])
})

test('applyRemotePlayerChatMessage returns the same array when no rendered player matches', () => {
  const players: TestPlayer[] = [
    { id: 'remote-1' }
  ]

  assert.equal(applyRemotePlayerChatMessage(players, {
    playerId: 'missing',
    message: 'new'
  }, 123), players)
})
