import { useEffect, useState } from 'react'

export interface RacingDeviceProfile {
  isTouchDevice: boolean
  isCoarsePointer: boolean
  isSmallViewport: boolean
  isLandscape: boolean
  prefersMobileRacingUi: boolean
}

export interface RacingDeviceSignals {
  coarsePointer: boolean
  hoverNone: boolean
  maxTouchPoints: number
  viewportWidth: number
  viewportHeight: number
}

// Short-edge threshold: a phone in landscape still reads as a small viewport.
export const SMALL_VIEWPORT_SHORT_EDGE_MAX_PX = 520

const DESKTOP_FALLBACK_PROFILE: RacingDeviceProfile = {
  isTouchDevice: false,
  isCoarsePointer: false,
  isSmallViewport: false,
  isLandscape: true,
  prefersMobileRacingUi: false
}

export const computeRacingDeviceProfile = (signals: RacingDeviceSignals): RacingDeviceProfile => {
  const isTouchDevice = signals.maxTouchPoints > 0
  const isCoarsePointer = signals.coarsePointer || (signals.hoverNone && isTouchDevice)
  const isSmallViewport = Math.min(signals.viewportWidth, signals.viewportHeight) <= SMALL_VIEWPORT_SHORT_EDGE_MAX_PX
  const isLandscape = signals.viewportWidth >= signals.viewportHeight
  // Touch-first devices (phones, tablets, foldables) get the mobile racing UI.
  // Desktop touchscreens keep the desktop UI because their primary pointer is fine.
  const prefersMobileRacingUi = isTouchDevice && isCoarsePointer

  return {
    isTouchDevice,
    isCoarsePointer,
    isSmallViewport,
    isLandscape,
    prefersMobileRacingUi
  }
}

const readRacingDeviceSignals = (): RacingDeviceSignals | null => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return {
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    hoverNone: window.matchMedia('(hover: none)').matches,
    maxTouchPoints: window.navigator?.maxTouchPoints ?? 0,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  }
}

export const getRacingDeviceProfileSnapshot = (): RacingDeviceProfile => {
  const signals = readRacingDeviceSignals()
  return signals ? computeRacingDeviceProfile(signals) : DESKTOP_FALLBACK_PROFILE
}

const isSameRacingDeviceProfile = (a: RacingDeviceProfile, b: RacingDeviceProfile): boolean => (
  a.isTouchDevice === b.isTouchDevice &&
  a.isCoarsePointer === b.isCoarsePointer &&
  a.isSmallViewport === b.isSmallViewport &&
  a.isLandscape === b.isLandscape &&
  a.prefersMobileRacingUi === b.prefersMobileRacingUi
)

const subscribeToMediaQuery = (query: MediaQueryList, listener: () => void): (() => void) => {
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }
  // Older Safari only supports the deprecated listener API.
  query.addListener(listener)
  return () => query.removeListener(listener)
}

export const useRacingDeviceProfile = (): RacingDeviceProfile => {
  const [profile, setProfile] = useState<RacingDeviceProfile>(getRacingDeviceProfileSnapshot)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const update = () => {
      setProfile(previous => {
        const next = getRacingDeviceProfileSnapshot()
        return isSameRacingDeviceProfile(previous, next) ? previous : next
      })
    }

    const unsubscribers = [
      subscribeToMediaQuery(window.matchMedia('(pointer: coarse)'), update),
      subscribeToMediaQuery(window.matchMedia('(hover: none)'), update)
    ]
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    update()

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe())
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return profile
}
