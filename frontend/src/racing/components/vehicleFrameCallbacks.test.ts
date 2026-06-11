import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyVehicleSpawnPositionOnce,
  commitVehiclePose,
  notifyManualCameraControlUsed,
  notifyVehiclePositionUpdate,
  resetVehiclePoseRefs
} from './vehicleFrameCallbacks'

test('notifyManualCameraControlUsed only fires for active controls in manual camera mode', () => {
  let calls = 0
  const onControlUsed = () => {
    calls++
  }

  notifyManualCameraControlUsed({
    isManualCamera: false,
    isControlActive: true,
    onControlUsed
  })
  notifyManualCameraControlUsed({
    isManualCamera: true,
    isControlActive: false,
    onControlUsed
  })
  notifyManualCameraControlUsed({
    isManualCamera: true,
    isControlActive: true,
    onControlUsed
  })

  assert.equal(calls, 1)
})

test('notifyVehiclePositionUpdate forwards position, rotation, and speed', () => {
  const position = { x: 1, y: 2, z: 3 }
  let received: unknown[] = []

  notifyVehiclePositionUpdate({
    position,
    rotation: 4,
    speed: 5,
    onPositionUpdate: (...args) => {
      received = args
    }
  })

  assert.deepEqual(received, [position, 4, 5])
})

test('commitVehiclePose copies position and writes rotation by default', () => {
  const position = { x: 1, y: 2, z: 3 }
  const vehicle = {
    copiedPosition: undefined as typeof position | undefined,
    position: {
      copy: (nextPosition: typeof position) => {
        vehicle.copiedPosition = nextPosition
      }
    },
    rotation: { y: 1 }
  }

  const result = commitVehiclePose({
    vehicle,
    position,
    rotation: 1
  })

  assert.equal(vehicle.copiedPosition, position)
  assert.equal(vehicle.rotation.y, 1)
  assert.equal(result.rotationUpdated, false)

  const changed = commitVehiclePose({
    vehicle,
    position,
    rotation: 2
  })

  assert.equal(vehicle.rotation.y, 2)
  assert.equal(changed.rotationUpdated, true)
})

test('commitVehiclePose can skip tiny rotation changes with an epsilon', () => {
  const vehicle = {
    position: {
      copy: () => {}
    },
    rotation: { y: 1 }
  }

  const skipped = commitVehiclePose({
    vehicle,
    position: { x: 0 },
    rotation: 1.0005,
    rotationEpsilon: 0.001
  })

  assert.equal(vehicle.rotation.y, 1)
  assert.equal(skipped.rotationUpdated, false)

  const updated = commitVehiclePose({
    vehicle,
    position: { x: 0 },
    rotation: 1.002,
    rotationEpsilon: 0.001
  })

  assert.equal(vehicle.rotation.y, 1.002)
  assert.equal(updated.rotationUpdated, true)
})

test('resetVehiclePoseRefs resets pose refs, speed, camera refs, and committed vehicle pose', () => {
  const position = {
    current: {
      x: 0,
      y: 0,
      z: 0,
      set(x: number, y: number, z: number) {
        this.x = x
        this.y = y
        this.z = z
      }
    }
  }
  const rotation = { current: 0 }
  const smoothedRotation = { current: 0 }
  const cameraRotation = { current: 0 }
  const lastCameraUpdateRotation = { current: 0 }
  const speed = { current: 12 }
  const vehicle = {
    copiedPosition: undefined as typeof position.current | undefined,
    position: {
      copy: (nextPosition: typeof position.current) => {
        vehicle.copiedPosition = nextPosition
      }
    },
    rotation: { y: 0 }
  }

  resetVehiclePoseRefs({
    position,
    x: 1,
    y: 2,
    z: 3,
    rotation,
    rotationRadians: 4,
    smoothedRotation,
    cameraRotation,
    lastCameraUpdateRotation,
    speed,
    vehicle
  })

  assert.deepEqual({ x: position.current.x, y: position.current.y, z: position.current.z }, { x: 1, y: 2, z: 3 })
  assert.equal(rotation.current, 4)
  assert.equal(smoothedRotation.current, 4)
  assert.equal(cameraRotation.current, 4)
  assert.equal(lastCameraUpdateRotation.current, 4)
  assert.equal(speed.current, 0)
  assert.equal(vehicle.copiedPosition, position.current)
  assert.equal(vehicle.rotation.y, 4)
})

test('applyVehicleSpawnPositionOnce applies spawn pose once and resets the flag when spawn clears', () => {
  const position = {
    current: {
      x: 0,
      y: 0,
      z: 0,
      set(x: number, y: number, z: number) {
        this.x = x
        this.y = y
        this.z = z
      }
    }
  }
  const rotation = { current: 0 }
  const smoothedRotation = { current: 0 }
  const cameraRotation = { current: 0 }
  const lastCameraUpdateRotation = { current: 0 }
  const hasAppliedSpawnPosition = { current: false }
  const spawnTangent = {
    current: {
      x: 0,
      z: 0,
      negate() {
        this.x *= -1
        this.z *= -1
      },
      normalize() {}
    }
  }
  const vehicle = {
    position: {
      copy: () => {}
    },
    rotation: { y: 0 }
  }
  const trackCurve = {
    getTangentAt: (_t: number, target: typeof spawnTangent.current) => {
      target.x = -1
      target.z = 0
    }
  }

  const first = applyVehicleSpawnPositionOnce({
    spawnPosition: { x: 10, z: 20 },
    hasAppliedSpawnPosition,
    trackCurve,
    position,
    rotation,
    smoothedRotation,
    cameraRotation,
    lastCameraUpdateRotation,
    vehicle,
    getHeightAtPosition: () => 3,
    createPosition: (x, y, z) => ({ x, y, z }),
    findTrackPosition: () => 0.25,
    spawnTangent
  })

  assert.deepEqual(first, { applied: true, resetAppliedFlag: false })
  assert.deepEqual({ x: position.current.x, y: position.current.y, z: position.current.z }, { x: 10, y: 3, z: 20 })
  assert.equal(rotation.current, Math.PI / 2)
  assert.equal(smoothedRotation.current, Math.PI / 2)
  assert.equal(cameraRotation.current, Math.PI / 2)
  assert.equal(lastCameraUpdateRotation.current, Math.PI / 2)
  assert.equal(vehicle.rotation.y, Math.PI / 2)

  const second = applyVehicleSpawnPositionOnce({
    spawnPosition: { x: 11, z: 21 },
    hasAppliedSpawnPosition,
    trackCurve,
    position,
    rotation,
    vehicle,
    getHeightAtPosition: () => 4,
    createPosition: (x, y, z) => ({ x, y, z }),
    findTrackPosition: () => 0.25,
    spawnTangent
  })

  assert.deepEqual(second, { applied: false, resetAppliedFlag: false })
  assert.deepEqual({ x: position.current.x, y: position.current.y, z: position.current.z }, { x: 10, y: 3, z: 20 })

  const cleared = applyVehicleSpawnPositionOnce({
    spawnPosition: null,
    hasAppliedSpawnPosition,
    trackCurve,
    position,
    rotation,
    vehicle,
    getHeightAtPosition: () => 4,
    createPosition: (x, y, z) => ({ x, y, z }),
    findTrackPosition: () => 0.25,
    spawnTangent
  })

  assert.deepEqual(cleared, { applied: false, resetAppliedFlag: true })
  assert.equal(hasAppliedSpawnPosition.current, false)
})
