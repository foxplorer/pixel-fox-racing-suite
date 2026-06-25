import React from 'react'
import * as THREE from 'three'
import type { CarTrackDefinition } from '../carTrackDefinitions'
import type { TerrainHeightSampler } from '../../core/roadCorridor'
import type { RacingQualityPreset } from '../../performance/qualitySettings'
import { UnitedKingdomScenery } from './unitedKingdom/unitedKingdomScenery'
import { ImportedBasicScenery } from './ImportedBasicScenery'
import { VolcanoCaveScenery } from './volcanoes/VolcanoCaveScenery'
import type { BillboardForestOptions } from '../../components/forest/billboardForestPlacement'
import { TrackBirds } from '../../components/birds/TrackBirds'

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
  forestOptions?: BillboardForestOptions
  onTreesGenerated?: (trees: ImportedSceneryTreePlacement[]) => void
  onBoardsGenerated?: (boards: ImportedSceneryAdvertisingBoard[]) => void
}

export const ImportedCarTrackScenery: React.FC<ImportedCarTrackSceneryProps> = ({
  trackDefinition,
  qualityPreset,
  getHeightAtPosition,
  forestOptions,
  onTreesGenerated,
  onBoardsGenerated
}) => {
  // The volcano cave is enclosed, so birds only make sense over the open-sky billboard
  // tracks. Everything else routed through here shares the same flock layer.
  if (trackDefinition.trackId === 'volcanoes') {
    return (
      <VolcanoCaveScenery
        trackDefinition={trackDefinition}
        qualityPreset={qualityPreset}
        getHeightAtPosition={getHeightAtPosition}
        forestOptions={forestOptions}
        onTreesGenerated={onTreesGenerated}
        onBoardsGenerated={onBoardsGenerated}
      />
    )
  }

  const scenery = trackDefinition.trackId === 'united-kingdom'
    ? (
      <UnitedKingdomScenery
        trackCurve={trackDefinition.trackCurve}
        qualityPreset={qualityPreset}
        getHeightAtPosition={getHeightAtPosition}
        forestOptions={forestOptions}
        onTreesGenerated={onTreesGenerated}
        onBoardsGenerated={onBoardsGenerated}
      />
    )
    : (
      <ImportedBasicScenery
        trackDefinition={trackDefinition}
        qualityPreset={qualityPreset}
        getHeightAtPosition={getHeightAtPosition}
        showBoardTextureLogos={
          trackDefinition.trackId === 'australia' ||
          trackDefinition.trackId === 'belgium' ||
          trackDefinition.trackId === 'germany'
        }
        forest
        forestOptions={forestOptions}
        onTreesGenerated={onTreesGenerated}
        onBoardsGenerated={onBoardsGenerated}
      />
    )

  return (
    <>
      {scenery}
      <TrackBirds
        trackCurve={trackDefinition.trackCurve}
        qualityPreset={qualityPreset}
        getHeightAtPosition={getHeightAtPosition}
      />
    </>
  )
}
