import assert from 'node:assert/strict'
import test from 'node:test'
import { createImportedCarTrackPreviewDefinition } from '../../trackPreviewDefinitions'
import unitedKingdomGeoJson from './unitedKingdom.source.json'
import { unitedKingdomTrackDefinition } from './unitedKingdomTrack'

const assertNear = (actual: number, expected: number, epsilon = 0.000001) => {
  assert.equal(Math.abs(actual - expected) <= epsilon, true)
}

test('unitedKingdom imported track definition builds from the supplied GeoJSON', () => {
  assert.equal(unitedKingdomTrackDefinition.trackId, 'united-kingdom')
  assert.equal(unitedKingdomTrackDefinition.metadata.displayName, 'United Kingdom')
  assert.equal(unitedKingdomTrackDefinition.metadata.location, 'United Kingdom')
  assert.equal(unitedKingdomTrackDefinition.metadata.layout.curveSource, 'frontend/src/racing/tracks/imported/unitedKingdom/unitedKingdom.source.json')
  assert.equal(unitedKingdomTrackDefinition.metadata.terrain.currentElevationSource, 'authored')
  assert.equal(unitedKingdomTrackDefinition.metadata.terrain.plannedElevationSource, 'authored')
  assert.equal(unitedKingdomTrackDefinition.metadata.terrain.heightProvider, 'terrain-system')
  assert.equal(unitedKingdomTrackDefinition.metadata.terrain.roadBlendDistance, 72)
  assert.equal(unitedKingdomTrackDefinition.trackCurve.closed, true)
  assert.equal(unitedKingdomTrackDefinition.trackCurve.points.length, 145)
  assert.equal(unitedKingdomTrackDefinition.trackLength > 0, true)
  assert.deepEqual(
    unitedKingdomTrackDefinition.startFinishPosition.toArray(),
    [-73.91431932683095, -0.0016999999999999932, -825.8470831976576]
  )
  const startDirection = unitedKingdomTrackDefinition.startFinishDirection.toArray()
  assertNear(startDirection[0], -0.9997865363477763)
  assertNear(startDirection[1], 0)
  assertNear(startDirection[2], -0.02066111656510051)
  assert.equal(Math.abs(unitedKingdomTrackDefinition.startFinishDirection.length() - 1) < 0.000001, true)
  assert.equal(unitedKingdomTrackDefinition.startingGateHalfWidth, 10)
  assert.equal(unitedKingdomTrackDefinition.metadata.lapValidation.requiresReachedEnd, false)

  const pointHeights = unitedKingdomTrackDefinition.trackCurve.points.map(point => point.y)
  assertNear(Math.min(...pointHeights), -19.011599999999998)
  assertNear(Math.max(...pointHeights), 19.011599999999998)
  assertNear(
    unitedKingdomTrackDefinition.terrainHeightSampler?.(
      unitedKingdomTrackDefinition.startFinishPosition.x,
      unitedKingdomTrackDefinition.startFinishPosition.z
    ) ?? 0,
    unitedKingdomTrackDefinition.startFinishPosition.y
  )
})

test('unitedKingdom imported track can produce a showroom preview definition', () => {
  const preview = createImportedCarTrackPreviewDefinition(unitedKingdomTrackDefinition)

  assert.equal(preview.trackName, 'United Kingdom')
  assert.equal(preview.vehicleMode, 'car')
  assert.equal(preview.curve, unitedKingdomTrackDefinition.trackCurve)
  assert.equal(preview.trackId, 'united-kingdom')
})

test('unitedKingdom source GeoJSON carries authored route-editor heights', () => {
  const coordinates = unitedKingdomGeoJson.features[0].geometry.coordinates
  const elevations = coordinates.map(coordinate => coordinate[2])

  assert.equal(coordinates.length, 145)
  assert.equal(coordinates.every(coordinate => coordinate.length === 3), true)
  assert.equal(elevations.every(elevation => Number.isFinite(elevation)), true)
  assert.equal(Math.min(...elevations), -42.248)
  assert.equal(Math.max(...elevations), 42.248)
  assert.equal(elevations[0], elevations[elevations.length - 1])
  assert.equal(unitedKingdomGeoJson.properties.preset, 'mountain')
  assert.equal(unitedKingdomGeoJson.properties.turnCharacter, 'hairpins')
  assert.equal(unitedKingdomGeoJson.properties.allowDoubleBack, true)
  assert.equal(unitedKingdomGeoJson.properties.elevation.mode, 'rolling')
  assert.equal(unitedKingdomGeoJson.properties.elevation.scale, 72)
})
