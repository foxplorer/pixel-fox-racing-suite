import React, { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { RacingQualityPreset } from '../../../performance/qualitySettings'
import { BoardLogoDecal, CurvedBoard } from '../../../../components/foxracingbelgium/AdvertisingBoards'
import {
  createUnitedKingdomAdvertisingBoards,
  createUnitedKingdomAdvertisingLogoDecals,
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
  const boards = useMemo(() => createUnitedKingdomAdvertisingBoards(trackCurve), [trackCurve])
  const logoDecals = useMemo(() => createUnitedKingdomAdvertisingLogoDecals(boards), [boards])

  // The billboard forest is the only tree layer here now; report no simple-tree
  // collision targets so nothing invisible remains where the instanced trees used to be.
  useEffect(() => {
    onTreesGenerated?.([])
  }, [onTreesGenerated])

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
