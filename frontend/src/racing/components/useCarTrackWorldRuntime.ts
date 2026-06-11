import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { getStartGatePolePositions } from './startGatePresentation'
import { useRaceWorldLifecycle } from './useRaceWorldLifecycle'
import { useCarTrackManualCamera } from './useCarTrackManualCamera'
import type { CarTrackDefinition } from '../tracks/carTrackDefinitions'
import {
  getRacingCanvasQualitySettings,
  getRacingQualityPreset,
  type RacingQualityPresetId
} from '../performance/qualitySettings'
import { getRacingSceneryQualitySettings } from '../performance/sceneryQuality'

type CarTrackWorldStatus = 'idle' | 'showroom' | 'loading' | 'countdown' | 'racing' | 'crashed' | 'finished'

export type { CarTrackDefinition } from '../tracks/carTrackDefinitions'

interface UseCarTrackWorldRuntimeOptions {
  config: CarTrackDefinition
  gameStatus: CarTrackWorldStatus
  qualityPresetId?: RacingQualityPresetId
  onTrackLengthUpdate?: (length: number) => void
  onWorldLoaded?: () => void
  onSceneReady?: () => void
}

export const useCarTrackWorldRuntime = ({
  config,
  gameStatus,
  qualityPresetId = 'medium',
  onTrackLengthUpdate,
  onWorldLoaded,
  onSceneReady
}: UseCarTrackWorldRuntimeOptions) => {
  const qualityPreset = getRacingQualityPreset(qualityPresetId)
  const canvasQuality = getRacingCanvasQualitySettings(qualityPreset)
  const sceneryQuality = getRacingSceneryQualitySettings(qualityPreset)
  const manualCamera = useCarTrackManualCamera({
    startPosition: config.startFinishPosition,
    targetYOffset: config.manualCamera?.targetYOffset ?? 0.15,
    followLerp: config.manualCamera?.followLerp ?? 0.2,
    updateControlsOnFollow: config.manualCamera?.updateControlsOnFollow ?? true
  })

  const startingGatePoles = useMemo(() => {
    return getStartGatePolePositions({
      center: config.startFinishPosition,
      direction: config.startFinishDirection,
      halfWidth: config.startingGateHalfWidth
    })
  }, [config.startFinishDirection, config.startFinishPosition, config.startingGateHalfWidth])

  useEffect(() => {
    if (onTrackLengthUpdate && config.trackLength) {
      onTrackLengthUpdate(config.trackLength)
    }
  }, [config.trackLength, onTrackLengthUpdate])

  useRaceWorldLifecycle({ gameStatus, onWorldLoaded, onSceneReady })

  return {
    qualityPreset,
    canvasQuality,
    sceneryQuality,
    manualCamera,
    startingGatePoles,
    startGateLayout: config.startGateLayout,
    trackCurve: config.trackCurve,
    trackFrames: config.trackFrames,
    trackSegments: config.trackSegments,
    trackLength: config.trackLength,
    roadCorridor: config.roadCorridor,
    terrainHeightSampler: config.terrainHeightSampler
  }
}
