import React, { useRef, useEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { VoxelBackgroundRemovalStrategy } from '../voxelization/voxelBackgroundStrategy'
import { logRacingDiagnostic } from '../../racing/debug/diagnostics'
import carOnGas from '../../assets/car-on-gas.mp3'
import { GameStatus } from './FoxRacingGame'
import { startFinishDirection, startFinishPosition } from './TrackData'
import { findClosestCurveT } from '../../racing/core/spatialTrackIndex'
import { createStartGate, updateStartGateState } from '../../racing/core/startGate'
import { getOnTrackDistance, isWithinDistanceSq, isWithinStartTolerance } from '../../racing/core/trackProximity'
import { attemptLapCompletion, finalizeLapDistanceFrame, updateTrackProgressAccumulator } from '../../racing/simulation/lapTiming'
import { browserRaceClock } from '../../racing/simulation/raceClock'
import { notifyLapDisplayUpdate, notifySpeedDisplayUpdate } from '../../racing/simulation/displayUpdates'
import { resetLapCountersForGameStatus } from '../../racing/simulation/lapCounterReset'
import { createPreloadedAudio } from '../../racing/components/audioElements'
import { commitVehiclePose, notifyManualCameraControlUsed, notifyVehiclePositionUpdate } from '../../racing/components/vehicleFrameCallbacks'
import { useVehicleLoadedNotification } from '../../racing/components/useVehicleLoadedNotification'
import { CarTrackVehicleModel } from '../../racing/components/CarTrackVehicleModel'
import type { RacingQualityPresetId } from '../../racing/performance/qualitySettings'
import { getTrackRuntimeConfig } from '../../racing/tracks/trackRuntimeConfig'
import { getCarSurfaceVisualY } from '../../racing/vehicles/carBounce'
import { capCameraDelta, clampCameraDistance, getCarCameraSmoothingRate, getExponentialSmoothingFactor, SHARED_CAR_CAMERA } from '../../racing/vehicles/carCamera'
import { updateCarGasAudio } from '../../racing/vehicles/carGasAudio'
import { resolveCarCollisionFrame } from '../../racing/vehicles/carCollisionFrame'
import { advanceCarControlFrame, advanceCarMovementFrame, canAdvanceCarFrame, getInactiveCarSpeed, getStableCarRotation, isAnyCarControlActive, SHARED_CAR_HANDLING } from '../../racing/vehicles/carHandling'
import { useCarKeyboardControls } from '../../racing/vehicles/useCarKeyboardControls'
import { collectFirstNearbyItem } from '../../racing/collectibles/collectiblePickup'
import type { RacingGameCollectibleItem as GameItem } from '../../racing/collectibles/collectibleTypes'
import type { RacingWorldPlayerCollisionTarget } from '../../racing/multiplayer/worldPlayers'

const trackRuntimeConfig = getTrackRuntimeConfig('san-luis')

export type CameraMode = 'simple' | 'smooth' | 'damped' | 'targetsmooth' | 'velocity'

interface FreeRoamCarProps {
  foxOriginOutpoint?: string | null
  backgroundRemovalStrategy?: VoxelBackgroundRemovalStrategy
  playerColor: string
  qualityPresetId?: RacingQualityPresetId
  gameStatus: GameStatus
  countdown?: number
  isManualCamera?: boolean
  cameraMode?: CameraMode // Camera mode selector
  trackCurve?: THREE.CatmullRomCurve3
  trackLength?: number
  treePositions?: Array<{ x: number; z: number; scale: number; radius: number }>
  startingGatePoles?: Array<{ x: number; z: number; radius: number }>
  onDistanceUpdate?: (distance: number) => void
  onPositionUpdate?: (position: THREE.Vector3, rotation?: number, speed?: number, headlightsEnabled?: boolean) => void
  onLapComplete?: (lapTime: number) => void
  onLapTimeUpdate?: (currentLapTime: number) => void // Callback to update visual timer with current lap time
  onSpeedUpdate?: (speed: number) => void // Callback to update speed display (m/s)
  onCarControlUsed?: () => void
  onGasPressed?: () => void
  onGasReleased?: () => void
  isSoundEnabled?: boolean
  onCarLoaded?: () => void
  items?: GameItem[]
  onCollectItem?: (itemId: string) => void
  otherPlayers?: RacingWorldPlayerCollisionTarget[]
  spawnPosition?: { x: number; y: number; z: number } | null
  localChatMessage?: { text: string; timestamp: number } | null
}

export const FreeRoamCar: React.FC<FreeRoamCarProps> = ({
  foxOriginOutpoint,
  backgroundRemovalStrategy = 'default',
  playerColor,
  qualityPresetId,
  gameStatus,
  countdown = 0,
  isManualCamera = false,
  cameraMode = 'smooth', // Default to 'smooth' mode (exponential smoothing)
  trackCurve,
  trackLength,
  treePositions = [],
  startingGatePoles = [],
  onDistanceUpdate,
  onPositionUpdate,
  onLapComplete,
  onLapTimeUpdate,
  onSpeedUpdate,
  onCarControlUsed,
  onGasPressed,
  onGasReleased,
  isSoundEnabled = false,
  onCarLoaded,
  items = [],
  onCollectItem,
  otherPlayers = [],
  spawnPosition = null,
  localChatMessage = null
}) => {
  const { camera } = useThree()
  const carRef = useRef<THREE.Group>(null)
  const [headlightsEnabled, setHeadlightsEnabled] = useState(false)
  const headlightsEnabledRef = useRef(false)
  
  // Initialize position from spawnPosition if provided, otherwise default to start line
  const initialPosition = spawnPosition 
    ? new THREE.Vector3(spawnPosition.x, spawnPosition.y, spawnPosition.z)
    : new THREE.Vector3(0, 0.1, 0)
  const position = useRef(initialPosition.clone()) // Car position: wheels at y=0.3 locally, so car at y=0.1 makes wheel centers at y=0.4 (radius 0.4, bottom at y=0)
  const initialRotation = Math.atan2(startFinishDirection.x, startFinishDirection.z)
  const rotation = useRef(initialRotation) // Y rotation in radians
  
  // Update position when spawnPosition changes (e.g., when joining game)
  useEffect(() => {
    if (spawnPosition) {
      position.current.set(spawnPosition.x, spawnPosition.y, spawnPosition.z)
      if (carRef.current) {
        carRef.current.position.copy(position.current)
      }
    }
  }, [spawnPosition])
  const speed = useRef(0)
  const velocity = useRef(new THREE.Vector3(0, 0, 0))
  const lastCameraTarget = useRef(new THREE.Vector3(0, 8, 15)) // For targetsmooth camera mode
  
  // PERFORMANCE: Reusable Vector3 objects to prevent memory allocations every frame
  const forwardRef = useRef(new THREE.Vector3(0, 0, -1))
  const worldUpRef = useRef(new THREE.Vector3(0, 1, 0))
  const newPositionRef = useRef(new THREE.Vector3())
  const pushDirectionRef = useRef(new THREE.Vector3())
  const cameraOffsetRef = useRef(new THREE.Vector3())
  const cameraTargetRef = useRef(new THREE.Vector3())
  const tempVec1Ref = useRef(new THREE.Vector3()) // For velocity mode prediction
  const tempVec2Ref = useRef(new THREE.Vector3()) // For distance constraints direction
  
  // Distance tracking along track
  const totalDistanceTraveled = useRef(0) // Total meters traveled
  const lastTrackT = useRef<number | null>(null) // Last position along track (0-1)
  const lastLapTime = useRef<number | null>(null) // Time when last lap started
  const lastLapDistance = useRef(0) // Distance traveled when last lap was completed
  const lapTimeUpdateFrameCounter = useRef(0) // Throttle lap time updates
  const hasCrossedStartLine = useRef(false) // Track if we've crossed start line (to prevent duplicate detections)
  const isOnStartLine = useRef(true) // Track if we're currently over the start line (starts true since car spawns at start)
  const maxTrackT = useRef<number | null>(null) // Maximum track position reached since last lap (anti-cheat: ensures full lap)
  const speedUpdateFrameCounter = useRef(0) // Throttle speed updates to every 6 frames (~10 updates/sec at 60fps)
  
  const keys = useRef<{ [key: string]: boolean }>({})

  // Gas sound
  const gasAudio = useMemo(() => {
    return createPreloadedAudio(carOnGas, { loop: true })
  }, [])
  const isGasSoundPlaying = useRef(false)
  
  useVehicleLoadedNotification({
    gameStatus,
    vehicleRef: carRef,
    onVehicleLoaded: onCarLoaded
  })

  // Check if car is on track (within track width / 2 + margin)
  const isOnTrack = (pos: THREE.Vector3, curve?: THREE.CatmullRomCurve3): boolean => {
    if (!curve) {
      // No track curve provided - assume always on track
      return true
    }
    
    const MAX_DISTANCE = getOnTrackDistance(trackRuntimeConfig.proximity)
    
    // Special case: if car is very close to start position (0, 0.1, 0), assume on track
    // This prevents false negatives at the start/finish line
    const START_POSITION = new THREE.Vector3(0, 0.1, 0)
    if (isWithinStartTolerance(pos.distanceTo(START_POSITION), trackRuntimeConfig.proximity)) {
      return true
    }
    
    const { distanceSq } = findClosestCurveT(curve, pos.x, pos.z, {
      coarseSamples: 100,
      refineSamples: 30
    })
    
    return isWithinDistanceSq(distanceSq, MAX_DISTANCE)
  }
  
  // Check if car is near track (more lenient than "on track" - allows going off track but not far)
  const isNearTrack = (pos: THREE.Vector3, curve?: THREE.CatmullRomCurve3): boolean => {
    if (!curve) return true
    
    const { distanceSq } = findClosestCurveT(curve, pos.x, pos.z, {
      coarseSamples: 100,
      refineSamples: 0
    })
    
    return isWithinDistanceSq(distanceSq, trackRuntimeConfig.proximity.nearTrackDistance)
  }
  
  // Find closest point on track and return the t value (0-1) along the curve
  const findTrackPosition = (pos: THREE.Vector3, curve?: THREE.CatmullRomCurve3): number => {
    if (!curve) return 0
    
    return findClosestCurveT(curve, pos.x, pos.z, {
      coarseSamples: 200,
      refineSamples: 50
    }).t
  }

  useCarKeyboardControls({
    keys,
    gameStatus,
    isSoundEnabled,
    gasAudio,
    speed,
    isGasSoundPlaying,
    onGasPressed,
    onGasReleased,
    onHeadlightsToggle: () => setHeadlightsEnabled(enabled => {
      const nextValue = !enabled
      headlightsEnabledRef.current = nextValue
      onPositionUpdate?.(position.current, rotation.current, speed.current, nextValue)
      return nextValue
    }),
    onGasPlayError: err => logRacingDiagnostic('Gas sound play failed:', err)
  })

  // Reset lap tracking when starting a new race
  useEffect(() => {
    resetLapCountersForGameStatus({
      gameStatus,
      refs: {
        lastLapTime,
        lastLapDistance,
        hasCrossedStartLine,
        isOnStartLine,
        maxTrackT
      },
      nowMs: browserRaceClock.nowMs()
    })
  }, [gameStatus])

  // Performance monitoring - track frame counts
  const frameCountRef = useRef(0)
  const lastLogTimeRef = useRef(Date.now())
  const trackPosCalcCountRef = useRef(0)
  const cameraUpdateCountRef = useRef(0)

  useFrame((state, delta) => {
    if (!carRef.current) return

    frameCountRef.current++
    const now = Date.now()

    // Log performance stats every 5 seconds
    if (now - lastLogTimeRef.current > 5000) {
      const fps = Math.round(frameCountRef.current / ((now - lastLogTimeRef.current) / 1000))
      logRacingDiagnostic(`📊 Performance Stats (last 5s): FPS=${fps}, TrackPosCalcs=${trackPosCalcCountRef.current}, CameraUpdates=${cameraUpdateCountRef.current}`)
      frameCountRef.current = 0
      trackPosCalcCountRef.current = 0
      cameraUpdateCountRef.current = 0
      lastLogTimeRef.current = now
    }

    // Only allow movement when racing (countdown must complete first)
    const canMove = canAdvanceCarFrame(gameStatus)
    if (!canMove) {
      // During countdown or loading, apply friction to stop any existing movement
      speed.current = getInactiveCarSpeed({ gameStatus, speed: speed.current })
      return
    }

    // Check if on track
    const onTrack = isOnTrack(position.current, trackCurve)
    
    const controlFrame = advanceCarControlFrame({
      keys: keys.current,
      speed: speed.current,
      rotationRadians: rotation.current,
      deltaSeconds: delta,
      isOnTrack: onTrack
    })
    const controls = controlFrame.controls

    // Notify parent when car controls are used (to return camera to follow mode)
    notifyManualCameraControlUsed({
      isManualCamera,
      isControlActive: isAnyCarControlActive(controls),
      onControlUsed: onCarControlUsed
    })

    speed.current = controlFrame.speed

    updateCarGasAudio({
      audio: gasAudio,
      speed: speed.current,
      isSoundEnabled,
      isPlaying: isGasSoundPlaying
    })

    rotation.current = controlFrame.rotationRadians

    advanceCarMovementFrame({
      rotationRadians: rotation.current,
      speed: speed.current,
      deltaSeconds: delta,
      position: position.current,
      forward: forwardRef.current,
      velocity: velocity.current,
      movementDelta: pushDirectionRef.current,
      nextPosition: newPositionRef.current
    })
    
    const collisionFrame = resolveCarCollisionFrame({
      position: newPositionRef.current,
      speed: speed.current,
      treeTargets: treePositions,
      startingGatePoles,
      players: otherPlayers
    })
    speed.current = collisionFrame.speed
    
    // Only update position if no collision, or use corrected position
    position.current.copy(newPositionRef.current)

    collectFirstNearbyItem({
      items,
      position: position.current,
      onCollectItem
    })

    position.current.y = getCarSurfaceVisualY({
      isOnTrack: onTrack,
      speed: speed.current,
      elapsedTime: state.clock.elapsedTime
    })

    commitVehiclePose({
      vehicle: carRef.current,
      position: position.current,
      rotation: rotation.current
    })

    const startGateState = updateStartGateState(
      position.current,
      createStartGate(startFinishPosition, startFinishDirection, trackRuntimeConfig.lapCrossing),
      isOnStartLine
    )
    const { justEntered: justEnteredStartLine, justLeft: justLeftStartLine } = startGateState
    
    // Track distance traveled along the track
    if (trackCurve && trackLength && Math.abs(speed.current) > 0.1) {
      trackPosCalcCountRef.current++
      const currentTrackT = findTrackPosition(position.current, trackCurve)
      
      updateTrackProgressAccumulator({
        currentTrackT,
        trackLength,
        lastTrackT,
        totalDistanceTraveled,
        maxTrackT,
        isNearTrack: isNearTrack(position.current, trackCurve)
      })
      
      // Lap Detection: Check if we've crossed the start line and traveled enough distance
      if (justEnteredStartLine && trackLength && onLapComplete && lastLapTime.current !== null) {
        const lapAttempt = attemptLapCompletion({
          trackLength,
          onLapComplete,
          lastLapTime,
          lastLapDistance,
          totalDistanceTraveled,
          hasCrossedStartLine,
          minLapDistanceRatio: trackRuntimeConfig.metadata.lapValidation.minLapDistanceRatio,
          requiresReachedEnd: trackRuntimeConfig.metadata.lapValidation.requiresReachedEnd,
          maxTrackT,
          resetMaxTrackTOnCompletion: 0,
          nowMs: browserRaceClock.nowMs()
        })
        
        if (lapAttempt.completed && lapAttempt.lapTime !== null) {
          logRacingDiagnostic(`🏁 Lap completed! Time: ${lapAttempt.lapTime.toFixed(3)}s`)
        }
      }
      
      finalizeLapDistanceFrame({
        justLeftStartLine,
        hasCrossedStartLine,
        totalDistanceTraveled,
        onDistanceUpdate
      })
    } else if (Math.abs(speed.current) <= 0.1) {
      // Reset tracking when stopped
      if (trackCurve) {
        lastTrackT.current = findTrackPosition(position.current, trackCurve)
      }
    }

    // Update visual timer with current lap time (synchronized with lap recording timer)
    // This ensures the visual timer matches exactly what gets recorded when lap completes
    // PERFORMANCE: Throttle to every 6 frames (~10 updates/sec at 60fps) to reduce React re-renders
    notifyLapDisplayUpdate({
      counter: lapTimeUpdateFrameCounter,
      lapStartMs: lastLapTime.current,
      nowMs: browserRaceClock.nowMs(),
      onLapTimeUpdate
    })

    // Notify parent of position update (for OrbitControls target)
    notifyVehiclePositionUpdate({
      position: position.current,
      rotation: rotation.current,
      speed: speed.current,
      headlightsEnabled: headlightsEnabledRef.current,
      onPositionUpdate
    })
    
    // Update speed display (throttled to reduce React re-renders)
    notifySpeedDisplayUpdate({
      counter: speedUpdateFrameCounter,
      speed: speed.current,
      onSpeedUpdate
    })

        // Camera follows car (third person) - only if not in manual mode
        // Stop immediately when manual mode is active to prevent conflicts
        if (!isManualCamera) {
          cameraUpdateCountRef.current++
          // Common setup for all camera modes
          const cappedDelta = capCameraDelta(delta)
          
          rotation.current = getStableCarRotation(rotation.current, initialRotation)

          // Calculate base camera offset - reuse ref to prevent allocation
          cameraOffsetRef.current.set(0, SHARED_CAR_CAMERA.height, SHARED_CAR_CAMERA.distance)
          cameraOffsetRef.current.applyAxisAngle(worldUpRef.current, rotation.current)
          
          // SAFETY: Validate camera offset
          if (!isFinite(cameraOffsetRef.current.x) || !isFinite(cameraOffsetRef.current.y) || !isFinite(cameraOffsetRef.current.z)) {
            // Reset to safe values
            cameraOffsetRef.current.set(0, SHARED_CAR_CAMERA.height, SHARED_CAR_CAMERA.distance)
          }
          
          // Camera mode-specific calculations
          switch (cameraMode) {
            case 'simple': {
              // Simple linear lerp (original)
              cameraTargetRef.current.copy(position.current).add(cameraOffsetRef.current)
              camera.position.lerp(cameraTargetRef.current, getExponentialSmoothingFactor(delta, SHARED_CAR_CAMERA.smoothSmoothingRate))
              camera.lookAt(position.current)
              return // Early return for simple mode
            }
            
            case 'velocity': {
              // Velocity-based prediction - reuse tempVec1Ref for calculations
              tempVec1Ref.current.copy(velocity.current)
              tempVec1Ref.current.multiplyScalar(SHARED_CAR_CAMERA.velocityPredictionSeconds)
              cameraTargetRef.current.copy(position.current).add(tempVec1Ref.current).add(cameraOffsetRef.current)
              break
            }
            
            case 'targetsmooth': {
              // Smooth the target position itself first
              cameraTargetRef.current.copy(position.current).add(cameraOffsetRef.current)
              const targetSmoothing = getExponentialSmoothingFactor(cappedDelta, SHARED_CAR_CAMERA.sanLuisTargetSmoothTargetRate)
              lastCameraTarget.current.lerp(cameraTargetRef.current, targetSmoothing)
              cameraTargetRef.current.copy(lastCameraTarget.current)
              break
            }
            
            case 'smooth':
            case 'damped':
            default: {
              // Base smooth mode (or default)
              cameraTargetRef.current.copy(position.current).add(cameraOffsetRef.current)
              break
            }
          }
          
          // Distance constraints (for all modes except simple)
          const currentDistance = camera.position.distanceTo(position.current)
          const minDistance = SHARED_CAR_CAMERA.minDistance
          const maxDistance = SHARED_CAR_CAMERA.maxDistance
          
          if (currentDistance < minDistance || currentDistance > maxDistance) {
            // Reuse tempVec2Ref for direction calculation
            tempVec2Ref.current.copy(cameraTargetRef.current).sub(position.current)
            // Safety check: if direction is invalid (zero length), use forward direction instead
            if (tempVec2Ref.current.lengthSq() < 0.01) {
              // Camera target is at car position - use forward direction as fallback
              tempVec2Ref.current.set(0, 0, 1) // Camera is behind car (opposite of forward)
            }
            tempVec2Ref.current.normalize()
            const clampedDistance = clampCameraDistance(currentDistance)
            cameraTargetRef.current.copy(position.current).add(tempVec2Ref.current.multiplyScalar(clampedDistance))
          }
          
          // Exponential smoothing (rate depends on mode)
          const smoothingRate = cameraMode === 'damped' ? SHARED_CAR_CAMERA.dampedSmoothingRate : getCarCameraSmoothingRate('smooth')
          const smoothingFactor = getExponentialSmoothingFactor(cappedDelta, smoothingRate)
          
          // Apply smoothing to camera position
          camera.position.lerp(cameraTargetRef.current, smoothingFactor)
          camera.lookAt(position.current)
        }
  })

  return (
    <group ref={carRef} position={[0, 0, 0]}>
      <CarTrackVehicleModel
        foxOriginOutpoint={foxOriginOutpoint}
        backgroundRemovalStrategy={backgroundRemovalStrategy}
        playerColor={playerColor}
        qualityPresetId={qualityPresetId}
        headlightsEnabled={headlightsEnabled}
        localChatMessage={localChatMessage}
      />
    </group>
  )
}
