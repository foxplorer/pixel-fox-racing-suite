import { useCallback, useEffect, useRef, useState } from 'react'

interface UseRaceCountdownFlowOptions {
  gameStatus: string
  setGameStatus: (status: 'countdown' | 'racing') => void
  setCountdown: (countdown: number) => void
  playStartBeeps: () => void
  vehicleLabel?: string
  enableLoadingTimeout?: boolean
  preventDuplicateSceneReady?: boolean
  localCountdownEnabled?: boolean
}

interface UseRaceCountdownFlowResult {
  isWorldLoaded: boolean
  isVehicleLoaded: boolean
  handleWorldLoaded: () => void
  handleVehicleLoaded: () => void
  handleSceneReady: () => void
}

export const useRaceCountdownFlow = ({
  gameStatus,
  setGameStatus,
  setCountdown,
  playStartBeeps,
  vehicleLabel = 'Car',
  enableLoadingTimeout = true,
  preventDuplicateSceneReady = false,
  localCountdownEnabled = true
}: UseRaceCountdownFlowOptions): UseRaceCountdownFlowResult => {
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasProcessedSceneReadyRef = useRef(false)
  const [isWorldLoaded, setIsWorldLoaded] = useState(false)
  const [isVehicleLoaded, setIsVehicleLoaded] = useState(false)

  useEffect(() => {
    if (!localCountdownEnabled) return

    if (gameStatus === 'loading' && isWorldLoaded && isVehicleLoaded) {
      const timer = setTimeout(() => {
        // -1 = "staged, countdown not started yet". The start-gate marquee treats this as
        // GET READY; using 0 here made it flash GO! for the whole ~5s pre-countdown window.
        setCountdown(-1)
        setGameStatus('countdown')
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [gameStatus, isWorldLoaded, isVehicleLoaded, localCountdownEnabled, setCountdown, setGameStatus])

  useEffect(() => {
    if (!enableLoadingTimeout) return

    if (gameStatus === 'loading') {
      const timeout = setTimeout(() => {
        console.log('⚠️ Loading timeout - forcing transition to countdown')
        if (!isWorldLoaded) {
          console.log('⚠️ World loaded callback did not fire - forcing it')
          setIsWorldLoaded(true)
        }
        if (!isVehicleLoaded) {
          console.log(`⚠️ ${vehicleLabel} loaded callback did not fire - forcing it`)
          setIsVehicleLoaded(true)
        }
      }, 5000)
      return () => clearTimeout(timeout)
    }
  }, [enableLoadingTimeout, gameStatus, isWorldLoaded, isVehicleLoaded, vehicleLabel])

  useEffect(() => {
    if (gameStatus !== 'loading') {
      setIsWorldLoaded(false)
      setIsVehicleLoaded(false)
    }

    if (gameStatus !== 'countdown') {
      hasProcessedSceneReadyRef.current = false
    }
  }, [gameStatus])

  const handleSceneReady = useCallback(() => {
    if (!localCountdownEnabled) {
      return
    }

    if (preventDuplicateSceneReady && hasProcessedSceneReadyRef.current) {
      return
    }
    hasProcessedSceneReadyRef.current = true

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
    }

    setTimeout(() => {
      setCountdown(3)
      playStartBeeps()

      let count = 3
      countdownTimerRef.current = setInterval(() => {
        count--
        setCountdown(count)
        if (count <= 0) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current)
            countdownTimerRef.current = null
          }
          // Hold on GO! (countdown 0) for a beat so the marquee shows GO! now — after the
          // countdown completes — instead of racing batching over it straight to LAP 1.
          setTimeout(() => setGameStatus('racing'), 650)
        }
      }, 1000)
    }, 5000)
  }, [localCountdownEnabled, playStartBeeps, preventDuplicateSceneReady, setCountdown, setGameStatus])

  const handleWorldLoaded = useCallback(() => {
    setIsWorldLoaded(true)
  }, [])

  const handleVehicleLoaded = useCallback(() => {
    setIsVehicleLoaded(true)
  }, [])

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
      }
    }
  }, [])

  return {
    isWorldLoaded,
    isVehicleLoaded,
    handleWorldLoaded,
    handleVehicleLoaded,
    handleSceneReady
  }
}
