import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_RACING_QUALITY_PRESET_ID,
  RACING_QUALITY_STORAGE_KEY,
  resolveRacingQualityPresetId,
  type RacingQualityPresetId
} from './qualitySettings'
import { getRacingDeviceProfileSnapshot } from '../platform/useRacingDeviceProfile'

export const useRacingQualitySetting = (): [RacingQualityPresetId, (presetId: RacingQualityPresetId) => void] => {
  const [qualityPresetId, setQualityPresetIdState] = useState<RacingQualityPresetId>(DEFAULT_RACING_QUALITY_PRESET_ID)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedPresetId = window.localStorage.getItem(RACING_QUALITY_STORAGE_KEY)
    if (storedPresetId === null && getRacingDeviceProfileSnapshot().prefersMobileRacingUi) {
      // First run on a touch-first device: default to the mobile budget.
      // Not persisted, so an explicit player choice is still the only stored value.
      setQualityPresetIdState('mobile')
      return
    }
    setQualityPresetIdState(resolveRacingQualityPresetId(storedPresetId))
  }, [])

  const setQualityPresetId = useCallback((presetId: RacingQualityPresetId) => {
    setQualityPresetIdState(presetId)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RACING_QUALITY_STORAGE_KEY, presetId)
    }
  }, [])

  return [qualityPresetId, setQualityPresetId]
}
