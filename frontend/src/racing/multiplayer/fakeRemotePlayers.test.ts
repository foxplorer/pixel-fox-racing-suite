import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateFakeRemotePlayers,
  parseFakeRemotePlayerCount,
  parseFakeRemotePlayerSpeedScale
} from './fakeRemotePlayers'

test('parseFakeRemotePlayerCount accepts positive counts and clamps large values', () => {
  assert.equal(parseFakeRemotePlayerCount(undefined), 0)
  assert.equal(parseFakeRemotePlayerCount(''), 0)
  assert.equal(parseFakeRemotePlayerCount('abc'), 0)
  assert.equal(parseFakeRemotePlayerCount('-4'), 0)
  assert.equal(parseFakeRemotePlayerCount('20'), 20)
  assert.equal(parseFakeRemotePlayerCount('500'), 100)
})

test('parseFakeRemotePlayerSpeedScale accepts positive scales and clamps large values', () => {
  assert.equal(parseFakeRemotePlayerSpeedScale(undefined), 1)
  assert.equal(parseFakeRemotePlayerSpeedScale(''), 1)
  assert.equal(parseFakeRemotePlayerSpeedScale('abc'), 1)
  assert.equal(parseFakeRemotePlayerSpeedScale('-2'), 1)
  assert.equal(parseFakeRemotePlayerSpeedScale('2.5'), 2.5)
  assert.equal(parseFakeRemotePlayerSpeedScale('99'), 8)
})

test('generateFakeRemotePlayers creates deterministic players with stable ids and colors', () => {
  const players = generateFakeRemotePlayers({
    count: 3,
    trackName: 'Australia',
    center: { x: 10, z: 20 },
    radius: 50,
    getFallbackColor: index => `color-${index}`
  })

  assert.deepEqual(players.map(player => player.id), [
    'fake-australia-1',
    'fake-australia-2',
    'fake-australia-3'
  ])
  assert.deepEqual(players.map(player => player.carColor), ['color-0', 'color-1', 'color-2'])
  assert.equal(players[0].name, 'Fake 1')
  assert.deepEqual(players[0].position, [60, 0.1, 20])
  assert.equal(players[0].chatMessage, 'Load 3')
})

test('generateFakeRemotePlayers defaults first ring close to the center for visual load testing', () => {
  const players = generateFakeRemotePlayers({
    count: 1,
    trackName: 'Australia',
    center: { x: 10, z: 20 },
    getFallbackColor: index => `color-${index}`
  })

  assert.deepEqual(players[0].position, [45, 0.1, 20])
})

test('generateFakeRemotePlayers moves deterministically when elapsed time is provided', () => {
  const first = generateFakeRemotePlayers({
    count: 2,
    trackName: 'Australia',
    center: { x: 10, z: 20 },
    getFallbackColor: index => `color-${index}`,
    elapsedSeconds: 0
  })
  const later = generateFakeRemotePlayers({
    count: 2,
    trackName: 'Australia',
    center: { x: 10, z: 20 },
    getFallbackColor: index => `color-${index}`,
    elapsedSeconds: 5
  })

  assert.deepEqual(later.map(player => player.id), first.map(player => player.id))
  assert.notDeepEqual(later.map(player => player.position), first.map(player => player.position))
})

test('generateFakeRemotePlayers scales fake movement speed without changing ids', () => {
  const normal = generateFakeRemotePlayers({
    count: 1,
    trackName: 'Australia',
    center: { x: 10, z: 20 },
    getFallbackColor: index => `color-${index}`,
    elapsedSeconds: 5,
    speedScale: 1
  })
  const faster = generateFakeRemotePlayers({
    count: 1,
    trackName: 'Australia',
    center: { x: 10, z: 20 },
    getFallbackColor: index => `color-${index}`,
    elapsedSeconds: 5,
    speedScale: 3
  })

  assert.equal(faster[0].id, normal[0].id)
  assert.notDeepEqual(faster[0].position, normal[0].position)
  assert.equal(faster[0].speed, normal[0].speed * 3)
})

test('generateFakeRemotePlayers clamps count and handles empty requests', () => {
  assert.deepEqual(generateFakeRemotePlayers({
    count: 0,
    trackName: 'Belgium',
    getFallbackColor: index => `color-${index}`
  }), [])

  const players = generateFakeRemotePlayers({
    count: 101,
    trackName: 'San Luis',
    getFallbackColor: index => `color-${index}`
  })

  assert.equal(players.length, 100)
  assert.equal(players[99].id, 'fake-san-luis-100')
})
