import * as THREE from 'three'

export interface StartGatePole {
  x: number
  z: number
  radius: number
}

export interface StartGatePoleOptions {
  center: THREE.Vector3
  direction: THREE.Vector3
  halfWidth: number
  radius?: number
}

export const getStartGatePolePositions = ({
  center,
  direction,
  halfWidth,
  radius = 0.5
}: StartGatePoleOptions): [StartGatePole, StartGatePole] => {
  const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize()

  return [
    {
      x: center.x + perpendicular.x * halfWidth,
      z: center.z + perpendicular.z * halfWidth,
      radius
    },
    {
      x: center.x - perpendicular.x * halfWidth,
      z: center.z - perpendicular.z * halfWidth,
      radius
    }
  ]
}

export const getStartLineRotationZ = (direction: THREE.Vector3): number => {
  return Math.atan2(direction.x, direction.z)
}

export const getStartLightRotationY = (direction: THREE.Vector3): number => {
  const angle = Math.atan2(-direction.x, -direction.z)
  return angle === -Math.PI ? Math.PI : angle
}
