import assert from 'node:assert/strict'
import test from 'node:test'
import { getOnTrackDistance } from '../core/trackProximity'
import { getTrackRuntimeConfig } from './trackRuntimeConfig'

test('track runtime config resolves road and proximity profiles from metadata', () => {
  const belgium = getTrackRuntimeConfig('belgium')
  const sanLuis = getTrackRuntimeConfig('san-luis')

  assert.equal(belgium.surfaceProfile.trackWidth, 18)
  assert.equal(belgium.worldSize, 2500)
  assert.deepEqual(belgium.roadCorridor, {
    roadWidth: 18,
    shoulderWidth: 30,
    blendDistance: 72,
    roadClearance: 0.1
  })
  assert.equal(getOnTrackDistance(belgium.proximity), 11)
  assert.equal(belgium.sectors.length, 3)
  assert.deepEqual(belgium.lapCrossing, { width: 18, depth: 4 })
  assert.equal(sanLuis.surfaceProfile.trackWidth, 12)
  assert.equal(getOnTrackDistance(sanLuis.proximity), 8)
  assert.deepEqual(sanLuis.lapCrossing, { width: 12, depth: 4 })
})

test('track runtime config keeps Aspen snow profile explicit', () => {
  const aspen = getTrackRuntimeConfig('aspen')

  assert.equal(aspen.metadata.terrain.elevationMode, 'hilly')
  assert.equal(aspen.surfaceProfile.trackWidth, 18)
  assert.equal(aspen.proximity.nearTrackDistance, 30)
  assert.deepEqual(aspen.terrainMeshGrid, {
    segmentSize: 400,
    resolution: 80,
    renderDistance: 2000
  })
})
