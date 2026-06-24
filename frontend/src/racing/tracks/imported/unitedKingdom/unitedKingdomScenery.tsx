import React, { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { TreeInstances } from '../../../components/TreeInstances'
import type { RacingQualityPreset } from '../../../performance/qualitySettings'
import { BoardLogoDecal, CurvedBoard } from '../../../../components/foxracingbelgium/AdvertisingBoards'
import {
  createUnitedKingdomAdvertisingBoards,
  createUnitedKingdomAdvertisingLogoDecals,
  createUnitedKingdomTreePlacements,
  type UnitedKingdomAdvertisingBoard,
  type UnitedKingdomTreePlacement
} from './unitedKingdomSceneryData'
import type { TerrainHeightSampler } from '../../../core/roadCorridor'
import { TrackBillboardForest } from '../../../components/forest/TrackBillboardForest'
import type { BillboardForestOptions } from '../../../components/forest/billboardForestPlacement'

interface UnitedKingdomSceneryProps {
  trackCurve: THREE.CatmullRomCurve3
  qualityPreset: RacingQualityPreset
  getHeightAtPosition?: TerrainHeightSampler
  forestOptions?: BillboardForestOptions
  onTreesGenerated?: (trees: UnitedKingdomTreePlacement[]) => void
  onBoardsGenerated?: (boards: UnitedKingdomAdvertisingBoard[]) => void
}

export const UnitedKingdomScenery: React.FC<UnitedKingdomSceneryProps> = ({
  trackCurve,
  qualityPreset,
  getHeightAtPosition,
  forestOptions,
  onTreesGenerated,
  onBoardsGenerated
}) => {
  const trees = useMemo(() => {
    const placements = createUnitedKingdomTreePlacements(trackCurve, qualityPreset)
    if (!getHeightAtPosition) return placements

    return placements.map(tree => ({
      ...tree,
      y: getHeightAtPosition(tree.x, tree.z)
    }))
  }, [getHeightAtPosition, trackCurve, qualityPreset])
  const boards = useMemo(() => createUnitedKingdomAdvertisingBoards(trackCurve), [trackCurve])
  const logoDecals = useMemo(() => createUnitedKingdomAdvertisingLogoDecals(boards), [boards])

  useEffect(() => {
    onTreesGenerated?.(trees)
  }, [onTreesGenerated, trees])

  useEffect(() => {
    onBoardsGenerated?.(boards)
  }, [onBoardsGenerated, boards])

  return (
    <>
      <TrackBillboardForest
        trackCurve={trackCurve}
        qualityPreset={qualityPreset}
        getHeightAtPosition={getHeightAtPosition}
        options={forestOptions}
      />
      <TreeInstances
        trees={trees}
        palette={{
          trunk: '#4a3522',
          foliage1: '#244d34',
          foliage2: '#2f6b45',
          foliage3: '#4e8f59'
        }}
      />
      {boards.map((board, index) => (
        <CurvedBoard
          key={`unitedKingdom-board-${index}`}
          curve={board.curve}
          startT={board.startT}
          endT={board.endT}
          offset={board.offset}
          side={board.side}
          height={board.height}
          showTextureLogos
          getHeightAtPosition={getHeightAtPosition}
        />
      ))}
      {logoDecals.map((decal, index) => (
        <BoardLogoDecal
          key={`unitedKingdom-board-logo-${index}`}
          curve={decal.curve}
          t={decal.t}
          offset={decal.offset}
          side={decal.side}
          width={decal.width}
          height={decal.height}
          boardHeight={decal.boardHeight}
          face={decal.face}
          logo={decal.logo}
          getHeightAtPosition={getHeightAtPosition}
        />
      ))}
    </>
  )
}
