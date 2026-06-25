import React, { useMemo } from 'react'
import * as THREE from 'three'
import type { TerrainHeightSampler } from '../../core/roadCorridor'
import type { RacingQualityPreset } from '../../performance/qualitySettings'
import { BillboardForest } from './BillboardForest'
import {
  createBillboardForestPlacements,
  type BillboardForestOptions
} from './billboardForestPlacement'
import {
  generateTreeBillboardAtlas,
  TEMPERATE_TREE_PALETTE,
  type TreeBillboardPalette,
  type TreeSpecies
} from './treeBillboardTexture'

interface TrackBillboardForestProps {
  trackCurve: THREE.CatmullRomCurve3
  qualityPreset: RacingQualityPreset
  getHeightAtPosition?: TerrainHeightSampler
  options?: BillboardForestOptions
  palette?: TreeBillboardPalette
  species?: TreeSpecies
}

export const TrackBillboardForest: React.FC<TrackBillboardForestProps> = ({
  trackCurve,
  qualityPreset,
  getHeightAtPosition,
  options,
  palette = TEMPERATE_TREE_PALETTE,
  species = 'broadleaf'
}) => {
  const atlas = useMemo(
    () => generateTreeBillboardAtlas(palette, { species, variants: 6, quality: qualityPreset.id }),
    [palette, species, qualityPreset.id]
  )
  const trees = useMemo(
    () => createBillboardForestPlacements(trackCurve, qualityPreset, options),
    [options, qualityPreset, trackCurve]
  )

  return <BillboardForest trees={trees} atlas={atlas} getHeightAtPosition={getHeightAtPosition} />
}
