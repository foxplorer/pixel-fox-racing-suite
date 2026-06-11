import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CAR_TRACK_DEFINITIONS,
  getCarTrackDefinition,
  australiaCarTrackDefinition,
  sanLuisCarTrackDefinition,
  belgiumCarTrackDefinition
} from './carTrackDefinitions'

test('car track definitions cover the current playable car tracks', () => {
  assert.deepEqual(
    CAR_TRACK_DEFINITIONS.map(definition => definition.trackId).sort(),
    ['australia', 'belgium', 'san-luis']
  )
})

test('car track definitions attach matching car metadata', () => {
  for (const definition of CAR_TRACK_DEFINITIONS) {
    assert.equal(definition.metadata.id, definition.trackId)
    assert.deepEqual(definition.metadata.supportedVehicleModes, ['car'])
    assert.deepEqual(definition.metadata.handlingModels, ['shared-car'])
    assert.equal(definition.trackLength > 0, true)
    assert.equal(definition.trackCurve.getLength() > 0, true)
    assert.equal(definition.startFinishPosition.isVector3, true)
    assert.equal(definition.startFinishDirection.isVector3, true)
  }
})

test('car track definitions preserve source and scenery differences', () => {
  assert.equal(australiaCarTrackDefinition.metadata.layout.kind, 'geojson-circuit')
  assert.equal(belgiumCarTrackDefinition.metadata.layout.kind, 'geojson-circuit')
  assert.equal(sanLuisCarTrackDefinition.metadata.layout.kind, 'hand-authored-spline')

  assert.equal(australiaCarTrackDefinition.metadata.scenery.adBoards, 'centerline-ad-boards')
  assert.equal(belgiumCarTrackDefinition.metadata.scenery.adBoards, 'centerline-ad-boards')
  assert.equal(sanLuisCarTrackDefinition.metadata.scenery.adBoards, 'none')
})

test('car track definitions preserve San Luis presentation exceptions', () => {
  assert.equal(sanLuisCarTrackDefinition.startingGateHalfWidth, 7)
  assert.equal(sanLuisCarTrackDefinition.startGateLayout?.alignArchTopToTrack, false)
  assert.equal(sanLuisCarTrackDefinition.manualCamera?.followLerp, 0.1)
  assert.equal(sanLuisCarTrackDefinition.manualCamera?.updateControlsOnFollow, false)
})

test('car track definitions can be looked up by id', () => {
  assert.equal(getCarTrackDefinition('australia'), australiaCarTrackDefinition)
  assert.equal(getCarTrackDefinition('belgium'), belgiumCarTrackDefinition)
  assert.equal(getCarTrackDefinition('san-luis'), sanLuisCarTrackDefinition)
})
