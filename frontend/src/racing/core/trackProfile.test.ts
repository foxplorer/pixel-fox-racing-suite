import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getCenterlineOffset,
  getTrackSurfaceProfile,
  getTotalTrackWidth,
  getTrackEdgeClearance,
  getTrackRadius,
  SAN_LUIS_TRACK_PROFILE,
  STANDARD_CAR_TRACK_PROFILE
} from './trackProfile'

test('track profile helpers preserve current standard and narrow widths', () => {
  assert.equal(getTotalTrackWidth(STANDARD_CAR_TRACK_PROFILE), 48)
  assert.equal(getTrackRadius(STANDARD_CAR_TRACK_PROFILE), 9)
  assert.equal(getTrackEdgeClearance(STANDARD_CAR_TRACK_PROFILE, 5), 14)
  assert.equal(getCenterlineOffset(STANDARD_CAR_TRACK_PROFILE, 4), 22)

  assert.equal(getTrackRadius(SAN_LUIS_TRACK_PROFILE), 6)
  assert.equal(getTrackEdgeClearance(SAN_LUIS_TRACK_PROFILE, 8), 14)
})

test('track profile keys resolve to runtime surface profiles', () => {
  assert.equal(getTrackSurfaceProfile('standard-car'), STANDARD_CAR_TRACK_PROFILE)
  assert.equal(getTrackSurfaceProfile('san-luis'), SAN_LUIS_TRACK_PROFILE)
  assert.equal(getTrackSurfaceProfile('snow').trackWidth, 18)
})
