import * as THREE from 'three'
import type { VehicleVisualTilt } from './vehicleElevation'

export interface VehicleVisualSurfaceFrameScratch {
  rightAxis: THREE.Vector3
  upAxis: THREE.Vector3
  backwardAxis: THREE.Vector3
  matrix: THREE.Matrix4
}

export const createVehicleVisualSurfaceFrameScratch = (): VehicleVisualSurfaceFrameScratch => ({
  rightAxis: new THREE.Vector3(),
  upAxis: new THREE.Vector3(),
  backwardAxis: new THREE.Vector3(),
  matrix: new THREE.Matrix4()
})

export const applyVehicleVisualSurfaceFrameRotation = ({
  group,
  tilt,
  pitchScale,
  rollScale,
  scratch
}: {
  group: THREE.Group
  tilt: VehicleVisualTilt
  pitchScale: number
  rollScale: number
  scratch: VehicleVisualSurfaceFrameScratch
}): void => {
  const pitchAngle = -tilt.pitch * pitchScale
  const rollAngle = tilt.roll * rollScale
  const forwardSlope = Math.tan(pitchAngle)
  const rightSlope = Math.tan(rollAngle)

  scratch.rightAxis.set(1, rightSlope, 0).normalize()
  scratch.upAxis.set(-rightSlope, 1, forwardSlope).normalize()
  scratch.backwardAxis.crossVectors(scratch.rightAxis, scratch.upAxis).normalize()
  scratch.rightAxis.crossVectors(scratch.upAxis, scratch.backwardAxis).normalize()
  scratch.matrix.makeBasis(scratch.rightAxis, scratch.upAxis, scratch.backwardAxis)
  group.quaternion.setFromRotationMatrix(scratch.matrix)
}
