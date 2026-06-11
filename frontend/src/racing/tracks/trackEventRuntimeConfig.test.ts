import assert from 'node:assert/strict'
import test from 'node:test'
import { getTrackEventRuntimeConfig } from './trackEventRuntimeConfig'

test('getTrackEventRuntimeConfig resolves event and base track config', () => {
  const belgium = getTrackEventRuntimeConfig('belgium-car')

  assert.equal(belgium.event.trackId, 'belgium')
  assert.equal(belgium.event.handlingModel, 'shared-car')
  assert.equal(belgium.track.metadata.id, 'belgium')
  assert.equal(belgium.track.surfaceProfile.trackWidth, 18)
})

test('getTrackEventRuntimeConfig keeps Aspen snowmobile-specific settings', () => {
  const aspenSnowmobile = getTrackEventRuntimeConfig('aspen-snowmobile')

  assert.equal(aspenSnowmobile.track.metadata.id, 'aspen')
  assert.equal(aspenSnowmobile.event.defaultCameraPreset, 'snowmobile-standard')
  assert.equal(aspenSnowmobile.event.wallCollisionMode, 'invisible-high-walls')
  assert.deepEqual(aspenSnowmobile.track.metadata.supportedVehicleModes, ['snowmobile'])
})
