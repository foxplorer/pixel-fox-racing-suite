import assert from 'node:assert/strict'
import test from 'node:test'
import { getTrackMetadata, TRACK_IDS, TRACK_METADATA } from './trackMetadata'

test('track metadata covers the current four track identities', () => {
  assert.deepEqual([...TRACK_IDS].sort(), ['aspen', 'australia', 'belgium', 'san-luis'])
})

test('track metadata preserves the important current differences', () => {
  assert.equal(getTrackMetadata('san-luis').road.profileKey, 'san-luis')
  assert.equal(getTrackMetadata('san-luis').layoutSource, 'custom')
  assert.equal(getTrackMetadata('australia').layoutSource, 'custom')
  assert.equal(getTrackMetadata('belgium').layoutSource, 'custom')
  assert.equal(getTrackMetadata('aspen').layoutSource, 'custom')
  assert.equal(getTrackMetadata('australia').terrain.elevationMode, 'hilly')
  assert.equal(getTrackMetadata('belgium').terrain.elevationMode, 'hilly')
  assert.equal(getTrackMetadata('australia').handlingModels.includes('shared-car'), true)
  assert.equal(getTrackMetadata('aspen').supportedVehicleModes.includes('snowmobile'), true)
  assert.equal(getTrackMetadata('aspen').supportedVehicleModes.includes('car'), false)
  assert.deepEqual(getTrackMetadata('aspen').handlingModels, ['snowmobile'])
  assert.equal(getTrackMetadata('aspen').terrain.elevationMode, 'hilly')
})

test('track metadata ids match their record keys', () => {
  for (const trackId of TRACK_IDS) {
    assert.equal(TRACK_METADATA[trackId].id, trackId)
  }
})

test('track metadata makes start direction and gate behavior explicit', () => {
  assert.equal(getTrackMetadata('australia').start.method, 'derived-longest-straight')
  assert.equal(getTrackMetadata('belgium').start.curveT, 0.9845)
  assert.equal(getTrackMetadata('aspen').start.direction, 'negated-tangent')
  assert.equal(getTrackMetadata('san-luis').start.direction, 'explicit')
  assert.deepEqual(getTrackMetadata('san-luis').start.position, [0, 0.1, 0])
  assert.deepEqual(getTrackMetadata('san-luis').start.directionVector, [0, 0, 1])
  assert.equal(getTrackMetadata('san-luis').start.lapCrossingWidth, 12)
  assert.equal(getTrackMetadata('belgium').start.lapCrossingWidth, 18)
  assert.equal(getTrackMetadata('san-luis').lapValidation.requiresReachedEnd, true)
  assert.equal(getTrackMetadata('belgium').lapValidation.minLapDistanceRatio, 0.9)
  assert.equal(getTrackMetadata('belgium').lapValidation.sectorCount, 3)
  assert.equal(getTrackMetadata('belgium').lapValidation.checkpointStatus, 'planned')
})

test('track metadata separates current centerline boards from future edge geometry', () => {
  assert.equal(getTrackMetadata('belgium').scenery.adBoards, 'centerline-ad-boards')
  assert.equal(getTrackMetadata('belgium').road.edgeGeometryStatus, 'planned')
  assert.equal(getTrackMetadata('aspen').terrain.roadCorridorRequired, true)
})

test('track metadata separates visual barriers from invisible wall collision', () => {
  assert.equal(getTrackMetadata('aspen').wallCollision.mode, 'invisible-high-walls')
  assert.equal(getTrackMetadata('aspen').wallCollision.centerlineOffsetExtra, 4)
  assert.equal(getTrackMetadata('aspen').wallCollision.collisionInset, 1)
  assert.match(getTrackMetadata('aspen').wallCollision.notes, /Snowmobile/)
})

test('track metadata keeps elevation source status explicit', () => {
  assert.equal(getTrackMetadata('belgium').terrain.currentElevationSource, 'authored')
  assert.equal(getTrackMetadata('belgium').terrain.plannedElevationSource, 'authored')
  assert.equal(getTrackMetadata('belgium').terrain.roadBlendDistance, 72)
  assert.equal(getTrackMetadata('australia').terrain.currentElevationSource, 'authored')
  assert.equal(getTrackMetadata('australia').terrain.plannedElevationSource, 'authored')
  assert.equal(getTrackMetadata('aspen').terrain.currentElevationSource, 'procedural')
  assert.equal(getTrackMetadata('aspen').terrain.plannedElevationSource, 'procedural')
  assert.deepEqual(getTrackMetadata('aspen').terrain.meshGrid, {
    segmentSize: 400,
    resolution: 80,
    renderDistance: 2000
  })
  assert.equal(getTrackMetadata('belgium').terrain.meshGrid, undefined)
})

test('track metadata carries performance budgets for platform work', () => {
  for (const trackId of TRACK_IDS) {
    const performance = TRACK_METADATA[trackId].performance
    assert.equal(performance.targetMobileFps >= 30, true)
    assert.equal(performance.targetDesktopFps >= 60, true)
  }
})

test('track metadata makes spatial index settings explicit', () => {
  for (const trackId of TRACK_IDS) {
    const spatialIndex = TRACK_METADATA[trackId].spatialIndex
    assert.equal(spatialIndex.gridSize, 50)
    assert.equal(spatialIndex.samples, 2200)
  }
})

test('track metadata makes imported GeoJSON world size explicit', () => {
  assert.equal(getTrackMetadata('australia').layout.worldSize, 2500)
  assert.equal(getTrackMetadata('belgium').layout.worldSize, 2500)
  assert.equal(getTrackMetadata('aspen').layout.worldSize, 2500)
  assert.equal(getTrackMetadata('san-luis').layout.worldSize, undefined)
})
