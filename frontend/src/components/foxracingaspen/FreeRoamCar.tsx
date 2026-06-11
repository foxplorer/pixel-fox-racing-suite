import React, { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Legacy/unofficial Aspen car path.
// The official Aspen event is `aspen-snowmobile` and uses `snowmobilerace/SnowmobileWorld`.
// Do not route this component into the app unless a deliberate `aspen-car` event is added.
import { VoxelFox } from '../VoxelFox'
import { getOrdinalContentUrl } from '../../racing/transactions/ordinalLinks'
import { logRacingDiagnostic, warnRacingDiagnostic } from '../../racing/debug/diagnostics'
import carOnGas from '../../assets/car-on-gas.mp3'
import { GameStatus } from './FoxRacingGame'
import { spatialHash, trackSamples, GRID_SIZE, startFinishPosition, startFinishDirection } from './TrackData'
import { createIndexedTrackQueries } from '../../racing/core/indexedTrackQueries'
import { createStartGate, updateStartGateState } from '../../racing/core/startGate'
import { attemptLapCompletion, finalizeLapDistanceFrame } from '../../racing/simulation/lapTiming'
import { browserRaceClock } from '../../racing/simulation/raceClock'
import { updateHorizontalDistanceAccumulator } from '../../racing/simulation/distanceTracking'
import { notifyLapDisplayUpdate, notifySpeedDisplayUpdate } from '../../racing/simulation/displayUpdates'
import { resetLapCountersForGameStatus } from '../../racing/simulation/lapCounterReset'
import { advanceTrackPositionFrame, shouldRefreshOnTrackState } from '../../racing/simulation/trackFrameCadence'
import { getTrackRuntimeConfig } from '../../racing/tracks/trackRuntimeConfig'
import { createPreloadedAudio } from '../../racing/components/audioElements'
import { applyVehicleSpawnPositionOnce, commitVehiclePose, notifyManualCameraControlUsed, notifyVehiclePositionUpdate, resetVehiclePoseRefs } from '../../racing/components/vehicleFrameCallbacks'
import { getCarSurfaceVisualY } from '../../racing/vehicles/carBounce'
import { capCameraDelta, clampCameraDistance, getCarCameraSmoothingRate, getExponentialSmoothingFactor, shouldResetTargetSmoothCamera, SHARED_CAR_CAMERA } from '../../racing/vehicles/carCamera'
import type { RacingAdvertisingBoard } from '../../racing/vehicles/carBoardCollision'
import { resolveCarCollisionFrame } from '../../racing/vehicles/carCollisionFrame'
import { updateCarGasAudio } from '../../racing/vehicles/carGasAudio'
import { advanceCarControlFrame, advanceCarMovementFrame, canAdvanceCarFrame, getInactiveCarSpeed, getStableCarRotation, isAnyCarControlActive, SHARED_CAR_HANDLING } from '../../racing/vehicles/carHandling'
import { useCarKeyboardControls } from '../../racing/vehicles/useCarKeyboardControls'
import { FLAT_CAR_MODEL_HEIGHT_OFFSET, getFlatVehicleHeightAtPosition, getFlatVehicleTargetHeight, resolveFlatCarNextPositionY, resolveVehicleSurfaceY } from '../../racing/vehicles/vehicleElevation'
import { collectFirstNearbyItem } from '../../racing/collectibles/collectiblePickup'
import { useReportedSpawnPosition, useVehicleLoadedNotification, useVehicleStatusCallback } from '../../racing/components/useVehicleLoadedNotification'
import type { RacingGameCollectibleItem as GameItem } from '../../racing/collectibles/collectibleTypes'
import type { RacingWorldPlayerCollisionTarget } from '../../racing/multiplayer/worldPlayers'

const trackRuntimeConfig = getTrackRuntimeConfig('aspen')
const getHeightAtPosition = getFlatVehicleHeightAtPosition

export type CameraMode = 'simple' | 'smooth' | 'damped' | 'targetsmooth' | 'velocity'

interface FreeRoamCarProps {
  foxOriginOutpoint?: string | null
  playerColor: string
  gameStatus: GameStatus
  countdown?: number
  isManualCamera?: boolean
  cameraMode?: CameraMode // Camera mode selector
  trackCurve?: THREE.CatmullRomCurve3
  trackLength?: number
  treePositions?: Array<{ x: number; z: number; scale: number; radius: number }>
  mountainPositions?: Array<{ x: number; z: number; radius: number }>
  startingGatePoles?: Array<{ x: number; z: number; radius: number }>
  advertisingBoards?: RacingAdvertisingBoard[]
  onDistanceUpdate?: (distance: number) => void
  onPositionUpdate?: (position: THREE.Vector3, rotation?: number, speed?: number) => void
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
  playerColor,
  gameStatus,
  countdown = 0,
  isManualCamera = false,
  cameraMode = 'simple', // Default to 'simple' mode (same as Australia - works correctly)
  trackCurve,
  trackLength,
  treePositions = [],
  mountainPositions = [],
  startingGatePoles = [],
  advertisingBoards = [],
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
  const foxRef = useRef<THREE.Group>(null)
  
  // Initialize position from spawnPosition if provided, otherwise default to start line
  // Y coordinate is set to track height (ignoring terrain for now)
  const getInitialPosition = () => {
    if (spawnPosition) {
      // Use provided spawn position, but recalculate Y from track
      // Don't pass currentY on initial setup - find closest track
      const trackY = getHeightAtPosition(spawnPosition.x, spawnPosition.z)
      return new THREE.Vector3(spawnPosition.x, trackY, spawnPosition.z)
    }
    // Default to start/finish line position, with track height
    // Don't pass currentY on initial setup - find closest track
    const trackY = getHeightAtPosition(startFinishPosition.x, startFinishPosition.z)
    return new THREE.Vector3(startFinishPosition.x, trackY, startFinishPosition.z)
  }
  const initialPosition = getInitialPosition()
  const position = useRef(initialPosition.clone()) // Car position follows track height
  const isInitialized = useRef(false) // Track if car has been initialized on track
  // Initialize rotation to face track direction at start/finish line
  const initialRotation = Math.atan2(startFinishDirection.x, startFinishDirection.z)
  const rotation = useRef(initialRotation) // Y rotation in radians
  const smoothedRotation = useRef(initialRotation) // Smoothed rotation for camera stability
  // CAMERA FIX: Track continuous camera rotation that doesn't wrap at ±π
  // This prevents camera from jumping when rotation crosses the 180°/-180° boundary
  const cameraRotation = useRef(initialRotation) // Continuous rotation for camera (doesn't wrap)
  const lastCameraUpdateRotation = useRef(initialRotation) // Last rotation used for camera (to detect wrap-around)
  const trackPositionUpdateFrame = useRef(0) // Frame counter for track position updates (performance optimization)
  const prevPositionForDistance = useRef<THREE.Vector3 | null>(null) // Previous car position for distance calculation (based on actual movement)
  const cameraLookTarget = useRef(new THREE.Vector3()) // Smoothed camera look target to prevent jitter
  const cachedOnTrack = useRef(true) // Cache last onTrack result to avoid expensive checks every frame
  // PERFORMANCE: Removed cachedHeight and cachedHeightPosition - track is flat, so height is constant
  
  // Reusable Vector3 objects to prevent memory leaks (created once, reused every frame)
  const forwardRef = useRef(new THREE.Vector3(0, 0, -1))
  const worldUpRef = useRef(new THREE.Vector3(0, 1, 0))
  const newPositionRef = useRef(new THREE.Vector3())
  const pushDirectionRef = useRef(new THREE.Vector3())
  const perpDirectionRef = useRef(new THREE.Vector3())
  const toCarRef = useRef(new THREE.Vector3())
  const cameraOffsetRef = useRef(new THREE.Vector3())
  const cameraTargetRef = useRef(new THREE.Vector3())
  const lastCameraTarget = useRef(new THREE.Vector3(0, 8, 20)) // For targetsmooth camera mode
  const prevCameraMode = useRef<CameraMode | undefined>(undefined) // Track previous camera mode to reset on change
  const startPositionRef = useRef(new THREE.Vector3(0, 0.1, 0)) // For isOnTrack check
  // Reusable Vector3 objects for collision detection (prevent memory leaks)
  const tempVec1Ref = useRef(new THREE.Vector3())
  const tempVec2Ref = useRef(new THREE.Vector3())
  const tempVec3Ref = useRef(new THREE.Vector3())
  const tempVec4Ref = useRef(new THREE.Vector3())
  // Reusable Vector3 objects for advertising board collision detection
  const boardMidPointRef = useRef(new THREE.Vector3())
  const boardPointRef = useRef(new THREE.Vector3())
  const prevBoardPointRef = useRef(new THREE.Vector3())
  const nearestPointRef = useRef(new THREE.Vector3())
  const curvePointRef2 = useRef(new THREE.Vector3())
  const curveTangentRef = useRef(new THREE.Vector3())
  const perpDirRef = useRef(new THREE.Vector3())
  const offsetDirRef = useRef(new THREE.Vector3())
  const boardTangentRef = useRef(new THREE.Vector3()) // Board tangent for sliding
  const slidingAlongBoardRef = useRef(false) // Flag to indicate sliding along board
  const spawnTangentRef = useRef(new THREE.Vector3()) // Reusable tangent for spawn position rotation calculation
  
  // Update position when spawnPosition changes (e.g., when joining game)
  // Only update ONCE when spawnPosition is first set - don't reset if car has moved
  const hasAppliedSpawnPosition = useRef(false)
  useEffect(() => {
    applyVehicleSpawnPositionOnce({
      spawnPosition,
      hasAppliedSpawnPosition,
      trackCurve,
      position,
      rotation,
      smoothedRotation,
      vehicle: carRef.current,
      getHeightAtPosition,
      createPosition: (x, y, z) => new THREE.Vector3(x, y, z),
      findTrackPosition,
      spawnTangent: spawnTangentRef,
      cameraRotation,
      lastCameraUpdateRotation
    })
  }, [spawnPosition, trackCurve])
  const speed = useRef(0)
  const velocity = useRef(new THREE.Vector3(0, 0, 0))
  
  // Camera stability refs for smooth movement (quaternion removed - using lookAt instead)
  
  // Distance tracking along track
  const totalDistanceTraveled = useRef(0) // Total meters traveled
  const lastTrackT = useRef<number | null>(null) // Last position along track (0-1)
  const lastLapTime = useRef<number | null>(null) // Time when last lap started
  const lastLapDistance = useRef(0) // Distance traveled when last lap was completed
  const hasCrossedStartLine = useRef(false) // Track if we've crossed start line (to prevent duplicate detections)
  const isOnStartLine = useRef(true) // Track if we're currently over the start line (starts true since car spawns at start)
  const lapTimeUpdateFrameCounter = useRef(0) // Throttle timer updates to every 6 frames (~10 updates/sec at 60fps)
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
    onVehicleLoaded: onCarLoaded,
    onLoaded: () => {
      onPositionUpdate?.(position.current, rotation.current, speed.current)
    }
  })
  
  useVehicleStatusCallback({
    gameStatus,
    targetStatus: 'countdown',
    onStatusReached: onPositionUpdate
      ? () => onPositionUpdate(position.current, rotation.current, speed.current)
      : undefined
  })
  
  useReportedSpawnPosition({
    spawnPosition,
    positionRef: position,
    rotationRef: rotation,
    speedRef: speed,
    getHeightAtPosition,
    onPositionUpdate
  })

  const trackQueries = useMemo(() => createIndexedTrackQueries({
    trackIndex: { gridSize: GRID_SIZE, samples: trackSamples, hash: spatialHash },
    config: trackRuntimeConfig.proximity,
    startPosition: startPositionRef.current
  }), [])
  const { isOnTrack, isNearTrack, findTrackPosition } = trackQueries

  useCarKeyboardControls({
    keys,
    gameStatus,
    isSoundEnabled,
    gasAudio,
    speed,
    isGasSoundPlaying,
    onGasPressed,
    onGasReleased,
    onGasPlayError: err => logRacingDiagnostic('Gas sound play failed:', err)
  })

  // Reset lap tracking and car position when starting a new race
  // NOTE: isManualCamera is NOT in dependencies - we don't want to reset car when camera mode changes
  useEffect(() => {
    if (gameStatus === 'racing') {
      // Reset car to start/finish line
      const trackY = getHeightAtPosition(startFinishPosition.x, startFinishPosition.z)
      resetVehiclePoseRefs({
        position,
        x: startFinishPosition.x,
        y: trackY,
        z: startFinishPosition.z,
        rotation,
        rotationRadians: initialRotation,
        smoothedRotation,
        cameraRotation,
        lastCameraUpdateRotation,
        speed,
        vehicle: carRef.current
      })
    } else if (gameStatus === 'countdown') {
      // Reset car to start/finish line during countdown
      const trackY = getHeightAtPosition(startFinishPosition.x, startFinishPosition.z)
      resetVehiclePoseRefs({
        position,
        x: startFinishPosition.x,
        y: trackY,
        z: startFinishPosition.z,
        rotation,
        rotationRadians: initialRotation,
        smoothedRotation,
        cameraRotation,
        lastCameraUpdateRotation,
        speed,
        vehicle: carRef.current
      })
    }
    resetLapCountersForGameStatus({
      gameStatus,
      refs: {
        lastLapTime,
        lastLapDistance,
        hasCrossedStartLine,
        isOnStartLine,
        totalDistanceTraveled,
        prevPositionForDistance
      },
      nowMs: browserRaceClock.nowMs()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStatus]) // Only depend on gameStatus, not isManualCamera

  // Performance monitoring - track frame counts
  const frameCountRef = useRef(0)
  const lastLogTimeRef = useRef(Date.now())
  // PERFORMANCE: Removed heightCalcCountRef - track is flat, so no height calculations needed
  const trackPosCalcCountRef = useRef(0)
  const cameraUpdateCountRef = useRef(0)
  
  useFrame((state, delta) => {
    if (!carRef.current) return
    
    frameCountRef.current++
    const now = Date.now()
    
    // Log performance stats every 5 seconds
    if (now - lastLogTimeRef.current > 5000) {
      const fps = Math.round(frameCountRef.current / ((now - lastLogTimeRef.current) / 1000))
      logRacingDiagnostic(`📊 Performance: FPS=${fps}, TrackT=${lastTrackT.current?.toFixed(3) ?? 'null'}`)
      frameCountRef.current = 0
      trackPosCalcCountRef.current = 0
      cameraUpdateCountRef.current = 0
      lastLogTimeRef.current = now
    }

    // Store gameStatus before any narrowing happens (needed for camera code at end)
    const currentGameStatus = gameStatus
    
    // Update track position (t value) to identify which track section car is on
    // This prevents jumping to overlapping track sections above/below
    // PERFORMANCE: Only update every 10 frames to improve performance significantly
    // CRITICAL: Pass previous T to findTrackPosition to handle wrap-around smoothly at closure
    // 
    // IMPORTANT: Track position (lastTrackT) is ONLY used for:
    // - Height calculation (which track section to use for Y position)
    // - Distance tracking along track
    // - Lap detection
    // 
    // Track position does NOT affect:
    // - Car rotation (rotation.current) - controlled by user input (WASD/arrows)
    // - Movement direction (forwardRef) - based on rotation.current
    // - Camera direction - follows rotation.current
    // 
    // The car's direction is determined SOLELY by user input, not by track position.
    // This ensures the car goes where the player points it, regardless of track position.
    // 
    // MEMORY: Reset frame counter periodically to prevent overflow (every 1000 frames = ~16 seconds at 60fps)
    // PERFORMANCE: Update track position less frequently (every 20 frames instead of 10)
    // Track position is purely informational, so we don't need it every frame
    const trackPositionFrame = advanceTrackPositionFrame(trackPositionUpdateFrame.current, lastTrackT.current !== null)
    trackPositionUpdateFrame.current = trackPositionFrame.frame
    if (trackCurve && trackPositionFrame.shouldUpdateTrackPosition) {
      trackPosCalcCountRef.current++
      const currentTrackT = findTrackPosition(position.current, trackCurve, lastTrackT.current ?? undefined)

      // CRITICAL: Track position (t) is PURELY INFORMATIONAL
      // It does NOT control car movement, rotation, or camera direction
      // Car goes where user wants - track position is just for display/info
      // Distance is tracked directly from car movement, not from track position
      
      // SAFETY: Validate track position - must be between 0 and 1
      if (!isFinite(currentTrackT) || currentTrackT < 0 || currentTrackT > 1) {
        // Invalid track position - use previous value or default
        if (lastTrackT.current === null || !isFinite(lastTrackT.current) || lastTrackT.current < 0 || lastTrackT.current > 1) {
          lastTrackT.current = 0 // Default to start
        }
        // Don't update - keep previous valid value
      } else {
        // SIMPLIFIED: Just update track position - no restrictions, no backward jump prevention
        // Track position is informational only - it doesn't matter if it jumps backward
        // Car movement is independent - user controls direction, distance is tracked from actual movement
        lastTrackT.current = currentTrackT
      }
    }
    
    // ALWAYS update car to track height - force it to stay on track
    // PERFORMANCE: Track is flat (y=0), so height is constant - no expensive calculations needed
    // Track is always at the shared flat vehicle ride height, so just use constant value
    // This eliminates hundreds of expensive getTrackHeightAndInfluence calls per second
    const targetTrackHeight = getFlatVehicleTargetHeight(FLAT_CAR_MODEL_HEIGHT_OFFSET)
    
    // FIXED: More aggressive snapping to prevent floating
    // If car is way above track, snap it down immediately (no lerp)
    if (position.current.y > targetTrackHeight + 1.0) {
      position.current.y = targetTrackHeight
      isInitialized.current = true
    } else if (!isInitialized.current) {
      // On first frame, ensure car is at start/finish line position and track height
      if (!spawnPosition) {
        // If no spawn position, use start/finish line
        position.current.x = startFinishPosition.x
        position.current.z = startFinishPosition.z
        rotation.current = initialRotation
        // CRITICAL: Also reset camera rotation refs to match car rotation
        cameraRotation.current = initialRotation
        lastCameraUpdateRotation.current = initialRotation
      }
      position.current.y = targetTrackHeight
      isInitialized.current = true
    } else {
      // Car is slightly floating - pull it down quickly
      position.current.y = resolveVehicleSurfaceY({
        currentY: position.current.y,
        targetY: targetTrackHeight,
        deltaSeconds: delta
      })
    }
    
    // Only allow movement when racing (countdown must complete first)
    const canMove = canAdvanceCarFrame(gameStatus)
    if (!canMove) {
      // During countdown or loading, apply friction to stop any existing movement
      speed.current = getInactiveCarSpeed({ gameStatus, speed: speed.current })
      // Force car to track height even when not moving
      position.current.y = targetTrackHeight
      return
    }

    // Check if on track - pass current track position for better closure handling
    // PERFORMANCE: Only check every 5 frames to reduce expensive binary search
    // CRITICAL: Don't pass lastTrackT to isOnTrack - it causes issues when track position jumps
    // isOnTrack now uses spatial hash and doesn't depend on track position
    if (shouldRefreshOnTrackState(trackPositionUpdateFrame.current)) {
      cachedOnTrack.current = isOnTrack(position.current, trackCurve)
    }
    const onTrack = cachedOnTrack.current
    
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
      nextPosition: newPositionRef.current,
      boardSliding: {
        isSlidingAlongBoard: slidingAlongBoardRef.current,
        tangent: boardTangentRef.current
      }
    })
    
    newPositionRef.current.y = resolveFlatCarNextPositionY({
      currentY: newPositionRef.current.y,
      currentVehicleY: position.current.y,
      deltaSeconds: delta
    })
    
    const collisionFrame = resolveCarCollisionFrame({
      position: newPositionRef.current,
      speed: speed.current,
      treeTargets: treePositions,
      startingGatePoles,
      players: otherPlayers,
      treeMaxCheckDistance: SHARED_CAR_HANDLING.treeCollisionCheckDistance,
      onTreeCollision: tree => {
        if (totalDistanceTraveled.current > 2900 && totalDistanceTraveled.current < 3200) {
          logRacingDiagnostic(`🌲 TREE COLLISION @${totalDistanceTraveled.current.toFixed(0)}m: tree at (${tree.x.toFixed(1)},${tree.z.toFixed(1)}), car at (${newPositionRef.current.x.toFixed(1)},${newPositionRef.current.z.toFixed(1)})`)
        }
      },
      boardCollision: {
        boards: advertisingBoards,
        boardTangent: boardTangentRef.current,
        scratch: {
          curvePoint: curvePointRef2.current,
          curveTangent: curveTangentRef.current,
          perpDir: perpDirRef.current,
          offsetDir: offsetDirRef.current,
          boardMidPoint: boardMidPointRef.current,
          boardPoint: boardPointRef.current,
          prevBoardPoint: prevBoardPointRef.current,
          nearestPoint: nearestPointRef.current,
          pushDirection: pushDirectionRef.current
        }
      }
    })
    speed.current = collisionFrame.speed
    slidingAlongBoardRef.current = collisionFrame.isSlidingAlongBoard
    
    // Check central mountain collision
    // DISABLED: Track now climbs the mountain, so we shouldn't collide with the mountain "walls"
    // The terrain height function handles the mountain surface support
    /*
    if (!collided && isInsideMountain(newPosition.x, newPosition.z, CAR_RADIUS)) {
      // Collision with mountain - push car away from mountain center
      collided = true
      const dx = newPosition.x - MOUNTAIN_CONFIG.centerX
      const dz = newPosition.z - MOUNTAIN_CONFIG.centerZ
      const distance = Math.sqrt(dx * dx + dz * dz)
      
      if (distance > 0.01) {
        const pushDirection = new THREE.Vector3(dx, 0, dz).normalize()
        // Push to just outside the collision radius (80% of base radius + car radius)
        const collisionRadius = MOUNTAIN_CONFIG.baseRadius * 0.8
        const targetDistance = collisionRadius + CAR_RADIUS + 1.0
        newPosition.x = MOUNTAIN_CONFIG.centerX + pushDirection.x * targetDistance
        newPosition.z = MOUNTAIN_CONFIG.centerZ + pushDirection.z * targetDistance
      }
      
      // Reduce speed on collision
      speed.current *= 0.2
      logRacingDiagnostic('🏔️ Mountain collision! Pushed away from mountain center')
    }
    */
    
    // SAFETY: Validate new position before applying
    if (!isFinite(newPositionRef.current.x) || !isFinite(newPositionRef.current.y) || !isFinite(newPositionRef.current.z)) {
      console.error(`❌ INVALID POSITION DETECTED: (${newPositionRef.current.x}, ${newPositionRef.current.y}, ${newPositionRef.current.z}) - rotation=${rotation.current}, speed=${speed.current}`)
      // Don't update position if invalid - keep previous position
    } else {
      // Only update position if no collision, or use corrected position
      position.current.copy(newPositionRef.current)
    }

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
    
    // Track distance traveled - based on ACTUAL CAR MOVEMENT, not track position
    // CRITICAL: Distance is tracked from car's actual position changes, independent of track
    // Car goes where user wants - we just accumulate distance from movement
    const distanceTracking = updateHorizontalDistanceAccumulator({
      speed: speed.current,
      position: position.current,
      previousPosition: prevPositionForDistance,
      totalDistanceTraveled,
      createPreviousPosition: () => new THREE.Vector3(),
      copyPosition: (target, source) => target.copy(source)
    })
    if (distanceTracking.isTracking) {
      // Lap Detection: Check if we've crossed the start line and traveled enough distance
      if (justEnteredStartLine) {
        attemptLapCompletion({
          trackLength,
          onLapComplete,
          lastLapTime,
          lastLapDistance,
          totalDistanceTraveled,
          hasCrossedStartLine,
          minLapDistanceRatio: trackRuntimeConfig.metadata.lapValidation.minLapDistanceRatio,
          requiresReachedEnd: trackRuntimeConfig.metadata.lapValidation.requiresReachedEnd,
          nowMs: browserRaceClock.nowMs()
        })
      }
      
      finalizeLapDistanceFrame({
        justLeftStartLine,
        hasCrossedStartLine,
        totalDistanceTraveled,
        onDistanceUpdate
      })
    }

    // Update visual timer with current lap time (synchronized with lap recording timer)
    // This ensures the visual timer matches exactly what gets recorded when lap completes
    // MOVED OUTSIDE speed check so timer starts immediately when race starts (not when gas pressed)
    // PERFORMANCE: Throttle to every 6 frames (~10 updates/sec at 60fps) to reduce React re-renders
    notifyLapDisplayUpdate({
      counter: lapTimeUpdateFrameCounter,
      lapStartMs: lastLapTime.current,
      nowMs: browserRaceClock.nowMs(),
      onLapTimeUpdate
    })

    // Update speed display (throttled to reduce React re-renders)
    notifySpeedDisplayUpdate({
      counter: speedUpdateFrameCounter,
      speed: speed.current,
      onSpeedUpdate
    })

    // Notify parent of position update (for OrbitControls target)
    notifyVehiclePositionUpdate({
      position: position.current,
      rotation: rotation.current,
      speed: speed.current,
      onPositionUpdate
    })

    // Camera follows car (third person) - only if not in manual mode
    // PERFORMANCE: Reuse Vector3 objects to prevent memory allocations every frame
    // MEMORY: Added error handling to prevent camera from breaking mid-race
    if (!isManualCamera) {
      cameraUpdateCountRef.current++
      try {
        // During countdown, zoom out to see stoplight and start gate
        // Normal racing: 8 up, 15 back (matching San Luis)
        // Countdown: 8 up, 15 back (same as normal, matching San Luis)
        const cameraDistance = SHARED_CAR_CAMERA.distance

        const cameraAngle = getStableCarRotation(rotation.current, initialRotation)
        rotation.current = cameraAngle

        // Common setup for all camera modes
        const cappedDelta = capCameraDelta(delta)

        // Calculate base camera offset using continuous rotation
        cameraOffsetRef.current.set(0, SHARED_CAR_CAMERA.height, cameraDistance)
        cameraOffsetRef.current.applyAxisAngle(worldUpRef.current, cameraAngle)

        // SAFETY: Validate camera offset
        if (!isFinite(cameraOffsetRef.current.x) || !isFinite(cameraOffsetRef.current.y) || !isFinite(cameraOffsetRef.current.z)) {
          // Reset to safe values
          cameraOffsetRef.current.set(0, SHARED_CAR_CAMERA.height, cameraDistance)
          cameraOffsetRef.current.applyAxisAngle(worldUpRef.current, initialRotation)
        }
        
        // Camera mode-specific calculations
        let basePosition: THREE.Vector3
        
        switch (cameraMode) {
          case 'simple': {
            // Simple linear lerp (original Australia behavior)
            cameraTargetRef.current.copy(position.current).add(cameraOffsetRef.current)

            // SAFETY: Validate camera target
            if (!isFinite(cameraTargetRef.current.x) || !isFinite(cameraTargetRef.current.y) || !isFinite(cameraTargetRef.current.z)) {
              // Fallback: simple offset from car
              cameraTargetRef.current.copy(position.current)
              cameraTargetRef.current.y += SHARED_CAR_CAMERA.height
              cameraTargetRef.current.z += cameraDistance
            }
            
            // Use original Australia smoothing (rate 15)
            const smoothingFactor = getExponentialSmoothingFactor(cappedDelta, SHARED_CAR_CAMERA.simpleSmoothingRate)
            const camPosBefore = camera.position.clone()
            camera.position.lerp(cameraTargetRef.current, smoothingFactor)
            const camPosAfter = camera.position.clone()

            // DEBUG: Log lerp execution in problem area
            const inLerpDebug = totalDistanceTraveled.current > 3050 && totalDistanceTraveled.current < 3250
            if (inLerpDebug && cameraUpdateCountRef.current % 30 === 0) {
              const lerpDist = camPosBefore.distanceTo(camPosAfter)
              logRacingDiagnostic(`🔧 LERP @${totalDistanceTraveled.current.toFixed(0)}m: factor=${smoothingFactor.toFixed(3)}, moved=${lerpDist.toFixed(1)}, delta=${cappedDelta.toFixed(4)}, before=(${camPosBefore.x.toFixed(1)},${camPosBefore.z.toFixed(1)}), after=(${camPosAfter.x.toFixed(1)},${camPosAfter.z.toFixed(1)})`)
            }

            // SAFETY: Validate camera position before lookAt
            if (isFinite(camera.position.x) && isFinite(camera.position.y) && isFinite(camera.position.z) &&
                isFinite(position.current.x) && isFinite(position.current.y) && isFinite(position.current.z)) {
              camera.lookAt(position.current)
            }
            
            // Log camera issues every 300 updates
            if (cameraUpdateCountRef.current % 300 === 0) {
              logRacingDiagnostic(`📹 Camera: pos=(${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}), target=(${position.current.x.toFixed(1)}, ${position.current.y.toFixed(1)}, ${position.current.z.toFixed(1)})`)
            }
            prevCameraMode.current = cameraMode
            return // Early return for simple mode
          }
          
          case 'velocity': {
            // Velocity-based prediction - calculate from forward direction and speed
            // Reuse tempVec1Ref to prevent allocation
            tempVec1Ref.current.set(0, 0, -1)
            // Safety: Validate rotation before applying (use continuous camera angle)
            if (isFinite(cameraAngle)) {
              tempVec1Ref.current.applyAxisAngle(worldUpRef.current, cameraAngle)
            }
            tempVec1Ref.current.multiplyScalar(speed.current)
            tempVec1Ref.current.multiplyScalar(SHARED_CAR_CAMERA.velocityPredictionSeconds)
            // Reuse tempVec2Ref for basePosition to avoid allocation
            basePosition = tempVec2Ref.current.copy(position.current).add(tempVec1Ref.current)
            prevCameraMode.current = cameraMode
            break
          }
          
          case 'targetsmooth': {
            // Smooth the target position itself first
            // Note: rawCameraTarget already includes the offset, so basePosition should be the final target
            // Reuse tempVec1Ref for rawCameraTarget calculation to avoid allocation
            tempVec1Ref.current.copy(position.current).add(cameraOffsetRef.current)
            
            // Safety: Validate tempVec1Ref before using
            if (!isFinite(tempVec1Ref.current.x) || !isFinite(tempVec1Ref.current.y) || !isFinite(tempVec1Ref.current.z)) {
              // Fallback to simple offset if calculation failed
              tempVec1Ref.current.copy(position.current)
              tempVec1Ref.current.y += SHARED_CAR_CAMERA.height
              tempVec1Ref.current.z += cameraDistance
            }
            
            // Reset lastCameraTarget if camera mode changed or if it's too far from the car (safety check)
            if (prevCameraMode.current !== cameraMode) {
              // Camera mode changed - reset to current target
              lastCameraTarget.current.copy(tempVec1Ref.current)
              prevCameraMode.current = cameraMode
            } else {
              // Safety check: if lastCameraTarget is too far from rawCameraTarget, reset it
              // Allow wider range (up to 25 units) but reset if beyond that to prevent losing the car
              // This allows targetsmooth to go outside normal distance constraints (10-20) for smoother following
              const distanceToRaw = lastCameraTarget.current.distanceTo(tempVec1Ref.current)
              if (shouldResetTargetSmoothCamera(distanceToRaw)) {
                // Camera target is way too far or invalid - reset to current target
                warnRacingDiagnostic('⚠️ Targetsmooth camera target too far or invalid, resetting')
                lastCameraTarget.current.copy(tempVec1Ref.current)
              }
            }
            
            // Use slightly faster smoothing (rate 5 instead of 4) for better responsiveness in Australia
            const targetSmoothing = getExponentialSmoothingFactor(cappedDelta, SHARED_CAR_CAMERA.targetSmoothTargetRate)
            lastCameraTarget.current.lerp(tempVec1Ref.current, targetSmoothing)
            // For targetsmooth, basePosition is already the final camera target (includes offset)
            // So we'll skip adding the offset again after the switch
            // Reuse tempVec2Ref for basePosition to avoid allocation
            basePosition = tempVec2Ref.current.copy(lastCameraTarget.current)
            prevCameraMode.current = cameraMode
            break
          }
          
          case 'smooth':
          case 'damped':
          default: {
            // Base smooth mode (or default)
            // Reuse tempVec4Ref for basePosition to avoid allocation
            basePosition = tempVec4Ref.current.copy(position.current)
            prevCameraMode.current = cameraMode
            break
          }
        }
        
        // Calculate camera target from base position
        // For targetsmooth mode, basePosition already includes the offset, so don't add it again
        if (cameraMode === 'targetsmooth') {
          cameraTargetRef.current.copy(basePosition)
        } else {
          cameraTargetRef.current.copy(basePosition).add(cameraOffsetRef.current)
        }
        
        // SAFETY: Validate camera target
        if (!isFinite(cameraTargetRef.current.x) || !isFinite(cameraTargetRef.current.y) || !isFinite(cameraTargetRef.current.z)) {
          // Fallback: simple offset from car
          cameraTargetRef.current.copy(position.current)
          cameraTargetRef.current.y += SHARED_CAR_CAMERA.height
          cameraTargetRef.current.z += cameraDistance
        }
        
        // Distance constraints (for all modes except simple and targetsmooth)
        // Note: 'simple' mode returns early, so this code only runs for other modes
        // Note: 'targetsmooth' already smooths the target, so distance constraints interfere with it
        // Matching San Luis constraints
        if (cameraMode !== 'targetsmooth') {
          const currentDistance = camera.position.distanceTo(position.current)
          const minDistance = SHARED_CAR_CAMERA.minDistance
          const maxDistance = SHARED_CAR_CAMERA.maxDistance

          if (currentDistance < minDistance || currentDistance > maxDistance) {
            // Reuse tempVec3Ref for direction calculation to prevent allocation
            tempVec3Ref.current.copy(cameraTargetRef.current).sub(position.current)
            // Safety check: if direction is invalid (zero length), use forward direction instead
            if (tempVec3Ref.current.lengthSq() < 0.01) {
              // Camera target is at car position - use forward direction as fallback
              tempVec3Ref.current.copy(forwardRef.current).multiplyScalar(-1) // Camera is behind car
            }
            tempVec3Ref.current.normalize()
            const clampedDistance = clampCameraDistance(currentDistance)
            cameraTargetRef.current.copy(position.current).add(tempVec3Ref.current.multiplyScalar(clampedDistance))
          }
        }
        
        // Exponential smoothing (rate depends on mode)
        // For targetsmooth, use rate 8 (same as smooth) since target is already smoothed
        const smoothingRate = getCarCameraSmoothingRate(cameraMode)
        const smoothingFactor = getExponentialSmoothingFactor(cappedDelta, smoothingRate)

        // Apply smoothing to camera position
        camera.position.lerp(cameraTargetRef.current, smoothingFactor)

        // SAFETY: Validate camera position before lookAt
        if (isFinite(camera.position.x) && isFinite(camera.position.y) && isFinite(camera.position.z) &&
            isFinite(position.current.x) && isFinite(position.current.y) && isFinite(position.current.z)) {
          camera.lookAt(position.current)
        }
      } catch (error) {
        // Silent error handling - camera will continue from last valid position
      }
    }
  })

  return (
    <group ref={carRef} position={[0, 0, 0]}>
      <group ref={foxRef}>
        {/* Car Body */}
        <group rotation={[0, Math.PI, 0]}>
          {/* Car Body - Bottom Floor */}
          <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[2, 0.1, 3.8]} />
            <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
          </mesh>
          
          {/* Left Side */}
          <mesh position={[-0.9, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.2, 0.4, 2.0]} />
            <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
          </mesh>
          
          {/* Right Side */}
          <mesh position={[0.9, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.2, 0.4, 2.0]} />
            <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
          </mesh>
          
          {/* Front Nose */}
          <mesh position={[0, 0.55, 1.4]} castShadow receiveShadow>
            <boxGeometry args={[2, 0.7, 1.0]} />
            <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
          </mesh>
          
          {/* Back Trunk */}
          <mesh position={[0, 0.55, -1.4]} castShadow receiveShadow>
            <boxGeometry args={[2, 0.7, 1.0]} />
            <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
          </mesh>

          {/* Spoiler */}
          <mesh position={[0, 1.4, -1.6]} castShadow>
            <boxGeometry args={[2.4, 0.1, 0.6]} />
            <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[-0.8, 0.9, -1.6]} castShadow>
            <boxGeometry args={[0.1, 0.8, 0.3]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[0.8, 0.9, -1.6]} castShadow>
            <boxGeometry args={[0.1, 0.8, 0.3]} />
            <meshStandardMaterial color="#111" />
          </mesh>

          {/* Front Left Wheel */}
          <group position={[-1.1, 0.3, 1.2]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.4, 0.4, 0.4, 16]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            <mesh position={[-0.21, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.15, 0.15, 0.05, 16]} />
              <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
            </mesh>
          </group>
          
          {/* Front Right Wheel */}
          <group position={[1.1, 0.3, 1.2]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.4, 0.4, 0.4, 16]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            <mesh position={[0.21, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.15, 0.15, 0.05, 16]} />
              <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
            </mesh>
          </group>
          
          {/* Rear Left Wheel */}
          <group position={[-1.1, 0.3, -1.2]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.45, 0.45, 0.5, 16]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            <mesh position={[-0.26, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.18, 0.18, 0.05, 16]} />
              <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
            </mesh>
          </group>
          
          {/* Rear Right Wheel */}
          <group position={[1.1, 0.3, -1.2]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.45, 0.45, 0.5, 16]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            <mesh position={[0.26, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.18, 0.18, 0.05, 16]} />
              <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
            </mesh>
          </group>

          {/* Windshield */}
          <mesh position={[0, 1.0, 1.4]} rotation={[-0.4, 0, 0]}>
            <boxGeometry args={[1.8, 0.6, 0.1]} />
            <meshPhysicalMaterial
              color="#aaf"
              transmission={0.5}
              opacity={0.5}
              transparent
              roughness={0}
            />
          </mesh>

          {/* Voxel Fox Driver - positioned to be visible in driver seat */}
          <group position={[0, 0.5, 0.2]} scale={1.0}>
            <VoxelFox
              position={[0, 0, 0]}
              rotation={[0, -Math.PI / 2, 0]}
              foxTextureUrl={getOrdinalContentUrl(foxOriginOutpoint) || undefined}
              color={playerColor}
              message={localChatMessage?.text}
              messageTime={localChatMessage?.timestamp}
            />
          </group>
        </group>
      </group>
    </group>
  )
}
