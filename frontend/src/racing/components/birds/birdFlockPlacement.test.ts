import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { getRacingQualityPreset } from '../../performance/qualitySettings'
import { createBirdFlockPlacements } from './birdFlockPlacement'

const createCurve = () => new THREE.CatmullRomCurve3([
  new THREE.Vector3(-100, 0, -100),
  new THREE.Vector3(100, 0, -100),
  new THREE.Vector3(100, 0, 100),
  new THREE.Vector3(-100, 0, 100)
], true)

test('bird flock count scales with the racing quality preset', () => {
  const curve = createCurve()
  const low = createBirdFlockPlacements(curve, getRacingQualityPreset('low'))
  const medium = createBirdFlockPlacements(curve, getRacingQualityPreset('medium'))
  const high = createBirdFlockPlacements(curve, getRacingQualityPreset('high'))

  assert.equal(low.length < medium.length, true)
  assert.equal(medium.length < high.length, true)
  assert.equal(low.length, 26)
  assert.equal(medium.length, 38)
  assert.equal(high.length, 48)
})

test('bird placements are deterministic for a given preset', () => {
  const curve = createCurve()
  const first = createBirdFlockPlacements(curve, getRacingQualityPreset('medium'))
  const second = createBirdFlockPlacements(curve, getRacingQualityPreset('medium'))

  assert.deepEqual(first, second)
})

test('birds carry finite flight parameters and fly above the ground', () => {
  const ground = 12
  const birds = createBirdFlockPlacements(
    createCurve(),
    getRacingQualityPreset('high'),
    () => ground
  )

  assert.equal(birds.length > 0, true)
  assert.equal(
    birds.every(bird =>
      Number.isFinite(bird.centerX) &&
      Number.isFinite(bird.centerZ) &&
      bird.radius > 0 &&
      bird.scale > 0 &&
      bird.flapSpeed > 0 &&
      bird.angularSpeed !== 0 &&
      bird.centerY > ground
    ),
    true
  )
})

test('birds share flock centres so they orbit together in groups', () => {
  const birds = createBirdFlockPlacements(createCurve(), getRacingQualityPreset('high'))
  const distinctCenters = new Set(birds.map(bird => `${bird.centerX.toFixed(2)},${bird.centerZ.toFixed(2)}`))

  // Far fewer unique centres than birds → birds are grouped into flocks, not scattered.
  assert.equal(distinctCenters.size < birds.length, true)
})
