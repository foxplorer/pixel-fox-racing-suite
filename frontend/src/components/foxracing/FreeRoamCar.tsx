import React, { useRef, useEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { VoxelBackgroundRemovalStrategy } from '../voxelization/voxelBackgroundStrategy'
import { logRacingDiagnostic, warnRacingDiagnostic } from '../../racing/debug/diagnostics'
import carOnGas from '../../assets/car-on-gas.mp3'
import explosionSound from '../../assets/explosion.mp3'
import { GameStatus } from './FoxRacingGame'
import { spatialHash, trackSamples, GRID_SIZE, startFinishPosition, startFinishDirection } from './TrackData'
import { createIndexedTrackQueries } from '../../racing/core/indexedTrackQueries'
import { createStartGate, updateStartGateState } from '../../racing/core/startGate'
import {
  attemptLapCompletion,
  finalizeLapDistanceFrame,
  updateDirectionalLapProgressAccumulator,
  type TrackDirection
} from '../../racing/simulation/lapTiming'
import { browserRaceClock } from '../../racing/simulation/raceClock'
import { updateHorizontalDistanceAccumulator } from '../../racing/simulation/distanceTracking'
import { notifyLapDisplayUpdate, notifySpeedDisplayUpdate } from '../../racing/simulation/displayUpdates'
import { resetLapCountersForGameStatus } from '../../racing/simulation/lapCounterReset'
import { advanceTrackPositionFrame, shouldRefreshOnTrackState } from '../../racing/simulation/trackFrameCadence'
import { getTrackRuntimeConfig } from '../../racing/tracks/trackRuntimeConfig'
import { createPreloadedAudio, playAudioElement } from '../../racing/components/audioElements'
import { applyVehicleSpawnPositionOnce, commitVehiclePose, notifyManualCameraControlUsed, notifyVehiclePositionUpdate, resetVehiclePoseRefs } from '../../racing/components/vehicleFrameCallbacks'
import { getCarSurfaceVisualY, SHARED_CAR_OFF_TRACK_BOUNCE } from '../../racing/vehicles/carBounce'
import {
  capCameraDelta,
  clampCameraDistanceForZone,
  findCarCameraZoneForTrackT,
  getCarCameraSmoothingRate,
  getExponentialSmoothingFactor,
  shouldResetTargetSmoothCamera,
  SHARED_CAR_CAMERA,
  type CarCameraZoneConfig
} from '../../racing/vehicles/carCamera'
import type { RacingAdvertisingBoard } from '../../racing/vehicles/carBoardCollision'
import { resolveCarCollisionFrame } from '../../racing/vehicles/carCollisionFrame'
import { advanceCarJump, createCarJumpState, findActiveCarJumpZone, CAR_JUMP_MIN_LAUNCH_SPEED, type CarJumpZone } from '../../racing/vehicles/carJump'
import { isCarRampLipLaunchTransition, rampHeightAbove, resolveCarRampSideCollision, type CarRampZone } from '../../racing/vehicles/carRamp'
import { isCarOverLava, type CarLavaHazard } from '../../racing/vehicles/carLavaHazard'
import { advanceLavaDeath, applyVehicleHeatTint, createLavaDeathState, resetLavaDeathState } from '../../racing/vehicles/carLavaDeath'
import { CarLavaExplosion } from '../../racing/components/CarLavaExplosion'
import { advanceCarTerrainContact, createCarTerrainContactState } from '../../racing/vehicles/carTerrainContact'
import { updateCarGasAudio } from '../../racing/vehicles/carGasAudio'
import { advanceCarControlFrame, advanceCarMovementFrame, canAdvanceCarFrame, getCarForwardVector, getInactiveCarSpeed, getStableCarRotation, isAnyCarControlActive, SHARED_CAR_HANDLING } from '../../racing/vehicles/carHandling'
import { useCarKeyboardControls } from '../../racing/vehicles/useCarKeyboardControls'
import { FLAT_CAR_MODEL_HEIGHT_OFFSET, getFlatVehicleHeightAtPosition, getSafeVehicleTargetHeight, getVehicleVisualTilt, resolveVehicleSurfaceY, smoothVehicleVisualTilt } from '../../racing/vehicles/vehicleElevation'
import { applyVehicleVisualSurfaceFrameRotation, createVehicleVisualSurfaceFrameScratch } from '../../racing/vehicles/vehicleVisualSurfaceFrame'
import { collectFirstNearbyItem } from '../../racing/collectibles/collectiblePickup'
import { useReportedSpawnPosition, useVehicleLoadedNotification, useVehicleStatusCallback } from '../../racing/components/useVehicleLoadedNotification'
import { CarTrackVehicleModel } from '../../racing/components/CarTrackVehicleModel'
import type { RacingQualityPresetId } from '../../racing/performance/qualitySettings'
import type { RacingGameCollectibleItem as GameItem } from '../../racing/collectibles/collectibleTypes'
import type { RacingWorldPlayerCollisionTarget } from '../../racing/multiplayer/worldPlayers'
import type { SpatialTrackIndex } from '../../racing/core/spatialTrackIndex'
import type { TrackLapValidationMetadata } from '../../racing/tracks/trackMetadata'

const trackRuntimeConfig = getTrackRuntimeConfig('australia')
const CAR_VISUAL_HEIGHT_OFFSET = SHARED_CAR_OFF_TRACK_BOUNCE.groundHeight - getFlatVehicleHeightAtPosition(0, 0)
const SLOPE_SAMPLE_DISTANCE = 14
const CAR_MODEL_TERRAIN_PITCH_SCALE = 1.75
const CAR_MODEL_TERRAIN_ROLL_SCALE = 2.4

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
  cameraZones?: CarCameraZoneConfig[]
  trackCurve?: THREE.CatmullRomCurve3
  trackLength?: number
  spatialTrackIndex?: SpatialTrackIndex
  startFinishPosition?: THREE.Vector3
  startFinishDirection?: THREE.Vector3
  lapCrossing?: Parameters<typeof createStartGate>[2]
  lapValidation?: Pick<TrackLapValidationMetadata, 'minLapDistanceRatio' | 'requiresReachedEnd'>
  getHeightAtPosition?: (x: number, z: number, currentY?: number, trackT?: number) => number
  treePositions?: Array<{ x: number; z: number; scale: number; radius: number }>
  startingGatePoles?: Array<{ x: number; z: number; radius: number }>
  /** Opt-in launch zones (e.g. lava pits). Empty/omitted = no jump behavior. */
  jumpZones?: CarJumpZone[]
  /** Opt-in raised ramp surfaces the car climbs (e.g. lava-pit ramps). Empty/omitted = flat ground. */
  rampZones?: CarRampZone[]
  /** Opt-in molten regions that destroy the car on contact (e.g. lava). Omitted = no hazard. */
  lavaHazard?: CarLavaHazard
  /** Fired once the burn-up sequence finishes, to switch the game into its crashed state. */
  onCrash?: () => void
  advertisingBoards?: RacingAdvertisingBoard[]
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
  cameraZones = [],
  trackCurve,
  trackLength,
  spatialTrackIndex,
  startFinishPosition: providedStartFinishPosition = startFinishPosition,
  startFinishDirection: providedStartFinishDirection = startFinishDirection,
  lapCrossing = trackRuntimeConfig.lapCrossing,
  lapValidation = trackRuntimeConfig.metadata.lapValidation,
  getHeightAtPosition = getFlatVehicleHeightAtPosition,
  treePositions = [],
  startingGatePoles = [],
  jumpZones = [],
  rampZones = [],
  lavaHazard,
  onCrash,
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
  const [headlightsEnabled, setHeadlightsEnabled] = useState(false)
  const headlightsEnabledRef = useRef(false)
  const carVisualRef = useRef<THREE.Group>(null)

  // Lava burn-up death sequence (Volcanoes): alive → red-hot → explode → game over.
  const lavaDeathRef = useRef(createLavaDeathState())
  const lavaExplosionStartedRef = useRef(false)
  const [showLavaExplosion, setShowLavaExplosion] = useState(false)

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
    const trackY = getHeightAtPosition(providedStartFinishPosition.x, providedStartFinishPosition.z)
    return new THREE.Vector3(providedStartFinishPosition.x, trackY, providedStartFinishPosition.z)
  }
  const initialPosition = getInitialPosition()
  const position = useRef(initialPosition.clone()) // Car position follows track height
  const isInitialized = useRef(false) // Track if car has been initialized on track
  // Initialize rotation to face track direction at start/finish line
  const initialRotation = Math.atan2(providedStartFinishDirection.x, providedStartFinishDirection.z)
  const rotation = useRef(initialRotation) // Y rotation in radians
  const smoothedRotation = useRef(initialRotation) // Smoothed rotation for camera stability
  const trackPositionUpdateFrame = useRef(0) // Frame counter for track position updates (performance optimization)
  const prevPositionForDistance = useRef<THREE.Vector3 | null>(null) // Previous car position for distance calculation (based on actual movement)
  const cameraLookTarget = useRef(new THREE.Vector3()) // Smoothed camera look target to prevent jitter
  const cachedOnTrack = useRef(true) // Cache last onTrack result to avoid expensive checks every frame
  const visualPitch = useRef(0)
  const visualRoll = useRef(0)
  const visualSurfaceFrameScratch = useRef(createVehicleVisualSurfaceFrameScratch())
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
  const startPositionRef = useRef(providedStartFinishPosition.clone()) // For isOnTrack check
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
  const jumpStateRef = useRef(createCarJumpState()) // Vertical arc state for lava-pit jumps (no-op when jumpZones empty)
  const terrainContactStateRef = useRef(createCarTerrainContactState()) // Generic cliff/drop-off gravity state
  
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
      spawnTangent: spawnTangentRef
    })
  }, [spawnPosition, trackCurve])
  const speed = useRef(0)
  const velocity = useRef(new THREE.Vector3(0, 0, 0))
  
  // Camera stability refs for smooth movement (quaternion removed - using lookAt instead)
  
  // Distance tracking along track
  const totalDistanceTraveled = useRef(0) // Total meters traveled
  const lastTrackT = useRef<number | null>(null) // Last position along track (0-1)
  const maxLapProgress = useRef<number | null>(null)
  const lastLapProgress = useRef<number | null>(null)
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
  const lavaExplosionAudio = useMemo(() => {
    return createPreloadedAudio(explosionSound, { volume: 0.75, loop: false })
  }, [])
  const isGasSoundPlaying = useRef(false)
  
  useVehicleLoadedNotification({
    gameStatus,
    vehicleRef: carRef,
    onVehicleLoaded: onCarLoaded,
    onLoaded: () => {
      onPositionUpdate?.(position.current, rotation.current, speed.current, headlightsEnabledRef.current)
    }
  })
  
  useVehicleStatusCallback({
    gameStatus,
    targetStatus: 'countdown',
    onStatusReached: onPositionUpdate
      ? () => onPositionUpdate(position.current, rotation.current, speed.current, headlightsEnabledRef.current)
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
    trackIndex: spatialTrackIndex || { gridSize: GRID_SIZE, samples: trackSamples, hash: spatialHash },
    config: trackRuntimeConfig.proximity,
    startPosition: providedStartFinishPosition
  }), [providedStartFinishPosition, spatialTrackIndex])
  const { isOnTrack, isNearTrack, findTrackPosition } = trackQueries
  const lapProgressRuntime = useMemo(() => {
    const startTrackT = findTrackPosition(providedStartFinishPosition, trackCurve)
    const tangent = trackCurve?.getTangentAt(startTrackT).normalize()
    const direction: TrackDirection = tangent && tangent.dot(providedStartFinishDirection) < 0 ? -1 : 1

    return { startTrackT, direction }
  }, [findTrackPosition, providedStartFinishDirection, providedStartFinishPosition, trackCurve])

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

  // Reset lap tracking and car position when starting a new race
  // NOTE: isManualCamera is NOT in dependencies - we don't want to reset car when camera mode changes
  useEffect(() => {
    // Clear any lava burn-up state whenever we leave the crashed screen for a fresh
    // race, restoring the car's normal look and visibility.
    if (gameStatus !== 'crashed') {
      resetLavaDeathState(lavaDeathRef.current)
      lavaExplosionStartedRef.current = false
      setShowLavaExplosion(false)
      applyVehicleHeatTint(carVisualRef.current, 0)
      if (carVisualRef.current) carVisualRef.current.visible = true
    }
    if (gameStatus === 'racing') {
      // Reset car to start/finish line
      const trackY = getHeightAtPosition(providedStartFinishPosition.x, providedStartFinishPosition.z)
      resetVehiclePoseRefs({
        position,
        x: providedStartFinishPosition.x,
        y: trackY,
        z: providedStartFinishPosition.z,
        rotation,
        rotationRadians: initialRotation,
        smoothedRotation,
        speed,
        vehicle: carRef.current
      })
      visualPitch.current = 0
      visualRoll.current = 0
      carVisualRef.current?.rotation.set(0, 0, 0)
    } else if (gameStatus === 'countdown') {
      // Reset car to start/finish line during countdown
      const trackY = getHeightAtPosition(providedStartFinishPosition.x, providedStartFinishPosition.z)
      resetVehiclePoseRefs({
        position,
        x: providedStartFinishPosition.x,
        y: trackY,
        z: providedStartFinishPosition.z,
        rotation,
        rotationRadians: initialRotation,
        smoothedRotation,
        speed,
        vehicle: carRef.current
      })
      visualPitch.current = 0
      visualRoll.current = 0
      carVisualRef.current?.rotation.set(0, 0, 0)
    }
    resetLapCountersForGameStatus({
      gameStatus,
      refs: {
        lastLapTime,
        lastLapDistance,
        hasCrossedStartLine,
        isOnStartLine,
        totalDistanceTraveled,
        prevPositionForDistance,
        maxTrackT: maxLapProgress
      },
      nowMs: browserRaceClock.nowMs()
    })
    lastLapProgress.current = null
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
      logRacingDiagnostic(`📊 Performance Stats (last 5s): FPS=${fps}, TrackPosCalcs=${trackPosCalcCountRef.current}, CameraUpdates=${cameraUpdateCountRef.current}, TrackT=${lastTrackT.current?.toFixed(3) ?? 'null'}`)
      frameCountRef.current = 0
      trackPosCalcCountRef.current = 0
      cameraUpdateCountRef.current = 0
      lastLogTimeRef.current = now
    }
    
    // Store gameStatus before any narrowing happens (needed for camera code at end)
    const currentGameStatus = gameStatus

    // --- Lava burn-up death (opt-in via lavaHazard, e.g. Volcanoes). On contact the
    // car/fox glow red-hot, then explode, then the game switches to its crashed
    // (game-over) screen. A successful jump is never a death: skip while airborne, or
    // while sitting in a pit zone with enough speed to launch out of it.
    const aboutToLaunchOverPit =
      lavaDeathRef.current.phase === 'alive' &&
      jumpStateRef.current.armed &&
      Math.abs(speed.current) >= CAR_JUMP_MIN_LAUNCH_SPEED &&
      findActiveCarJumpZone(position.current.x, position.current.z, jumpZones) !== null
    // Plain terrain height under the car (no ramp lift — ramps flank the pits, not
    // the central lake). Lets the lake hazard ignore rock that pokes above the
    // buried lava sheet so the car only burns over visible lava.
    const lavaGroundY = getHeightAtPosition(position.current.x, position.current.z)
    const overLava =
      currentGameStatus === 'racing' &&
      !jumpStateRef.current.airborne &&
      !aboutToLaunchOverPit &&
      isCarOverLava(position.current.x, position.current.z, lavaHazard, {
        groundY: lavaGroundY,
        vehicleY: position.current.y
      })
    const lavaDeath = advanceLavaDeath({
      state: lavaDeathRef.current,
      overLava,
      nowSeconds: state.clock.elapsedTime
    })
    const lavaFrozen = lavaDeath.phase !== 'alive'
    if (lavaFrozen) {
      speed.current = 0
      applyVehicleHeatTint(carVisualRef.current, lavaDeath.heat)
    }
    if ((lavaDeath.phase === 'exploding' || lavaDeath.phase === 'dead') && carVisualRef.current) {
      carVisualRef.current.visible = false
    }
    if (lavaDeath.phase === 'exploding' && !lavaExplosionStartedRef.current) {
      lavaExplosionStartedRef.current = true
      setShowLavaExplosion(true)
      if (isSoundEnabled) {
        playAudioElement(lavaExplosionAudio, { reset: true, errorMessage: 'Lava explosion sound failed:' })
      }
    }
    if (lavaDeath.justFinished) onCrash?.()

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
      
      // Log track position issues every 100 calculations
      if (trackPosCalcCountRef.current % 100 === 0) {
        logRacingDiagnostic(`📍 Track Position: t=${currentTrackT.toFixed(3)}, lastT=${lastTrackT.current?.toFixed(3) ?? 'null'}, pos=(${position.current.x.toFixed(1)}, ${position.current.z.toFixed(1)})`)
      }
      
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
        updateDirectionalLapProgressAccumulator({
          currentTrackT,
          startTrackT: lapProgressRuntime.startTrackT,
          direction: lapProgressRuntime.direction,
          lastLapProgress,
          maxLapProgress,
          isNearTrack: isNearTrack(position.current, trackCurve)
        })
        lastTrackT.current = currentTrackT
      }
    }
    
    // ALWAYS update car to track height - force it to stay on track
    // PERFORMANCE: Track is flat (y=0), so height is constant - no expensive calculations needed
    // Track is always at the shared flat vehicle ride height, so just use constant value
    // This eliminates hundreds of expensive getTrackHeightAndInfluence calls per second
    // Height the car is rendering at coming into this frame (before surface follow
    // overwrites it). At the moment of a jump launch this still holds the ramp-lip
    // height, which the jump uses as the launch start so the car pops off the kicker.
    const preFrameVehicleY = position.current.y

    // Ramp-aware ground sampler: plain terrain plus any raised launch-ramp surface
    // (no-op off-volcano, where rampZones is empty). Used for ride height, slope,
    // next position and visual surface so the car physically climbs and pitches up
    // the ramp before the jump zone launches it at the lip.
    const sampleGroundHeight = (x: number, z: number, currentY?: number, trackT?: number) =>
      getHeightAtPosition(x, z, currentY, trackT) + rampHeightAbove(x, z, rampZones)

    const targetTrackHeight = getSafeVehicleTargetHeight({
      sampledSurfaceHeight: sampleGroundHeight(
        position.current.x,
        position.current.z,
        position.current.y,
        lastTrackT.current ?? undefined
      ),
      currentVehicleY: position.current.y,
      vehicleHeightOffset: FLAT_CAR_MODEL_HEIGHT_OFFSET,
      minSurfaceHeight: -1000
    })
    
    // FIXED: More aggressive snapping to prevent floating
    // If car is way above track, snap it down immediately (no lerp)
    // While airborne, skip surface snapping so gravity/jump arcs are preserved.
    if (jumpStateRef.current.airborne || terrainContactStateRef.current.airborne) {
      // Vertical position is owned by the airborne integrator this frame.
    } else if (position.current.y > targetTrackHeight + 1.0) {
      position.current.y = targetTrackHeight
      isInitialized.current = true
    } else if (!isInitialized.current) {
      // On first frame, ensure car is at start/finish line position and track height
      if (!spawnPosition) {
        // If no spawn position, use start/finish line
        position.current.x = providedStartFinishPosition.x
        position.current.z = providedStartFinishPosition.z
        rotation.current = initialRotation
        
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
    const canMove = canAdvanceCarFrame(gameStatus) && !lavaFrozen
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
    
    const slopeForward = getCarForwardVector(rotation.current)
    const currentSlopeHeight = sampleGroundHeight(
      position.current.x,
      position.current.z,
      position.current.y,
      lastTrackT.current ?? undefined
    )
    const sampledForwardHeight = sampleGroundHeight(
      position.current.x + slopeForward.x * SLOPE_SAMPLE_DISTANCE,
      position.current.z + slopeForward.z * SLOPE_SAMPLE_DISTANCE,
      position.current.y,
      lastTrackT.current ?? undefined
    )
    const travelDirection = speed.current < -SHARED_CAR_HANDLING.stopSpeed ? -1 : 1
    const slopeGrade = ((sampledForwardHeight - currentSlopeHeight) / SLOPE_SAMPLE_DISTANCE) * travelDirection

    const controlFrame = advanceCarControlFrame({
      keys: keys.current,
      speed: speed.current,
      rotationRadians: rotation.current,
      deltaSeconds: delta,
      isOnTrack: onTrack,
      slopeGrade
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

    if (!jumpStateRef.current.airborne && !terrainContactStateRef.current.airborne) {
      const rampSideCollision = resolveCarRampSideCollision({
        previousX: position.current.x,
        previousZ: position.current.z,
        nextX: newPositionRef.current.x,
        nextZ: newPositionRef.current.z,
        ramps: rampZones
      })
      if (rampSideCollision.blocked) {
        newPositionRef.current.x = rampSideCollision.slideX ?? position.current.x
        newPositionRef.current.z = rampSideCollision.slideZ ?? position.current.z
        speed.current *= SHARED_CAR_HANDLING.boardCollisionSpeedMultiplier
      }
    }

    const canLaunchJumpFromRamp = isCarRampLipLaunchTransition({
      previousX: position.current.x,
      previousZ: position.current.z,
      nextX: newPositionRef.current.x,
      nextZ: newPositionRef.current.z,
      ramps: rampZones
    })
    
    const nextTargetTrackHeight = getSafeVehicleTargetHeight({
      sampledSurfaceHeight: sampleGroundHeight(
        newPositionRef.current.x,
        newPositionRef.current.z,
        position.current.y,
        lastTrackT.current ?? undefined
      ),
      currentVehicleY: position.current.y,
      vehicleHeightOffset: FLAT_CAR_MODEL_HEIGHT_OFFSET,
      minSurfaceHeight: -1000
    })
    const horizontalMoveDistance = Math.hypot(
      newPositionRef.current.x - position.current.x,
      newPositionRef.current.z - position.current.z
    )
    if (jumpStateRef.current.airborne || canLaunchJumpFromRamp) {
      newPositionRef.current.y = position.current.y
    } else {
      const terrainFrame = advanceCarTerrainContact({
        state: terrainContactStateRef.current,
        currentY: position.current.y,
        targetY: nextTargetTrackHeight,
        speed: speed.current,
        deltaSeconds: delta,
        horizontalDistance: horizontalMoveDistance
      })
      if (terrainFrame.blockedBySteepClimb) {
        newPositionRef.current.x = position.current.x
        newPositionRef.current.z = position.current.z
      }
      newPositionRef.current.y = terrainFrame.airborne
        ? terrainFrame.height
        : resolveVehicleSurfaceY({
          currentY: newPositionRef.current.y,
          targetY: terrainFrame.height,
          deltaSeconds: delta,
          snapUpToTarget: true
        })
      speed.current = terrainFrame.speed
    }
    
    const collisionFrame = resolveCarCollisionFrame({
      position: newPositionRef.current,
      speed: speed.current,
      treeTargets: treePositions,
      startingGatePoles,
      players: otherPlayers,
      treeMaxCheckDistance: SHARED_CAR_HANDLING.treeCollisionCheckDistance,
      boardCollision: {
        boards: advertisingBoards,
        carForward: forwardRef.current,
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
    
    // Only update position if no collision, or use corrected position
    position.current.copy(newPositionRef.current)

    collectFirstNearbyItem({
      items,
      position: position.current,
      onCollectItem
    })

    // While sailing off a cliff (terrain-contact airborne), the vertical integrator
    // owns Y — skip the ground-hugging visual surface snap or it'd clamp the car back
    // onto the cliff face every frame instead of letting it arc out and fall. The jump
    // arc is handled the same way, but advanceCarJump re-asserts its height below, so
    // only the terrain-contact case needs to short-circuit here.
    if (terrainContactStateRef.current.airborne && !jumpStateRef.current.airborne) {
      // Vertical position is owned by the cliff-drop integrator this frame.
    } else {
      const visualSurfaceHeight = sampleGroundHeight(
        position.current.x,
        position.current.z,
        position.current.y,
        lastTrackT.current ?? undefined
      )
      position.current.y = getCarSurfaceVisualY({
        isOnTrack: onTrack,
        speed: speed.current,
        elapsedTime: state.clock.elapsedTime,
        bounce: {
          ...SHARED_CAR_OFF_TRACK_BOUNCE,
          groundHeight: visualSurfaceHeight + CAR_VISUAL_HEIGHT_OFFSET
        }
      })
    }

    // Lava-pit jumps: launch into a gravity arc when crossing a zone at speed,
    // otherwise this returns the grounded height unchanged (no-op off-volcano).
    const jumpFrame = advanceCarJump({
      state: jumpStateRef.current,
      zones: jumpZones,
      x: position.current.x,
      z: position.current.z,
      groundedY: position.current.y,
      currentY: preFrameVehicleY,
      speed: speed.current,
      deltaSeconds: delta,
      canMove: canMove && canLaunchJumpFromRamp
    })
    position.current.y = jumpFrame.height
    speed.current = jumpFrame.speed

    commitVehiclePose({
      vehicle: carRef.current,
      position: position.current,
      rotation: rotation.current,
      rotationEpsilon: 0.001
    })

    if (carVisualRef.current) {
      const visualForward = getCarForwardVector(rotation.current)
      const visualTilt = getVehicleVisualTilt({
        x: position.current.x,
        z: position.current.z,
        currentY: position.current.y,
        trackT: lastTrackT.current ?? undefined,
        forward: visualForward,
        right: {
          x: -visualForward.z,
          z: visualForward.x
        },
        getHeightAtPosition: sampleGroundHeight
      })
      const smoothedTilt = smoothVehicleVisualTilt({
        currentPitch: visualPitch.current,
        currentRoll: visualRoll.current,
        targetPitch: visualTilt.pitch,
        targetRoll: visualTilt.roll,
        deltaSeconds: delta
      })

      visualPitch.current = smoothedTilt.pitch
      visualRoll.current = smoothedTilt.roll
      applyVehicleVisualSurfaceFrameRotation({
        group: carVisualRef.current,
        tilt: smoothedTilt,
        pitchScale: CAR_MODEL_TERRAIN_PITCH_SCALE,
        rollScale: CAR_MODEL_TERRAIN_ROLL_SCALE,
        scratch: visualSurfaceFrameScratch.current
      })
    }

    const startGateState = updateStartGateState(
      position.current,
      createStartGate(providedStartFinishPosition, providedStartFinishDirection, lapCrossing),
      isOnStartLine
    )
    const { alongTrack, acrossTrack, justEntered: justEnteredStartLine, justLeft: justLeftStartLine } = startGateState
    if (justEnteredStartLine) {
      logRacingDiagnostic(`🚦 Entered start line area (alongTrack: ${alongTrack.toFixed(2)}, acrossTrack: ${acrossTrack.toFixed(2)})`)
    }
    if (justLeftStartLine) {
      logRacingDiagnostic(`🚦 Left start line area`)
    }
    
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
      // Log distance tracking every 1000 meters
      if (distanceTracking.distanceDelta > 0 && totalDistanceTraveled.current > 0 && Math.floor(totalDistanceTraveled.current) % 1000 === 0 && totalDistanceTraveled.current % 1000 < 10) {
        const currentTrackT = lastTrackT.current ?? 0
        logRacingDiagnostic(`📐 Distance: ${totalDistanceTraveled.current.toFixed(1)}m, trackT=${currentTrackT.toFixed(3)}, speed=${speed.current.toFixed(1)}`)
      }
      
      // Lap Detection: Check if we've crossed the start line and traveled enough distance
      if (justEnteredStartLine) {
        logRacingDiagnostic(`🚦 Entered start line area - checking lap conditions...`)
        logRacingDiagnostic(`   trackLength: ${trackLength}, onLapComplete: ${!!onLapComplete}, lastLapTime: ${lastLapTime.current}`)
        
        const lapAttempt = attemptLapCompletion({
          trackLength,
          onLapComplete,
          lastLapTime,
          lastLapDistance,
          totalDistanceTraveled,
          hasCrossedStartLine,
          minLapDistanceRatio: lapValidation.minLapDistanceRatio,
          requiresReachedEnd: lapValidation.requiresReachedEnd,
          maxTrackT: maxLapProgress,
          resetMaxTrackTOnCompletion: 0,
          nowMs: browserRaceClock.nowMs()
        })

        if (lapAttempt.validation) {
          const lapValidation = lapAttempt.validation
          const distanceSinceLastLap = lapAttempt.distanceSinceLastLap ?? 0
          
          // Anti-cheat: Distance-based validation is sufficient
          // Requiring 90% of track length prevents going forward a short distance, reversing, and completing a lap
          // The distance tracking is more reliable than maxTrackT tracking
          
          logRacingDiagnostic(`   Distance since last lap: ${distanceSinceLastLap.toFixed(2)}m (min: ${lapValidation.minLapDistance.toFixed(2)}m)`)
          logRacingDiagnostic(`   Has crossed start line: ${hasCrossedStartLine.current}`)
          
          if (lapAttempt.completed && lapAttempt.lapTime !== null) {
            logRacingDiagnostic(`🏁 Lap completed! Time: ${lapAttempt.lapTime.toFixed(3)}s`)
          } else {
            logRacingDiagnostic(`   ❌ Lap conditions not met - not completing lap`)
          }
        } else {
          if (lapAttempt.skippedReasons.includes('missing-track-length')) logRacingDiagnostic(`   ❌ Missing trackLength`)
          if (lapAttempt.skippedReasons.includes('missing-lap-callback')) logRacingDiagnostic(`   ❌ Missing onLapComplete callback`)
          if (lapAttempt.skippedReasons.includes('missing-lap-start')) logRacingDiagnostic(`   ❌ lastLapTime is null - lap timer not initialized`)
        }
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
      headlightsEnabled: headlightsEnabledRef.current,
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
        const activeCameraZone = findCarCameraZoneForTrackT(lastTrackT.current, cameraZones)
        const cameraDistance = activeCameraZone?.distance ?? SHARED_CAR_CAMERA.distance
        const cameraHeight = activeCameraZone?.height ?? SHARED_CAR_CAMERA.height
        const cameraLookYOffset = activeCameraZone?.lookYOffset ?? 0
        
        const validRotation = getStableCarRotation(rotation.current, initialRotation)
        rotation.current = validRotation
        
        // Common setup for all camera modes
        const cappedDelta = capCameraDelta(delta)
        
        // Calculate base camera offset
        cameraOffsetRef.current.set(0, cameraHeight, cameraDistance)
        cameraOffsetRef.current.applyAxisAngle(worldUpRef.current, validRotation)
        
        // SAFETY: Validate camera offset
        if (!isFinite(cameraOffsetRef.current.x) || !isFinite(cameraOffsetRef.current.y) || !isFinite(cameraOffsetRef.current.z)) {
          // Reset to safe values
          cameraOffsetRef.current.set(0, cameraHeight, cameraDistance)
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
              cameraTargetRef.current.y += cameraHeight
              cameraTargetRef.current.z += cameraDistance
            }
            
            // Use original Australia smoothing (rate 15)
            const smoothingFactor = getExponentialSmoothingFactor(cappedDelta, SHARED_CAR_CAMERA.simpleSmoothingRate)
            camera.position.lerp(cameraTargetRef.current, smoothingFactor)
            
            // SAFETY: Validate camera position before lookAt
            if (isFinite(camera.position.x) && isFinite(camera.position.y) && isFinite(camera.position.z) &&
                isFinite(position.current.x) && isFinite(position.current.y) && isFinite(position.current.z)) {
              cameraLookTarget.current.copy(position.current)
              cameraLookTarget.current.y += cameraLookYOffset
              camera.lookAt(cameraLookTarget.current)
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
            // Safety: Validate rotation before applying
            if (isFinite(validRotation)) {
              tempVec1Ref.current.applyAxisAngle(worldUpRef.current, validRotation)
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
              tempVec1Ref.current.y += cameraHeight
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
          cameraTargetRef.current.y += cameraHeight
          cameraTargetRef.current.z += cameraDistance
        }
        
        // Distance constraints (for all modes except simple and targetsmooth)
        // Note: 'simple' mode returns early, so this code only runs for other modes
        // Note: 'targetsmooth' already smooths the target, so distance constraints interfere with it
        // Matching San Luis constraints
        if (cameraMode !== 'targetsmooth') {
          const currentDistance = camera.position.distanceTo(position.current)
            const minDistance = activeCameraZone?.minDistance ?? SHARED_CAR_CAMERA.minDistance
            const maxDistance = activeCameraZone?.maxDistance ?? SHARED_CAR_CAMERA.maxDistance
          
          if (currentDistance < minDistance || currentDistance > maxDistance) {
            // Reuse tempVec3Ref for direction calculation to prevent allocation
            tempVec3Ref.current.copy(cameraTargetRef.current).sub(position.current)
            // Safety check: if direction is invalid (zero length), use forward direction instead
            if (tempVec3Ref.current.lengthSq() < 0.01) {
              // Camera target is at car position - use forward direction as fallback
              tempVec3Ref.current.copy(forwardRef.current).multiplyScalar(-1) // Camera is behind car
            }
            tempVec3Ref.current.normalize()
            const clampedDistance = clampCameraDistanceForZone(currentDistance, activeCameraZone)
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
          cameraLookTarget.current.copy(position.current)
          cameraLookTarget.current.y += cameraLookYOffset
          camera.lookAt(cameraLookTarget.current)
        }
        
        // Log camera issues every 300 updates
        if (cameraUpdateCountRef.current % 300 === 0) {
          logRacingDiagnostic(`📹 Camera: pos=(${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}), target=(${position.current.x.toFixed(1)}, ${position.current.y.toFixed(1)}, ${position.current.z.toFixed(1)})`)
        }
      } catch (error) {
        console.error(`❌ Camera error:`, error, `at pos=(${position.current.x.toFixed(1)}, ${position.current.y.toFixed(1)}, ${position.current.z.toFixed(1)})`)
        // Silent error handling - camera will continue from last valid position
        // This prevents camera from breaking mid-race
      }
    }
  })

  return (
    <group ref={carRef} position={[0, 0, 0]}>
      <group ref={carVisualRef}>
        <CarTrackVehicleModel
          foxOriginOutpoint={foxOriginOutpoint}
          backgroundRemovalStrategy={backgroundRemovalStrategy}
          playerColor={playerColor}
          qualityPresetId={qualityPresetId}
          headlightsEnabled={headlightsEnabled}
          localChatMessage={localChatMessage}
        />
      </group>
      {showLavaExplosion && <CarLavaExplosion />}
    </group>
  )
}
