import React, { useRef, useEffect, useMemo, useState, useCallback, memo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Sky } from '@react-three/drei'
import * as THREE from 'three'
import { GameStatus, PlayerState } from './types'
import { VoxelFox } from '../VoxelFox'
import type { VoxelBackgroundRemovalStrategy } from '../voxelization/voxelBackgroundStrategy'
import { Minimap } from './Minimap'
import { OtherPlayerSnowmobile } from './OtherPlayerSnowmobile'
import { Showroom } from './Showroom'
import { TerrainAwareAdvertisingBoards } from './TerrainAwareAdvertisingBoards'
import { StartLight } from '../racing/StartLight'
import { trackCurve, startFinishPosition, startFinishDirection, trackLength } from './TrackData'
import { StadiumSeating } from '../aspen/StadiumSeating'
import { browserRaceClock, elapsedSeconds, sanitizeSimulationDeltaSeconds } from '../../racing/simulation/raceClock'
import { SeededRandom, WORLD_SEED } from '../../racing/core/seededRandom'
import snowmobileIdleSound from '../../assets/snowmobile_idle.mp3'
import snowmobileGasSound from '../../assets/snowmobile_on_gas.mp3'
import {
  getTerrainHeight,
  getTerrainPhysicsData,
  TERRAIN_CONFIG,
  generateTerrainChunkGeometry
} from './TerrainSystem'
import { getCenterlineOffset } from '../../racing/core/trackProfile'
import { getTrackRuntimeConfig } from '../../racing/tracks/trackRuntimeConfig'
import { getOrdinalContentUrl } from '../../racing/transactions/ordinalLinks'
import { RacingFpsCounter } from '../../racing/components/RacingFpsCounter'
import { RacingCameraControlButtons } from '../../racing/components/RacingCameraControlButtons'
import { getRacingCanvasQualitySettings, getRacingMinimapQualitySettings, getRacingQualityPreset, type RacingQualityPresetId } from '../../racing/performance/qualitySettings'
import { getQualityScaledCount } from '../../racing/performance/sceneryQuality'

const trackRuntimeConfig = getTrackRuntimeConfig('aspen')
const terrainMeshGrid = trackRuntimeConfig.terrainMeshGrid ?? {
  segmentSize: 400,
  resolution: 80,
  renderDistance: 2000
}
const ASPEN_SNOWFALL_PARTICLE_COUNT = 500
const ASPEN_SNOW_SPRAY_PARTICLE_COUNT = 2500

// Camera mode type - matches Belgium track
export type CameraMode = 'simple' | 'smooth' | 'damped' | 'targetsmooth' | 'velocity'

// Snowmobile vehicle component with VoxelFox rider - BIG powder sled
const SnowmobileVehicle: React.FC<{
  color: string
  foxOriginOutpoint?: string
  backgroundRemovalStrategy?: VoxelBackgroundRemovalStrategy
  chatMessage?: string
  chatTimestamp?: number
  onFoxLoaded?: () => void
}> = ({ color, foxOriginOutpoint, backgroundRemovalStrategy = 'default', chatMessage, chatTimestamp, onFoxLoaded }) => {
  const spotlightRef = useRef<THREE.SpotLight>(null)
  const targetRef = useRef<THREE.Object3D>(null)

  // Connect spotlight to target
  useEffect(() => {
    if (spotlightRef.current && targetRef.current) {
      spotlightRef.current.target = targetRef.current
    }
  }, [])

  return (
    <group rotation={[0, Math.PI, 0]} scale={1.9}>
      {/* Main Body/Chassis - wider and longer */}
      <mesh position={[0, 0.35, 0.3]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.3, 3.2]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Engine Hood (front) - bigger */}
      <mesh position={[0, 0.55, 1.4]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.35, 1.2]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Engine vent (single) */}
      <mesh position={[0, 0.75, 1.4]}>
        <boxGeometry args={[0.8, 0.05, 0.8]} />
        <meshStandardMaterial color="#111" />
      </mesh>

      {/* Windshield - taller */}
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

      {/* Handlebars - wider */}
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

      {/* Seat - longer for 2-up riding */}
      <mesh position={[0, 0.65, -0.3]} castShadow>
        <boxGeometry args={[0.9, 0.25, 1.6]} />
        <meshStandardMaterial color="#111" roughness={0.9} />
      </mesh>
      {/* Seat back rest */}
      <mesh position={[0, 0.85, -1.0]} castShadow>
        <boxGeometry args={[0.85, 0.4, 0.15]} />
        <meshStandardMaterial color="#111" roughness={0.9} />
      </mesh>

      {/* Front Skis - bigger and wider apart */}
      <group position={[-0.55, 0.1, 1.5]}>
        <mesh castShadow>
          <boxGeometry args={[0.2, 0.06, 1.8]} />
          <meshStandardMaterial color="#333" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Ski tip curve */}
        <mesh position={[0, 0.08, 0.85]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.2, 0.06, 0.3]} />
          <meshStandardMaterial color="#333" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Ski strut */}
        <mesh position={[0, 0.25, 0.3]}>
          <boxGeometry args={[0.08, 0.3, 0.08]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      </group>
      <group position={[0.55, 0.1, 1.5]}>
        <mesh castShadow>
          <boxGeometry args={[0.2, 0.06, 1.8]} />
          <meshStandardMaterial color="#333" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Ski tip curve */}
        <mesh position={[0, 0.08, 0.85]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.2, 0.06, 0.3]} />
          <meshStandardMaterial color="#333" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Ski strut */}
        <mesh position={[0, 0.25, 0.3]}>
          <boxGeometry args={[0.08, 0.3, 0.08]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      </group>

      {/* LONG POWDER TRACK - the main feature! */}
      <group position={[0, 0.25, -1.2]}>
        {/* Track main body - LONG for deep powder */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.55, 3.2]} />
          <meshStandardMaterial color="#0a0a0a" roughness={1} />
        </mesh>

        {/* Track lugs/paddles - reduced for performance */}
        {[-1.2, -0.6, 0, 0.6, 1.2].map((z, i) => (
          <mesh key={i} position={[0, -0.22, z]}>
            <boxGeometry args={[0.55, 0.18, 0.2]} />
            <meshStandardMaterial color="#1a1a1a" roughness={1} />
          </mesh>
        ))}

        {/* Track side rails */}
        <mesh position={[-0.3, 0, 0]} castShadow>
          <boxGeometry args={[0.12, 0.6, 3.3]} />
          <meshStandardMaterial color="#0d0d0d" roughness={0.95} />
        </mesh>
        <mesh position={[0.3, 0, 0]} castShadow>
          <boxGeometry args={[0.12, 0.6, 3.3]} />
          <meshStandardMaterial color="#0d0d0d" roughness={0.95} />
        </mesh>

        {/* Rear idler wheel */}
        <mesh position={[0, 0.1, 1.4]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.25, 0.25, 0.4, 12]} />
          <meshStandardMaterial color="#222" metalness={0.8} />
        </mesh>

        {/* Front drive sprocket */}
        <mesh position={[0, 0.1, -1.4]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.3, 0.3, 0.4, 12]} />
          <meshStandardMaterial color="#222" metalness={0.8} />
        </mesh>

        {/* Track tunnel/cover - colored */}
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[0.7, 0.15, 3.0]} />
          <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
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

      {/* Exhaust - dual pipes */}
      <mesh position={[-0.35, 0.4, -2.6]} rotation={[0.15, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.6, 8]} />
        <meshStandardMaterial color="#333" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[0.35, 0.4, -2.6]} rotation={[0.15, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.6, 8]} />
        <meshStandardMaterial color="#333" metalness={0.9} roughness={0.3} />
      </mesh>

      {/* Single big centered headlight */}
      <group position={[0, 0.65, 2.0]}>
        {/* Headlight housing - sides and back in sled color */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.05]}>
          <cylinderGeometry args={[0.32, 0.32, 0.15, 16]} />
          <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Headlight lens - glowing front face */}
        <mesh position={[0, 0, 0.03]}>
          <circleGeometry args={[0.28, 16]} />
          <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={2.5} />
        </mesh>
        {/* Headlight beam - spotLight with target in front of sled */}
        <spotLight
          ref={spotlightRef}
          position={[0, 0, 0.5]}
          intensity={100}
          color="#ffffee"
          distance={100}
          angle={0.6}
          penumbra={0.4}
          decay={1.2}
        />
        {/* Target for spotlight - positioned in front of sled */}
        <object3D ref={targetRef} position={[0, -1, 20]} />
      </group>

      {/* Tail light */}
      <mesh position={[0, 0.75, -2.7]}>
        <boxGeometry args={[0.6, 0.12, 0.05]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={0.4} />
      </mesh>

      {/* VoxelFox Driver - positioned on seat */}
      <group position={[0, 0.85, 0]} scale={1.0}>
        <VoxelFox
          position={[0, 0, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          foxTextureUrl={getOrdinalContentUrl(foxOriginOutpoint) || undefined}
          backgroundRemovalStrategy={backgroundRemovalStrategy}
          color={color}
          message={chatMessage}
          messageTime={chatTimestamp}
          onTextureLoaded={onFoxLoaded}
        />
      </group>
    </group>
  )
}

// Heightmap terrain chunk component - generates mesh from noise
const TerrainChunk: React.FC<{ offsetX: number; offsetZ: number }> = ({ offsetX, offsetZ }) => {
  const meshRef = useRef<THREE.Mesh>(null)

  const geometry = useMemo(() => {
    const { positions, normals, indices } = generateTerrainChunkGeometry(
      offsetX,
      offsetZ,
      terrainMeshGrid.segmentSize,
      terrainMeshGrid.resolution
    )

    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    geom.setIndex(new THREE.BufferAttribute(indices, 1))

    return geom
  }, [offsetX, offsetZ])

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.frustumCulled = false
    }
  }, [])

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={0.05}
        roughness={0.8}
        metalness={0.0}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// Heightmap snow terrain - rolling hills generated from noise
const SnowyTerrain: React.FC = () => {
  // Generate grid of terrain chunks covering the world (4000x4000 like original)
  const chunks = useMemo(() => {
    const result: Array<{ x: number; z: number; key: string }> = []
    const chunkCount = 11 // 11x11 grid = 4400x4400 coverage with 400-size chunks
    const halfGrid = Math.floor(chunkCount / 2)

    for (let cz = -halfGrid; cz <= halfGrid; cz++) {
      for (let cx = -halfGrid; cx <= halfGrid; cx++) {
        result.push({
          x: cx * terrainMeshGrid.segmentSize,
          z: cz * terrainMeshGrid.segmentSize,
          key: `${cx}_${cz}`
        })
      }
    }
    return result
  }, [])

  return (
    <group>
      {chunks.map(chunk => (
        <TerrainChunk key={chunk.key} offsetX={chunk.x} offsetZ={chunk.z} />
      ))}
    </group>
  )
}

// Camera terrain clamp - prevents camera from going below terrain surface
const CameraTerrainClamp: React.FC = () => {
  const { camera } = useThree()

  useFrame(() => {
    // Get terrain height at camera position
    const terrainY = getTerrainHeight(camera.position.x, camera.position.z)
    const minCameraHeight = terrainY + 2 // Keep camera at least 2 units above terrain

    // Clamp camera Y to stay above terrain
    if (camera.position.y < minCameraHeight) {
      camera.position.y = minCameraHeight
    }
  })

  return null
}

// Shared cone geometry for all mountains (created once)
const sharedConeGeometry = new THREE.ConeGeometry(1, 1, 8)

