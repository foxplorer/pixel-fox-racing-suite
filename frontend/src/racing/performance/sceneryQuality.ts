import type { RacingQualityPreset } from './qualitySettings'
import { getRacingQualityPreset } from './qualitySettings'

export interface RacingSceneryQualitySettings {
  densityScale: number
  detailDistanceScale: number
  rollingHillLayers: number
}

const ROLLING_HILL_LAYERS_BY_QUALITY: Record<RacingQualityPreset['id'], number> = {
  low: 2,
  medium: 3,
  high: 4
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

export const getRacingSceneryQualitySettings = (
  preset: RacingQualityPreset = getRacingQualityPreset()
): RacingSceneryQualitySettings => ({
  densityScale: preset.scenery.densityScale,
  detailDistanceScale: preset.scenery.detailDistanceScale,
  rollingHillLayers: ROLLING_HILL_LAYERS_BY_QUALITY[preset.id]
})
