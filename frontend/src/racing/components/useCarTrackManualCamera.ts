import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface UseCarTrackManualCameraOptions {
  startPosition: THREE.Vector3
  targetYOffset?: number
  followLerp?: number
  updateControlsOnFollow?: boolean
}

export const useCarTrackManualCamera = ({
  startPosition,
  targetYOffset = 0.15,
  followLerp = 0.2,
  updateControlsOnFollow = true
}: UseCarTrackManualCameraOptions) => {
  const [isManualCamera, setIsManualCamera] = useState(false)
  const orbitControlsRef = useRef<any>(null)
  const carPositionRef = useRef(new THREE.Vector3(startPosition.x, startPosition.y + targetYOffset, startPosition.z))

  const getFallbackTarget = useCallback(() => {
    return new THREE.Vector3(startPosition.x, startPosition.y + targetYOffset, startPosition.z)
  }, [startPosition, targetYOffset])

  const focusControlsOnCar = useCallback(() => {
    if (!orbitControlsRef.current) return

    const targetPosition = carPositionRef.current.lengthSq() > 0
      ? carPositionRef.current
      : getFallbackTarget()
    orbitControlsRef.current.target.copy(targetPosition)
    orbitControlsRef.current.update()
  }, [getFallbackTarget])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'c' && event.key !== 'C') return

      setIsManualCamera(previousValue => {
        const nextValue = !previousValue
        if (nextValue) {
          focusControlsOnCar()
        }
        console.log(`📷 Camera mode: ${nextValue ? 'MANUAL (press C or drive to return)' : 'FOLLOW'}`)
        return nextValue
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusControlsOnCar])

  const returnToFollowCamera = useCallback(() => {
    setIsManualCamera(false)
  }, [])

  const updateCarPosition = useCallback((position: THREE.Vector3) => {
    carPositionRef.current.copy(position)

    if (isManualCamera && orbitControlsRef.current) {
      orbitControlsRef.current.target.lerp(position, followLerp)
      if (updateControlsOnFollow) {
        orbitControlsRef.current.update()
      }
    }
  }, [followLerp, isManualCamera, updateControlsOnFollow])

  return {
    isManualCamera,
    orbitControlsRef,
    setIsManualCamera,
    focusControlsOnCar,
    returnToFollowCamera,
    updateCarPosition
  }
}
