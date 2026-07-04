import * as THREE from 'three'

export interface ScheduledRaceGridSlot {
  slot: number
  position: THREE.Vector3
  rotationY: number
}

export interface BuildScheduledRaceGridSlotsOptions {
  startPosition: THREE.Vector3
  startDirection: THREE.Vector3
  slotCount?: number
  laneOffset?: number
  rowSpacing?: number
  startOffset?: number
  yOffset?: number
  getHeightAtPosition?: (x: number, z: number) => number
}

export interface ScheduledRaceGridLayout {
  laneOffset: number
  rowSpacing: number
  startOffset: number
}

const DEFAULT_GRID_LAYOUT: ScheduledRaceGridLayout = {
  laneOffset: 4,
  rowSpacing: 7,
  startOffset: 6,
}

const TRACK_GRID_LAYOUTS: Record<string, Partial<ScheduledRaceGridLayout>> = {
  'San Luis': {
    laneOffset: 2.2,
    rowSpacing: 5.5,
  },
  Belgium: {
    laneOffset: 2.8,
    rowSpacing: 6,
  },
}

export const getScheduledRaceGridLayout = (trackName: string | null | undefined): ScheduledRaceGridLayout => ({
  ...DEFAULT_GRID_LAYOUT,
  ...(trackName ? TRACK_GRID_LAYOUTS[trackName] : null),
})

const normalizeHorizontalDirection = (direction: THREE.Vector3): THREE.Vector3 => {
  const horizontal = new THREE.Vector3(direction.x, 0, direction.z)
  if (horizontal.lengthSq() === 0) {
    throw new Error('startDirection must have a horizontal component')
  }
  return horizontal.normalize()
}

export const getScheduledRaceGridYaw = (startDirection: THREE.Vector3): number => {
  const forward = normalizeHorizontalDirection(startDirection)
  return Math.atan2(forward.x, forward.z)
}

export const buildScheduledRaceGridSlots = ({
  startPosition,
  startDirection,
  slotCount = 6,
  laneOffset = 4,
  rowSpacing = 7,
  startOffset = 0,
  yOffset = 0,
  getHeightAtPosition,
}: BuildScheduledRaceGridSlotsOptions): ScheduledRaceGridSlot[] => {
  const forward = normalizeHorizontalDirection(startDirection)
  const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize()
  const yaw = getScheduledRaceGridYaw(startDirection)
  const slots: ScheduledRaceGridSlot[] = []

  for (let index = 0; index < slotCount; index++) {
    const row = Math.floor(index / 2)
    const side = index % 2 === 0 ? -1 : 1
    const stagger = startOffset + rowSpacing * row
    const position = startPosition.clone()
      .add(forward.clone().multiplyScalar(stagger))
      .add(right.clone().multiplyScalar(side * laneOffset))
    position.y = (getHeightAtPosition?.(position.x, position.z) ?? position.y) + yOffset

    slots.push({
      slot: index + 1,
      position,
      rotationY: yaw,
    })
  }

  return slots
}
