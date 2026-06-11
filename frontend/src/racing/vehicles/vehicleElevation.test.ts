import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FLAT_CAR_MODEL_HEIGHT_OFFSET,
  FLAT_VEHICLE_RIDE_HEIGHT,
  DEFAULT_VEHICLE_VISUAL_TILT_LATERAL_SAMPLE_DISTANCE,
  getFlatVehicleHeight,
  getFlatVehicleHeightAtPosition,
  getFlatVehicleTargetHeight,
  getSafeVehicleSurfaceHeight,
  getSafeVehicleTargetHeight,
  getVehicleVisualTilt,
  resolveFlatCarNextPositionY,
  resolveVehicleSurfaceY,
  smoothVehicleVisualTilt
} from './vehicleElevation'

test('flat vehicle height preserves the current flat-track ride clearance', () => {
  assert.equal(FLAT_VEHICLE_RIDE_HEIGHT, 0.01)
  assert.equal(FLAT_CAR_MODEL_HEIGHT_OFFSET, 0.05)
  assert.equal(getFlatVehicleHeight(), 0.01)
  assert.equal(getFlatVehicleHeightAtPosition(100, -50, 12, 0.5), 0.01)
})

test('flat vehicle target height adds vehicle-specific model offset', () => {
  assert.equal(getFlatVehicleTargetHeight(0), 0.01)
  assert.equal(getFlatVehicleTargetHeight(0.5), 0.51)
})

test('safe vehicle surface height accepts finite sampled heights inside bounds', () => {
  assert.equal(getSafeVehicleSurfaceHeight({
    sampledSurfaceHeight: 2,
    currentVehicleY: 10,
    vehicleHeightOffset: 0.5
  }), 2)
})

test('safe vehicle surface height falls back to current vehicle height minus offset', () => {
  assert.equal(getSafeVehicleSurfaceHeight({
    sampledSurfaceHeight: 0.01,
    currentVehicleY: 4,
    vehicleHeightOffset: 0.5
  }), 3.5)
})

test('safe vehicle surface height preserves the existing minimum fallback', () => {
  assert.equal(getSafeVehicleSurfaceHeight({
    sampledSurfaceHeight: Number.NaN,
    currentVehicleY: 0.05,
    vehicleHeightOffset: 0.5
  }), 0.1)
})

test('safe vehicle target height adds the model offset after surface fallback', () => {
  assert.equal(getSafeVehicleTargetHeight({
    sampledSurfaceHeight: 0.01,
    currentVehicleY: 4,
    vehicleHeightOffset: 0.5
  }), 4)
})

test('resolve vehicle surface y snaps down large floating offsets', () => {
  assert.equal(resolveVehicleSurfaceY({
    currentY: 2,
    targetY: 0.5,
    deltaSeconds: 0.016
  }), 0.5)
})

test('resolve vehicle surface y smooths smaller floating offsets', () => {
  const resolved = resolveVehicleSurfaceY({
    currentY: 1,
    targetY: 0.5,
    deltaSeconds: 0.016
  })

  assert.equal(resolved > 0.5, true)
  assert.equal(resolved < 1, true)
})

test('resolve vehicle surface y optionally snaps up when below target', () => {
  assert.equal(resolveVehicleSurfaceY({
    currentY: 0,
    targetY: 0.5,
    deltaSeconds: 0.016,
    snapUpToTarget: true
  }), 0.5)
  assert.equal(resolveVehicleSurfaceY({
    currentY: 0,
    targetY: 0.5,
    deltaSeconds: 0.016
  }), 0)
})

test('resolve flat car next position y snaps upward to the shared flat car target', () => {
  assert.equal(resolveFlatCarNextPositionY({
    currentY: 0,
    currentVehicleY: 0.06,
    deltaSeconds: 0.016
  }), 0.15000000000000002)
})

test('resolve flat car next position y keeps nearby higher positions unchanged', () => {
  assert.equal(resolveFlatCarNextPositionY({
    currentY: 0.2,
    currentVehicleY: 0.06,
    deltaSeconds: 0.016
  }), 0.2)
})

test('vehicle visual tilt is flat when sampled heights match', () => {
  const tilt = getVehicleVisualTilt({
    x: 10,
    z: -5,
    forward: { x: 0, z: -1 },
    right: { x: 1, z: 0 },
    getHeightAtPosition: () => 4
  })

  assert.equal(tilt.pitch, 0)
  assert.equal(tilt.roll, 0)
})

test('vehicle visual tilt pitches the rendered car nose up on an uphill', () => {
  const tilt = getVehicleVisualTilt({
    x: 0,
    z: 0,
    forward: { x: 0, z: -1 },
    right: { x: 1, z: 0 },
    longitudinalSampleDistance: 5,
    getHeightAtPosition: (_x, z) => -z
  })

  assert.equal(tilt.pitch < 0, true)
  assert.equal(Math.abs(tilt.roll) < 0.00001, true)
})

test('vehicle visual tilt rolls toward the higher right side', () => {
  assert.equal(DEFAULT_VEHICLE_VISUAL_TILT_LATERAL_SAMPLE_DISTANCE, 4)

  const tilt = getVehicleVisualTilt({
    x: 0,
    z: 0,
    forward: { x: 0, z: -1 },
    right: { x: 1, z: 0 },
    lateralSampleDistance: 2,
    getHeightAtPosition: x => x
  })

  assert.equal(Math.abs(tilt.pitch) < 0.00001, true)
  assert.equal(tilt.roll > 0, true)
})

test('vehicle visual tilt clamps extreme terrain changes', () => {
  const tilt = getVehicleVisualTilt({
    x: 0,
    z: 0,
    forward: { x: 0, z: -1 },
    right: { x: 1, z: 0 },
    longitudinalSampleDistance: 1,
    lateralSampleDistance: 1,
    maxPitchRadians: 0.1,
    maxRollRadians: 0.2,
    getHeightAtPosition: (x, z) => (x * 100) + (-z * 100)
  })

  assert.equal(tilt.pitch, -0.1)
  assert.equal(tilt.roll, 0.2)
})

test('vehicle visual tilt ignores invalid sample directions', () => {
  const tilt = getVehicleVisualTilt({
    x: 0,
    z: 0,
    forward: { x: 0, z: 0 },
    right: { x: 1, z: 0 },
    getHeightAtPosition: () => 10
  })

  assert.deepEqual(tilt, { pitch: 0, roll: 0 })
})

test('smooth vehicle visual tilt moves toward the target without snapping', () => {
  const tilt = smoothVehicleVisualTilt({
    currentPitch: 0,
    currentRoll: 0,
    targetPitch: -0.2,
    targetRoll: 0.1,
    deltaSeconds: 0.016,
    smoothingRate: 10
  })

  assert.equal(tilt.pitch < 0, true)
  assert.equal(tilt.pitch > -0.2, true)
  assert.equal(tilt.roll > 0, true)
  assert.equal(tilt.roll < 0.1, true)
})