// Single instanced layer component for mountains
const MountainLayer: React.FC<{
  mountains: Array<{ x: number; z: number; height: number; width: number }>
  color: string
  castShadow: boolean
}> = ({ mountains, color, castShadow }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    if (!meshRef.current) return

    // Disable frustum culling - mountains are spread across huge area
    meshRef.current.frustumCulled = false

    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()

    mountains.forEach((mountain, i) => {
      position.set(mountain.x, mountain.height / 2, mountain.z)
      quaternion.identity()
      scale.set(mountain.width, mountain.height, mountain.width)

      matrix.compose(position, quaternion, scale)
      meshRef.current!.setMatrixAt(i, matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
  }, [mountains])

  return (
    <instancedMesh
      ref={meshRef}
      args={[sharedConeGeometry, undefined, mountains.length]}
      castShadow={castShadow}
    >
      <meshStandardMaterial color={color} roughness={0.9} metalness={0.1} />
    </instancedMesh>
  )
}

// Start Gate - arch at start/finish line with stoplight
interface StartGateProps {
  gameStatus: GameStatus
  countdown: number
}

const StartGate: React.FC<StartGateProps> = ({ gameStatus, countdown }) => {
  // Calculate perpendicular direction (90 degrees from track direction)
  const perpDirection = useMemo(() => {
    return new THREE.Vector3(-startFinishDirection.z, 0, startFinishDirection.x).normalize()
  }, [])

  // Gate pole positions
  const poleOffset = 12 // Distance from center line
  const startY = getTerrainHeight(startFinishPosition.x, startFinishPosition.z)

  const leftPolePos = useMemo(() => ({
    x: startFinishPosition.x + perpDirection.x * poleOffset,
    z: startFinishPosition.z + perpDirection.z * poleOffset
  }), [perpDirection])

  const rightPolePos = useMemo(() => ({
    x: startFinishPosition.x - perpDirection.x * poleOffset,
    z: startFinishPosition.z - perpDirection.z * poleOffset
  }), [perpDirection])

  // Arch rotation to face the track
  const archRotation = Math.atan2(startFinishDirection.x, startFinishDirection.z)

  return (
    <group position={[startFinishPosition.x, startY, startFinishPosition.z]}>
      {/* Checkered flag strip on ground - wider like Belgium track */}
      <group rotation={[-Math.PI / 2, 0, archRotation]} position={[0, 0.17, 0]}>
        {Array.from({ length: 18 }).map((_, i) =>
          Array.from({ length: 4 }).map((_, j) => {
            const isBlack = (i + j) % 2 === 0
            // X position: -9 to +8 (18 squares wide, centered at 0)
            const x = (i - 9) * 1.0 + 0.5
            // Y position (becomes world Z after rotation)
            const y = (j - 1.5) * 1.0
            return (
              <mesh key={`${i}-${j}`} position={[x, y, 0]} receiveShadow>
                <planeGeometry args={[1, 1]} />
                <meshStandardMaterial color={isBlack ? '#000000' : '#FFFFFF'} />
              </mesh>
            )
          })
        )}
      </group>

      {/* Left pole - darker like Belgium */}
      <mesh position={[leftPolePos.x - startFinishPosition.x, 4, leftPolePos.z - startFinishPosition.z]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 8]} />
        <meshStandardMaterial color="#444" />
      </mesh>

      {/* Right pole */}
      <mesh position={[rightPolePos.x - startFinishPosition.x, 4, rightPolePos.z - startFinishPosition.z]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 8]} />
        <meshStandardMaterial color="#444" />
      </mesh>

      {/* Arch top beam - darker like Belgium */}
      <mesh
        position={[0, 8, 0]}
        rotation={[0, archRotation, 0]}
        castShadow
      >
        <boxGeometry args={[poleOffset * 2 + 2, 1, 1]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* 3D Start Light - Face the direction sleds approach from (opposite of track direction) */}
      <group rotation={[0, Math.atan2(-startFinishDirection.x, -startFinishDirection.z), 0]}>
        <StartLight
          countdown={countdown}
          visible={gameStatus === 'countdown' || gameStatus === 'racing'}
          gameStatus={gameStatus}
        />
      </group>
    </group>
  )
}

// Distant mountains - pushed out to not overlap track, but close enough to feel immersive
const DistantMountains: React.FC<{ radius?: number; layers?: number }> = ({
  radius = 2400,
  layers = 2
}) => {
  const mountainLayers = useMemo(() => {
    const rng = new SeededRandom(WORLD_SEED)
    const result: Array<{
      mountains: Array<{ x: number; z: number; height: number; width: number }>
      color: string
    }> = []

    for (let layer = 0; layer < layers; layer++) {
      const layerDistance = radius + (layer * 400)
      const layerRadius = layerDistance
      const numMountains = 20 + layer * 5
      const mountains: Array<{ x: number; z: number; height: number; width: number }> = []

      for (let i = 0; i < numMountains; i++) {
        const angle = (i / numMountains) * Math.PI * 2
        const angleOffset = (rng.next() - 0.5) * (Math.PI * 2 / numMountains) * 0.5
        const finalAngle = angle + angleOffset

        const distanceVariation = 1 + (rng.next() - 0.5) * 0.2
        const x = Math.cos(finalAngle) * layerRadius * distanceVariation
        const z = -400 + Math.sin(finalAngle) * layerRadius * distanceVariation

        const baseHeight = 280 - (layer * 40)
        const height = baseHeight + rng.next() * 150
        const baseWidth = 360 - (layer * 40)
        const width = baseWidth + rng.next() * 160

        mountains.push({ x, z, height, width })
      }

      // const brightness = 0.35 + (layer * 0.12) // OLD - lighter
      const brightness = 0.25 + (layer * 0.08) // NEW - darker mountains
      const color = new THREE.Color(brightness, brightness * 0.92, brightness * 0.88)

      result.push({ mountains, color: `#${color.getHexString()}` })
    }

    return result
  }, [radius, layers])

  return (
    <>
      {mountainLayers.map((layer, i) => (
        <MountainLayer
          key={i}
          mountains={layer.mountains}
          color={layer.color}
          castShadow={i === 0}
        />
      ))}
    </>
  )
}

// 3D Snowfall - heavy blizzard effect that follows player everywhere
const Snowfall: React.FC<{ playerPosition: THREE.Vector3; particleCount: number }> = ({ playerPosition, particleCount }) => {
  const particlesRef = useRef<THREE.Points>(null)
  const spawnRadius = 120 // Large area around player
  const spawnHeight = 70
  const lastPlayerPos = useRef({ x: 0, z: 0 })

  // Create snowflake positions - will be positioned relative to player
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spawnRadius * 2
      pos[i * 3 + 1] = Math.random() * spawnHeight
      pos[i * 3 + 2] = (Math.random() - 0.5) * spawnRadius * 2
    }
    return pos
  }, [particleCount])

  // Disable frustum culling on mount
  useEffect(() => {
    if (particlesRef.current) {
      particlesRef.current.frustumCulled = false
    }
  }, [])

  useFrame((state, delta) => {
    if (!particlesRef.current) return

    const posArray = particlesRef.current.geometry.attributes.position.array as Float32Array
    const windX = Math.sin(state.clock.elapsedTime * 0.5) * 3
    const windZ = Math.cos(state.clock.elapsedTime * 0.3) * 2
    const playerX = playerPosition.x
    const playerZ = playerPosition.z

    // Calculate how much player moved since last frame
    const deltaX = playerX - lastPlayerPos.current.x
    const deltaZ = playerZ - lastPlayerPos.current.z
    lastPlayerPos.current.x = playerX
    lastPlayerPos.current.z = playerZ

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3

      // Move particles with player so they stay relative
      posArray[idx] += deltaX
      posArray[idx + 2] += deltaZ

      // Fall down with wind
      posArray[idx] += delta * windX
      posArray[idx + 1] -= delta * (24 + (i % 8) * 4) // Doubled fall speed!
      posArray[idx + 2] += delta * windZ

      // Check bounds relative to player
      const distX = posArray[idx] - playerX
      const distZ = posArray[idx + 2] - playerZ
      const tooFar = Math.abs(distX) > spawnRadius || Math.abs(distZ) > spawnRadius
      const belowGround = posArray[idx + 1] < -1

      if (belowGround || tooFar) {
        // Respawn at top near player
        posArray[idx] = playerX + (Math.random() - 0.5) * spawnRadius * 2
        posArray[idx + 1] = spawnHeight + Math.random() * 20
        posArray[idx + 2] = playerZ + (Math.random() - 0.5) * spawnRadius * 2
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
        size={0.5}
        color="#ffffff"
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

// Idle sound component - starts playing during loading
const IdleSound: React.FC<{ isOnGas: boolean; isSoundEnabled: boolean }> = ({ isOnGas, isSoundEnabled }) => {
  const audioContextRef = useRef<AudioContext | null>(null)
  const idleGainRef = useRef<GainNode | null>(null)
  const gasGainRef = useRef<GainNode | null>(null)
  const idleSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const gasSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const audioStartedRef = useRef(false)
  const animationFrameRef = useRef<number | null>(null)
  const targetIdleGainRef = useRef(0.3)
  const targetGasGainRef = useRef(0)

  useEffect(() => {
    if (!snowmobileIdleSound || !snowmobileGasSound) return

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
        console.error('Failed to load audio:', err)
      }
    }

    // Animation loop for smooth crossfade
    const animate = () => {
      if (idleGainRef.current && gasGainRef.current && audioStartedRef.current) {
        const idleGain = idleGainRef.current.gain
        const gasGain = gasGainRef.current.gain

        // Smooth interpolation toward target values
        idleGain.value += (targetIdleGainRef.current - idleGain.value) * 0.1
        gasGain.value += (targetGasGainRef.current - gasGain.value) * 0.1
      }
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    startAudio()
    animate()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (idleSourceRef.current) {
        try { idleSourceRef.current.stop() } catch (e) {}
      }
      if (gasSourceRef.current) {
        try { gasSourceRef.current.stop() } catch (e) {}
      }
      audioContext.close()
    }
  }, [])

  // Update target gains based on gas state and sound enabled
  useEffect(() => {
    if (!isSoundEnabled) {
      // Sound is muted - set both to 0
      targetIdleGainRef.current = 0
      targetGasGainRef.current = 0
    } else if (isOnGas) {
      // On gas: idle very quiet, gas loud
      targetIdleGainRef.current = 0.05
      targetGasGainRef.current = 0.9
    } else {
      // Off gas: idle loud, gas silent
      targetIdleGainRef.current = 0.3
      targetGasGainRef.current = 0
    }
  }, [isOnGas, isSoundEnabled])

  return null
}

// Generate a random spawn position near center that avoids trees
const getRandomSpawnPosition = (trees: Array<{ x: number; z: number; y: number; radius: number }>): { x: number; z: number } => {
  const SPAWN_RADIUS = 30 // Max distance from center
  const SAFE_DISTANCE = 5 // Minimum distance from trees
  const MAX_ATTEMPTS = 50

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    // Random position within spawn radius
    const angle = Math.random() * Math.PI * 2
    const dist = Math.random() * SPAWN_RADIUS
    const x = Math.cos(angle) * dist
    const z = Math.sin(angle) * dist

    // Check if position is safe from all trees
    let isSafe = true
    for (const tree of trees) {
      const dx = x - tree.x
      const dz = z - tree.z
      const distToTree = Math.sqrt(dx * dx + dz * dz)
      if (distToTree < SAFE_DISTANCE + tree.radius) {
        isSafe = false
        break
      }
    }

    if (isSafe) {
      return { x, z }
    }
  }

  // Fallback to center if no safe spot found
  return { x: 0, z: 0 }
}

