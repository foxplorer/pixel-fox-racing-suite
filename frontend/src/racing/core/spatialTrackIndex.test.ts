import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import {
  createSpatialTrackIndex,
  DEFAULT_SPATIAL_TRACK_INDEX_GRID_SIZE,
  DEFAULT_SPATIAL_TRACK_INDEX_SAMPLES,
  findClosestCurveT,
  findIndexedTrackPositionT,
  findNearestTrackSample,
  getSpatialHashKey,
  isWithinTrackDistance
} from './spatialTrackIndex'

const createCurve = () => new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(100, 0, 0),
  new THREE.Vector3(100, 0, 100),
  new THREE.Vector3(0, 0, 100),
  new THREE.Vector3(0, 0, 0)
], true, 'centripetal', 0.5)

test('createSpatialTrackIndex samples a curve by distance', () => {
  const index = createSpatialTrackIndex(createCurve(), { samples: 10, gridSize: 50 })

  assert.equal(index.samples.length, 11)
  assert.equal(index.gridSize, 50)
  assert.equal(index.samples[0].t, 0)
  assert.equal(index.samples[index.samples.length - 1].t, 1)
  assert.ok(index.samples[index.samples.length - 1].dist > index.samples[0].dist)
})

test('createSpatialTrackIndex exposes stable defaults', () => {
  const index = createSpatialTrackIndex(createCurve())

  assert.equal(index.gridSize, DEFAULT_SPATIAL_TRACK_INDEX_GRID_SIZE)
  assert.equal(index.samples.length, DEFAULT_SPATIAL_TRACK_INDEX_SAMPLES + 1)
})

test('createSpatialTrackIndex adds samples to neighboring grid cells', () => {
  const index = createSpatialTrackIndex(createCurve(), { samples: 10, gridSize: 50 })
  const firstSample = index.samples[0]
  const key = getSpatialHashKey(firstSample.pos.x, firstSample.pos.z, index.gridSize)

  assert.ok(index.hash.has(key))
  assert.ok(index.hash.get(key)?.includes(0))
  assert.ok(index.hash.has('-1,-1'))
})

test('createSpatialTrackIndex can project samples onto a terrain height provider', () => {
  const index = createSpatialTrackIndex(createCurve(), {
    samples: 10,
    getY: (x, z) => x * 0.1 + z * 0.01
  })

  const sample = index.samples.find(({ pos }) => Math.abs(pos.x) > 1 || Math.abs(pos.z) > 1)
  assert.ok(sample)
  assert.equal(sample.pos.y, sample.pos.x * 0.1 + sample.pos.z * 0.01)
})

test('findNearestTrackSample returns closest indexed sample in the current grid cell', () => {
  const index = createSpatialTrackIndex(createCurve(), { samples: 20, gridSize: 50 })
  const { sample, distanceSq } = findNearestTrackSample(index, 100, 10)

  assert.ok(sample)
  assert.ok(distanceSq < 400)
  assert.equal(isWithinTrackDistance(index, 100, 10, 20), true)
  assert.equal(isWithinTrackDistance(index, 500, 500, 20), false)
})

test('findIndexedTrackPositionT returns indexed sample t before fallback search', () => {
  const curve = createCurve()
  const index = createSpatialTrackIndex(curve, { samples: 20, gridSize: 50 })
  const { sample } = findNearestTrackSample(index, 100, 10)

  assert.ok(sample)
  assert.equal(findIndexedTrackPositionT(index, curve, 100, 10), sample.t)
})

test('findIndexedTrackPositionT falls back to coarse-only curve search', () => {
  const curve = createCurve()
  const index = {
    gridSize: 50,
    samples: [],
    hash: new Map<string, number[]>()
  }
  const result = findIndexedTrackPositionT(index, curve, 90, 10)

  assert.equal(Number.isFinite(result), true)
  assert.ok(result >= 0)
  assert.ok(result <= 1)
})

test('findClosestCurveT finds a nearby curve parameter using coarse and refined search', () => {
  const result = findClosestCurveT(createCurve(), 100, 50, {
    coarseSamples: 40,
    refineSamples: 10
  })

  assert.ok(result.t > 0)
  assert.ok(result.t < 1)
  assert.ok(result.distanceSq < 200)
})

test('findClosestCurveT supports coarse-only lookup with zero refine samples', () => {
  const result = findClosestCurveT(createCurve(), 90, 10, {
    coarseSamples: 20,
    refineSamples: 0
  })

  assert.equal(Number.isFinite(result.t), true)
  assert.equal(Number.isFinite(result.distanceSq), true)
  assert.ok(result.t >= 0)
  assert.ok(result.t <= 1)
})
