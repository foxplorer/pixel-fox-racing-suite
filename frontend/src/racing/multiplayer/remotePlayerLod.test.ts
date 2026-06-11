import assert from 'node:assert/strict'
import test from 'node:test'
import { getRacingQualityPreset } from '../performance/qualitySettings'
import { classifyRemotePlayersForLod } from './remotePlayerLod'

const playerAt = (id: string, x: number, z = 0) => ({
  id,
  position: [x, 0, z] as [number, number, number]
})

test('classifyRemotePlayersForLod keeps nearest visible players within preset budget', () => {
  const players = [
    playerAt('far', 500),
    playerAt('near-2', 30),
    playerAt('near-1', 10),
    playerAt('near-3', 50)
  ]

  const entries = classifyRemotePlayersForLod(players, { x: 0, z: 0 }, {
    ...getRacingQualityPreset('medium'),
    remotePlayers: {
      renderDistance: 100,
      maxVisible: 2
    }
  })

  assert.deepEqual(entries.map(entry => entry.player.id), ['near-1', 'near-2'])
  assert.deepEqual(entries.map(entry => entry.sourceIndex), [2, 1])
})

test('classifyRemotePlayersForLod assigns stable near and mid tiers by distance and index', () => {
  const players = [
    playerAt('same-distance-a', 10, 0),
    playerAt('same-distance-b', -10, 0),
    playerAt('mid-by-distance', 140, 0),
    playerAt('near-budget-1', 20, 0),
    playerAt('near-budget-2', 30, 0),
    playerAt('near-budget-3', 40, 0),
    playerAt('near-budget-4', 50, 0),
    playerAt('near-budget-5', 60, 0),
    playerAt('near-budget-6', 70, 0),
    playerAt('mid-by-budget', 80, 0)
  ]

  const entries = classifyRemotePlayersForLod(players, { x: 0, z: 0 }, getRacingQualityPreset('medium'))

  assert.deepEqual(entries.map(entry => entry.player.id), [
    'same-distance-a',
    'same-distance-b',
    'near-budget-1',
    'near-budget-2',
    'near-budget-3',
    'near-budget-4',
    'near-budget-5',
    'near-budget-6',
    'mid-by-budget',
    'mid-by-distance'
  ])
  assert.deepEqual(entries.map(entry => entry.tier), [
    'near',
    'near',
    'near',
    'near',
    'near',
    'near',
    'near',
    'near',
    'mid',
    'mid'
  ])
})

test('classifyRemotePlayersForLod uses preset-specific visible and near budgets', () => {
  const players = Array.from({ length: 40 }, (_, index) => playerAt(`p-${index + 1}`, 5 + index * 5))

  const lowEntries = classifyRemotePlayersForLod(players, { x: 0, z: 0 }, getRacingQualityPreset('low'))
  const mediumEntries = classifyRemotePlayersForLod(players, { x: 0, z: 0 }, getRacingQualityPreset('medium'))
  const highEntries = classifyRemotePlayersForLod(players, { x: 0, z: 0 }, getRacingQualityPreset('high'))

  assert.equal(lowEntries.length, 8)
  assert.equal(mediumEntries.length, 16)
  assert.equal(highEntries.length, 32)
  assert.equal(lowEntries.filter(entry => entry.tier === 'near').length, 4)
  assert.equal(mediumEntries.filter(entry => entry.tier === 'near').length, 8)
  assert.equal(highEntries.filter(entry => entry.tier === 'near').length, 12)
})

test('classifyRemotePlayersForLod falls back to input order before local position is known', () => {
  const players = [playerAt('a', 0), playerAt('b', 0), playerAt('c', 0)]

  const entries = classifyRemotePlayersForLod(players, null, {
    ...getRacingQualityPreset('medium'),
    remotePlayers: {
      renderDistance: 100,
      maxVisible: 2
    }
  })

  assert.deepEqual(entries.map(entry => entry.player.id), ['a', 'b'])
  assert.deepEqual(entries.map(entry => entry.tier), ['near', 'near'])
})

test('classifyRemotePlayersForLod retains previous visible players inside retention distance', () => {
  const players = [
    playerAt('previous-at-edge', 108),
    playerAt('new-closer', 90),
    playerAt('new-close', 80)
  ]

  const entries = classifyRemotePlayersForLod(players, { x: 0, z: 0 }, {
    ...getRacingQualityPreset('medium'),
    remotePlayers: {
      renderDistance: 100,
      maxVisible: 2
    }
  }, {
    previousVisiblePlayerIds: ['previous-at-edge', 'new-close'],
    retentionDistanceScale: 1.15
  })

  assert.deepEqual(entries.map(entry => entry.player.id), ['new-close', 'previous-at-edge'])
})

test('classifyRemotePlayersForLod drops retained players beyond retention distance', () => {
  const players = [
    playerAt('previous-too-far', 120),
    playerAt('new-closer', 90),
    playerAt('new-close', 80)
  ]

  const entries = classifyRemotePlayersForLod(players, { x: 0, z: 0 }, {
    ...getRacingQualityPreset('medium'),
    remotePlayers: {
      renderDistance: 100,
      maxVisible: 2
    }
  }, {
    previousVisiblePlayerIds: ['previous-too-far', 'new-close'],
    retentionDistanceScale: 1.15
  })

  assert.deepEqual(entries.map(entry => entry.player.id), ['new-close', 'new-closer'])
})

test('classifyRemotePlayersForLod keeps previous near tier through the near-distance buffer', () => {
  const entries = classifyRemotePlayersForLod(
    [playerAt('previous-near', 130)],
    { x: 0, z: 0 },
    getRacingQualityPreset('medium'),
    {
      previousLodTiersById: new Map([['previous-near', 'near']])
    }
  )

  assert.equal(entries[0]?.tier, 'near')
})

test('classifyRemotePlayersForLod waits for previous mid tier to move clearly inside near distance', () => {
  const boundaryEntries = classifyRemotePlayersForLod(
    [playerAt('previous-mid', 115)],
    { x: 0, z: 0 },
    getRacingQualityPreset('medium'),
    {
      previousLodTiersById: new Map([['previous-mid', 'mid']])
    }
  )
  const insideEntries = classifyRemotePlayersForLod(
    [playerAt('previous-mid', 100)],
    { x: 0, z: 0 },
    getRacingQualityPreset('medium'),
    {
      previousLodTiersById: new Map([['previous-mid', 'mid']])
    }
  )

  assert.equal(boundaryEntries[0]?.tier, 'mid')
  assert.equal(insideEntries[0]?.tier, 'near')
})
