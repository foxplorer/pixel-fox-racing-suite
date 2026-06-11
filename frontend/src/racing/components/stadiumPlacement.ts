import * as THREE from 'three'

export interface StadiumStandPlacement {
  leftPos: THREE.Vector3
  rightPos: THREE.Vector3
  leftRotation: number
  rightRotation: number
  basePosition: THREE.Vector3
}

export interface StadiumStandPlacementInput {
  basePosition: THREE.Vector3
  baseDirection: THREE.Vector3
  distanceFromTrack: number
  groundY: number
}

export const getStadiumStandPlacement = ({
  basePosition,
  baseDirection,
  distanceFromTrack,
  groundY
}: StadiumStandPlacementInput): StadiumStandPlacement => {
  const trackDir = baseDirection.clone().normalize()
  const perpDir = new THREE.Vector3(-trackDir.z, 0, trackDir.x).normalize()

  const leftPos = basePosition.clone().add(perpDir.clone().multiplyScalar(distanceFromTrack))
  leftPos.y = groundY

  const rightPos = basePosition.clone().add(perpDir.clone().multiplyScalar(-distanceFromTrack))
  rightPos.y = groundY

  return {
    leftPos,
    rightPos,
    leftRotation: Math.atan2(perpDir.x, perpDir.z),
    rightRotation: Math.atan2(-perpDir.x, -perpDir.z),
    basePosition
  }
}
