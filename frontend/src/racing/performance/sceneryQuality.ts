import type { RacingQualityPreset } from './qualitySettings'
import { getRacingQualityPreset } from './qualitySettings'

export interface RacingSceneryQualitySettings {
  densityScale: number
  detailDistanceScale: number
  rollingHillLayers: number
  effects: {
    meshDetailScale: number
    activeLightScale: number
    particleDensityScale: number
  }
}

const ROLLING_HILL_LAYERS_BY_QUALITY: Record<RacingQualityPreset['id'], number> = {
  low: 2,
  medium: 3,
  high: 4
}

const EFFECT_QUALITY_BY_PRESET: Record<RacingQualityPreset['id'], RacingSceneryQualitySettings['effects']> = {
  low: {
    meshDetailScale: 0.5,
    activeLightScale: 0.35,
    particleDensityScale: 0.45
  },
  medium: {
    meshDetailScale: 0.75,
    activeLightScale: 0.65,
    particleDensityScale: 0.7
  },
  high: {
    meshDetailScale: 1,
    activeLightScale: 1,
    particleDensityScale: 1
  }
}

export const getQualityScaledCount = (
  baseCount: number,
  preset: RacingQualityPreset = getRacingQualityPreset(),
  minimumCount: number = 0
): number => {
  if (!Number.isFinite(baseCount) || baseCount <= 0) return 0

  const scaledCount = Math.round(baseCount * preset.scenery.densityScale)
  return Math.max(minimumCount, scaledCount)
}

export const getScaledQualityValue = (
  baseValue: number,
  scale: number,
  minimumValue: number = 0
): number => {
  if (!Number.isFinite(baseValue) || baseValue <= 0) return 0

  const scaledValue = Math.round(baseValue * scale)
  return Math.max(minimumValue, scaledValue)
}

export const getRacingSceneryQualitySettings = (
  preset: RacingQualityPreset = getRacingQualityPreset()
): RacingSceneryQualitySettings => ({
  densityScale: preset.scenery.densityScale,
  detailDistanceScale: preset.scenery.detailDistanceScale,
  rollingHillLayers: ROLLING_HILL_LAYERS_BY_QUALITY[preset.id],
  effects: EFFECT_QUALITY_BY_PRESET[preset.id]
})
