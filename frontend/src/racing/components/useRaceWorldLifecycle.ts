import { useEffect, useRef } from 'react'

interface UseRaceWorldLifecycleOptions {
  gameStatus: string
  onWorldLoaded?: () => void
  onSceneReady?: () => void
  worldLoadedDelayMs?: number
  sceneReadyDelayMs?: number
}

export const useRaceWorldLifecycle = ({
  gameStatus,
  onWorldLoaded,
  onSceneReady,
  worldLoadedDelayMs = 300,
  sceneReadyDelayMs = 500
}: UseRaceWorldLifecycleOptions): void => {
  const hasNotifiedWorldLoaded = useRef(false)
  const hasTriggeredSceneReady = useRef(false)

  useEffect(() => {
    if (gameStatus === 'loading' && onWorldLoaded && !hasNotifiedWorldLoaded.current) {
      const timeoutId = window.setTimeout(() => {
        hasNotifiedWorldLoaded.current = true
        onWorldLoaded()
      }, worldLoadedDelayMs)
      return () => window.clearTimeout(timeoutId)
    }

    if (gameStatus !== 'loading') {
      hasNotifiedWorldLoaded.current = false
    }
  }, [gameStatus, onWorldLoaded, worldLoadedDelayMs])

  useEffect(() => {
    if (gameStatus === 'countdown' && onSceneReady && !hasTriggeredSceneReady.current) {
      hasTriggeredSceneReady.current = true
      const timeoutId = window.setTimeout(() => {
        onSceneReady()
      }, sceneReadyDelayMs)
      return () => window.clearTimeout(timeoutId)
    }

    if (gameStatus !== 'countdown') {
      hasTriggeredSceneReady.current = false
    }
  }, [gameStatus, onSceneReady, sceneReadyDelayMs])
}