// Player controller with proper physics
const PlayerController: React.FC<{
  gameStatus: GameStatus
  color: string
  foxOriginOutpoint?: string
  backgroundRemovalStrategy?: VoxelBackgroundRemovalStrategy
  trees: Array<{ x: number; z: number; y: number; scale: number; radius: number }>
  otherPlayers: PlayerState[]
  onPositionUpdate: (pos: { x: number; y: number; z: number }, rot: { x: number; y: number; z: number }) => void
  onSpeedUpdate: (speed: number) => void
  onDistanceUpdate: (distance: number) => void
  onGasChange: (isOnGas: boolean) => void
  onSledReady?: () => void
  isManualCamera: boolean
  onToggleManualCamera: () => void
  localChatMessage?: { text: string; timestamp: number } | null
  cameraMode?: CameraMode
  // Lap detection callbacks
  onLapComplete?: (lapTime: number) => void
  onLapTimeUpdate?: (currentLapTime: number) => void
  onCarControlUsed?: () => void
  snowSprayParticleCount: number
}> = ({ gameStatus, color, foxOriginOutpoint, backgroundRemovalStrategy = 'default', trees, otherPlayers, onPositionUpdate, onSpeedUpdate, onDistanceUpdate, onGasChange, onSledReady, isManualCamera, onToggleManualCamera, localChatMessage, cameraMode = 'smooth', onLapComplete, onLapTimeUpdate, onCarControlUsed, snowSprayParticleCount }) => {
  const { camera } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const positionRef = useRef(new THREE.Vector3(0, -0.6, 0)) // Start sunk deep in powder
  const rotationRef = useRef(0)
  const speedRef = useRef(0)
  const bobRef = useRef(0)
  const bobIntensityRef = useRef(0) // Smoothly ramps up/down to avoid shudder
  const leanRef = useRef(0) // Lean into turns
  const pitchRef = useRef(0) // Smoothed pitch
  const [isInitialized, setIsInitialized] = useState(false) // Hide sled until positioned
  const foxLoadedRef = useRef(false) // Track if fox texture has loaded
  const racingReadyRef = useRef(false) // Track if racing position is set
  const prevPitchRef = useRef(0) // For detecting pitch changes
  const prevYRef = useRef(0) // For detecting vertical velocity
  const verticalVelocityRef = useRef(0) // Track vertical movement
  const landingSinkRef = useRef(0) // Extra sink depth after landing
  const wasAirborneRef = useRef(false) // Track if we were airborne last frame

  // Camera mode refs - for different camera behaviors
  const cameraTargetRef = useRef(new THREE.Vector3())
  const cameraOffsetRef = useRef(new THREE.Vector3())
  const lastCameraTarget = useRef(new THREE.Vector3()) // For targetsmooth mode
  const prevCameraMode = useRef<CameraMode | undefined>(undefined)
  const worldUpRef = useRef(new THREE.Vector3(0, 1, 0))
  // Camera zoom - smoothly interpolates between countdown (zoomed out) and racing (zoomed in)
  const CAMERA_DISTANCE_COUNTDOWN = 38 // Zoomed out during countdown to see start gate
  const CAMERA_DISTANCE_RACING = 22    // Zoomed in during racing
  const currentCameraDistanceRef = useRef(CAMERA_DISTANCE_COUNTDOWN) // Start zoomed out
  // Reusable temp vectors to avoid allocations
  const tempVec1Ref = useRef(new THREE.Vector3())
  const tempVec2Ref = useRef(new THREE.Vector3())
  const tempVec3Ref = useRef(new THREE.Vector3())
  const tempVec4Ref = useRef(new THREE.Vector3())

  // Distance tracking
  const totalDistanceRef = useRef(0)
  const prevPositionForDistanceRef = useRef<THREE.Vector3 | null>(null)
  const trackPositionLogCountRef = useRef(0) // For occasional track position logging

  // Lap detection refs
  const lastLapTime = useRef<number | null>(null) // Timestamp of last lap start
  const lastLapDistance = useRef(0) // Distance at last lap completion
  const hasCrossedStartLine = useRef(false) // Prevent duplicate lap detections
  const isOnStartLine = useRef(true) // Track if currently on start line (starts true since sled spawns at start)
  const lapTimeUpdateFrameCounter = useRef(0) // Throttle timer updates to every 6 frames (~10 updates/sec at 60fps)

  const [currentSpeed, setCurrentSpeed] = useState(0)
  const [turningLeft, setTurningLeft] = useState(false)
  const [turningRight, setTurningRight] = useState(false)
  const [isAccelerating, setIsAccelerating] = useState(false)
  const [sprayData, setSprayData] = useState({
    pitchDelta: 0,      // How fast pitch is changing (positive = nose diving)
    verticalVel: 0,     // Vertical velocity (negative = falling/landing)
    landingImpact: 0,   // Impact force from landing
    terrainSlope: 0,    // Current terrain slope
    isAirborne: false   // Whether sled is in the air
  })

  // Input state
  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false
  })

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow browser shortcuts (Ctrl, Alt, Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) return

      // Allow typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Toggle manual camera with 'c'
      if (e.key.toLowerCase() === 'c') {
        onToggleManualCamera()
        return
      }

      if (gameStatus !== 'racing') return

      // Only prevent default for game control keys
      const gameKeys = ['w', 's', 'a', 'd', 'g', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']
      if (gameKeys.includes(e.key.toLowerCase())) {
        e.preventDefault()
      }

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
        case 'g':
          keysRef.current.forward = true
          break
        case 's':
        case 'arrowdown':
          keysRef.current.backward = true
          break
        case 'a':
        case 'arrowleft':
          keysRef.current.left = true
          break
        case 'd':
        case 'arrowright':
          keysRef.current.right = true
          break
      }

      // Return to follow camera when car controls are used in manual mode
      if (isManualCamera && onCarControlUsed && gameKeys.includes(e.key.toLowerCase())) {
        onCarControlUsed()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
        case 'g':
          keysRef.current.forward = false
          break
        case 's':
        case 'arrowdown':
          keysRef.current.backward = false
          break
        case 'a':
        case 'arrowleft':
          keysRef.current.left = false
          break
        case 'd':
        case 'arrowright':
          keysRef.current.right = false
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [gameStatus, onToggleManualCamera, isManualCamera, onCarControlUsed])

  // Helper to check if sled should be visible
  const checkAndShowSled = () => {
    if (racingReadyRef.current && foxLoadedRef.current) {
      setIsInitialized(true)
      onSledReady?.() // Signal to parent that sled is ready
    }
  }

  // Handle fox texture loaded
  const handleFoxLoaded = () => {
    foxLoadedRef.current = true
    checkAndShowSled()
  }

  // Position at start line when countdown begins, ready for racing
  useEffect(() => {
    if (gameStatus === 'loading' || gameStatus === 'countdown' || gameStatus === 'racing') {
      // Position at start/finish line
      // Match the sunken position: terrainHeight + RIDE_HEIGHT - POWDER_SINK_MAX
      // RIDE_HEIGHT = 0.4, POWDER_SINK_MAX = 3.0, so offset = 0.4 - 3.0 = -2.6
      const startY = getTerrainHeight(startFinishPosition.x, startFinishPosition.z)
      positionRef.current.set(startFinishPosition.x, startY - 2.6, startFinishPosition.z)

      // Face the track direction (direction is already negated in TrackData for clockwise)
      rotationRef.current = Math.atan2(startFinishDirection.x, startFinishDirection.z)

      speedRef.current = 0
      bobRef.current = 0
      bobIntensityRef.current = 0
      leanRef.current = 0
      pitchRef.current = 0

      // Reset distance and lap tracking on countdown
      if (gameStatus === 'countdown') {
        totalDistanceRef.current = 0
        prevPositionForDistanceRef.current = null
        // Reset lap detection refs
        lastLapTime.current = null
        lastLapDistance.current = 0
        hasCrossedStartLine.current = false
        isOnStartLine.current = true // Start on the start line
      }

      racingReadyRef.current = true
      checkAndShowSled() // Show sled if fox is also loaded
    } else {
      setIsInitialized(false) // Hide sled when not racing/countdown/loading
      racingReadyRef.current = false
    }
  }, [gameStatus])

  useFrame((state, delta) => {
    if (!groupRef.current) return

    const keys = keysRef.current
    const canMove = gameStatus === 'racing'

    // ========== REALISTIC SNOWMOBILE PHYSICS CONSTANTS ==========
    // Power and speed
    const BASE_POWER = 28              // Base engine power
    const MAX_POWER = 65               // Peak power when track grips well
    const MAX_SPEED = 75               // Top speed on flat (km/h feel)
    const REVERSE_MAX = 15             // Max reverse speed

    // Braking and friction
    const BRAKE_FORCE = 45             // Brake deceleration
    const SNOW_FRICTION = 0.985        // Rolling resistance in powder
    const DEEP_POWDER_DRAG = 0.012     // Extra drag at low speed in deep snow

    // Terrain physics
    const GRAVITY_EFFECT = 35          // How much gravity affects speed on slopes
    const UPHILL_POWER_LOSS = 0.6      // Power reduction going uphill (0-1)
    const DOWNHILL_SPEED_BOOST = 1.3   // Extra speed potential downhill
    const SIDEHILL_SLIP_FACTOR = 0.4   // How much sidehills cause lateral slip

    // Turning
    const BASE_TURN_RATE = 2.2         // Turn speed at low velocity
    const HIGH_SPEED_TURN_RATE = 1.0   // Turn speed at max velocity
    const COUNTERSTEER_FACTOR = 0.3    // How much sidehill affects steering

    // Suspension and ride height - BLOWER POW! Chest deep powder
    const RIDE_HEIGHT = 0.4            // Low base height when planing
    const SUSPENSION_STIFFNESS = 4.0   // Very soft suspension
    const SUSPENSION_DAMPING = 0.08    // Minimal damping = maximum float
    const POWDER_SINK_MAX = 3.0        // CHEST DEEP sink at rest!
    const POWDER_PLANE_SPEED = 35      // Need real speed to plane
    const AIRBORNE_GRAVITY = 1.8       // Much stronger gravity - falls fast, no floaty jumps
    const LANDING_SINK_DEPTH = 2.5     // How deep you sink on landing
    const LANDING_SINK_RECOVERY = 3.0  // How fast you recover from landing sink

    // Pitch and roll limits
    const MAX_TERRAIN_PITCH = 0.5      // Max pitch from terrain (~28 degrees)
    const MAX_TERRAIN_ROLL = 0.4       // Max roll from sidehill (~23 degrees)
    const LEAN_INTO_TURN = 0.2         // Additional lean when turning
    const ACCEL_PITCH_BACK = 0.08      // Pitch back when accelerating hard

    if (canMove) {
      // Calculate forward direction vector
      const forwardX = Math.sin(rotationRef.current)
      const forwardZ = Math.cos(rotationRef.current)

      // ========== GET TERRAIN DATA ==========
      const terrainData = getTerrainPhysicsData(
        positionRef.current.x,
        positionRef.current.z,
        -forwardX,  // Negative because sled faces opposite to movement
        -forwardZ
      )

      const terrainHeight = terrainData.height
      const forwardSlope = terrainData.forwardSlope   // Positive = uphill
      const crossSlope = terrainData.crossSlope       // Positive = tilting right

      // ========== SLOPE-BASED ACCELERATION ==========
      const speedRatio = Math.abs(speedRef.current) / MAX_SPEED
      const isGoingUphill = forwardSlope > 0.02
      const isGoingDownhill = forwardSlope < -0.02
      const slopeAngle = Math.abs(forwardSlope)

      if (keys.forward) {
        // Base power increases with speed (track grip improves)
        let power = BASE_POWER + (MAX_POWER - BASE_POWER) * speedRatio * 0.5

        // Uphill: significantly reduced power, engine works harder
        if (isGoingUphill) {
          const uphillPenalty = 1 - (slopeAngle / 0.5) * UPHILL_POWER_LOSS
          power *= Math.max(0.2, uphillPenalty)
        }

        // Downhill: gravity assists, easier to accelerate
        if (isGoingDownhill) {
          power += Math.abs(forwardSlope) * GRAVITY_EFFECT * 0.5
        }

        // Calculate effective max speed (higher downhill, lower uphill)
        let effectiveMaxSpeed = MAX_SPEED
        if (isGoingUphill) {
          effectiveMaxSpeed = MAX_SPEED * (1 - slopeAngle * 1.5)
        } else if (isGoingDownhill) {
          effectiveMaxSpeed = MAX_SPEED * DOWNHILL_SPEED_BOOST
        }

        speedRef.current = Math.min(speedRef.current + power * delta, effectiveMaxSpeed)

      } else if (keys.backward) {
        // Braking or reversing
        if (speedRef.current > 0.5) {
          // Braking while moving forward
          speedRef.current = Math.max(0, speedRef.current - BRAKE_FORCE * delta)
        } else {
          // Reversing
          speedRef.current = Math.max(-REVERSE_MAX, speedRef.current - BASE_POWER * 0.4 * delta)
        }

      } else {
        // Coasting - apply friction and gravity
        speedRef.current *= SNOW_FRICTION

        // Deep powder drag at low speeds
        if (Math.abs(speedRef.current) < POWDER_PLANE_SPEED) {
          speedRef.current *= (1 - DEEP_POWDER_DRAG)
        }

        // Gravity effect when coasting on slopes
        if (isGoingDownhill && speedRef.current >= 0) {
          // Accelerate downhill when coasting
          speedRef.current += Math.abs(forwardSlope) * GRAVITY_EFFECT * delta * 0.7
        } else if (isGoingUphill && speedRef.current > 0) {
          // Decelerate uphill when coasting
          speedRef.current -= forwardSlope * GRAVITY_EFFECT * delta
        }

        // Stop if very slow
        if (Math.abs(speedRef.current) < 0.3) speedRef.current = 0
      }

      // ========== TURNING WITH TERRAIN INFLUENCE ==========
      // Check if airborne (can't turn in air!)
      const heightAboveTerrainForTurn = positionRef.current.y - terrainHeight
      const isAirborneForTurn = heightAboveTerrainForTurn > 1.2

      if (Math.abs(speedRef.current) > 0.5 && !isAirborneForTurn) {
        // Turn rate varies with speed (slower at high speed for stability)
        const turnRate = THREE.MathUtils.lerp(BASE_TURN_RATE, HIGH_SPEED_TURN_RATE, speedRatio)

        // Sidehill affects steering - harder to turn uphill on a sidehill
        let sidehillSteering = 0
        if (Math.abs(crossSlope) > 0.02) {
          sidehillSteering = crossSlope * COUNTERSTEER_FACTOR * speedRatio
        }

        if (keys.left) {
          rotationRef.current += (turnRate + sidehillSteering) * delta * Math.sign(speedRef.current)
        }
        if (keys.right) {
          rotationRef.current -= (turnRate - sidehillSteering) * delta * Math.sign(speedRef.current)
        }
      }
      // No turning in the air - sled maintains direction

      // ========== WALL COLLISION SYSTEM (PREDICTIVE) ==========
      const WALL_OFFSET = getCenterlineOffset(
        trackRuntimeConfig.surfaceProfile,
        trackRuntimeConfig.wallCollision.centerlineOffsetExtra
      )
      const WALL_COLLISION_DIST = WALL_OFFSET - trackRuntimeConfig.wallCollision.collisionInset
      const SLED_HALF_WIDTH = 1.4
      const SLED_FRONT_OFFSET = 4.0
      const SLED_REAR_OFFSET = 3.5

      // Helper to get sled collision points at a given position
      const getSledPoints = (cx: number, cz: number) => {
        const sledFwdX = -forwardX
        const sledFwdZ = -forwardZ
        const sledRightX = -sledFwdZ
        const sledRightZ = sledFwdX
        return [
          { x: cx + sledFwdX * SLED_FRONT_OFFSET, z: cz + sledFwdZ * SLED_FRONT_OFFSET },
          { x: cx + sledFwdX * SLED_FRONT_OFFSET - sledRightX * SLED_HALF_WIDTH, z: cz + sledFwdZ * SLED_FRONT_OFFSET - sledRightZ * SLED_HALF_WIDTH },
          { x: cx + sledFwdX * SLED_FRONT_OFFSET + sledRightX * SLED_HALF_WIDTH, z: cz + sledFwdZ * SLED_FRONT_OFFSET + sledRightZ * SLED_HALF_WIDTH },
          { x: cx - sledRightX * SLED_HALF_WIDTH, z: cz - sledRightZ * SLED_HALF_WIDTH },
          { x: cx + sledRightX * SLED_HALF_WIDTH, z: cz + sledRightZ * SLED_HALF_WIDTH },
          { x: cx - sledFwdX * SLED_REAR_OFFSET - sledRightX * SLED_HALF_WIDTH, z: cz - sledFwdZ * SLED_REAR_OFFSET - sledRightZ * SLED_HALF_WIDTH },
          { x: cx - sledFwdX * SLED_REAR_OFFSET + sledRightX * SLED_HALF_WIDTH, z: cz - sledFwdZ * SLED_REAR_OFFSET + sledRightZ * SLED_HALF_WIDTH },
        ]
      }

      // Helper to check wall collision for a single point - returns signed distance from track center
      const getWallInfo = (px: number, pz: number): { nearTrack: boolean, perpDist: number, perpX: number, perpZ: number } => {
        let closestDistSq = Infinity
        let closestT = 0

        // Use more samples for accuracy
        for (let i = 0; i < 300; i++) {
          const t = i / 300
          const tp = trackCurve.getPointAt(t)
          const dx = px - tp.x
          const dz = pz - tp.z
          const distSq = dx * dx + dz * dz
          if (distSq < closestDistSq) {
            closestDistSq = distSq
            closestT = t
          }
        }

        // Too far from track - not in wall zone
        const nearTrackDistance = trackRuntimeConfig.wallCollision.nearTrackDistance
        if (closestDistSq > nearTrackDistance * nearTrackDistance) return { nearTrack: false, perpDist: 0, perpX: 0, perpZ: 0 }

        const tp = trackCurve.getPointAt(closestT)
        const tan = trackCurve.getTangentAt(closestT).normalize()
        const perpX = -tan.z
        const perpZ = tan.x
        const toX = px - tp.x
        const toZ = pz - tp.z
        const perpDist = toX * perpX + toZ * perpZ  // Signed distance

        return { nearTrack: true, perpDist, perpX, perpZ }
      }

      // Check if any point of the sled would be in the wall at given position
      const checkSledWallCollision = (cx: number, cz: number): { collided: boolean, maxOverlap: number, pushX: number, pushZ: number } => {
        const points = getSledPoints(cx, cz)
        let maxOverlap = 0
        let totalPushX = 0
        let totalPushZ = 0
        let hitCount = 0

        for (const p of points) {
          const info = getWallInfo(p.x, p.z)
          if (info.nearTrack && Math.abs(info.perpDist) > WALL_COLLISION_DIST) {
            const overlap = Math.abs(info.perpDist) - WALL_COLLISION_DIST
            hitCount++
            totalPushX += -Math.sign(info.perpDist) * info.perpX * overlap
            totalPushZ += -Math.sign(info.perpDist) * info.perpZ * overlap
            if (overlap > maxOverlap) maxOverlap = overlap
          }
        }

        if (hitCount > 0) {
          const mag = Math.sqrt(totalPushX * totalPushX + totalPushZ * totalPushZ)
          if (mag > 0.001) {
            return { collided: true, maxOverlap, pushX: totalPushX / mag, pushZ: totalPushZ / mag }
          }
        }
        return { collided: false, maxOverlap: 0, pushX: 0, pushZ: 0 }
      }

      // ========== SIDEHILL SLIP ==========
      let slipX = 0
      let slipZ = 0
      if (Math.abs(crossSlope) > 0.05 && Math.abs(speedRef.current) > 2) {
        const slipAmount = crossSlope * SIDEHILL_SLIP_FACTOR * delta * 10
        const rightX = -forwardZ
        const rightZ = forwardX
        slipX = rightX * slipAmount
        slipZ = rightZ * slipAmount
      }

      // ========== MOVEMENT WITH PREDICTIVE COLLISION ==========
      // Calculate total intended movement (forward + sidehill)
      const intendedMoveX = -forwardX * speedRef.current * delta + slipX
      const intendedMoveZ = -forwardZ * speedRef.current * delta + slipZ

      // Store current position
      const startX = positionRef.current.x
      const startZ = positionRef.current.z

      // Check current position first - if already colliding, push out
      const currentCollision = checkSledWallCollision(startX, startZ)
      if (currentCollision.collided) {
        const pushAmount = currentCollision.maxOverlap + 3.0
        positionRef.current.x += currentCollision.pushX * pushAmount
        positionRef.current.z += currentCollision.pushZ * pushAmount
        speedRef.current *= 0.5
      }

      // Now check intended destination
      const destX = positionRef.current.x + intendedMoveX
      const destZ = positionRef.current.z + intendedMoveZ
      const destCollision = checkSledWallCollision(destX, destZ)

      if (!destCollision.collided) {
        // Safe to move to destination
        positionRef.current.x = destX
        positionRef.current.z = destZ
      } else {
        // Destination would collide - try to slide along wall
        // First, reduce speed
        speedRef.current *= 0.4

        // Try moving at reduced distance
        const moveLen = Math.sqrt(intendedMoveX * intendedMoveX + intendedMoveZ * intendedMoveZ)
        if (moveLen > 0.01) {
          // Binary search for safe distance
          let safeT = 0
          for (let step = 0.5; step >= 0.0625; step *= 0.5) {
            const testT = safeT + step
            const testX = positionRef.current.x + intendedMoveX * testT
            const testZ = positionRef.current.z + intendedMoveZ * testT
            const testCollision = checkSledWallCollision(testX, testZ)
            if (!testCollision.collided) {
              safeT = testT
            }
          }

          // Apply safe movement
          if (safeT > 0) {
            positionRef.current.x += intendedMoveX * safeT
            positionRef.current.z += intendedMoveZ * safeT
          }

          // Also try sliding along wall
          const slideX = destCollision.pushX * moveLen * 0.3
          const slideZ = destCollision.pushZ * moveLen * 0.3
          const slideDestX = positionRef.current.x + slideX
          const slideDestZ = positionRef.current.z + slideZ
          const slideCollision = checkSledWallCollision(slideDestX, slideDestZ)
          if (!slideCollision.collided) {
            positionRef.current.x = slideDestX
            positionRef.current.z = slideDestZ
          }
        }
      }

      // Final safety: ensure we're not in a wall
      for (let safety = 0; safety < 10; safety++) {
        const finalCollision = checkSledWallCollision(positionRef.current.x, positionRef.current.z)
        if (!finalCollision.collided) break
        const pushAmount = finalCollision.maxOverlap + 2.0
        positionRef.current.x += finalCollision.pushX * pushAmount
        positionRef.current.z += finalCollision.pushZ * pushAmount
        speedRef.current *= 0.3
      }

      // ========== TREE COLLISION ==========
      const SLED_RADIUS = 1.5
      for (const tree of trees) {
        const dx = positionRef.current.x - tree.x
        const dz = positionRef.current.z - tree.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        const minDist = SLED_RADIUS + tree.radius

        // Calculate tree top height (tree.y is terrain height, tree top is ~6 * scale above)
        const treeTopHeight = tree.y + 6 * tree.scale
        // Only collide if player is below tree top
        const playerY = positionRef.current.y

        if (dist < minDist && playerY < treeTopHeight) {
          const overlap = minDist - dist
          const pushX = (dx / dist) * overlap
          const pushZ = (dz / dist) * overlap

          if (keys.forward && (keys.left || keys.right)) {
            const slipDir = keys.left ? 1 : -1
            const perpX = -dz / dist * slipDir
            const perpZ = dx / dist * slipDir
            const slipAmount = 0.15 * Math.abs(speedRef.current)
            positionRef.current.x += pushX + perpX * slipAmount
            positionRef.current.z += pushZ + perpZ * slipAmount
            speedRef.current *= 0.85
          } else {
            positionRef.current.x += pushX
            positionRef.current.z += pushZ
            speedRef.current *= 0.3
          }
        }
      }

      // ========== PLAYER COLLISION ==========
      const PLAYER_COLLISION_RADIUS = 2.5
      for (const player of otherPlayers) {
        const dx = positionRef.current.x - player.position.x
        const dz = positionRef.current.z - player.position.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        const minDist = SLED_RADIUS + PLAYER_COLLISION_RADIUS

        if (dist < minDist && dist > 0.01) {
          const overlap = minDist - dist
          const pushX = (dx / dist) * overlap
          const pushZ = (dz / dist) * overlap

          if (keys.forward && (keys.left || keys.right)) {
            const slipDir = keys.left ? 1 : -1
            const perpX = -dz / dist * slipDir
            const perpZ = dx / dist * slipDir
            const slipAmount = 0.2 * Math.abs(speedRef.current)
            positionRef.current.x += pushX + perpX * slipAmount
            positionRef.current.z += pushZ + perpZ * slipAmount
            speedRef.current *= 0.9
          } else {
            positionRef.current.x += pushX
            positionRef.current.z += pushZ
            speedRef.current *= 0.5
          }
        }
      }

      // ========== START GATE POLE COLLISION ==========
      const POLE_RADIUS = 0.5
      const POLE_OFFSET = 12 // Same as StartGate
      // Calculate perpendicular direction to track at start/finish
      const perpDirX = -startFinishDirection.z
      const perpDirZ = startFinishDirection.x
      const perpLen = Math.sqrt(perpDirX * perpDirX + perpDirZ * perpDirZ)
      const normPerpX = perpDirX / perpLen
      const normPerpZ = perpDirZ / perpLen
      // Left and right pole positions
      const poles = [
        { x: startFinishPosition.x + normPerpX * POLE_OFFSET, z: startFinishPosition.z + normPerpZ * POLE_OFFSET },
        { x: startFinishPosition.x - normPerpX * POLE_OFFSET, z: startFinishPosition.z - normPerpZ * POLE_OFFSET }
      ]
      for (const pole of poles) {
        const dx = positionRef.current.x - pole.x
        const dz = positionRef.current.z - pole.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        const minDist = SLED_RADIUS + POLE_RADIUS

        if (dist < minDist && dist > 0.01) {
          const overlap = minDist - dist
          const pushX = (dx / dist) * overlap
          const pushZ = (dz / dist) * overlap

          if (keys.forward && (keys.left || keys.right)) {
            // Allow sliding around poles
            const slipDir = keys.left ? 1 : -1
            const perpX = -dz / dist * slipDir
            const perpZ = dx / dist * slipDir
            const slipAmount = 0.15 * Math.abs(speedRef.current)
            positionRef.current.x += pushX + perpX * slipAmount
            positionRef.current.z += pushZ + perpZ * slipAmount
            speedRef.current *= 0.85
          } else {
            positionRef.current.x += pushX
            positionRef.current.z += pushZ
            speedRef.current *= 0.3
          }
        }
      }

      // ========== SUSPENSION & HEIGHT WITH AIRTIME ==========
      // Powder sink effect - deeper at rest, planes at speed
      const planeRatio = Math.min(Math.abs(speedRef.current) / POWDER_PLANE_SPEED, 1)
      const powderSink = POWDER_SINK_MAX * (1 - planeRatio * planeRatio)

      // Detect if airborne (significantly above where we should be)
      const heightAboveTerrain = positionRef.current.y - terrainHeight
      const isAirborne = heightAboveTerrain > 1.5

      // Detect landing - was airborne, now touching down
      if (wasAirborneRef.current && !isAirborne) {
        // LANDING! Sink deep into the powder based on how fast we were falling
        const impactForce = Math.abs(verticalVelocityRef.current)
        landingSinkRef.current = Math.min(LANDING_SINK_DEPTH * (impactForce / 10), LANDING_SINK_DEPTH)
      }
      wasAirborneRef.current = isAirborne

      // Recover from landing sink over time
      if (landingSinkRef.current > 0) {
        landingSinkRef.current -= LANDING_SINK_RECOVERY * delta
        if (landingSinkRef.current < 0) landingSinkRef.current = 0
      }

      // Target height follows terrain with suspension + landing sink
      const targetY = terrainHeight + RIDE_HEIGHT - powderSink - landingSinkRef.current

      if (isAirborne) {
        // AIRBORNE! Apply gravity
        verticalVelocityRef.current -= 9.8 * AIRBORNE_GRAVITY * delta
        positionRef.current.y += verticalVelocityRef.current * delta

        // Don't go below terrain
        if (positionRef.current.y < terrainHeight + RIDE_HEIGHT - powderSink) {
          positionRef.current.y = terrainHeight + RIDE_HEIGHT - powderSink
        }
      } else {
        // On ground - smooth follow terrain with landing sink
        const heightDiff = targetY - positionRef.current.y
        const suspensionForce = heightDiff * SUSPENSION_STIFFNESS * delta
        positionRef.current.y += suspensionForce * (1 - SUSPENSION_DAMPING)

        // Reset vertical velocity when on ground
        verticalVelocityRef.current = 0
      }

      // ========== PITCH (terrain + acceleration) ==========
      // Base pitch from terrain slope
      let terrainPitch = THREE.MathUtils.clamp(-forwardSlope, -MAX_TERRAIN_PITCH, MAX_TERRAIN_PITCH)

      // Add acceleration pitch-back effect
      const isHardAccel = keys.forward && speedRef.current < MAX_SPEED * 0.4
      const accelPitch = isHardAccel ? ACCEL_PITCH_BACK * (1 - speedRatio * 2) : 0

      const targetPitch = terrainPitch + accelPitch

      // Smooth pitch transitions
      pitchRef.current = THREE.MathUtils.lerp(pitchRef.current, targetPitch, 0.12)

      // ========== ROLL/LEAN (terrain + turning) ==========
      // Base roll from cross-slope (sidehill)
      let terrainRoll = THREE.MathUtils.clamp(crossSlope, -MAX_TERRAIN_ROLL, MAX_TERRAIN_ROLL)

      // Add rider lean into turns
      let turnLean = 0
      if (Math.abs(speedRef.current) > 2) {
        if (keys.left) turnLean = LEAN_INTO_TURN
        if (keys.right) turnLean = -LEAN_INTO_TURN
      }

      const targetLean = terrainRoll + turnLean

      // Smooth lean transitions
      leanRef.current = THREE.MathUtils.lerp(leanRef.current, targetLean, 0.1)

      // ========== APPLY ROTATIONS ==========
      groupRef.current.rotation.x = pitchRef.current
      groupRef.current.rotation.z = leanRef.current

      // ========== BOBBING (terrain roughness) ==========
      const roughnessIntensity = Math.min(speedRatio * 1.2, 0.8)
      bobIntensityRef.current = THREE.MathUtils.lerp(bobIntensityRef.current, roughnessIntensity, 0.03)

      if (bobIntensityRef.current > 0.01) {
        const bobFreq = 6 + speedRatio * 8
        const bobAmp = 0.08 * bobIntensityRef.current
        bobRef.current = Math.sin(state.clock.elapsedTime * bobFreq) * bobAmp
        positionRef.current.y += bobRef.current
      }
    }

    // ========== UPDATE GROUP ==========
    groupRef.current.position.copy(positionRef.current)
    groupRef.current.rotation.y = rotationRef.current

    // ========== CALCULATE SPRAY DYNAMICS ==========
    // Pitch delta - how fast the nose is diving (positive = diving into snow)
    const pitchDelta = (pitchRef.current - prevPitchRef.current) / Math.max(delta, 0.001)
    prevPitchRef.current = pitchRef.current

    // Vertical velocity and landing detection
    const currentY = positionRef.current.y
    const rawVerticalVel = (currentY - prevYRef.current) / Math.max(delta, 0.001)
    prevYRef.current = currentY

    // Smooth vertical velocity
    verticalVelocityRef.current = THREE.MathUtils.lerp(
      verticalVelocityRef.current,
      rawVerticalVel,
      0.3
    )

    // Detect hard landings (was falling, now stopped or rising) - MORE SENSITIVE
    let landingImpact = 0
    if (verticalVelocityRef.current < -1 && rawVerticalVel > verticalVelocityRef.current + 0.5) {
      // Big impact based on how fast we were falling
      landingImpact = Math.abs(verticalVelocityRef.current) * 1.2
    }
    // Also trigger on any significant downward velocity change (hitting bumps)
    if (rawVerticalVel - verticalVelocityRef.current > 2) {
      landingImpact = Math.max(landingImpact, (rawVerticalVel - verticalVelocityRef.current) * 0.5)
    }

    // APPROACHING LANDING - start spray BEFORE impact when falling fast toward ground
    // This makes spray happen AS you land, not after
    const heightAboveGround = canMove ? positionRef.current.y - getTerrainHeight(positionRef.current.x, positionRef.current.z) : 10
    if (verticalVelocityRef.current < -3 && heightAboveGround < 4 && heightAboveGround > 0.5) {
      // Falling fast and close to ground - spray based on fall speed and proximity
      const proximityFactor = 1 - (heightAboveGround / 4) // 1 at ground, 0 at 4 units high
      const fallSpeed = Math.abs(verticalVelocityRef.current)
      const approachingImpact = fallSpeed * proximityFactor * 0.8
      landingImpact = Math.max(landingImpact, approachingImpact)
    }

    // Get terrain slope for spray calculations
    const terrainData = canMove ? getTerrainPhysicsData(
      positionRef.current.x,
      positionRef.current.z,
      -Math.sin(rotationRef.current),
      -Math.cos(rotationRef.current)
    ) : { forwardSlope: 0 }

    // Check if airborne for spray (using heightAboveGround already calculated)
    const isAirborneForSpray = heightAboveGround > 1.5

    setSprayData({
      pitchDelta: pitchDelta,
      verticalVel: verticalVelocityRef.current,
      landingImpact: landingImpact,
      terrainSlope: terrainData.forwardSlope,
      isAirborne: isAirborneForSpray
    })

    // ========== REPORT STATE ==========
    onSpeedUpdate(Math.abs(speedRef.current))
    setCurrentSpeed(Math.abs(speedRef.current))
    setTurningLeft(keys.left && Math.abs(speedRef.current) > 1)
    setTurningRight(keys.right && Math.abs(speedRef.current) > 1)
    setIsAccelerating(keys.forward && canMove)

    // ========== DISTANCE TRACKING ==========
    if (prevPositionForDistanceRef.current) {
      const dx = positionRef.current.x - prevPositionForDistanceRef.current.x
      const dz = positionRef.current.z - prevPositionForDistanceRef.current.z
      const distanceDelta = Math.sqrt(dx * dx + dz * dz)
      totalDistanceRef.current += distanceDelta
    }
    prevPositionForDistanceRef.current = positionRef.current.clone()
    onDistanceUpdate(totalDistanceRef.current)

    // ========== LAP DETECTION ==========
    if (canMove) {
      // Start lap timer if not already started
      if (lastLapTime.current === null) {
        lastLapTime.current = browserRaceClock.nowMs()
        lastLapDistance.current = 0
        console.log('🏁 Lap timer started')
      }

      // Check if we're near the start/finish line
      const START_LINE_RADIUS = 30 // Detection zone radius
      const distToStartX = positionRef.current.x - startFinishPosition.x
      const distToStartZ = positionRef.current.z - startFinishPosition.z
      const distToStartLine = Math.sqrt(distToStartX * distToStartX + distToStartZ * distToStartZ)

      const wasOnStartLine = isOnStartLine.current
      isOnStartLine.current = distToStartLine < START_LINE_RADIUS

      // Detect entering the start line zone (just entered)
      const justEnteredStartLine = isOnStartLine.current && !wasOnStartLine

      // Lap Detection: Check if we've crossed the start line and traveled enough distance
      if (justEnteredStartLine) {
        if (trackLength && onLapComplete && lastLapTime.current !== null) {
          const distanceSinceLastLap = totalDistanceRef.current - lastLapDistance.current
          const MIN_LAP_DISTANCE = trackLength * 0.9 // Must travel at least 90% of track length

          if (distanceSinceLastLap >= MIN_LAP_DISTANCE && !hasCrossedStartLine.current) {
            // Calculate lap time
            const nowMs = browserRaceClock.nowMs()
            const lapTime = elapsedSeconds(lastLapTime.current, nowMs)

            // Reset distance tracking BEFORE calling onLapComplete (prevents double-sends)
            lastLapDistance.current = totalDistanceRef.current
            lastLapTime.current = nowMs // Start timing next lap
            hasCrossedStartLine.current = true // Prevent immediate re-trigger

            console.log(`🏁 Lap completed: ${lapTime.toFixed(3)}s, distance: ${distanceSinceLastLap.toFixed(0)}m`)
            onLapComplete(lapTime)
          }
        }
      }

      // Reset the crossed flag when we leave the start line zone
      if (!isOnStartLine.current && hasCrossedStartLine.current) {
        hasCrossedStartLine.current = false
      }

      // Update lap time display (throttled to reduce React re-renders)
      lapTimeUpdateFrameCounter.current = (lapTimeUpdateFrameCounter.current + 1) % 6
      if (lapTimeUpdateFrameCounter.current === 0) {
        if (onLapTimeUpdate && lastLapTime.current !== null) {
          const currentLapTime = elapsedSeconds(lastLapTime.current, browserRaceClock.nowMs())
          onLapTimeUpdate(currentLapTime)
        }
      }
    }

    // ========== TRACK POSITION LOGGING ==========
    trackPositionLogCountRef.current++
    if (trackPositionLogCountRef.current % 300 === 0) { // Log every ~5 seconds at 60fps
      // Find track position t
      let closestT = 0
      let closestDistSq = Infinity
      for (let i = 0; i < 100; i++) {
        const t = i / 100
        const tp = trackCurve.getPointAt(t)
        const dx = positionRef.current.x - tp.x
        const dz = positionRef.current.z - tp.z
        const distSq = dx * dx + dz * dz
        if (distSq < closestDistSq) {
          closestDistSq = distSq
          closestT = t
        }
      }
      console.log(`📍 Track: t=${closestT.toFixed(3)}, dist=${totalDistanceRef.current.toFixed(0)}m, speed=${(speedRef.current * 3.6).toFixed(0)}km/h, pos=(${positionRef.current.x.toFixed(0)},${positionRef.current.z.toFixed(0)})`)
    }

    onGasChange(keys.forward && canMove)

    onPositionUpdate(
      { x: positionRef.current.x, y: positionRef.current.y, z: positionRef.current.z },
      { x: pitchRef.current, y: rotationRef.current, z: leanRef.current }
    )

    // ========== CAMERA FOLLOW (5 MODES) ==========
    if (!isManualCamera) {
      // Camera zoom: smoothly transition between countdown (zoomed out) and racing (zoomed in)
      const targetCameraDistance = gameStatus === 'racing' ? CAMERA_DISTANCE_RACING : CAMERA_DISTANCE_COUNTDOWN
      const zoomSpeed = gameStatus === 'racing' ? 2.0 : 3.0 // Zoom in slower for cinematic effect
      const cappedDelta = sanitizeSimulationDeltaSeconds(delta, 0.05)
      currentCameraDistanceRef.current += (targetCameraDistance - currentCameraDistanceRef.current) * cappedDelta * zoomSpeed

      // Camera position relative to sled, accounting for terrain
      const cameraHeight = 10 + Math.abs(pitchRef.current) * 3 // Higher camera on steep slopes
      const cameraDistance = currentCameraDistanceRef.current + speedRef.current * 0.08 // Slight extra at speed

      // Calculate camera offset and apply rotation
      cameraOffsetRef.current.set(0, cameraHeight, cameraDistance)
      cameraOffsetRef.current.applyAxisAngle(worldUpRef.current, rotationRef.current)

      // Camera mode-specific calculations
      let basePosition: THREE.Vector3

      switch (cameraMode) {
        case 'simple': {
          // Simple linear lerp (original Australia behavior)
          cameraTargetRef.current.copy(positionRef.current).add(cameraOffsetRef.current)

          // Use original smoothing (rate 15)
          const smoothingFactor = 1 - Math.exp(-cappedDelta * 15)
          camera.position.lerp(cameraTargetRef.current, smoothingFactor)
          camera.lookAt(positionRef.current)

          prevCameraMode.current = cameraMode
          return // Early return for simple mode
        }

        case 'velocity': {
          // Velocity-based prediction - calculate from forward direction and speed
          tempVec1Ref.current.set(0, 0, -1)
          tempVec1Ref.current.applyAxisAngle(worldUpRef.current, rotationRef.current)
          tempVec1Ref.current.multiplyScalar(speedRef.current)
          const predictionTime = 0.05 // 50ms ahead
          tempVec1Ref.current.multiplyScalar(predictionTime)
          basePosition = tempVec2Ref.current.copy(positionRef.current).add(tempVec1Ref.current)
          prevCameraMode.current = cameraMode
          break
        }

        case 'targetsmooth': {
          // Smooth the target position itself first
          tempVec1Ref.current.copy(positionRef.current).add(cameraOffsetRef.current)

          // Reset lastCameraTarget if camera mode changed
          if (prevCameraMode.current !== cameraMode) {
            lastCameraTarget.current.copy(tempVec1Ref.current)
            prevCameraMode.current = cameraMode
          } else {
            // Safety check: if lastCameraTarget is too far, reset it
            const distanceToRaw = lastCameraTarget.current.distanceTo(tempVec1Ref.current)
            if (distanceToRaw > 40 || !isFinite(distanceToRaw)) {
              lastCameraTarget.current.copy(tempVec1Ref.current)
            }
          }

          // Smooth the target (rate 5)
          const targetSmoothing = 1 - Math.exp(-cappedDelta * 5)
          lastCameraTarget.current.lerp(tempVec1Ref.current, targetSmoothing)
          basePosition = tempVec2Ref.current.copy(lastCameraTarget.current)
          prevCameraMode.current = cameraMode
          break
        }

        case 'smooth':
        case 'damped':
        default: {
          // Base smooth mode
          basePosition = tempVec4Ref.current.copy(positionRef.current)
          prevCameraMode.current = cameraMode
          break
        }
      }

      // Calculate camera target from base position
      // For targetsmooth mode, basePosition already includes the offset
      if (cameraMode === 'targetsmooth') {
        cameraTargetRef.current.copy(basePosition)
      } else {
        cameraTargetRef.current.copy(basePosition).add(cameraOffsetRef.current)
      }

      // Exponential smoothing (rate depends on mode)
      const smoothingRate = cameraMode === 'damped' ? 4 : (cameraMode === 'targetsmooth' ? 8 : (cameraMode === 'smooth' ? 8 : 15))
      const smoothingFactor = 1 - Math.exp(-cappedDelta * smoothingRate)

      // Apply smoothing to camera position
      camera.position.lerp(cameraTargetRef.current, smoothingFactor)
      camera.lookAt(positionRef.current)
    }
  })

  return (
    <>
      <group ref={groupRef} visible={isInitialized}>
        <SnowmobileVehicle
          color={color}
          foxOriginOutpoint={foxOriginOutpoint}
          backgroundRemovalStrategy={backgroundRemovalStrategy}
          chatMessage={localChatMessage?.text}
          chatTimestamp={localChatMessage?.timestamp}
          onFoxLoaded={handleFoxLoaded}
        />
      </group>
      <SnowSpray
        key={snowSprayParticleCount}
        speed={currentSpeed}
        isTurningLeft={turningLeft}
        isTurningRight={turningRight}
        isAccelerating={isAccelerating}
        sledPosition={positionRef.current}
        sledRotation={rotationRef.current}
        pitchDelta={sprayData.pitchDelta}
        verticalVel={sprayData.verticalVel}
        landingImpact={sprayData.landingImpact}
        terrainSlope={sprayData.terrainSlope}
        sledPitch={pitchRef.current}
        isAirborne={sprayData.isAirborne}
        particleCount={snowSprayParticleCount}
      />
    </>
  )
}

