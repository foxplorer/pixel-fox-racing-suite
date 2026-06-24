import assert from 'node:assert/strict'
import test from 'node:test'
import { createImportedCarTrackPreviewDefinition } from '../../trackPreviewDefinitions'
import volcanoesGeoJson from './volcanoes.source.json'
import {
  createLavaCrossings,
  createVolcanoLavaPitPools,
  createVolcanoLavaPitRoadExclusionIntervals,
  getLavaCrossingVisualHalfLength,
  LAVA_PIT_RAMP_LENGTH
} from './volcanoCavePlacement'
import { volcanoesTrackDefinition } from './volcanoesTrack'

test('volcanoes imported track builds from the browser-edited mountain layout', () => {
  assert.equal(volcanoesTrackDefinition.trackId, 'volcanoes')
  assert.equal(volcanoesTrackDefinition.metadata.displayName, 'Volcanoes')
  assert.equal(volcanoesTrackDefinition.metadata.location, 'Volcanic Highlands')
  assert.equal(volcanoesTrackDefinition.metadata.terrain.currentElevationSource, 'authored')
  assert.equal(volcanoesTrackDefinition.trackCurve.closed, true)
  assert.equal(volcanoesTrackDefinition.trackCurve.points.length, 97)
  assert.equal(volcanoesTrackDefinition.trackCurve.arcLengthDivisions, 14400)
  assert.equal(volcanoesTrackDefinition.spatialTrackIndex.samples.length, 7201)
  assert.equal(volcanoesTrackDefinition.trackLength > 0, true)
  assert.equal(volcanoesTrackDefinition.startingGateHalfWidth, 10)

  const heights = volcanoesTrackDefinition.trackCurve.points.map(point => point.y)
  assert.equal(Math.abs(Math.min(...heights)) < 0.000001, true)
  assert.equal(Math.max(...heights) > 50, true)
})

test('volcanoes imported track produces a showroom preview', () => {
  const preview = createImportedCarTrackPreviewDefinition(volcanoesTrackDefinition)
  assert.equal(preview.trackName, 'Volcanoes')
  assert.equal(preview.trackId, 'volcanoes')
  assert.equal(preview.curve, volcanoesTrackDefinition.trackCurve)
})

test('volcanoes source GeoJSON remains a closed elevated circuit', () => {
  const coordinates = volcanoesGeoJson.features[0].geometry.coordinates
  assert.equal(coordinates.length, 97)
  assert.deepEqual(coordinates[0], coordinates[coordinates.length - 1])
  assert.equal(coordinates.every(coordinate => coordinate.length === 3), true)
  assert.equal(volcanoesGeoJson.properties.preset, 'mountain')
  assert.equal(volcanoesGeoJson.properties.turnCharacter, 'balanced')
  assert.equal(volcanoesGeoJson.properties.elevation.mode, 'hill-climb')
})

test('volcanoes lava crossing visuals reach ramp midpoints', () => {
  const crossings = createLavaCrossings(volcanoesTrackDefinition.trackCurve)
  assert.equal(crossings.length, 5)
  for (const crossing of crossings) {
    const gapHalf = crossing.length / 2
    assert.equal(getLavaCrossingVisualHalfLength(crossing), gapHalf + LAVA_PIT_RAMP_LENGTH / 2)
  }
})

test('volcanoes road exclusions match lava crossing midpoint spans', () => {
  const crossings = createLavaCrossings(volcanoesTrackDefinition.trackCurve)
  const intervals = createVolcanoLavaPitRoadExclusionIntervals(volcanoesTrackDefinition.trackCurve)
  const curveLength = volcanoesTrackDefinition.trackCurve.getLength()
  assert.equal(intervals.length, crossings.length)

  crossings.forEach((crossing, index) => {
    const halfT = getLavaCrossingVisualHalfLength(crossing) / curveLength
    assert.equal(Math.abs(intervals[index].startT - (crossing.t - halfT)) < 0.000001, true)
    assert.equal(Math.abs(intervals[index].endT - (crossing.t + halfT)) < 0.000001, true)
  })
})

test('volcanoes lava pit pools follow the curve from mid up-ramp to mid down-ramp', () => {
  const curve = volcanoesTrackDefinition.trackCurve
  const crossings = createLavaCrossings(curve)
  const pools = createVolcanoLavaPitPools(curve)
  const curveLength = curve.getLength()
  assert.equal(pools.length, crossings.length)

  const wrap = (t: number) => {
    const wrapped = t % 1
    return wrapped < 0 ? wrapped + 1 : wrapped
  }

  crossings.forEach((crossing, index) => {
    const pool = pools[index]
    const halfT = getLavaCrossingVisualHalfLength(crossing) / curveLength
    const startPoint = curve.getPointAt(wrap(crossing.t - halfT))
    const endPoint = curve.getPointAt(wrap(crossing.t + halfT))

    // The centerline ends sit exactly on the ramp midpoints (the molten edge starts
    // and ends there, never on the open road before the ramp or short of it).
    const first = pool.centerline[0]
    const last = pool.centerline[pool.centerline.length - 1]
    assert.equal(Math.hypot(first.x - startPoint.x, first.z - startPoint.z) < 0.5, true)
    assert.equal(Math.hypot(last.x - endPoint.x, last.z - endPoint.z) < 0.5, true)

    // Edges run one entry per centerline sample (parallel rows for the ribbon).
    assert.equal(pool.leftEdge.length, pool.centerline.length)
    assert.equal(pool.rightEdge.length, pool.centerline.length)
    assert.equal(pool.halfWidth, crossing.width / 2)

    // The tapered caps collapse onto the centerline ends; the middle is full width.
    const capGap = Math.hypot(pool.leftEdge[0].x - first.x, pool.leftEdge[0].z - first.z)
    assert.equal(capGap < 0.000001, true)
    const midIndex = Math.floor(pool.centerline.length / 2)
    const midCenter = pool.centerline[midIndex]
    const midEdge = pool.leftEdge[midIndex]
    assert.equal(Math.hypot(midEdge.x - midCenter.x, midEdge.z - midCenter.z) > pool.halfWidth * 0.5, true)
  })
})
