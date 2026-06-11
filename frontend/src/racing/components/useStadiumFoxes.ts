import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import {
  generateFoxTextureAtlas,
  preloadStadiumFoxes,
  type FoxVoxelData,
  type VoxelTuple
} from './BillboardStadiumFoxes'
import {
  getStadiumFoxPlacements,
  shuffleStadiumFoxes,
  type StadiumFoxPlacement,
  type StadiumSide
} from './stadiumFoxPlacement'
import type { StadiumStandPlacement } from './stadiumPlacement'

interface UseStadiumFoxesInput {
  stadiumData: StadiumStandPlacement
  rows: number
  seatsPerRow: number
  seatWidth: number
  rowDepth: number
  rowHeightStep: number
  side?: StadiumSide
  densityScale?: number
}

interface UseStadiumFoxesResult {
  foxPlacements: Array<StadiumFoxPlacement<VoxelTuple>>
  textureAtlas: THREE.CanvasTexture | null
  atlasSize: { cols: number; rows: number }
}

export function useStadiumFoxes({
  stadiumData,
  rows,
  seatsPerRow,
  seatWidth,
  rowDepth,
  rowHeightStep,
  side = 'both',
  densityScale = 1
}: UseStadiumFoxesInput): UseStadiumFoxesResult {
  const [voxelData, setVoxelData] = useState<FoxVoxelData[]>([])
  const [textureAtlas, setTextureAtlas] = useState<THREE.CanvasTexture | null>(null)
  const [atlasSize, setAtlasSize] = useState({ cols: 1, rows: 1 })

  useEffect(() => {
    let isMounted = true

    preloadStadiumFoxes().then(foxes => {
      if (isMounted) {
        setVoxelData(foxes)
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  const shuffledFoxes = useMemo(() => {
    return shuffleStadiumFoxes(voxelData)
  }, [voxelData])

  useEffect(() => {
    if (shuffledFoxes.length === 0) return

    const { texture, cols, rows: atlasRows } = generateFoxTextureAtlas(shuffledFoxes)
    setTextureAtlas(texture)
    setAtlasSize({ cols, rows: atlasRows })

    return () => {
      texture.dispose()
    }
  }, [shuffledFoxes])

  const foxPlacements = useMemo(() => {
    return getStadiumFoxPlacements({
      shuffledFoxes,
      stadiumData,
      rows,
      seatsPerRow,
      seatWidth,
      rowDepth,
      rowHeightStep,
      side,
      densityScale
    })
  }, [shuffledFoxes, stadiumData, rows, seatsPerRow, seatWidth, rowDepth, rowHeightStep, side, densityScale])

  return {
    foxPlacements,
    textureAtlas,
    atlasSize
  }
}