// Dynamic snow spray effect - BLOWER POW with massive constant spray
const SnowSpray: React.FC<{
  speed: number
  isTurningLeft: boolean
  isTurningRight: boolean
  isAccelerating: boolean
  sledPosition: THREE.Vector3
  sledRotation: number
  pitchDelta: number      // Rate of pitch change (positive = nose diving)
  verticalVel: number     // Vertical velocity
  landingImpact: number   // Landing force
  terrainSlope: number    // Current terrain slope
  sledPitch: number       // Current sled pitch
  isAirborne: boolean     // Whether sled is in the air
  particleCount: number
}> = ({
  speed, isTurningLeft, isTurningRight, isAccelerating, sledPosition, sledRotation,
  pitchDelta, verticalVel, landingImpact, terrainSlope, sledPitch, isAirborne, particleCount
}) => {
  const particlesRef = useRef<THREE.Points>(null)
  const velocitiesRef = useRef<Float32Array>(new Float32Array(particleCount * 3))
  const lifetimesRef = useRef<Float32Array>(new Float32Array(particleCount))
  const sizesRef = useRef<Float32Array>(new Float32Array(particleCount))

  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = 0
      pos[i * 3 + 1] = -10
      pos[i * 3 + 2] = 0
      lifetimesRef.current[i] = 0
      sizesRef.current[i] = 0.3
    }
    return pos
  }, [particleCount])

  // CRITICAL: Disable frustum culling so spray shows everywhere on the map
  useEffect(() => {
    if (particlesRef.current) {
      particlesRef.current.frustumCulled = false
    }
  }, [])

  // Transform local to world space (accounting for pitch)
  const localToWorld = (localX: number, localY: number, localZ: number) => {
    // First apply pitch rotation (around X-axis)
    const cosPitch = Math.cos(sledPitch)
    const sinPitch = Math.sin(sledPitch)
    const pitchedY = localY * cosPitch - localZ * sinPitch
    const pitchedZ = localY * sinPitch + localZ * cosPitch

    // Then apply yaw rotation (around Y-axis)
    const cos = Math.cos(sledRotation)
    const sin = Math.sin(sledRotation)
    return {
      x: sledPosition.x + localX * cos + pitchedZ * sin,
      y: sledPosition.y + pitchedY,
      z: sledPosition.z - localX * sin + pitchedZ * cos
    }
  }

  const localVelToWorld = (localVx: number, localVy: number, localVz: number) => {
    // First apply pitch rotation (around X-axis)
    const cosPitch = Math.cos(sledPitch)
    const sinPitch = Math.sin(sledPitch)
    const pitchedVy = localVy * cosPitch - localVz * sinPitch
    const pitchedVz = localVy * sinPitch + localVz * cosPitch

    // Then apply yaw rotation (around Y-axis)
    const cos = Math.cos(sledRotation)
    const sin = Math.sin(sledRotation)
    return {
      x: localVx * cos + pitchedVz * sin,
      y: pitchedVy,
      z: -localVx * sin + pitchedVz * cos
    }
  }

  useFrame((state, delta) => {
    if (!particlesRef.current) return

    const posArray = particlesRef.current.geometry.attributes.position.array as Float32Array
    const velocities = velocitiesRef.current
    const lifetimes = lifetimesRef.current
    const sizes = sizesRef.current

    // Get current sled position for distance checks (read fresh from the Vector3)
    const sledX = sledPosition.x
    const sledY = sledPosition.y
    const sledZ = sledPosition.z

    // ========== CALCULATE SPRAY INTENSITIES - BLOWER POW! ==========
    const baseSprayIntensity = Math.min(speed / 20, 1.5) // Even higher base!

    // Nose diving into snow - MASSIVE spray when pitch increases
    const noseDiveIntensity = Math.max(0, pitchDelta * 6) // More sensitive
    const isNoseDiving = noseDiveIntensity > 0.15

    // Going uphill into deep snow
    const uphillPlowIntensity = Math.max(0, terrainSlope) * speed * 0.1

    // Landing impact - HUGE EXPLOSION of snow
    const landingSprayIntensity = landingImpact * 8 // MASSIVE!

    // Hitting bumps (rapid vertical movement)
    const bumpIntensity = Math.abs(verticalVel) * 0.3

    // Combined intensity for spawn rate
    const totalIntensity = baseSprayIntensity + noseDiveIntensity + uphillPlowIntensity + landingSprayIntensity + bumpIntensity

    // During landing, we'll spawn extra particles
    const isLanding = landingImpact > 0.15
    // Detect starting from a stop - accelerating at low speed
    const isStartingFromStop = isAccelerating && speed < 12 && speed > 0.1

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3

      if (lifetimes[i] <= 0) {
        // Don't spawn new spray while airborne (unless landing)
        if (isAirborne && !isLanding) {
          continue
        }

        // Spawn probability - optimized single check instead of loop
        let spawnChance = 0.4 + totalIntensity * 0.3

        // Boost spawn rate for special events
        if (landingImpact > 0.2) spawnChance = 0.95
        if (isNoseDiving) spawnChance += 0.25
        if (uphillPlowIntensity > 0.15) spawnChance += 0.2
        if (isStartingFromStop) spawnChance += 0.2

        // During landing, also allow spawning even at zero speed
        const minSpeed = isLanding ? 0 : 0.3

        // Single random check (replaces expensive spawn attempt loop)
        const shouldSpawn = Math.random() < Math.min(spawnChance, 0.98)

        // Size multiplier for starting from stop - some particles 2-3x size
        let sizeMultiplier = 1.0
        if (isStartingFromStop && Math.random() < 0.4) {
          sizeMultiplier = 2.0 + Math.random() * 1.0 // 2x to 3x size
        }

        if (shouldSpawn && speed >= minSpeed) {
          let localX = 0, localY = 0, localZ = 0
          let localVx = 0, localVy = 0, localVz = 0
          let particleSize = 0.3 * sizeMultiplier

          // Determine spray type based on current conditions
          const rand = Math.random()

          // LANDING EXPLOSION - COMPLETELY OCCLUDE THE SLED IN POWDER!
          if (landingImpact > 0.1 && rand < 0.98) { // Almost ALL particles go to landing explosion
            const angle = Math.random() * Math.PI * 2
            // Mix of close particles (occlude sled) and far particles (explosion effect)
            const distType = Math.random()
            let dist: number
            if (distType < 0.5) {
              dist = Math.random() * 4 // Close particles - right on top of sled!
            } else {
              dist = 4 + Math.random() * 10 // Outer explosion ring
            }
            localX = Math.cos(angle) * dist
            localY = 0.5 + Math.random() * 4.0 // Spawn at various heights to fill the space
            localZ = Math.sin(angle) * dist

            // HUGE force that scales with impact - minimum force even for small landings
            const baseForce = 4.0 // Even bigger minimum explosion force
            const impactForce = landingImpact * (10.0 + Math.random() * 10)
            const force = baseForce + impactForce

            // Explode outward AND upward - snow bursts UP into the air!
            const outwardX = (localX / Math.max(dist, 0.1)) * 50 * force
            const outwardZ = (localZ / Math.max(dist, 0.1)) * 50 * force
            localVx = outwardX + (Math.random() - 0.5) * 50 * force
            localVy = (50 + Math.random() * 100) * force // MASSIVE upward burst!
            localVz = outwardZ + (Math.random() - 0.5) * 50 * force
            // HUGE particles - completely occlude the sled!
            particleSize = 12.0 + Math.random() * 20.0 // DOUBLED!
          }
          // NOSE DIVE PLOW - massive front spray when pitching down into snow
          else if (isNoseDiving && rand < 0.5) {
            localX = (Math.random() - 0.5) * 3
            localY = 1.0 + Math.random() * 1.5 // Higher spawn
            localZ = -3.5 - Math.random() * 2

            const diveForce = 1 + noseDiveIntensity * 2
            localVx = (Math.random() - 0.5) * 15 * diveForce
            localVy = (20 + Math.random() * 25) * diveForce // More upward
            localVz = (6 + Math.random() * 12) * diveForce
            particleSize = (1.4 + Math.random() * 1.6) * sizeMultiplier // DOUBLED!
          }
          // UPHILL PLOW - snow thrown up when climbing
          else if (uphillPlowIntensity > 0.2 && rand < 0.45) {
            localX = (Math.random() - 0.5) * 2.5
            localY = 1.0 + Math.random() * 1.0 // Higher spawn
            localZ = -3 - Math.random() * 1.5

            const plowForce = 1 + uphillPlowIntensity
            localVx = (Math.random() - 0.5) * 10 * plowForce
            localVy = (18 + Math.random() * 20) * plowForce // More upward
            localVz = (4 + Math.random() * 8) * plowForce
            particleSize = (1.2 + Math.random() * 1.4) * sizeMultiplier // DOUBLED!
          }
          // TRACK ROOSTER TAIL - BIG constant spray from back
          else if (rand < 0.55) {
            localX = (Math.random() - 0.5) * 1.8
            localY = 0.8 + Math.random() * 1.2 // Higher spawn
            localZ = 3.0 + Math.random() * 3

            const sideDir = isTurningLeft ? -1.5 : isTurningRight ? 1.5 : (Math.random() - 0.5) * 2
            const trackForce = baseSprayIntensity * (1.2 + bumpIntensity)
            localVx = sideDir * (8 + Math.random() * 14) * trackForce
            localVy = (15 + Math.random() * 20) * trackForce // More upward
            localVz = (12 + Math.random() * 20) * trackForce
            particleSize = (1.4 + Math.random() * 1.6) * sizeMultiplier // DOUBLED!
          }
          // SKI SPRAY - powder from skis
          else if (rand < 0.75) {
            const isLeft = Math.random() < 0.5
            localX = isLeft ? (-0.9 - Math.random() * 0.4) : (0.9 + Math.random() * 0.4)
            localY = 0.8 + Math.random() * 1.0 // Higher spawn
            localZ = -1 + Math.random() * 2.5

            const skiForce = baseSprayIntensity * (1 + bumpIntensity * 0.5)
            const dir = isLeft ? -1 : 1
            localVx = dir * (6 + Math.random() * 10) * skiForce
            localVy = (10 + Math.random() * 15) * skiForce // More upward
            localVz = (Math.random() - 0.3) * 5 * skiForce
            particleSize = (1.0 + Math.random() * 1.2) * sizeMultiplier // DOUBLED!
          }
          // SIDE POWDER CLOUD - ambient powder floating up
          else if (rand < 0.9) {
            const side = Math.random() < 0.5 ? -1 : 1
            localX = side * (0.3 + Math.random() * 1.5)
            localY = 1.0 + Math.random() * 1.5 // Higher spawn
            localZ = -1 + Math.random() * 4

            const cloudForce = baseSprayIntensity * 0.7
            localVx = side * (2 + Math.random() * 5) * cloudForce
            localVy = (8 + Math.random() * 12) * cloudForce // More upward
            localVz = (Math.random() - 0.5) * 4 * cloudForce
            particleSize = (1.4 + Math.random() * 1.4) * sizeMultiplier // DOUBLED!
          }
          // FRONT PLOW - continuous front spray when accelerating
          else {
            localX = (Math.random() - 0.5) * 2.5
            localY = 1.0 + Math.random() * 1.0 // Higher spawn
            localZ = -3.5 - Math.random() * 1

            const frontForce = baseSprayIntensity * (isAccelerating ? 1.3 : 0.8)
            localVx = (Math.random() - 0.5) * 8 * frontForce
            localVy = (15 + Math.random() * 18) * frontForce // More upward
            localVz = (4 + Math.random() * 8) * frontForce
            particleSize = (1.0 + Math.random() * 1.2) * sizeMultiplier // DOUBLED!
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
          lifetimes[i] = 0.8 + Math.random() * 1.2 // Longer lasting particles
        }
      } else {
        // Update particle physics
        posArray[idx] += velocities[idx] * delta
        posArray[idx + 1] += velocities[idx + 1] * delta
        posArray[idx + 2] += velocities[idx + 2] * delta

        // Stronger gravity so particles actually fall to the snow
        velocities[idx + 1] -= 12 * delta
        // Less air resistance so they keep moving
        velocities[idx] *= 0.985
        velocities[idx + 1] *= 0.99
        velocities[idx + 2] *= 0.985

        lifetimes[i] -= delta

        // RECYCLE particles that hit terrain or are too far from sled
        const dx = posArray[idx] - sledX
        const dz = posArray[idx + 2] - sledZ
        const distSq = dx * dx + dz * dz
        const MAX_DIST_SQ = 80 * 80 // 80 units max horizontal distance

        // Use estimated ground based on sled Y (avoids expensive terrain queries)
        // Sled sinks ~3 units in powder, so ground is approximately sledY + 3
        const estimatedGround = sledY - 5
        const belowTerrain = posArray[idx + 1] < estimatedGround

        if (lifetimes[i] <= 0 || distSq > MAX_DIST_SQ || belowTerrain) {
          // Force expire - particle will respawn next frame
          lifetimes[i] = 0
          posArray[idx + 1] = -100 // Move far below so it's invisible
        }
      }
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true
  })

  // Don't unmount when slow - just hide particles (prevents respawn issues)

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

// Shared geometries for instanced trees (created once) - 3 layer foliage like Belgium
const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 3, 8)
const foliage1Geometry = new THREE.ConeGeometry(1.2, 2, 8)
const foliage2Geometry = new THREE.ConeGeometry(1.0, 1.8, 8)
const foliage3Geometry = new THREE.ConeGeometry(0.8, 1.5, 8)

