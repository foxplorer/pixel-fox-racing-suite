import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyPlayerCarColorUpdate,
  applyPlayerTrackNameUpdate,
  type CarColorSyncedPlayer,
  type TrackNameSyncedPlayer
} from './playerAppearance'

interface TestPlayer extends CarColorSyncedPlayer, TrackNameSyncedPlayer {
  name: string
}

test('applyPlayerCarColorUpdate patches the matching remote player color', () => {
  const players: TestPlayer[] = [
    { id: 'remote-1', name: 'One', carColor: '#111111' },
    { id: 'remote-2', name: 'Two', carColor: '#222222' }
  ]

  assert.deepEqual(applyPlayerCarColorUpdate(players, {
    playerId: 'remote-2',
    carColor: '#ffcc00'
  }), [
    { id: 'remote-1', name: 'One', carColor: '#111111' },
    { id: 'remote-2', name: 'Two', carColor: '#ffcc00' }
  ])
})

test('applyPlayerCarColorUpdate returns the same array when no player matches', () => {
  const players: TestPlayer[] = [
    { id: 'remote-1', name: 'One', carColor: '#111111' }
  ]

  assert.equal(applyPlayerCarColorUpdate(players, {
    playerId: 'missing',
    carColor: '#ffcc00'
  }), players)
})

test('applyPlayerCarColorUpdate patches players without an existing car color', () => {
  const players: TestPlayer[] = [
    { id: 'remote-1', name: 'One', carColor: '#111111' },
    { id: 'remote-2', name: 'Two' }
  ]

  assert.deepEqual(applyPlayerCarColorUpdate(players, {
    playerId: 'remote-2',
    carColor: '#ffcc00'
  }), [
    { id: 'remote-1', name: 'One', carColor: '#111111' },
    { id: 'remote-2', name: 'Two', carColor: '#ffcc00' }
  ])
})

test('applyPlayerTrackNameUpdate patches the matching player track name', () => {
  const players: TestPlayer[] = [
    { id: 'remote-1', name: 'One', carColor: '#111111', trackName: 'Australia' },
    { id: 'remote-2', name: 'Two', carColor: '#222222', trackName: 'Belgium' }
  ]

  assert.deepEqual(applyPlayerTrackNameUpdate(players, {
    playerId: 'remote-1',
    trackName: 'Aspen'
  }), [
    { id: 'remote-1', name: 'One', carColor: '#111111', trackName: 'Aspen' },
    { id: 'remote-2', name: 'Two', carColor: '#222222', trackName: 'Belgium' }
  ])
})

test('applyPlayerTrackNameUpdate returns the same array when no player matches', () => {
  const players: TestPlayer[] = [
    { id: 'remote-1', name: 'One', carColor: '#111111', trackName: 'Australia' }
  ]

  assert.equal(applyPlayerTrackNameUpdate(players, {
    playerId: 'missing',
    trackName: 'Aspen'
  }), players)
})
