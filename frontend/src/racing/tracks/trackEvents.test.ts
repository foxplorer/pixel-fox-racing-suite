import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getTrackEventDisplayName,
  getTrackEventMetadata,
  getTrackEventsByVehicleMode,
  findTrackEventByDisplayName,
  isOfficialTrackDisplayName,
  OFFICIAL_TRACK_DISPLAY_NAMES,
  TRACK_EVENT_IDS,
  TRACK_EVENT_METADATA
} from './trackEvents'

test('track events cover current playable event modes', () => {
  assert.deepEqual([...TRACK_EVENT_IDS].sort(), [
    'aspen-snowmobile',
    'australia-car',
    'belgium-car',
    'san-luis-car'
  ])
})

test('track events treat Aspen as snowmobile-only', () => {
  const aspenSnowmobile = getTrackEventMetadata('aspen-snowmobile')

  assert.equal(aspenSnowmobile.trackId, 'aspen')
  assert.equal(aspenSnowmobile.handlingModel, 'snowmobile')
  assert.equal(aspenSnowmobile.wallCollisionMode, 'invisible-high-walls')
  assert.equal(TRACK_EVENT_IDS.includes('aspen-car' as never), false)
})

test('vehicle mode event lists keep car tracks separate from Aspen snowmobile', () => {
  assert.deepEqual(getTrackEventsByVehicleMode('car').map(getTrackEventDisplayName), [
    'Australia',
    'San Luis',
    'Belgium'
  ])
  assert.deepEqual(getTrackEventsByVehicleMode('snowmobile').map(getTrackEventDisplayName), [
    'Aspen'
  ])
})

test('official display names come from playable events', () => {
  assert.deepEqual([...OFFICIAL_TRACK_DISPLAY_NAMES].sort(), [
    'Aspen',
    'Australia',
    'Belgium',
    'San Luis'
  ])
  assert.equal(isOfficialTrackDisplayName('Aspen'), true)
  assert.equal(isOfficialTrackDisplayName('Watkins Glen'), false)
})

test('display-name event lookup can be scoped by vehicle mode', () => {
  assert.equal(findTrackEventByDisplayName('Belgium', 'car')?.id, 'belgium-car')
  assert.equal(findTrackEventByDisplayName('Aspen', 'car'), undefined)
  assert.equal(findTrackEventByDisplayName('Aspen', 'snowmobile')?.id, 'aspen-snowmobile')
})

test('track event ids match their record keys', () => {
  for (const eventId of TRACK_EVENT_IDS) {
    assert.equal(TRACK_EVENT_METADATA[eventId].id, eventId)
  }
})