// Check if a point is inside the track walls (using perpendicular distance like wall collision)
const isInsideTrackWalls = (x: number, z: number): boolean => {
  const WALL_OFFSET = getCenterlineOffset(
    trackRuntimeConfig.surfaceProfile,
    trackRuntimeConfig.wallCollision.centerlineOffsetExtra
  )  // Walls are 22 units from centerline
  const TREE_BUFFER = trackRuntimeConfig.wallCollision.treeBuffer   // Extra buffer to keep trees well clear of walls
  const EXCLUSION_DIST = WALL_OFFSET + TREE_BUFFER  // Trees must be > 27 units from centerline

  // Find closest point on track
  let closestDistSq = Infinity
  let closestT = 0
  const samples = 150  // More samples for accuracy

  for (let i = 0; i < samples; i++) {
    const t = i / samples
    const trackPoint = trackCurve.getPointAt(t)
    const dx = x - trackPoint.x
    const dz = z - trackPoint.z
    const distSq = dx * dx + dz * dz

    if (distSq < closestDistSq) {
      closestDistSq = distSq
      closestT = t
    }
  }

  // If very far from track, definitely not inside walls
  if (closestDistSq > 60 * 60) {
    return false
  }

  // Calculate perpendicular distance (same method as wall collision)
  const trackPoint = trackCurve.getPointAt(closestT)
  const tangent = trackCurve.getTangentAt(closestT).normalize()

  // Perpendicular direction to track
  const perpX = -tangent.z
  const perpZ = tangent.x

  // Vector from track to point
  const toPointX = x - trackPoint.x
  const toPointZ = z - trackPoint.z

  // Signed perpendicular distance
  const signedPerpDist = toPointX * perpX + toPointZ * perpZ

  // If perpendicular distance is less than exclusion distance, point is inside track area
  return Math.abs(signedPerpDist) < EXCLUSION_DIST
}

