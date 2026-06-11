import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceTrackPositionFrame,
  ON_TRACK_CHECK_INTERVAL_FRAMES,
  shouldRefreshOnTrackState,
  TRACK_POSITION_COUNTER_RESET_FRAMES,
  TRACK_POSITION_UPDATE_INTERVAL_FRAMES
} from './trackFrameCadence'

test('advanceTrackPositionFrame preserves track-position update cadence', () => {
  assert.equal(TRACK_POSITION_COUNTER_RESET_FRAMES, 1000)
  assert.equal(TRACK_POSITION_UPDATE_INTERVAL_FRAMES, 20)

  assert.deepEqual(advanceTrackPositionFrame(18, true), {
    frame: 19,
    shouldUpdateTrackPosition: false
  })

  assert.deepEqual(advanceTrackPositionFrame(19, true), {
    frame: 20,
    shouldUpdateTrackPosition: true
  })

  assert.deepEqual(advanceTrackPositionFrame(7, false), {
    frame: 8,
    shouldUpdateTrackPosition: true
  })

  assert.deepEqual(advanceTrackPositionFrame(999, true), {
    frame: 0,
    shouldUpdateTrackPosition: true
  })
})

test('shouldRefreshOnTrackState preserves five-frame cached on-track cadence', () => {
  assert.equal(ON_TRACK_CHECK_INTERVAL_FRAMES, 5)
  assert.equal(shouldRefreshOnTrackState(10), true)
  assert.equal(shouldRefreshOnTrackState(11), false)
  assert.equal(shouldRefreshOnTrackState(Number.NaN), false)
})
