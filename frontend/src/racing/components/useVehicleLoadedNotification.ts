import { useEffect, useRef, type RefObject } from 'react'

interface UseVehicleLoadedNotificationOptions<TVehicle> {
  gameStatus: string
  vehicleRef: RefObject<TVehicle>
  onVehicleLoaded?: () => void
  onLoaded?: () => void
  loadingStatus?: string
  delayMs?: number
}

export const useVehicleLoadedNotification = <TVehicle>({
  gameStatus,
  vehicleRef,
  onVehicleLoaded,
  onLoaded,
  loadingStatus = 'loading',
  delayMs = 300
}: UseVehicleLoadedNotificationOptions<TVehicle>): void => {
  const hasNotifiedVehicleLoaded = useRef(false)
  const onVehicleLoadedRef = useRef(onVehicleLoaded)
  const onLoadedRef = useRef(onLoaded)
  const hasVehicleLoadedCallback = Boolean(onVehicleLoaded)

  useEffect(() => {
    onVehicleLoadedRef.current = onVehicleLoaded
    onLoadedRef.current = onLoaded
  }, [onLoaded, onVehicleLoaded])

  useEffect(() => {
    if (gameStatus === loadingStatus && hasVehicleLoadedCallback && !hasNotifiedVehicleLoaded.current) {
      const timeoutId = setTimeout(() => {
        if (vehicleRef.current) {
          hasNotifiedVehicleLoaded.current = true
          onVehicleLoadedRef.current?.()
          onLoadedRef.current?.()
        }
      }, delayMs)

      return () => clearTimeout(timeoutId)
    }

    if (gameStatus !== loadingStatus) {
      hasNotifiedVehicleLoaded.current = false
    }
  }, [delayMs, gameStatus, hasVehicleLoadedCallback, loadingStatus, vehicleRef])
}

interface UseVehicleStatusCallbackOptions {
  gameStatus: string
  targetStatus: string
  onStatusReached?: () => void
}

export const useVehicleStatusCallback = ({
  gameStatus,
  targetStatus,
  onStatusReached
}: UseVehicleStatusCallbackOptions): void => {
  const onStatusReachedRef = useRef(onStatusReached)
  const hasStatusCallback = Boolean(onStatusReached)

  useEffect(() => {
    onStatusReachedRef.current = onStatusReached
  }, [onStatusReached])

  useEffect(() => {
    if (gameStatus === targetStatus && hasStatusCallback) {
      onStatusReachedRef.current?.()
    }
  }, [gameStatus, hasStatusCallback, targetStatus])
}

interface VehicleSpawnPosition {
  x: number
  z: number
}

interface MutableRef<TValue> {
  current: TValue
}

interface SettablePosition {
  set: (x: number, y: number, z: number) => unknown
}

interface UseReportedSpawnPositionOptions<TPosition extends SettablePosition> {
  spawnPosition?: VehicleSpawnPosition | null
  positionRef: MutableRef<TPosition>
  rotationRef: MutableRef<number>
  speedRef: MutableRef<number>
  getHeightAtPosition: (x: number, z: number) => number
  onPositionUpdate?: (position: TPosition, rotation?: number, speed?: number) => void
}

export const useReportedSpawnPosition = <TPosition extends SettablePosition>({
  spawnPosition,
  positionRef,
  rotationRef,
  speedRef,
  getHeightAtPosition,
  onPositionUpdate
}: UseReportedSpawnPositionOptions<TPosition>): void => {
  const hasReportedSpawnPosition = useRef(false)

  useEffect(() => {
    if (spawnPosition && onPositionUpdate && !hasReportedSpawnPosition.current) {
      const trackY = getHeightAtPosition(spawnPosition.x, spawnPosition.z)
      positionRef.current.set(spawnPosition.x, trackY, spawnPosition.z)
      onPositionUpdate(positionRef.current, rotationRef.current, speedRef.current)
      hasReportedSpawnPosition.current = true
    }

    if (!spawnPosition) {
      hasReportedSpawnPosition.current = false
    }
  }, [getHeightAtPosition, onPositionUpdate, positionRef, rotationRef, spawnPosition, speedRef])
}