// Generate tree positions once (shared between rendering and collision)
const generateTreePositions = () => {
  const rng = new SeededRandom(12345)
  const trees: Array<{ x: number; z: number; y: number; scale: number; radius: number }> = []

  let attempts = 0
  const maxAttempts = 700 // Try more times to compensate for track exclusion

  while (trees.length < 350 && attempts < maxAttempts) {
    attempts++
    const angle = rng.next() * Math.PI * 2
    const dist = 80 + rng.next() * 900 // Start closer, spread further

    const x = Math.cos(angle) * dist
    const z = Math.sin(angle) * dist

    // Skip if inside the track walls
    if (isInsideTrackWalls(x, z)) {
      continue
    }

    // Get terrain height at tree position
    const y = getTerrainHeight(x, z)

    // Vary tree sizes more
    const sizeType = rng.next()
    let scale: number
    if (sizeType < 0.3) {
      scale = 0.6 + rng.next() * 0.3 // Small
    } else if (sizeType < 0.7) {
      scale = 0.9 + rng.next() * 0.4 // Medium
    } else {
      scale = 1.3 + rng.next() * 0.5 // Large
    }

    trees.push({
      x,
      z,
      y,
      scale,
      radius: 0.5 * scale + 0.5 // Collision radius based on trunk size
    })
  }
  return trees
}

