import assert from 'node:assert/strict'
import test from 'node:test'
import { getRacingQualityPreset } from './qualitySettings'
import {
  getQualityScaledCount,
  getRacingSceneryQualitySettings
} from './sceneryQuality'

test('getRacingSceneryQualitySettings maps quality presets to scenery budgets', () => {
  assert.deepEqual(getRacingSceneryQualitySettings(getRacingQualityPreset('low')), {
    densityScale: 0.55,
    detailDistanceScale: 0.65,
    rollingHillLayers: 2
  })
  assert.deepEqual(getRacingSceneryQualitySettings(getRacingQualityPreset('medium')), {
    densityScale: 0.8,
    detailDistanceScale: 0.85,
    rollingHillLayers: 3
  })
  assert.deepEqual(getRacingSceneryQualitySettings(getRacingQualityPreset('high')), {
    densityScale: 1,
    detailDistanceScale: 1,
    rollingHillLayers: 4
  })
})

test('getQualityScaledCount applies density scale with a minimum floor', () => {
  assert.equal(getQualityScaledCount(1400, getRacingQualityPreset('low'), 400), 770)
  assert.equal(getQualityScaledCount(1400, getRacingQualityPreset('medium'), 400), 1120)
  assert.equal(getQualityScaledCount(1400, getRacingQualityPreset('high'), 400), 1400)
  assert.equal(getQualityScaledCount(100, getRacingQualityPreset('low'), 80), 80)
})

test('getQualityScaledCount returns zero for invalid or empty base counts', () => {
  assert.equal(getQualityScaledCount(0, getRacingQualityPreset('high'), 10), 0)
  assert.equal(getQualityScaledCount(-20, getRacingQualityPreset('high'), 10), 0)
  assert.equal(getQualityScaledCount(Number.NaN, getRacingQualityPreset('high'), 10), 0)
})
