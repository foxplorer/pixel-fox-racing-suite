import React, { useRef, useEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Legacy Aspen-local snowmobile controller.
// The official Aspen event currently uses `snowmobilerace/SnowmobileWorld`.
// Keep this only as a migration reference unless it is deliberately merged or routed.
import { VoxelFox } from '../VoxelFox'
import { getOrdinalContentUrl } from '../../racing/transactions/ordinalLinks'
import { logRacingDiagnostic, warnRacingDiagnostic } from '../../racing/debug/diagnostics'
import snowmobileIdleSound from '../../assets/snowmobile_idle.mp3'
import snowmobileGasSound from '../../assets/snowmobile_on_gas.mp3'
import { GameStatus } from './FoxRacingGame'
import { spatialHash, trackSamples, GRID_SIZE, startFinishPosition, startFinishDirection } from './TrackData'
import { createStartGate, updateStartGateState } from '../../racing/core/startGate'
import { attemptLapCompletion, finalizeLapDistanceFrame } from '../../racing/simulation/lapTiming'
import { browserRaceClock, sanitizeSimulationDeltaSeconds } from '../../racing/simulation/raceClock'
import { updateHorizontalDistanceAccumulator } from '../../racing/simulation/distanceTracking'
import { notifyLapDisplayUpdate, notifySpeedDisplayUpdate } from '../../racing/simulation/displayUpdates'
import { resetLapCountersForCountdown, resetLapCountersForRaceStart } from '../../racing/simulation/lapCounterReset'
import { advanceTrackPositionFrame, shouldRefreshOnTrackState } from '../../racing/simulation/trackFrameCadence'
import { getOnTrackDistance, isWithinDistanceSq, isWithinStartTolerance } from '../../racing/core/trackProximity'
import { getTrackRuntimeConfig } from '../../racing/tracks/trackRuntimeConfig'
import { getFlatVehicleHeight } from '../../racing/vehicles/vehicleElevation'
import { collectFirstNearbyItem } from '../../racing/collectibles/collectiblePickup'
import { useReportedSpawnPosition, useVehicleLoadedNotification, useVehicleStatusCallback } from '../../racing/components/useVehicleLoadedNotification'
import { notifyManualCameraControlUsed, notifyVehiclePositionUpdate } from '../../racing/components/vehicleFrameCallbacks'
import type { RacingGameCollectibleItem as GameItem } from '../../racing/collectibles/collectibleTypes'
import type { RacingWorldPlayerCollisionTarget } from '../../racing/multiplayer/worldPlayers'

const trackRuntimeConfig = getTrackRuntimeConfig('aspen')
// PERFORMANCE: Removed getTrackHeightAndInfluence import - track is flat, so no expensive calculations needed
// import { getTerrainHeight } from './HillyTerrain' // Temporarily disabled - using track height only
// import { isInsideMountain, MOUNTAIN_CONFIG } from './CentralMountain'

// Helper function to get height at position
// PERFORMANCE: Track is flat (y=0), so just return ground height
// This eliminates hundreds of expensive getTrackHeightAndInfluence calls per second
// Track is always at ground level (0), so no need for complex height calculations
const getHeightAtPosition = (x: number, z: number, currentY?: number, trackT?: number): number => {
  return getFlatVehicleHeight()
}

// Snow spray effect for racing snowmobile - simplified for flat track
const SnowSpray: React.FC<{
  speed: number
  isTurningLeft: boolean
  isTurningRight: boolean
  isAccelerating: boolean
  sledPosition: THREE.Vector3
  sledRotation: number
}> = ({ speed, isTurningLeft, isTurningRight, isAccelerating, sledPosition, sledRotation }) => {
  const particlesRef = useRef<THREE.Points>(null)
  const particleCount = 4000 // Reduced by half for performance
  const velocitiesRef = useRef<Float32Array>(new Float32Array(particleCount * 3))
  const lifetimesRef = useRef<Float32Array>(new Float32Array(particleCount))
  const sizesRef = useRef<Float32Array>(new Float32Array(particleCount))

  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = 0
      pos[i * 3 + 1] = -100 // Start hidden
      pos[i * 3 + 2] = 0
      lifetimesRef.current[i] = 0
      sizesRef.current[i] = 0.3
    }
    return pos
  }, [])

  // Disable frustum culling so spray shows everywhere
  useEffect(() => {
    if (particlesRef.current) {
      particlesRef.current.frustumCulled = false
    }
  }, [])

  // Transform local to world space
  const localToWorld = (localX: number, localY: number, localZ: number) => {
    const cos = Math.cos(sledRotation)
    const sin = Math.sin(sledRotation)
    return {
      x: sledPosition.x + localX * cos + localZ * sin,
      y: sledPosition.y + localY,
      z: sledPosition.z - localX * sin + localZ * cos
    }
  }

  const localVelToWorld = (localVx: number, localVy: number, localVz: number) => {
    const cos = Math.cos(sledRotation)
    const sin = Math.sin(sledRotation)
    return {
      x: localVx * cos + localVz * sin,
      y: localVy,
      z: -localVx * sin + localVz * cos
    }
  }

  useFrame((state, delta) => {
    if (!particlesRef.current) return

    const posArray = particlesRef.current.geometry.attributes.position.array as Float32Array
    const velocities = velocitiesRef.current
    const lifetimes = lifetimesRef.current
    const sizes = sizesRef.current

    const sledX = sledPosition.x
    const sledY = sledPosition.y
    const sledZ = sledPosition.z

    // Spray intensity based on speed
    const baseSprayIntensity = Math.min(speed / 20, 1.5)
    const isStartingFromStop = isAccelerating && speed < 12 && speed > 0.1

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3

      if (lifetimes[i] <= 0) {
        // Spawn new particles
        let spawnChance = 0.4 + baseSprayIntensity * 0.5
        if (isStartingFromStop) spawnChance += 0.3

        let spawnAttempts = 4
        if (isStartingFromStop) spawnAttempts = 16

        let shouldSpawn = false
        for (let attempt = 0; attempt < spawnAttempts; attempt++) {
          if (Math.random() < spawnChance) shouldSpawn = true
        }

        let sizeMultiplier = 1.0
        if (isStartingFromStop && Math.random() < 0.4) {
          sizeMultiplier = 2.0 + Math.random() * 1.0
        }

        if (shouldSpawn && speed >= 0.3) {
          let localX = 0, localY = 0, localZ = 0
          let localVx = 0, localVy = 0, localVz = 0
          let particleSize = 0.3 * sizeMultiplier

          const rand = Math.random()

          // TRACK ROOSTER TAIL - main spray from back
          if (rand < 0.55) {
            localX = (Math.random() - 0.5) * 1.8
            localY = 0.8 + Math.random() * 1.2
            localZ = 3.0 + Math.random() * 3

            const sideDir = isTurningLeft ? -1.5 : isTurningRight ? 1.5 : (Math.random() - 0.5) * 2
            const trackForce = baseSprayIntensity * 1.2
            localVx = sideDir * (8 + Math.random() * 14) * trackForce
            localVy = (15 + Math.random() * 20) * trackForce
            localVz = (12 + Math.random() * 20) * trackForce
            particleSize = (1.4 + Math.random() * 1.6) * sizeMultiplier
          }
          // SKI SPRAY - powder from skis
          else if (rand < 0.75) {
            const isLeft = Math.random() < 0.5
            localX = isLeft ? (-0.9 - Math.random() * 0.4) : (0.9 + Math.random() * 0.4)
            localY = 0.8 + Math.random() * 1.0
            localZ = -1 + Math.random() * 2.5

            const skiForce = baseSprayIntensity
            const dir = isLeft ? -1 : 1
            localVx = dir * (6 + Math.random() * 10) * skiForce
            localVy = (10 + Math.random() * 15) * skiForce
            localVz = (Math.random() - 0.3) * 5 * skiForce
            particleSize = (1.0 + Math.random() * 1.2) * sizeMultiplier
          }
          // SIDE POWDER CLOUD
          else if (rand < 0.9) {
            const side = Math.random() < 0.5 ? -1 : 1
            localX = side * (0.3 + Math.random() * 1.5)
            localY = 1.0 + Math.random() * 1.5
            localZ = -1 + Math.random() * 4

            const cloudForce = baseSprayIntensity * 0.7
            localVx = side * (2 + Math.random() * 5) * cloudForce
            localVy = (8 + Math.random() * 12) * cloudForce
            localVz = (Math.random() - 0.5) * 4 * cloudForce
            particleSize = (1.4 + Math.random() * 1.4) * sizeMultiplier
          }
          // FRONT PLOW - spray when accelerating
          else {
            localX = (Math.random() - 0.5) * 2.5
            localY = 1.0 + Math.random() * 1.0
            localZ = -3.5 - Math.random() * 1

            const frontForce = baseSprayIntensity * (isAccelerating ? 1.3 : 0.8)
            localVx = (Math.random() - 0.5) * 8 * frontForce
            localVy = (15 + Math.random() * 18) * frontForce
            localVz = (4 + Math.random() * 8) * frontForce
            particleSize = (1.0 + Math.random() * 1.2) * sizeMultiplier
          }

          // Transform to world space
          const worldPos = localToWorld(localX, localY, localZ)
          const worldVel = localVelToWorld(localVx, localVy, localVz)

          posArray[idx] = worldPos.x
          posArray[idx + 1] = worldPos.y
          posArray[idx + 2] = worldPos.z

          velocities[idx] = worldVel.x
          velocities[idx + 1] = worldVel.y
          velocities[idx + 2] = worldVel.z

          sizes[i] = particleSize
          lifetimes[i] = 0.8 + Math.random() * 1.2
        }
      } else {
        // Update particle physics
        posArray[idx] += velocities[idx] * delta
        posArray[idx + 1] += velocities[idx + 1] * delta
        posArray[idx + 2] += velocities[idx + 2] * delta

        // Gravity
        velocities[idx + 1] -= 12 * delta
        // Air resistance
        velocities[idx] *= 0.985
        velocities[idx + 1] *= 0.99
        velocities[idx + 2] *= 0.985

        lifetimes[i] -= delta

        // Recycle particles that are too far or hit snow
        const dx = posArray[idx] - sledX
        const dz = posArray[idx + 2] - sledZ
        const distSq = dx * dx + dz * dz
        const MAX_DIST_SQ = 60 * 60

        // Check if below snow surface
        const belowSnow = posArray[idx + 1] < 2.7 // Slightly above snow surface

        if (lifetimes[i] <= 0 || distSq > MAX_DIST_SQ || belowSnow) {
          lifetimes[i] = 0
          posArray[idx + 1] = -100 // Hide
        }
      }
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.25}
        color="#ffffff"
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

export type CameraMode = 'simple' | 'smooth' | 'damped' | 'targetsmooth' | 'velocity'

interface FreeRoamSnowmobileProps {
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
  advertisingBoards?: Array<{
    curve: THREE.CatmullRomCurve3
    startT: number
    endT: number
    offset: number
    side: 'left' | 'right'
    height: number
  }>
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

export const FreeRoamSnowmobile: React.FC<FreeRoamSnowmobileProps> = ({
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
    if (spawnPosition && !hasAppliedSpawnPosition.current && trackCurve) {
      // Recalculate Y from track height at spawn position
      const trackY = getHeightAtPosition(spawnPosition.x, spawnPosition.z)
      position.current.set(spawnPosition.x, trackY, spawnPosition.z)
      
      // Calculate correct rotation based on track direction at spawn position
      const spawnPosVec = new THREE.Vector3(spawnPosition.x, trackY, spawnPosition.z)
      const trackT = findTrackPosition(spawnPosVec, trackCurve)
      
      // Get tangent at spawn position (negate for clockwise track, like startFinishDirection)
      trackCurve.getTangentAt(trackT, spawnTangentRef.current)
      spawnTangentRef.current.negate().normalize()
      
      // Calculate rotation from tangent direction
      const spawnRotation = Math.atan2(spawnTangentRef.current.x, spawnTangentRef.current.z)

      // Update rotation refs and car rotation
      rotation.current = spawnRotation
      smoothedRotation.current = spawnRotation
      // CAMERA FIX: Also reset camera rotation refs to match spawn rotation
      cameraRotation.current = spawnRotation
      lastCameraUpdateRotation.current = spawnRotation

      if (carRef.current) {
        carRef.current.position.copy(position.current)
        carRef.current.rotation.y = spawnRotation
      }

      hasAppliedSpawnPosition.current = true
    }
    // Reset flag when spawnPosition becomes null (player left game)
    if (!spawnPosition) {
      hasAppliedSpawnPosition.current = false
    }
  }, [spawnPosition, trackCurve])
  const speed = useRef(0)
  const velocity = useRef(new THREE.Vector3(0, 0, 0))
  const leanRef = useRef(0) // Lean into turns (snowmobile tilt)
  
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

  // Snowmobile sound system with crossfade between idle and gas
  const audioContextRef = useRef<AudioContext | null>(null)
  const idleGainRef = useRef<GainNode | null>(null)
  const gasGainRef = useRef<GainNode | null>(null)
  const idleSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const gasSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const audioStartedRef = useRef(false)
  const targetIdleGainRef = useRef(0.3)
  const targetGasGainRef = useRef(0)
  const [isOnGas, setIsOnGas] = useState(false)
  const [isTurningLeft, setIsTurningLeft] = useState(false)
  const [isTurningRight, setIsTurningRight] = useState(false)

  // Initialize snowmobile audio system
  useEffect(() => {
    if (!isSoundEnabled || !snowmobileIdleSound || !snowmobileGasSound) return

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    audioContextRef.current = audioContext

    // Create gain nodes
    const idleGain = audioContext.createGain()
    idleGain.gain.value = 0.3 // Start with idle audible
    idleGain.connect(audioContext.destination)
    idleGainRef.current = idleGain

    const gasGain = audioContext.createGain()
    gasGain.gain.value = 0 // Start with gas silent
    gasGain.connect(audioContext.destination)
    gasGainRef.current = gasGain

    // Load and start audio
    const loadAudio = async (url: string): Promise<AudioBuffer> => {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      return await audioContext.decodeAudioData(arrayBuffer)
    }

    const startAudio = async () => {
      try {
        const [idleBuffer, gasBuffer] = await Promise.all([
          loadAudio(snowmobileIdleSound),
          loadAudio(snowmobileGasSound)
        ])

        // Resume context if suspended
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
        }

        // Start idle sound
        const idleSource = audioContext.createBufferSource()
        idleSource.buffer = idleBuffer
        idleSource.loop = true
        idleSource.connect(idleGain)
        idleSource.start(0)
        idleSourceRef.current = idleSource

        // Start gas sound (muted initially)
        const gasSource = audioContext.createBufferSource()
        gasSource.buffer = gasBuffer
        gasSource.loop = true
        gasSource.connect(gasGain)
        gasSource.start(0)
        gasSourceRef.current = gasSource

        audioStartedRef.current = true
      } catch (err) {
        console.error('Failed to load snowmobile audio:', err)
      }
    }

    startAudio()

    return () => {
      if (idleSourceRef.current) {
        try { idleSourceRef.current.stop() } catch (e) {}
      }
      if (gasSourceRef.current) {
        try { gasSourceRef.current.stop() } catch (e) {}
      }
      audioContext.close()
    }
  }, [isSoundEnabled])

  // Crossfade animation for snowmobile sounds - runs continuously, checks audio ready inside
  const animationFrameRef = useRef<number | null>(null)
  useEffect(() => {
    const animate = () => {
      // Check audio ready INSIDE the loop so it works even if audio loads later
      if (idleGainRef.current && gasGainRef.current && audioStartedRef.current) {
        const idleGain = idleGainRef.current.gain
        const gasGain = gasGainRef.current.gain

        // Smooth transition to target values
        idleGain.value += (targetIdleGainRef.current - idleGain.value) * 0.1
        gasGain.value += (targetGasGainRef.current - gasGain.value) * 0.1
      }
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Update sound targets based on gas state
  useEffect(() => {
    if (isOnGas) {
      targetIdleGainRef.current = 0.1 // Quiet idle
      targetGasGainRef.current = 0.4 // Loud gas
    } else {
      targetIdleGainRef.current = 0.3 // Normal idle
      targetGasGainRef.current = 0 // Silent gas
    }
  }, [isOnGas])
  
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

  // Check if car is on track (within track width / 2 + margin)
  // Matches original implementation for consistent bumpy behavior
  // CRITICAL: Handles closure point smoothly to prevent false negatives
  // CRITICAL: isOnTrack should NOT depend on currentTrackT - it causes issues when track position jumps
  // Just find the closest point on track regardless of previous position
  const isOnTrack = (pos: THREE.Vector3, curve?: THREE.CatmullRomCurve3, currentTrackT?: number): boolean => {
    if (!curve) {
      // No track curve provided - assume always on track
      return true
    }
    
    const MAX_DISTANCE = getOnTrackDistance(trackRuntimeConfig.proximity)
    
    // Special case: if car is very close to start position (0, 0.1, 0), assume on track
    // This prevents false negatives at the start/finish line
    if (isWithinStartTolerance(pos.distanceTo(startPositionRef.current), trackRuntimeConfig.proximity)) {
      return true
    }
    
    // PERFORMANCE: Use spatial hash for fast lookup instead of checking currentTrackT
    // This prevents issues when track position jumps backward
    const gx = Math.floor(pos.x / GRID_SIZE)
    const gz = Math.floor(pos.z / GRID_SIZE)
    
    let minDistance = Infinity
    
    // Check current cell and neighboring cells (3x3 grid)
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const key = `${gx+i},${gz+j}`
        const indices = spatialHash.get(key)
        if (!indices) continue
        
        // Check all samples in this cell
        for (const idx of indices) {
          const sample = trackSamples[idx]
          const dx = pos.x - sample.pos.x
          const dz = pos.z - sample.pos.z
          const distance = Math.sqrt(dx * dx + dz * dz)
          
          if (distance < minDistance) {
            minDistance = distance
          }
        }
      }
    }
    
    // If we found a close point, we're on track
    if (minDistance <= MAX_DISTANCE) {
      return true
    }
    
    // Fallback: If spatial hash didn't find anything close, do a coarse search
    // This should rarely happen, but handles edge cases
    const coarseSamples = 60
    for (let i = 0; i <= coarseSamples; i++) {
      const t = i / coarseSamples
      const curvePoint = curve.getPointAt(t)
      const dx = pos.x - curvePoint.x
      const dz = pos.z - curvePoint.z
      const distance = Math.sqrt(dx * dx + dz * dz)
      if (distance < minDistance) {
        minDistance = distance
      }
    }
    
    return minDistance <= MAX_DISTANCE
  }
  
  // Check if car is near track (more lenient than "on track" - allows going off track but not far)
  // PERFORMANCE: Optimized to use spatial hash instead of brute force
  const isNearTrack = (pos: THREE.Vector3, curve?: THREE.CatmullRomCurve3): boolean => {
    if (!curve) return true
    
    const NEAR_TRACK_DISTANCE = trackRuntimeConfig.proximity.nearTrackDistance // More lenient than on-track check (allows going off track but not far)
    
    // Use spatial hash for fast lookup
    const gx = Math.floor(pos.x / GRID_SIZE)
    const gz = Math.floor(pos.z / GRID_SIZE)
    
    // Check current cell and neighboring cells (3x3 grid)
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const key = `${gx+i},${gz+j}`
        const indices = spatialHash.get(key)
        if (!indices) continue
        
        // Check all samples in this cell
        for (const idx of indices) {
          const sample = trackSamples[idx]
          const dx = pos.x - sample.pos.x
          const dz = pos.z - sample.pos.z
          const distanceSq = dx * dx + dz * dz
          
          if (isWithinDistanceSq(distanceSq, NEAR_TRACK_DISTANCE)) {
            return true // Found nearby track
          }
        }
      }
    }
    
    return false
  }
  
  // Reusable Vector3 for curve.getPointAt() to prevent memory leaks
  const curvePointRef = useRef(new THREE.Vector3())
  
  // Find closest point on track and return the t value (0-1) along the curve
  // PERFORMANCE: Optimized to use spatial hash instead of brute force search
  // CRITICAL: This function is PURELY INFORMATIONAL - it does NOT affect car movement
  // Car movement is 100% independent of track position - user controls direction
  // We ignore previousT completely - just find the closest point, period
  // This prevents any issues with hidden loops or track curve problems
  // MEMORY: Reuses curvePointRef to prevent Vector3 allocations
  const findTrackPosition = (pos: THREE.Vector3, curve?: THREE.CatmullRomCurve3, previousT?: number): number => {
    if (!curve) return 0

    // Use spatial hash for fast lookup - only check nearby samples
    const gx = Math.floor(pos.x / GRID_SIZE)
    const gz = Math.floor(pos.z / GRID_SIZE)

    let minDistanceSq = Infinity
    let bestT = 0

    // Check current cell and neighboring cells (3x3 grid)
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const key = `${gx+i},${gz+j}`
        const indices = spatialHash.get(key)
        if (!indices) continue

        // Check all samples in this cell - NO CONTINUITY CHECKS
        // Just find the closest point, period. Track position is informational only.
        // Car movement is 100% independent - user controls direction
        for (const idx of indices) {
          const sample = trackSamples[idx]
          const dx = pos.x - sample.pos.x
          const dz = pos.z - sample.pos.z
          const distanceSq = dx * dx + dz * dz

          // NO CONTINUITY PENALTIES - just find closest point
          // Track position is purely informational, doesn't affect movement
          if (distanceSq < minDistanceSq) {
            minDistanceSq = distanceSq
            bestT = sample.t
          }
        }
      }
    }

    // PERFORMANCE: Skip refinement loop - track position is just informational
    // The spatial hash lookup is accurate enough, and refinement calls getPointAt() 10 times
    // which is expensive. Since track position doesn't affect movement, we don't need perfect accuracy.
    // If spatial hash found a match, use it. Otherwise fall back to coarse search.
    if (minDistanceSq === Infinity) {
      // Fallback: if spatial hash fails, do a coarse search (shouldn't happen)
      // PERFORMANCE: Reduced samples from 50 to 20 for better performance
      const coarseSamples = 20
      for (let i = 0; i <= coarseSamples; i++) {
        const t = i / coarseSamples
        // MEMORY FIX: Reuse curvePointRef instead of creating new Vector3
        curve.getPointAt(t, curvePointRef.current)
        const dx = pos.x - curvePointRef.current.x
        const dz = pos.z - curvePointRef.current.z
        const distanceSq = dx * dx + dz * dz
        if (distanceSq < minDistanceSq) {
          minDistanceSq = distanceSq
          bestT = t
        }
      }
    }

    return bestT
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser from intercepting arrow keys during racing
      // (scrolling, UI navigation, etc.)
      if ((e.code === 'ArrowDown' || e.code === 'ArrowUp' ||
           e.code === 'ArrowLeft' || e.code === 'ArrowRight' ||
           e.code === 'Space') && gameStatus === 'racing') {
        e.preventDefault()
      }

      keys.current[e.code] = true

      // Trigger gas sound crossfade when G, W, or ArrowUp is pressed (only during racing)
      if ((e.code === 'KeyG' || e.code === 'KeyW' || e.code === 'ArrowUp') && gameStatus === 'racing') {
        setIsOnGas(true)
        if (onGasPressed) {
          onGasPressed()
        }
      }

    }
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false

      // Stop gas sound crossfade when G, W, or ArrowUp is released (only if none of them are still pressed)
      if ((e.code === 'KeyG' || e.code === 'KeyW' || e.code === 'ArrowUp')) {
        // Check if any other gas key is still pressed
        const anyGasKeyPressed = keys.current['KeyG'] || keys.current['KeyW'] || keys.current['ArrowUp']
        if (!anyGasKeyPressed) {
          setIsOnGas(false)
          if (onGasReleased) {
            onGasReleased()
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      // Sound cleanup is handled by the audio context useEffect
    }
  }, [gameStatus, isSoundEnabled])

  // Reset lap tracking and car position when starting a new race
  // NOTE: isManualCamera is NOT in dependencies - we don't want to reset car when camera mode changes
  useEffect(() => {
    if (gameStatus === 'racing') {
      // Reset car to start/finish line
      const trackY = getHeightAtPosition(startFinishPosition.x, startFinishPosition.z)
      position.current.set(startFinishPosition.x, trackY, startFinishPosition.z)
      rotation.current = initialRotation
      smoothedRotation.current = initialRotation // Reset smoothed rotation too
      // CRITICAL: Also reset camera rotation refs to match car rotation
      cameraRotation.current = initialRotation
      lastCameraUpdateRotation.current = initialRotation
      speed.current = 0
      leanRef.current = 0
      if (carRef.current) {
        carRef.current.position.copy(position.current)
        carRef.current.rotation.y = rotation.current
        carRef.current.rotation.z = 0
      }

      resetLapCountersForRaceStart({
        lastLapTime,
        lastLapDistance,
        hasCrossedStartLine,
        isOnStartLine,
        totalDistanceTraveled,
        prevPositionForDistance
      }, browserRaceClock.nowMs())
    } else if (gameStatus === 'countdown') {
      // Reset car to start/finish line during countdown
      const trackY = getHeightAtPosition(startFinishPosition.x, startFinishPosition.z)
      position.current.set(startFinishPosition.x, trackY, startFinishPosition.z)
      rotation.current = initialRotation
      smoothedRotation.current = initialRotation // Reset smoothed rotation too
      // CRITICAL: Also reset camera rotation refs to match car rotation
      cameraRotation.current = initialRotation
      lastCameraUpdateRotation.current = initialRotation
      speed.current = 0
      leanRef.current = 0
      if (carRef.current) {
        carRef.current.position.copy(position.current)
        carRef.current.rotation.y = rotation.current
        carRef.current.rotation.z = 0
      }

      resetLapCountersForCountdown({
        lastLapTime,
        lastLapDistance,
        hasCrossedStartLine,
        isOnStartLine,
        totalDistanceTraveled,
        prevPositionForDistance
      })
    }
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
    
    // Car height offset: car should be slightly above track surface
    // Defined early so it can be used in initialization
    const CAR_HEIGHT_OFFSET = 0.05
    
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
    
    // Deep snow surface level - snowmobile sinks into it
    // Must match racing physics: GROUND_HEIGHT + RIDE_HEIGHT - POWDER_SINK_MAX = (2.5 - 0.4) + 0.4 - 3.0 = -0.5
    const SNOW_SURFACE = 2.5
    const RIDE_HEIGHT_INIT = 0.4
    const POWDER_SINK_MAX_INIT = 3.0
    const GROUND_HEIGHT_INIT = SNOW_SURFACE - RIDE_HEIGHT_INIT // 2.1
    const SUNK_HEIGHT = GROUND_HEIGHT_INIT + RIDE_HEIGHT_INIT - POWDER_SINK_MAX_INIT // -0.5 at rest

    // Initialize position on first frame
    if (!isInitialized.current) {
      if (!spawnPosition) {
        position.current.x = startFinishPosition.x
        position.current.z = startFinishPosition.z
        rotation.current = initialRotation
        cameraRotation.current = initialRotation
        lastCameraUpdateRotation.current = initialRotation
      }
      position.current.y = SUNK_HEIGHT // Start sunk in snow
      isInitialized.current = true
    }

    // Only allow movement when racing (countdown must complete first)
    const canMove = gameStatus === 'racing'
    if (!canMove) {
      // During countdown or loading, stay sunk in snow
      if (gameStatus === 'countdown' || gameStatus === 'loading') {
        speed.current = 0
        // Smoothly sink to rest position
        position.current.y = THREE.MathUtils.lerp(position.current.y, SUNK_HEIGHT, 0.05)
      }
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
    
    // ========== SNOWMOBILE PHYSICS CONSTANTS (matching /snowmobile EXACTLY) ==========
    // Power and speed
    const BASE_POWER = 28              // Base engine power
    const MAX_POWER = 65               // Peak power when track grips well
    const MAX_SPEED = 75               // Top speed (same as /snowmobile)
    const REVERSE_MAX = 15             // Max reverse speed

    // Braking and friction
    const BRAKE_FORCE = 45             // Brake deceleration
    const SNOW_FRICTION = 0.985        // Rolling resistance in powder
    const DEEP_POWDER_DRAG = 0.012     // Extra drag at low speed in deep snow

    // Turning
    const BASE_TURN_RATE = 2.2         // Turn speed at low velocity
    const HIGH_SPEED_TURN_RATE = 1.0   // Turn speed at max velocity
    const LEAN_INTO_TURN = 0.2         // Lean when turning

    // Suspension and ride height - BLOWER POW! Chest deep powder (matching /snowmobile exactly)
    const RIDE_HEIGHT = 0.4            // Low base height when planing
    const SUSPENSION_STIFFNESS = 4.0   // Very soft suspension (same as /snowmobile)
    const SUSPENSION_DAMPING = 0.08    // Minimal damping = maximum float
    const POWDER_SINK_MAX = 3.0        // CHEST DEEP sink at rest!
    const POWDER_PLANE_SPEED = 35      // Need real speed to plane

    // Acceleration - G key for gas
    const isAccelerating = keys.current['KeyW'] || keys.current['ArrowUp'] || keys.current['KeyG']
    const isBraking = keys.current['KeyS'] || keys.current['ArrowDown']
    const turningLeft = keys.current['KeyA'] || keys.current['ArrowLeft']
    const turningRight = keys.current['KeyD'] || keys.current['ArrowRight']

    // Update React state for snow spray (only when changed to avoid re-renders)
    if (turningLeft !== isTurningLeft) setIsTurningLeft(turningLeft)
    if (turningRight !== isTurningRight) setIsTurningRight(turningRight)

    // Notify parent when controls are used (to return camera to follow mode)
    notifyManualCameraControlUsed({
      isManualCamera,
      isControlActive: isAccelerating || isBraking || turningLeft || turningRight,
      onControlUsed: onCarControlUsed
    })

    // ========== SNOWMOBILE ACCELERATION ==========
    const speedRatio = Math.abs(speed.current) / MAX_SPEED

    if (isAccelerating) {
      // Power increases with speed (track grip improves)
      const power = BASE_POWER + (MAX_POWER - BASE_POWER) * speedRatio * 0.5
      speed.current = Math.min(speed.current + power * delta, MAX_SPEED)
    } else if (isBraking) {
      if (speed.current > 0.5) {
        // Braking while moving forward
        speed.current = Math.max(0, speed.current - BRAKE_FORCE * delta)
      } else {
        // Reversing
        speed.current = Math.max(-REVERSE_MAX, speed.current - BASE_POWER * 0.4 * delta)
      }
    } else {
      // Coasting - apply friction
      speed.current *= SNOW_FRICTION

      // Deep powder drag at low speeds (matching /snowmobile)
      if (Math.abs(speed.current) < POWDER_PLANE_SPEED) {
        speed.current *= (1 - DEEP_POWDER_DRAG)
      }

      // Stop if very slow
      if (Math.abs(speed.current) < 0.3) speed.current = 0
    }

    // Clamp speed to current max (in case we just went off track)
    if (speed.current > MAX_SPEED) {
      speed.current = MAX_SPEED
    }

    // Snowmobile sound volume is handled by the crossfade audio system

    // ========== TURNING WITH LEAN ==========
    if (Math.abs(speed.current) > 0.5) {
      // Turn rate varies with speed (slower at high speed for stability)
      const turnRate = THREE.MathUtils.lerp(BASE_TURN_RATE, HIGH_SPEED_TURN_RATE, speedRatio)

      if (turningLeft) {
        rotation.current += turnRate * delta * Math.sign(speed.current)
      }
      if (turningRight) {
        rotation.current -= turnRate * delta * Math.sign(speed.current)
      }
    }

    // ========== LEAN INTO TURNS ==========
    let targetLean = 0
    if (Math.abs(speed.current) > 2) {
      if (turningLeft) targetLean = LEAN_INTO_TURN
      if (turningRight) targetLean = -LEAN_INTO_TURN
    }
    // Smooth lean transitions
    leanRef.current = THREE.MathUtils.lerp(leanRef.current, targetLean, 0.1)

    // CRITICAL: Cap delta for movement to prevent teleporting on frame drops
    // 50ms max = 20 FPS minimum effective rate
    const movementDelta = sanitizeSimulationDeltaSeconds(delta, 0.05)

    // Movement - reuse Vector3 objects to prevent memory leaks
    forwardRef.current.set(0, 0, -1)
    forwardRef.current.applyAxisAngle(worldUpRef.current, rotation.current)
    
    // If sliding along board, project forward direction onto board tangent
    // This allows the car to slide along the board instead of getting stuck
    if (slidingAlongBoardRef.current && boardTangentRef.current.lengthSq() > 0.1) {
      const forwardDotTangent = forwardRef.current.dot(boardTangentRef.current)
      // Project forward onto board tangent (preserve movement along board)
      forwardRef.current.copy(boardTangentRef.current).multiplyScalar(forwardDotTangent > 0 ? 1 : -1)
      forwardRef.current.normalize()
    }
    
    velocity.current.copy(forwardRef.current).multiplyScalar(speed.current)
    // Calculate new position: reuse pushDirectionRef as temp vector for velocity * movementDelta
    // Using capped movementDelta prevents teleporting on frame drops
    pushDirectionRef.current.copy(velocity.current).multiplyScalar(movementDelta)
    newPositionRef.current.copy(position.current).add(pushDirectionRef.current)
    
    // Y position is now handled entirely by powder sink physics below (lines 1218-1234)
    // No track height clamping - snowmobile sinks into deep powder and planes up at speed
    
    // Collision detection
    // Car is 2 units wide, 3.8 units long - use larger radius to account for length
    // Using 2.0 to ensure cars can't pass through each other (car is 3.8 long, so radius of 2.0 covers most of it)
    const CAR_RADIUS = 2.0 // Car collision radius (larger to prevent cars passing through)
    let collided = false
    
    // Reset sliding flag at start of collision checks
    slidingAlongBoardRef.current = false

    // Tree collisions removed - trees are placed outside the track

    // Check starting gate pole collisions
    // PERFORMANCE: Use distance squared to avoid expensive sqrt
    if (!collided) {
      for (const pole of startingGatePoles) {
        const dx = newPositionRef.current.x - pole.x
        const dz = newPositionRef.current.z - pole.z
        const distanceSq = dx * dx + dz * dz
        const minDistance = CAR_RADIUS + pole.radius
        const minDistanceSq = minDistance * minDistance

        if (distanceSq < minDistanceSq) {
          // Collision detected - push car back
          collided = true
          const distance = Math.sqrt(distanceSq)
          pushDirectionRef.current.set(dx, 0, dz).normalize()
          const overlap = minDistance - distance
          newPositionRef.current.add(pushDirectionRef.current.multiplyScalar(overlap + 0.1)) // Push back with small margin

          // Also reduce speed on collision (like hitting something)
          speed.current *= 0.3
          break
        }
      }
    }

    // Check advertising board collisions
    // Boards are curved, so find nearest point on curve and check distance
    // PERFORMANCE: Only check if car is near the board area (quick distance check first)
    // MEMORY: Reuse Vector3 objects to prevent allocations
    if (!collided && advertisingBoards && advertisingBoards.length > 0) {
      for (const board of advertisingBoards) {
        // Quick distance check: get midpoint of board curve to see if we're even close
        const midT = (board.startT + board.endT) / 2
        const wrappedMidT = midT < 0 ? midT + 1 : (midT > 1 ? midT - 1 : midT)
        board.curve.getPointAt(wrappedMidT, curvePointRef2.current)
        board.curve.getTangentAt(wrappedMidT, curveTangentRef.current)
        curveTangentRef.current.normalize()
        
        // Calculate perpendicular direction (reuse Vector3)
        perpDirRef.current.set(-curveTangentRef.current.z, 0, curveTangentRef.current.x).normalize()
        offsetDirRef.current.copy(perpDirRef.current)
        if (board.side === 'right') {
          offsetDirRef.current.multiplyScalar(-1)
        }
        
        // Calculate board midpoint (reuse Vector3)
        boardMidPointRef.current.copy(curvePointRef2.current).add(offsetDirRef.current.multiplyScalar(board.offset))
        
        // Quick distance check - if car is far from board midpoint, skip detailed check
        const dx = newPositionRef.current.x - boardMidPointRef.current.x
        const dz = newPositionRef.current.z - boardMidPointRef.current.z
        const quickDistSq = dx * dx + dz * dz
        const boardLength = board.curve.getLength() * Math.abs(board.endT - board.startT)
        const maxCheckDistance = boardLength / 2 + board.offset + CAR_RADIUS + 5 // Add margin
        if (quickDistSq > maxCheckDistance * maxCheckDistance) {
          continue // Skip this board - car is too far away
        }
        
        // Find the nearest point on the board's curve path
        // IMPROVED: Check both point-to-point distance AND line segments to prevent passing through
        let minDistanceSq = Infinity
        let nearestT = board.startT
        let hasPrevPoint = false
        
        // Increased samples for better coverage (prevents gaps where car can slip through)
        const samples = 50
        
        for (let i = 0; i <= samples; i++) {
          // Interpolate t from startT to endT
          const t = board.startT + (board.endT - board.startT) * (i / samples)
          // Wrap t to [0, 1] range for closed curves
          const wrappedT = t < 0 ? t + 1 : (t > 1 ? t - 1 : t)
          
          // MEMORY: Reuse Vector3 objects instead of creating new ones
          board.curve.getPointAt(wrappedT, curvePointRef2.current)
          board.curve.getTangentAt(wrappedT, curveTangentRef.current)
          curveTangentRef.current.normalize()
          
          perpDirRef.current.set(-curveTangentRef.current.z, 0, curveTangentRef.current.x).normalize()
          offsetDirRef.current.copy(perpDirRef.current)
          if (board.side === 'right') {
            offsetDirRef.current.multiplyScalar(-1)
          }
          
          boardPointRef.current.copy(curvePointRef2.current).add(offsetDirRef.current.multiplyScalar(board.offset))
          
          // 1. Check distance to current board point
          const boardDx = newPositionRef.current.x - boardPointRef.current.x
          const boardDz = newPositionRef.current.z - boardPointRef.current.z
          const distanceSq = boardDx * boardDx + boardDz * boardDz
          
          if (distanceSq < minDistanceSq) {
            minDistanceSq = distanceSq
            nearestT = wrappedT
            nearestPointRef.current.copy(boardPointRef.current)
          }
          
          // 2. Check distance to line segment between previous and current board points
          // This prevents car from passing through gaps between samples
          if (hasPrevPoint) {
            // Calculate distance from car to line segment (prevBoardPoint -> boardPoint)
            const segmentDx = boardPointRef.current.x - prevBoardPointRef.current.x
            const segmentDz = boardPointRef.current.z - prevBoardPointRef.current.z
            const segmentLengthSq = segmentDx * segmentDx + segmentDz * segmentDz
            
            if (segmentLengthSq > 0.001) { // Only check if segment has length
              // Vector from prevBoardPoint to car
              const toCarDx = newPositionRef.current.x - prevBoardPointRef.current.x
              const toCarDz = newPositionRef.current.z - prevBoardPointRef.current.z
              
              // Project car position onto line segment
              const tParam = Math.max(0, Math.min(1, (toCarDx * segmentDx + toCarDz * segmentDz) / segmentLengthSq))
              
              // Closest point on line segment
              const closestX = prevBoardPointRef.current.x + tParam * segmentDx
              const closestZ = prevBoardPointRef.current.z + tParam * segmentDz
              
              // Distance from car to closest point on segment
              const segDx = newPositionRef.current.x - closestX
              const segDz = newPositionRef.current.z - closestZ
              const segDistanceSq = segDx * segDx + segDz * segDz
              
              if (segDistanceSq < minDistanceSq) {
                minDistanceSq = segDistanceSq
                nearestPointRef.current.set(closestX, boardPointRef.current.y, closestZ)
              }
            }
          }
          
          // Store current point as previous for next iteration
          prevBoardPointRef.current.copy(boardPointRef.current)
          hasPrevPoint = true
        }
        
        // Check if car is within collision distance (using squared distance to avoid sqrt)
        // Use actual board thickness (0.05 units) for tighter collision detection
        const boardThickness = 0.05 // Actual frame thickness from AdvertisingBoards.tsx
        const effectiveCarRadius = CAR_RADIUS // Use full radius for better coverage
        const collisionDistance = effectiveCarRadius + boardThickness + 0.05 // Small margin for smooth collision
        const collisionDistanceSq = collisionDistance * collisionDistance
        
        if (minDistanceSq <= collisionDistanceSq) {
          // Collision detected - allow sliding along board instead of grabbing
          collided = true
          const distance = Math.sqrt(minDistanceSq)
          
          // Get board tangent at nearest point for sliding
          board.curve.getTangentAt(nearestT, boardTangentRef.current)
          boardTangentRef.current.y = 0 // Keep it horizontal
          boardTangentRef.current.normalize()
          
          // Calculate push direction (perpendicular to board, away from it)
          pushDirectionRef.current.set(
            newPositionRef.current.x - nearestPointRef.current.x,
            0,
            newPositionRef.current.z - nearestPointRef.current.z
          ).normalize()
          
          // Push car away from board (perpendicular only)
          const pushDistance = collisionDistance - distance + 0.05
          newPositionRef.current.add(pushDirectionRef.current.multiplyScalar(pushDistance))
          
          // Store board tangent for sliding - will be applied to forwardRef after it's recalculated
          slidingAlongBoardRef.current = true
          
          // Minimal speed reduction for realistic sliding (was 0.3, now 0.85)
          speed.current *= 0.85
          break
        }
      }
    }
    
    // Check other player car collisions
    // Use same radius for other cars as our car
    // PERFORMANCE: Use distance squared to avoid expensive sqrt
    if (!collided && otherPlayers.length > 0) {
      const minDistance = CAR_RADIUS + CAR_RADIUS // Both cars use same radius
      const minDistanceSq = minDistance * minDistance
      for (const otherPlayer of otherPlayers) {
        const dx = newPositionRef.current.x - otherPlayer.position[0]
        const dz = newPositionRef.current.z - otherPlayer.position[2]
        const distanceSq = dx * dx + dz * dz
        
        if (distanceSq < minDistanceSq && distanceSq > 0.0001) { // Avoid division by zero (0.01^2)
          // Collision detected - push car back
          collided = true
          const distance = Math.sqrt(distanceSq)
          pushDirectionRef.current.set(dx, 0, dz).normalize()
          const overlap = minDistance - distance
          newPositionRef.current.add(pushDirectionRef.current.multiplyScalar(overlap + 0.15)) // Push back with margin
          
          // Also reduce speed on collision (like hitting another car)
          speed.current *= 0.4 // Slightly less speed reduction than obstacles (cars can push)
          break
        }
      }
    }
    
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

    // ========== POWDER SINK EFFECT (matching /snowmobile exactly) ==========
    // Snowmobile sinks in powder at rest, planes up as speed increases
    // Uses constants from initialization: SNOW_SURFACE=2.5, RIDE_HEIGHT=0.4, POWDER_SINK_MAX=3.0
    // GROUND_HEIGHT_INIT = 2.1, so at full speed: 2.1 + 0.4 = 2.5 (at snow surface)
    const planeRatio = Math.min(Math.abs(speed.current) / POWDER_PLANE_SPEED, 1)
    const powderSink = POWDER_SINK_MAX * (1 - planeRatio * planeRatio)

    // Target height follows ground with suspension + powder sink
    const targetY = GROUND_HEIGHT_INIT + RIDE_HEIGHT - powderSink

    // ========== SUSPENSION PHYSICS (matching /snowmobile exactly) ==========
    // Smooth follow with suspension force calculation
    const heightDiff = targetY - position.current.y
    const suspensionForce = heightDiff * SUSPENSION_STIFFNESS * delta
    position.current.y += suspensionForce * (1 - SUSPENSION_DAMPING)

    // Update snowmobile position and rotation (including lean)
    // Always update both to ensure they stay in sync
    carRef.current.position.copy(position.current)
    carRef.current.rotation.y = rotation.current
    carRef.current.rotation.z = leanRef.current

    const startGateState = updateStartGateState(
      position.current,
      createStartGate(startFinishPosition, startFinishDirection, trackRuntimeConfig.lapCrossing),
      isOnStartLine
    )

    const justEnteredStartLine = startGateState.justEntered
    const justLeftStartLine = startGateState.justLeft
    
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
        const cameraDistance = 15

        // SAFETY: Validate rotation before using
        let validRotation = rotation.current

        // Additional safety check for invalid values (NaN, Infinity)
        if (!isFinite(validRotation)) {
          validRotation = initialRotation
          rotation.current = initialRotation
        }

        // SIMPLIFIED: Since car rotation is no longer normalized (can be any value),
        // the camera can use car rotation directly. No need for separate tracking.
        // applyAxisAngle handles any rotation value correctly (uses sin/cos internally)
        const cameraAngle = validRotation

        // Common setup for all camera modes
        const cappedDelta = sanitizeSimulationDeltaSeconds(delta, 0.05)

        // Calculate base camera offset using continuous rotation
        cameraOffsetRef.current.set(0, 8, cameraDistance)
        // Safety: Validate rotation before applying
        if (isFinite(cameraAngle)) {
          cameraOffsetRef.current.applyAxisAngle(worldUpRef.current, cameraAngle)
        } else {
          // Fallback to initial rotation if cameraAngle is invalid
          cameraOffsetRef.current.applyAxisAngle(worldUpRef.current, initialRotation)
        }

        // SAFETY: Validate camera offset
        if (!isFinite(cameraOffsetRef.current.x) || !isFinite(cameraOffsetRef.current.y) || !isFinite(cameraOffsetRef.current.z)) {
          // Reset to safe values
          cameraOffsetRef.current.set(0, 8, cameraDistance)
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
              cameraTargetRef.current.y += 8
              cameraTargetRef.current.z += cameraDistance
            }
            
            // Use original Australia smoothing (rate 15)
            const smoothingFactor = 1 - Math.exp(-cappedDelta * 15)
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
            const predictionTime = 0.05 // 50ms ahead
            tempVec1Ref.current.multiplyScalar(predictionTime)
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
              tempVec1Ref.current.y += 8
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
              if (distanceToRaw > 25 || !isFinite(distanceToRaw)) {
                // Camera target is way too far or invalid - reset to current target
                warnRacingDiagnostic('⚠️ Targetsmooth camera target too far or invalid, resetting')
                lastCameraTarget.current.copy(tempVec1Ref.current)
              }
            }
            
            // Use slightly faster smoothing (rate 5 instead of 4) for better responsiveness in Australia
            const targetSmoothing = 1 - Math.exp(-cappedDelta * 5)
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
          cameraTargetRef.current.y += 8
          cameraTargetRef.current.z += cameraDistance
        }
        
        // Distance constraints (for all modes except simple and targetsmooth)
        // Note: 'simple' mode returns early, so this code only runs for other modes
        // Note: 'targetsmooth' already smooths the target, so distance constraints interfere with it
        // Matching San Luis constraints
        if (cameraMode !== 'targetsmooth') {
          const currentDistance = camera.position.distanceTo(position.current)
          const minDistance = 10
          const maxDistance = 20

          if (currentDistance < minDistance || currentDistance > maxDistance) {
            // Reuse tempVec3Ref for direction calculation to prevent allocation
            tempVec3Ref.current.copy(cameraTargetRef.current).sub(position.current)
            // Safety check: if direction is invalid (zero length), use forward direction instead
            if (tempVec3Ref.current.lengthSq() < 0.01) {
              // Camera target is at car position - use forward direction as fallback
              tempVec3Ref.current.copy(forwardRef.current).multiplyScalar(-1) // Camera is behind car
            }
            tempVec3Ref.current.normalize()
            const clampedDistance = Math.max(minDistance, Math.min(maxDistance, currentDistance))
            cameraTargetRef.current.copy(position.current).add(tempVec3Ref.current.multiplyScalar(clampedDistance))
          }
        }
        
        // Exponential smoothing (rate depends on mode)
        // For targetsmooth, use rate 8 (same as smooth) since target is already smoothed
        const smoothingRate = cameraMode === 'damped' ? 4 : (cameraMode === 'targetsmooth' ? 8 : (cameraMode === 'smooth' ? 8 : 15)) // Default to 15 for backward compatibility
        const smoothingFactor = 1 - Math.exp(-cappedDelta * smoothingRate)

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
    <>
      {/* Snow spray effect */}
      <SnowSpray
        speed={speed.current}
        isTurningLeft={isTurningLeft}
        isTurningRight={isTurningRight}
        isAccelerating={isOnGas}
        sledPosition={position.current}
        sledRotation={rotation.current}
      />

      <group ref={carRef} position={[0, 0, 0]}>
        <group ref={foxRef}>
          {/* Snowmobile Body */}
          <group rotation={[0, Math.PI, 0]} scale={1.9}>
            {/* Main Body/Chassis */}
            <mesh position={[0, 0.35, 0.3]} castShadow receiveShadow>
            <boxGeometry args={[1.3, 0.3, 3.2]} />
            <meshStandardMaterial color={playerColor} metalness={0.7} roughness={0.3} />
          </mesh>

          {/* Engine Hood (front) */}
          <mesh position={[0, 0.55, 1.4]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.35, 1.2]} />
            <meshStandardMaterial color={playerColor} metalness={0.7} roughness={0.3} />
          </mesh>

          {/* Engine vent */}
          <mesh position={[0, 0.75, 1.4]}>
            <boxGeometry args={[0.8, 0.05, 0.8]} />
            <meshStandardMaterial color="#111" />
          </mesh>

          {/* Windshield */}
          <mesh position={[0, 1.0, 0.9]} rotation={[-0.4, 0, 0]}>
            <boxGeometry args={[1.1, 0.7, 0.08]} />
            <meshPhysicalMaterial
              color="#88ccff"
              transmission={0.6}
              opacity={0.5}
              transparent
              roughness={0}
            />
          </mesh>

          {/* Handlebars */}
          <mesh position={[0, 0.95, 0.5]}>
            <boxGeometry args={[1.5, 0.1, 0.1]} />
            <meshStandardMaterial color="#222" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Handlebar grips */}
          <mesh position={[-0.7, 0.95, 0.5]}>
            <cylinderGeometry args={[0.08, 0.08, 0.25, 8]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <mesh position={[0.7, 0.95, 0.5]}>
            <cylinderGeometry args={[0.08, 0.08, 0.25, 8]} />
            <meshStandardMaterial color="#333" />
          </mesh>

          {/* Seat */}
          <mesh position={[0, 0.65, -0.3]} castShadow>
            <boxGeometry args={[0.9, 0.25, 1.6]} />
            <meshStandardMaterial color="#111" roughness={0.9} />
          </mesh>
          {/* Seat back rest */}
          <mesh position={[0, 0.85, -1.0]} castShadow>
            <boxGeometry args={[0.85, 0.4, 0.15]} />
            <meshStandardMaterial color="#111" roughness={0.9} />
          </mesh>

          {/* Front Skis */}
          <group position={[-0.55, 0.1, 1.5]}>
            <mesh castShadow>
              <boxGeometry args={[0.2, 0.06, 1.8]} />
              <meshStandardMaterial color="#333" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.08, 0.85]} rotation={[0.5, 0, 0]}>
              <boxGeometry args={[0.2, 0.06, 0.3]} />
              <meshStandardMaterial color="#333" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
          <group position={[0.55, 0.1, 1.5]}>
            <mesh castShadow>
              <boxGeometry args={[0.2, 0.06, 1.8]} />
              <meshStandardMaterial color="#333" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.08, 0.85]} rotation={[0.5, 0, 0]}>
              <boxGeometry args={[0.2, 0.06, 0.3]} />
              <meshStandardMaterial color="#333" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>

          {/* Long Powder Track */}
          <group position={[0, 0.25, -1.2]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.5, 0.55, 3.2]} />
              <meshStandardMaterial color="#0a0a0a" roughness={1} />
            </mesh>
            {/* Track lugs */}
            {[-1.2, -0.6, 0, 0.6, 1.2].map((z, i) => (
              <mesh key={i} position={[0, -0.22, z]}>
                <boxGeometry args={[0.55, 0.18, 0.2]} />
                <meshStandardMaterial color="#1a1a1a" roughness={1} />
              </mesh>
            ))}
            {/* Track tunnel cover */}
            <mesh position={[0, 0.35, 0]} castShadow>
              <boxGeometry args={[0.7, 0.15, 3.0]} />
              <meshStandardMaterial color={playerColor} metalness={0.6} roughness={0.4} />
            </mesh>
          </group>

          {/* Running boards */}
          <mesh position={[-0.7, 0.2, -0.2]} castShadow>
            <boxGeometry args={[0.3, 0.08, 2.0]} />
            <meshStandardMaterial color="#222" roughness={0.8} />
          </mesh>
          <mesh position={[0.7, 0.2, -0.2]} castShadow>
            <boxGeometry args={[0.3, 0.08, 2.0]} />
            <meshStandardMaterial color="#222" roughness={0.8} />
          </mesh>

          {/* Headlight */}
          <group position={[0, 0.65, 2.0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.05]}>
              <cylinderGeometry args={[0.32, 0.32, 0.15, 16]} />
              <meshStandardMaterial color={playerColor} metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0, 0.03]}>
              <circleGeometry args={[0.28, 16]} />
              <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={2.5} />
            </mesh>
          </group>

          {/* Tail light */}
          <mesh position={[0, 0.75, -2.7]}>
            <boxGeometry args={[0.6, 0.12, 0.05]} />
            <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={0.4} />
          </mesh>

          {/* VoxelFox Driver */}
          <group position={[0, 0.85, 0]} scale={0.8}>
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
    </>
  )
}
