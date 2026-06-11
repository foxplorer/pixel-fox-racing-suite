import * as THREE from 'three'
import { SeededRandom, WORLD_SEED } from '../core/seededRandom'
import type { StadiumStandPlacement } from './stadiumPlacement'

export type StadiumSide = 'left' | 'right' | 'both'

export interface StadiumFoxSource<TVoxel> {
  voxels: TVoxel[]
}

export interface StadiumFoxPlacement<TVoxel> {
  position: [number, number, number]
  rotation: number
  scale: number
  voxels: TVoxel[]
  foxIndex: number
}

export interface StadiumFoxLayoutInput<TVoxel> {
  shuffledFoxes: Array<StadiumFoxSource<TVoxel>>
  stadiumData: StadiumStandPlacement
  rows: number
  seatsPerRow: number
  seatWidth: number
  rowDepth: number
  rowHeightStep: number
  side?: StadiumSide
  densityScale?: number
}

export const shuffleStadiumFoxes = <TFox>(foxes: TFox[]): TFox[] => {
  const rng = new SeededRandom(WORLD_SEED + 12345)
  const shuffled = [...foxes]

  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(rng.next() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled
}

export const getStadiumFoxPlacements = <TVoxel>({
  shuffledFoxes,
  stadiumData,
  rows,
  seatsPerRow,
  seatWidth,
  rowDepth,
  rowHeightStep,
  side = 'both',
  densityScale = 1
}: StadiumFoxLayoutInput<TVoxel>): Array<StadiumFoxPlacement<TVoxel>> => {
  if (shuffledFoxes.length === 0) return []

  const placements: Array<StadiumFoxPlacement<TVoxel>> = []
  const resolvedDensityScale = Number.isFinite(densityScale)
    ? Math.max(0, Math.min(1, densityScale))
    : 1
  const baseHeight = 0.5
  const seatYOffset = 0.5
  const footSpaceDepth = 1.8

  const addStandFoxes = (standPos: THREE.Vector3, standRotation: number, standIndex: number) => {
    const foxRng = new SeededRandom(WORLD_SEED + 77777 + standIndex * 1000)
    const standMatrix = new THREE.Matrix4()
    standMatrix.compose(
      standPos,
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), standRotation),
      new THREE.Vector3(1, 1, 1)
    )

    for (let row = 0; row < rows; row++) {
      const rowY = baseHeight + row * rowHeightStep + seatYOffset
      const rowZ = row * rowDepth

      for (let seat = 0; seat < seatsPerRow; seat++) {
        if (resolvedDensityScale < 1 && foxRng.next() > resolvedDensityScale) {
          continue
        }

        const foxIndex = Math.floor(foxRng.next() * shuffledFoxes.length)
        const seatX = (seat - seatsPerRow / 2 + 0.5) * seatWidth
        const seatY = rowY + 0.5
        const seatZ = rowZ + footSpaceDepth + 0.8
        const localPos = new THREE.Vector3(seatX, seatY + 1.8, seatZ)

        localPos.applyMatrix4(standMatrix)

        placements.push({
          position: [localPos.x, localPos.y, localPos.z],
          rotation: Math.PI + standRotation,
          scale: 1.2,
          voxels: shuffledFoxes[foxIndex].voxels,
          foxIndex
        })
      }
    }
  }

  if (side === 'left' || side === 'both') {
    addStandFoxes(stadiumData.leftPos, stadiumData.leftRotation, 0)
  }
  if (side === 'right' || side === 'both') {
    addStandFoxes(stadiumData.rightPos, stadiumData.rightRotation, 1)
  }

  return placements
}