// Pre-generate tree positions for sharing
const TREE_POSITIONS = generateTreePositions()

// Instanced forest - fully snow-covered trees
const InstancedForest: React.FC<{ trees: Array<{ x: number; z: number; y: number; scale: number; radius: number }> }> = ({ trees }) => {
  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const foliage1Ref = useRef<THREE.InstancedMesh>(null)
  const foliage2Ref = useRef<THREE.InstancedMesh>(null)
  const foliage3Ref = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    if (!trunkRef.current || !foliage1Ref.current || !foliage2Ref.current || !foliage3Ref.current) return

    // Disable frustum culling - trees are spread across huge area
    trunkRef.current.frustumCulled = false
    foliage1Ref.current.frustumCulled = false
    foliage2Ref.current.frustumCulled = false
    foliage3Ref.current.frustumCulled = false

    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()

    trees.forEach((tree, i) => {
      const s = tree.scale
      const baseY = tree.y // Terrain height at tree position

      // Trunk: position at terrain height + 1.5 * scale height
      position.set(tree.x, baseY + 1.5 * s, tree.z)
      quaternion.identity()
      scale.set(s, s, s)
      matrix.compose(position, quaternion, scale)
      trunkRef.current!.setMatrixAt(i, matrix)

      // Foliage 1 (bottom layer): position at terrain + 3.5 * scale height
      position.set(tree.x, baseY + 3.5 * s, tree.z)
      matrix.compose(position, quaternion, scale)
      foliage1Ref.current!.setMatrixAt(i, matrix)

      // Foliage 2 (middle layer): position at terrain + 4.5 * scale height
      position.set(tree.x, baseY + 4.5 * s, tree.z)
      matrix.compose(position, quaternion, scale)
      foliage2Ref.current!.setMatrixAt(i, matrix)

      // Foliage 3 (top layer): position at terrain + 5.3 * scale height
      position.set(tree.x, baseY + 5.3 * s, tree.z)
      matrix.compose(position, quaternion, scale)
      foliage3Ref.current!.setMatrixAt(i, matrix)
    })

    trunkRef.current.instanceMatrix.needsUpdate = true
    foliage1Ref.current.instanceMatrix.needsUpdate = true
    foliage2Ref.current.instanceMatrix.needsUpdate = true
    foliage3Ref.current.instanceMatrix.needsUpdate = true
  }, [trees])

  return (
    <>
      {/* Snow-covered trunk */}
      <instancedMesh ref={trunkRef} args={[trunkGeometry, undefined, trees.length]} castShadow receiveShadow>
        <meshStandardMaterial color="#c8d8e0" />
      </instancedMesh>
      {/* Snow-covered foliage - shades of white */}
      <instancedMesh ref={foliage1Ref} args={[foliage1Geometry, undefined, trees.length]} castShadow>
        <meshStandardMaterial color="#d8e8f0" />
      </instancedMesh>
      <instancedMesh ref={foliage2Ref} args={[foliage2Geometry, undefined, trees.length]} castShadow>
        <meshStandardMaterial color="#e8f4f8" />
      </instancedMesh>
      <instancedMesh ref={foliage3Ref} args={[foliage3Geometry, undefined, trees.length]} castShadow>
        <meshStandardMaterial color="#f5fbfd" />
      </instancedMesh>
    </>
  )
}

// Camera controls API interface
export interface CameraControlsApi {
  zoomIn: () => void
  zoomOut: () => void
  rotateLeft: () => void
  rotateRight: () => void
}

