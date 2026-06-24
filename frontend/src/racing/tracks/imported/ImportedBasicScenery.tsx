import React, { useEffect, useMemo } from 'react'
import type { CarTrackDefinition } from '../carTrackDefinitions'
import { TreeInstances, type TreePalette } from '../../components/TreeInstances'
import { CurvedBoard } from '../../../components/foxracingbelgium/AdvertisingBoards'
import type { TerrainHeightSampler } from '../../core/roadCorridor'
import type { RacingQualityPreset } from '../../performance/qualitySettings'
import { TrackBillboardForest } from '../../components/forest/TrackBillboardForest'
import type { BillboardForestOptions } from '../../components/forest/billboardForestPlacement'
import type {
  TreeBillboardPalette,
  TreeSpecies
} from '../../components/forest/treeBillboardTexture'
import type {
  ImportedSceneryAdvertisingBoard,
  ImportedSceneryTreePlacement
} from './ImportedCarTrackScenery'
import {
  createImportedBasicAdvertisingBoards,
  createImportedBasicTreePlacements,
  type ImportedBasicBoardOptions,
  type ImportedBasicTreeOptions
} from './importedBasicSceneryData'

interface ImportedBasicSceneryProps {
  trackDefinition: CarTrackDefinition
  qualityPreset: RacingQualityPreset
  getHeightAtPosition?: TerrainHeightSampler
  treeOptions?: ImportedBasicTreeOptions
  boardOptions?: ImportedBasicBoardOptions
  treePalette?: TreePalette
  showBoardTextureLogos?: boolean
  forest?: boolean
  forestOptions?: BillboardForestOptions
  forestPalette?: TreeBillboardPalette
  forestSpecies?: TreeSpecies
  onTreesGenerated?: (trees: ImportedSceneryTreePlacement[]) => void
  onBoardsGenerated?: (boards: ImportedSceneryAdvertisingBoard[]) => void
}

const DEFAULT_IMPORTED_TREE_PALETTE: TreePalette = {
  trunk: '#4a3522',
  foliage1: '#244d34',
  foliage2: '#2f6b45',
  foliage3: '#4e8f59'
}

export const ImportedBasicScenery: React.FC<ImportedBasicSceneryProps> = ({
  trackDefinition,
  qualityPreset,
  getHeightAtPosition,
  treeOptions,
  boardOptions,
  treePalette = DEFAULT_IMPORTED_TREE_PALETTE,
  showBoardTextureLogos = false,
  forest = false,
  forestOptions,
  forestPalette,
  forestSpecies,
  onTreesGenerated,
  onBoardsGenerated
}) => {
  const trees = useMemo(() => {
    const placements = createImportedBasicTreePlacements(trackDefinition.trackCurve, qualityPreset, treeOptions)
    if (!getHeightAtPosition) return placements

    return placements.map(tree => ({
      ...tree,
      y: getHeightAtPosition(tree.x, tree.z)
    }))
  }, [getHeightAtPosition, qualityPreset, trackDefinition.trackCurve, treeOptions])

  const boards = useMemo(() => {
    return createImportedBasicAdvertisingBoards(trackDefinition.trackCurve, boardOptions)
  }, [boardOptions, trackDefinition.trackCurve])

  useEffect(() => {
    onTreesGenerated?.(trees)
  }, [onTreesGenerated, trees])

  useEffect(() => {
    onBoardsGenerated?.(boards)
  }, [onBoardsGenerated, boards])

  return (
    <>
      {forest && (
        <TrackBillboardForest
          trackCurve={trackDefinition.trackCurve}
          qualityPreset={qualityPreset}
          getHeightAtPosition={getHeightAtPosition}
          options={forestOptions}
          palette={forestPalette}
          species={forestSpecies}
        />
      )}
      <TreeInstances trees={trees} palette={treePalette} />
      {boards.map((board, index) => (
        <CurvedBoard
          key={`imported-basic-board-${trackDefinition.trackId}-${index}`}
          curve={board.curve}
          startT={board.startT}
          endT={board.endT}
          offset={board.offset}
          side={board.side}
          height={board.height}
          showTextureLogos={showBoardTextureLogos}
          getHeightAtPosition={getHeightAtPosition}
        />
      ))}
    </>
  )
}
