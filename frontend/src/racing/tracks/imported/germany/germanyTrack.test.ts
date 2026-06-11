import assert from 'node:assert/strict'
import test from 'node:test'
import { createImportedCarTrackPreviewDefinition } from '../../trackPreviewDefinitions'
import germanyRawElevatedGeoJson from './germany.raw-elevated.json'
import germanyGeoJson from './germany.source.json'
import { germanyTrackDefinition } from './germanyTrack'

const assertNear = (actual: number, expected: number, epsilon = 0.000001) => {
  assert.equal(Math.abs(actual - expected) <= epsilon, true)
}

test('germany imported track definition builds from the supplied GeoJSON', () => {
  assert.equal(germanyTrackDefinition.trackId, 'germany')
  assert.equal(germanyTrackDefinition.metadata.displayName, 'Germany')
  assert.equal(germanyTrackDefinition.metadata.location, 'Germany')
  assert.equal(germanyTrackDefinition.metadata.layout.curveSource, 'frontend/src/racing/tracks/imported/germany/germany.raw-elevated.json')
  assert.equal(germanyTrackDefinition.metadata.layoutSource, 'custom')
  assert.equal(germanyTrackDefinition.metadata.terrain.currentElevationSource, 'authored')
  assert.equal(germanyTrackDefinition.metadata.terrain.heightProvider, 'terrain-system')
  assert.equal(germanyTrackDefinition.metadata.terrain.plannedElevationSource, 'authored')
  assert.equal(germanyTrackDefinition.metadata.terrain.roadBlendDistance, 72)
  assert.equal(germanyTrackDefinition.trackCurve.closed, true)
  assert.equal(germanyTrackDefinition.trackCurve.points.length, 96)
  assert.equal(germanyTrackDefinition.trackSegments, 3600)
  assert.equal(germanyTrackDefinition.trackCurve.arcLengthDivisions, 14400)
  assert.equal(germanyTrackDefinition.spatialTrackIndex.samples.length, 7201)
  assert.equal(germanyTrackDefinition.trackLength > 0, true)
  assert.deepEqual(
    germanyTrackDefinition.startFinishPosition.toArray(),
    [517.49906803647, -0.0582, 663.3846005305669]
  )

  const startDirection = germanyTrackDefinition.startFinishDirection.toArray()
  assertNear(startDirection[0], 0.9994086641472743)
  assertNear(startDirection[1], 0)
  assertNear(startDirection[2], -0.034384909878615345)
  assert.equal(Math.abs(germanyTrackDefinition.startFinishDirection.length() - 1) < 0.000001, true)
  assert.equal(germanyTrackDefinition.startingGateHalfWidth, 10)

  const pointHeights = germanyTrackDefinition.trackCurve.points.map(point => point.y)
  assertNear(Math.min(...pointHeights), -29.530199999999997)
  assertNear(Math.max(...pointHeights), 29.530199999999997)
  assertNear(
    germanyTrackDefinition.terrainHeightSampler?.(
      germanyTrackDefinition.startFinishPosition.x,
      germanyTrackDefinition.startFinishPosition.z
    ) ?? 0,
    germanyTrackDefinition.startFinishPosition.y
  )
})

test('germany imported track can produce a showroom preview definition', () => {
  const preview = createImportedCarTrackPreviewDefinition(germanyTrackDefinition)

  assert.equal(preview.trackName, 'Germany')
  assert.equal(preview.vehicleMode, 'car')
  assert.equal(preview.curve, germanyTrackDefinition.trackCurve)
  assert.equal(preview.trackId, 'germany')
})

test('germany source GeoJSON is closed and has no consecutive duplicate coordinates', () => {
  const coordinates = germanyGeoJson.features[0].geometry.coordinates

  assert.equal(coordinates.length, 97)
  assert.deepEqual(coordinates[0], coordinates[coordinates.length - 1])
  assert.equal(coordinates.every(coordinate => coordinate.length === 3), true)
  assert.equal(coordinates.some((coordinate, index) => {
    if (index === 0) return false
    const previous = coordinates[index - 1]
    return coordinate[0] === previous[0] && coordinate[1] === previous[1]
  }), false)
})

test('germany raw elevated GeoJSON carries authored route-editor heights', () => {
  const coordinates = germanyRawElevatedGeoJson.features[0].geometry.coordinates
  const elevations = coordinates.map(coordinate => coordinate[2])

  assert.equal(coordinates.length, 97)
  assert.equal(coordinates.every(coordinate => coordinate.length === 3), true)
  assert.equal(elevations.every(elevation => Number.isFinite(elevation)), true)
  assertNear(Math.min(...elevations), -42.186)
  assertNear(Math.max(...elevations), 42.186)
  assert.equal(elevations[0], elevations[elevations.length - 1])
  assert.equal(germanyRawElevatedGeoJson.properties.elevation.mode, 'hill-climb')
  assert.equal(germanyRawElevatedGeoJson.properties.elevation.scale, 72)
  assert.equal(germanyRawElevatedGeoJson.properties.preset, 'mountain')
})
