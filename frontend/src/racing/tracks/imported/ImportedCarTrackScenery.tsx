import React from 'react'
import * as THREE from 'three'
import type { CarTrackDefinition } from '../carTrackDefinitions'
import type { TerrainHeightSampler } from '../../core/roadCorridor'
import type { RacingQualityPreset } from '../../performance/qualitySettings'
import { UnitedKingdomScenery } from './unitedKingdom/unitedKingdomScenery'
import { ImportedBasicScenery } from './ImportedBasicScenery'

export interface ImportedSceneryTreePlacement {
  x: number
  z: number
  scale: number
  radius: number
}

export interface ImportedSceneryAdvertisingBoard {
  curve: THREE.CatmullRomCurve3
  startT: number
  endT: number
  offset: number
  side: 'left' | 'right'
  height: number
}

interface ImportedCarTrackSceneryProps {
  trackDefinition: CarTrackDefinition
  qualityPreset: RacingQualityPreset
  getHeightAtPosition?: TerrainHeightSampler
  onTreesGenerated?: (trees: ImportedSceneryTreePlacement[]) => void
  onBoardsGenerated?: (boards: ImportedSceneryAdvertisingBoard[]) => void
}

export const ImportedCarTrackScenery: React.FC<ImportedCarTrackSceneryProps> = ({
  trackDefinition,
  qualityPreset,
  getHeightAtPosition,
  onTreesGenerated,
  onBoardsGenerated
}) => {
  switch (trackDefinition.trackId) {
    case 'united-kingdom':
      return (
        <UnitedKingdomScenery
          trackCurve={trackDefinition.trackCurve}
          qualityPreset={qualityPreset}
          getHeightAtPosition={getHeightAtPosition}
          onTreesGenerated={onTreesGenerated}
          onBoardsGenerated={onBoardsGenerated}
        />
      )
    case 'australia':
    case 'belgium':
    case 'germany':
      return (
        <ImportedBasicScenery
          trackDefinition={trackDefinition}
          qualityPreset={qualityPreset}
          getHeightAtPosition={getHeightAtPosition}
          showBoardTextureLogos
          onTreesGenerated={onTreesGenerated}
          onBoardsGenerated={onBoardsGenerated}
        />
      )
    default:
      return (
        <ImportedBasicScenery
          trackDefinition={trackDefinition}
          qualityPreset={qualityPreset}
          getHeightAtPosition={getHeightAtPosition}
          onTreesGenerated={onTreesGenerated}
          onBoardsGenerated={onBoardsGenerated}
        />
      )
  }
}
