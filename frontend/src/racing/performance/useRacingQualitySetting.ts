import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_RACING_QUALITY_PRESET_ID,
  RACING_QUALITY_STORAGE_KEY,
  resolveRacingQualityPresetId,
  type RacingQualityPresetId
} from './qualitySettings'

export const useRacingQualitySetting = (): [RacingQualityPresetId, (presetId: RacingQualityPresetId) => void] => {
  const [qualityPresetId, setQualityPresetIdState] = useState<RacingQualityPresetId>(DEFAULT_RACING_QUALITY_PRESET_ID)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setQualityPresetIdState(resolveRacingQualityPresetId(window.localStorage.getItem(RACING_QUALITY_STORAGE_KEY)))
  }, [])

  const setQualityPresetId = useCallback((presetId: RacingQualityPresetId) => {
    setQualityPresetIdState(presetId)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RACING_QUALITY_STORAGE_KEY, presetId)
    }
  }, [])

  return [qualityPresetId, setQualityPresetId]
}
