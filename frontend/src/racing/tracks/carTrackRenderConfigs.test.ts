import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CAR_TRACK_RENDER_CONFIGS,
  australiaCarTrackRenderConfig,
  sanLuisCarTrackRenderConfig,
  belgiumCarTrackRenderConfig
} from './carTrackRenderConfigs'

test('car track render configs cover the current car tracks', () => {
  assert.deepEqual(
    CAR_TRACK_RENDER_CONFIGS.map(config => config.trackId).sort(),
    ['australia', 'belgium', 'san-luis']
  )
})

test('car track render configs expose usable runtime geometry', () => {
  for (const config of CAR_TRACK_RENDER_CONFIGS) {
    assert.equal(config.trackId.length > 0, true)
    assert.equal(config.trackLength > 0, true)
    assert.equal(config.startingGateHalfWidth > 0, true)
    assert.equal(config.trackCurve.getLength() > 0, true)
    assert.equal(config.startFinishPosition.isVector3, true)
    assert.equal(config.startFinishDirection.isVector3, true)
    assert.equal(config.startFinishDirection.length() > 0, true)
    assert.equal(config.trackSegments > 0, true)
    assert.ok(config.trackFrames)
  }
})

test('car track render configs preserve gate presentation differences', () => {
  assert.equal(australiaCarTrackRenderConfig.startGateLayout, undefined)
  assert.equal(belgiumCarTrackRenderConfig.startGateLayout, undefined)

  assert.equal(sanLuisCarTrackRenderConfig.startingGateHalfWidth, 7)
  assert.equal(sanLuisCarTrackRenderConfig.startGateLayout?.stripColumns, 12)
  assert.equal(sanLuisCarTrackRenderConfig.startGateLayout?.archTopWidth, 16)
  assert.deepEqual(sanLuisCarTrackRenderConfig.startGateLayout?.archTopPosition, [0, 8, 0])
  assert.equal(sanLuisCarTrackRenderConfig.startGateLayout?.alignArchTopToTrack, false)
})

test('car track render configs preserve manual camera tuning differences', () => {
  assert.equal(australiaCarTrackRenderConfig.manualCamera?.followLerp, 0.2)
  assert.equal(belgiumCarTrackRenderConfig.manualCamera?.followLerp, 0.2)
  assert.equal(sanLuisCarTrackRenderConfig.manualCamera?.followLerp, 0.1)
  assert.equal(sanLuisCarTrackRenderConfig.manualCamera?.updateControlsOnFollow, false)
})
