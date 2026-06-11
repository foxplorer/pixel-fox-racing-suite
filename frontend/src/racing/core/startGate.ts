import * as THREE from 'three'

export type StartGate = {
  position: THREE.Vector3
  direction: THREE.Vector3
  halfWidth: number
  halfLength: number
}

export type StartGateDimensions = {
  width: number
  depth: number
}

export type StartGateProjection = {
  alongTrack: number
  acrossTrack: number
  isInside: boolean
}

export type StartGateStateUpdate = StartGateProjection & {
  justEntered: boolean
  justLeft: boolean
}

type MutableBooleanRef = {
  current: boolean
}

export const createStartGate = (
  position: THREE.Vector3,
  direction: THREE.Vector3,
  dimensions: StartGateDimensions
): StartGate => ({
  position,
  direction,
  halfWidth: dimensions.width / 2,
  halfLength: dimensions.depth / 2
})

export const projectOntoStartGate = (
  point: THREE.Vector3,
  gate: StartGate
): StartGateProjection => {
  const direction = gate.direction.clone().normalize()
  const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize()
  const toPoint = point.clone().sub(gate.position)
  const alongTrack = toPoint.dot(direction)
  const acrossTrack = toPoint.dot(perpendicular)

  return {
    alongTrack,
    acrossTrack,
    isInside: Math.abs(alongTrack) <= gate.halfLength && Math.abs(acrossTrack) <= gate.halfWidth
  }
}

export const getStartGateTransition = (
  wasInside: boolean,
  isInside: boolean
): { justEntered: boolean; justLeft: boolean } => ({
  justEntered: isInside && !wasInside,
  justLeft: !isInside && wasInside
})

export const updateStartGateState = (
  point: THREE.Vector3,
  gate: StartGate,
  isInsideRef: MutableBooleanRef
): StartGateStateUpdate => {
  const projection = projectOntoStartGate(point, gate)
  const transition = getStartGateTransition(isInsideRef.current, projection.isInside)
  isInsideRef.current = projection.isInside

  return {
    ...projection,
    ...transition
  }
}
