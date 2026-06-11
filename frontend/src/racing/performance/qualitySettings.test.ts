import assert from 'node:assert/strict'
import test from 'node:test'
import {
  filterRemotePlayersForQuality,
  getRacingCanvasQualitySettings,
  getRacingMinimapQualitySettings,
  getRacingQualityPreset,
  RACING_QUALITY_PRESETS,
  resolveRacingQualityPresetId
} from './qualitySettings'

test('getRacingQualityPreset resolves defaults and known presets', () => {
  assert.equal(getRacingQualityPreset().id, 'medium')
  assert.equal(getRacingQualityPreset('low').renderer.shadows, false)
  assert.equal(getRacingQualityPreset('high').remotePlayers.maxVisible, 32)
})

test('quality presets scale remote player budget upward', () => {
  assert.ok(RACING_QUALITY_PRESETS.low.remotePlayers.maxVisible < RACING_QUALITY_PRESETS.medium.remotePlayers.maxVisible)
  assert.ok(RACING_QUALITY_PRESETS.medium.remotePlayers.maxVisible < RACING_QUALITY_PRESETS.high.remotePlayers.maxVisible)
  assert.ok(RACING_QUALITY_PRESETS.low.remotePlayers.renderDistance < RACING_QUALITY_PRESETS.medium.remotePlayers.renderDistance)
  assert.ok(RACING_QUALITY_PRESETS.medium.remotePlayers.renderDistance < RACING_QUALITY_PRESETS.high.remotePlayers.renderDistance)
})

test('resolveRacingQualityPresetId accepts known ids and falls back to default', () => {
  assert.equal(resolveRacingQualityPresetId('low'), 'low')
  assert.equal(resolveRacingQualityPresetId('medium'), 'medium')
  assert.equal(resolveRacingQualityPresetId('high'), 'high')
  assert.equal(resolveRacingQualityPresetId('ultra'), 'medium')
  assert.equal(resolveRacingQualityPresetId(null), 'medium')
})

test('getRacingCanvasQualitySettings derives renderer budget from preset', () => {
  assert.deepEqual(getRacingCanvasQualitySettings(getRacingQualityPreset('low')), {
    dpr: [1, 1],
    shadows: false,
    antialias: false
  })
  assert.deepEqual(getRacingCanvasQualitySettings(getRacingQualityPreset('high')), {
    dpr: [1, 2],
    shadows: true,
    antialias: true
  })
})

test('getRacingMinimapQualitySettings derives update cadence from preset', () => {
  assert.deepEqual(getRacingMinimapQualitySettings(getRacingQualityPreset('low')), {
    updateEveryFrames: 4
  })
  assert.deepEqual(getRacingMinimapQualitySettings(getRacingQualityPreset('medium')), {
    updateEveryFrames: 2
  })
  assert.deepEqual(getRacingMinimapQualitySettings(getRacingQualityPreset('high')), {
    updateEveryFrames: 1
  })
})

test('filterRemotePlayersForQuality keeps nearest players within distance and max-visible budget', () => {
  const players = [
    { id: 'far', position: [500, 0, 0] as [number, number, number] },
    { id: 'near-2', position: [50, 0, 0] as [number, number, number] },
    { id: 'near-1', position: [10, 0, 0] as [number, number, number] },
    { id: 'near-3', position: [70, 0, 0] as [number, number, number] }
  ]

  const filtered = filterRemotePlayersForQuality(players, { x: 0, z: 0 }, {
    ...getRacingQualityPreset('medium'),
    remotePlayers: {
      renderDistance: 100,
      maxVisible: 2
    }
  })

  assert.deepEqual(filtered.map(player => player.id), ['near-1', 'near-2'])
})

test('filterRemotePlayersForQuality falls back to max-visible order before local position is known', () => {
  const players = [
    { id: 'a', position: [0, 0, 0] as [number, number, number] },
    { id: 'b', position: [0, 0, 0] as [number, number, number] },
    { id: 'c', position: [0, 0, 0] as [number, number, number] }
  ]

  const filtered = filterRemotePlayersForQuality(players, null, {
    ...getRacingQualityPreset('medium'),
    remotePlayers: {
      renderDistance: 100,
      maxVisible: 2
    }
  })

  assert.deepEqual(filtered.map(player => player.id), ['a', 'b'])
})
