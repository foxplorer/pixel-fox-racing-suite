import * as THREE from 'three'

export const DEFAULT_STADIUM_DETAIL_DISTANCE = 1000
export const DEFAULT_STADIUM_FOX_HOP_DISTANCE = 150

export const shouldRenderStadiumDetail = (
  cameraPosition: THREE.Vector3,
  stadiumPosition: THREE.Vector3,
  detailDistance: number = DEFAULT_STADIUM_DETAIL_DISTANCE
): boolean => {
  return cameraPosition.distanceToSquared(stadiumPosition) < detailDistance * detailDistance
}
