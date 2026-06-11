import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import {
  DEFAULT_MINIMAP_TRACK_BOUNDS,
  getMinimapTrackBounds,
  hasMinimapPositionChanged,
  shouldDrawMinimapVehicleFrame,
  worldToMinimapCanvas
} from './minimapGeometry'

test('getMinimapTrackBounds returns the default bounds without a curve', () => {
  assert.deepEqual(getMinimapTrackBounds(null), DEFAULT_MINIMAP_TRACK_BOUNDS)
})

test('getMinimapTrackBounds samples track extents with padding', () => {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-50, 0, -20),
    new THREE.Vector3(0, 0, 40),
    new THREE.Vector3(80, 0, 10)
  ])

  const bounds = getMinimapTrackBounds(curve, 64, 10)

  assert.ok(bounds.minX <= -60)
  assert.ok(bounds.maxX >= 90)
  assert.ok(bounds.minZ <= -30)
  assert.ok(bounds.maxZ >= 50)
  assert.equal(bounds.centerX, (bounds.minX + bounds.maxX) / 2)
  assert.equal(bounds.centerZ, (bounds.minZ + bounds.maxZ) / 2)
  assert.equal(bounds.range, Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ))
})

test('worldToMinimapCanvas preserves existing flipped minimap projection', () => {
  const bounds = {
    minX: -100,
    maxX: 100,
    minZ: -100,
    maxZ: 100,
    centerX: 0,
    centerZ: 0,
    range: 200
  }

  assert.deepEqual(
    worldToMinimapCanvas(0, 0, { width: 200, height: 200, bounds }),
    { x: 100, y: 100 }
  )
  assert.deepEqual(
    worldToMinimapCanvas(100, 100, { width: 200, height: 200, bounds }),
    { x: 10, y: 10 }
  )
  assert.deepEqual(
    worldToMinimapCanvas(-100, -100, { width: 200, height: 200, bounds }),
    { x: 190, y: 190 }
  )
})

test('hasMinimapPositionChanged uses the existing greater-than threshold behavior', () => {
  const previous = { x: 0, y: 0, z: 0 }

  assert.equal(hasMinimapPositionChanged(null, previous), false)
  assert.equal(hasMinimapPositionChanged({ x: 0, y: 0, z: 0 }, null), true)
  assert.equal(hasMinimapPositionChanged({ x: 1, y: 0, z: 0 }, previous), false)
  assert.equal(hasMinimapPositionChanged({ x: 1.01, y: 0, z: 0 }, previous), true)
  assert.equal(hasMinimapPositionChanged({ x: 0, y: 0, z: -1.01 }, previous), true)
})

test('shouldDrawMinimapVehicleFrame draws first position and throttles later updates', () => {
  const first = shouldDrawMinimapVehicleFrame({
    vehiclePosition: { x: 0, y: 0, z: 0 },
    lastVehiclePosition: null,
    skippedFrameCount: 0,
    updateEveryFrames: 4
  })
  const skipped = shouldDrawMinimapVehicleFrame({
    vehiclePosition: { x: 2, y: 0, z: 0 },
    lastVehiclePosition: { x: 0, y: 0, z: 0 },
    skippedFrameCount: 0,
    updateEveryFrames: 4
  })
  const drawn = shouldDrawMinimapVehicleFrame({
    vehiclePosition: { x: 8, y: 0, z: 0 },
    lastVehiclePosition: { x: 0, y: 0, z: 0 },
    skippedFrameCount: 3,
    updateEveryFrames: 4
  })

  assert.deepEqual(first, { shouldDraw: true, nextSkippedFrameCount: 0 })
  assert.deepEqual(skipped, { shouldDraw: false, nextSkippedFrameCount: 1 })
  assert.deepEqual(drawn, { shouldDraw: true, nextSkippedFrameCount: 0 })
})

test('shouldDrawMinimapVehicleFrame skips unchanged positions and normalizes cadence', () => {
  assert.deepEqual(shouldDrawMinimapVehicleFrame({
    vehiclePosition: { x: 0, y: 0, z: 0 },
    lastVehiclePosition: { x: 0, y: 0, z: 0 },
    skippedFrameCount: 2,
    updateEveryFrames: 0
  }), {
    shouldDraw: false,
    nextSkippedFrameCount: 2
  })

  assert.deepEqual(shouldDrawMinimapVehicleFrame({
    vehiclePosition: { x: 2, y: 0, z: 0 },
    lastVehiclePosition: { x: 0, y: 0, z: 0 },
    skippedFrameCount: 0,
    updateEveryFrames: 0
  }), {
    shouldDraw: true,
    nextSkippedFrameCount: 0
  })
})