// OrbitControls that follows a ref target without causing re-renders
const OrbitControlsWithTarget: React.FC<{
  targetRef: React.MutableRefObject<THREE.Vector3>
  maxPolarAngle: number
  minDistance: number
  maxDistance: number
  cameraControlRef?: React.MutableRefObject<CameraControlsApi | null>
  onStart?: () => void
  enabled?: boolean
}> = ({ targetRef, maxPolarAngle, minDistance, maxDistance, cameraControlRef, onStart, enabled = true }) => {
  const controlsRef = useRef<any>(null)

  // Expose camera control methods
  useEffect(() => {
    if (cameraControlRef) {
      cameraControlRef.current = {
        zoomIn: () => {
          if (controlsRef.current) {
            const camera = controlsRef.current.object
            const direction = new THREE.Vector3()
            camera.getWorldDirection(direction)
            camera.position.addScaledVector(direction, 5)
            controlsRef.current.update()
          }
        },
        zoomOut: () => {
          if (controlsRef.current) {
            const camera = controlsRef.current.object
            const direction = new THREE.Vector3()
            camera.getWorldDirection(direction)
            camera.position.addScaledVector(direction, -5)
            controlsRef.current.update()
          }
        },
        rotateLeft: () => {
          if (controlsRef.current) {
            controlsRef.current.autoRotate = false
            const camera = controlsRef.current.object
            const target = controlsRef.current.target
            const offset = camera.position.clone().sub(target)
            const angle = 0.2
            offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
            camera.position.copy(target).add(offset)
            controlsRef.current.update()
          }
        },
        rotateRight: () => {
          if (controlsRef.current) {
            controlsRef.current.autoRotate = false
            const camera = controlsRef.current.object
            const target = controlsRef.current.target
            const offset = camera.position.clone().sub(target)
            const angle = -0.2
            offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
            camera.position.copy(target).add(offset)
            controlsRef.current.update()
          }
        }
      }
    }
  }, [cameraControlRef])

  useFrame(() => {
    if (controlsRef.current && targetRef.current) {
      controlsRef.current.target.copy(targetRef.current)
      controlsRef.current.update()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      maxPolarAngle={maxPolarAngle}
      minDistance={minDistance}
      maxDistance={maxDistance}
      onStart={onStart}
      enabled={enabled}
    />
  )
}

// Main world props
interface SnowmobileWorldProps {
  gameStatus: GameStatus
  playerColor: string
  foxOriginOutpoint?: string
  backgroundRemovalStrategy?: VoxelBackgroundRemovalStrategy
  otherPlayers: PlayerState[]
  onPositionUpdate: (pos: { x: number; y: number; z: number }, rot: { x: number; y: number; z: number }, speed: number) => void
  onSpeedUpdate: (speed: number) => void
  onDistanceUpdate: (distance: number) => void
  localChatMessage?: { text: string; timestamp: number } | null
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onSledReady?: () => void
  countdown?: number
  cameraMode?: CameraMode
  // Lap detection callbacks
  onLapComplete?: (lapTime: number) => void
  onLapTimeUpdate?: (currentLapTime: number) => void
  onTrackLengthUpdate?: (length: number) => void
  // Additional callbacks for FoxRacingGame compatibility
  onSceneReady?: () => void
  onWorldLoaded?: () => void
  onCarLoaded?: () => void
  onGasPressed?: () => void
  onGasReleased?: () => void
  isSoundEnabled?: boolean
  spawnPosition?: { x: number; y: number; z: number } | null
  // Control whether to show internal minimap (set false when FoxRacingGame handles minimap)
  showMinimap?: boolean
  qualityPresetId?: RacingQualityPresetId
}

export const SnowmobileWorld: React.FC<SnowmobileWorldProps> = ({
  gameStatus,
  playerColor,
  foxOriginOutpoint,
  backgroundRemovalStrategy = 'default',
  otherPlayers,
  onPositionUpdate,
  onSpeedUpdate,
  onDistanceUpdate,
  localChatMessage,
  isFullscreen = false,
  onToggleFullscreen,
  onSledReady,
  countdown = 0,
  cameraMode = 'smooth',
  onLapComplete,
  onLapTimeUpdate,
  onTrackLengthUpdate,
  onSceneReady,
  onWorldLoaded,
  onCarLoaded,
  onGasPressed,
  onGasReleased,
  isSoundEnabled = false,
  spawnPosition = null,
  showMinimap = true, // Default to true for standalone snowmobilerace usage
  qualityPresetId = 'medium'
}) => {
  const qualityPreset = getRacingQualityPreset(qualityPresetId)
  const canvasQuality = getRacingCanvasQualitySettings(qualityPreset)
  const snowfallParticleCount = getQualityScaledCount(ASPEN_SNOWFALL_PARTICLE_COUNT, qualityPreset, 250)
  const snowSprayParticleCount = getQualityScaledCount(ASPEN_SNOW_SPRAY_PARTICLE_COUNT, qualityPreset, 1000)
  const [isManualCamera, setIsManualCamera] = useState(false) // Start with follow camera
  const [isOnGas, setIsOnGas] = useState(false)
  const [minimapPos, setMinimapPos] = useState<{ x: number; y: number; z: number } | null>(null)
  const [currentSpeed, setCurrentSpeed] = useState(0)
  const playerPosRef = useRef(new THREE.Vector3(0, 0, 0))
  const playerRotRef = useRef({ x: 0, y: 0, z: 0 })
  const cameraControlRef = useRef<CameraControlsApi | null>(null)
  const orbitTargetRef = useRef(new THREE.Vector3(0, 1, 0))
  const lastMinimapUpdateRef = useRef(0)

  const handleToggleManualCamera = useCallback(() => {
    setIsManualCamera(prev => !prev)
  }, [])

  // Report track length on mount
  useEffect(() => {
    if (onTrackLengthUpdate) {
      onTrackLengthUpdate(trackLength)
    }
  }, [onTrackLengthUpdate])

  // Report world loaded on mount
  useEffect(() => {
    if (onWorldLoaded) {
      // Small delay to ensure Canvas is rendered
      const timer = setTimeout(() => {
        onWorldLoaded()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [onWorldLoaded])

  // Handle gas state changes to call onGasPressed/onGasReleased
  useEffect(() => {
    if (isOnGas) {
      onGasPressed?.()
    } else {
      onGasReleased?.()
    }
  }, [isOnGas, onGasPressed, onGasReleased])

  // Handle sled ready - also call onCarLoaded and onSceneReady
  const handleSledReady = useCallback(() => {
    onSledReady?.()
    onCarLoaded?.()
    onSceneReady?.()
  }, [onSledReady, onCarLoaded, onSceneReady])

  // Camera control handlers
  const handleZoomIn = useCallback(() => cameraControlRef.current?.zoomIn(), [])
  const handleZoomOut = useCallback(() => cameraControlRef.current?.zoomOut(), [])
  const handleRotateLeft = useCallback(() => cameraControlRef.current?.rotateLeft(), [])
  const handleRotateRight = useCallback(() => cameraControlRef.current?.rotateRight(), [])

  // Wrap onPositionUpdate - use refs to avoid re-renders every frame
  // Update minimap less frequently (every 100ms) to avoid excessive re-renders
  const handlePositionUpdate = useCallback((pos: { x: number; y: number; z: number }, rot: { x: number; y: number; z: number }) => {
    playerPosRef.current.set(pos.x, pos.y, pos.z)
    playerRotRef.current = rot
    orbitTargetRef.current.set(pos.x, pos.y + 1, pos.z) // Offset Y to focus on fox rider
    onPositionUpdate(pos, rot, currentSpeed)

    // Update minimap at reduced frequency
    const now = Date.now()
    if (now - lastMinimapUpdateRef.current > 100) {
      setMinimapPos({ ...pos })
      lastMinimapUpdateRef.current = now
    }
  }, [onPositionUpdate, currentSpeed])

  // Track speed for position updates
  const handleSpeedUpdate = useCallback((newSpeed: number) => {
    setCurrentSpeed(newSpeed)
    onSpeedUpdate(newSpeed)
  }, [onSpeedUpdate])

  // Showroom mode - display rotating snowmobile preview
  if (gameStatus === 'showroom') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Canvas
          key="showroom"
          shadows={canvasQuality.shadows}
          dpr={canvasQuality.dpr}
          camera={{ position: [0, 4, 12], fov: 45 }}
          frameloop="always"
          gl={{ antialias: canvasQuality.antialias, powerPreference: 'high-performance' }}
          style={{ background: '#050510' }}
        >
          <color attach="background" args={['#050510']} />
          <ambientLight intensity={0.5} />
          <Showroom
            foxOriginOutpoint={foxOriginOutpoint}
            backgroundRemovalStrategy={backgroundRemovalStrategy}
            playerColor={playerColor}
          />
          <OrbitControls
            autoRotate
            autoRotateSpeed={0.5}
            enableZoom={true}
            enablePan={false}
            minDistance={8}
            maxDistance={20}
            maxPolarAngle={Math.PI / 2}
          />
        </Canvas>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Audio - starts during loading */}
      <IdleSound isOnGas={isOnGas} isSoundEnabled={isSoundEnabled} />

      <Canvas
        shadows={canvasQuality.shadows}
        dpr={canvasQuality.dpr}
        camera={{ position: [20, 10, 0], fov: 60, near: 1, far: 5000 }}
        frameloop="always"
        gl={{ antialias: canvasQuality.antialias && qualityPresetId === 'high', powerPreference: 'high-performance' }}
        style={{ background: 'linear-gradient(180deg, #c0d0e0 0%, #e0e8f0 50%, #f0f4f8 100%)' }}
      >
        {/* Lighting - bright for snowy day */}
        <ambientLight intensity={1.2} color="#ffffff" />
      <directionalLight
        position={[100, 80, 100]}
        intensity={1.0}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={200}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />

      {/* Sky - simple overcast, large distance to avoid visible edges */}
      {/* <Sky sunPosition={[100, 200, 100]} turbidity={8} rayleigh={0.2} distance={450000} /> */}
      {/* OLD - lighter sky ^^ */}
      {/* <Sky sunPosition={[100, 80, 100]} turbidity={10} rayleigh={0.5} distance={450000} /> */}
      {/* ^^ still too blue on opposite side */}
      <Sky sunPosition={[0, 20, 0]} turbidity={20} rayleigh={0.1} mieCoefficient={0.1} mieDirectionalG={0.8} distance={450000} />

      {/* Blizzard fog - white, denser to hide under-terrain */}
      <fog attach="fog" args={['#e8ecf0', 40, 350]} />

      {/* 3D Snowfall */}
      <Snowfall key={snowfallParticleCount} playerPosition={playerPosRef.current} particleCount={snowfallParticleCount} />

      {/* Terrain */}
      <SnowyTerrain />

      {/* Race Track Advertising Boards */}
      <TerrainAwareAdvertisingBoards />

      {/* Start Gate - arch at start/finish line with stoplight */}
      <StartGate gameStatus={gameStatus} countdown={countdown} />

      {/* Stadium Seating - crowd on both sides of start/finish line */}
      <StadiumSeating
        isSoundEnabled={isSoundEnabled}
        customPosition={startFinishPosition}
        customDirection={startFinishDirection}
        distanceFromTrack={76}
      />

      {/* Keep camera above terrain */}
      <CameraTerrainClamp />

      {/* Distant mountains */}
      <DistantMountains />

      {/* Forest */}
      <InstancedForest trees={TREE_POSITIONS} />


      {/* Player - show during loading, countdown and racing */}
      {(gameStatus === 'loading' || gameStatus === 'countdown' || gameStatus === 'racing') && (
        <PlayerController
          gameStatus={gameStatus}
          color={playerColor}
          foxOriginOutpoint={foxOriginOutpoint}
          backgroundRemovalStrategy={backgroundRemovalStrategy}
          trees={TREE_POSITIONS}
          otherPlayers={otherPlayers}
          onPositionUpdate={handlePositionUpdate}
          onSpeedUpdate={handleSpeedUpdate}
          onDistanceUpdate={onDistanceUpdate}
          onGasChange={setIsOnGas}
          onSledReady={handleSledReady}
          isManualCamera={isManualCamera}
          onToggleManualCamera={handleToggleManualCamera}
          localChatMessage={localChatMessage}
          cameraMode={cameraMode}
          onLapComplete={onLapComplete}
          onLapTimeUpdate={onLapTimeUpdate}
          onCarControlUsed={() => setIsManualCamera(false)}
          snowSprayParticleCount={snowSprayParticleCount}
        />
      )}

      {/* Manual camera controls - click and drag to enable, use sled controls to return to follow */}
      {(gameStatus === 'racing' || gameStatus === 'countdown' || gameStatus === 'loading') && (
        <OrbitControlsWithTarget
          targetRef={orbitTargetRef}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={5}
          maxDistance={100}
          cameraControlRef={cameraControlRef}
          onStart={() => setIsManualCamera(true)}
          enabled={isManualCamera}
        />
      )}

      {/* Other players with interpolated movement */}
      {otherPlayers.map(player => (
        <OtherPlayerSnowmobile
          key={player.id}
          id={player.id}
          position={player.position}
          rotation={player.rotation}
          color={player.color}
          speed={player.speed}
          localPlayerPosition={{ x: playerPosRef.current.x, y: playerPosRef.current.y, z: playerPosRef.current.z }}
          originOutpoint={player.originOutpoint}
          chatMessage={player.chatMessage}
          chatTimestamp={player.chatTimestamp}
        />
      ))}
      </Canvas>

      {/* FPS Counter - show during countdown and racing */}
      {(gameStatus === 'countdown' || gameStatus === 'racing') && <RacingFpsCounter top={140} zIndex={100} />}

      {(gameStatus === 'racing' || gameStatus === 'countdown') && (
        <RacingCameraControlButtons
          isManualCamera={isManualCamera}
          isFullscreen={isFullscreen}
          onToggleManualCamera={handleToggleManualCamera}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onRotateLeft={handleRotateLeft}
          onRotateRight={handleRotateRight}
          onToggleFullscreen={onToggleFullscreen}
        />
      )}

      {/* Minimap - shows track and player position (can be disabled when FoxRacingGame handles it) */}
      {showMinimap && (gameStatus === 'countdown' || gameStatus === 'racing') && (
        <Minimap
          carPosition={minimapPos}
          trackLocation="Aspen"
          updateEveryFrames={getRacingMinimapQualitySettings(getRacingQualityPreset(qualityPresetId)).updateEveryFrames}
        />
      )}
    </div>
  )
}
