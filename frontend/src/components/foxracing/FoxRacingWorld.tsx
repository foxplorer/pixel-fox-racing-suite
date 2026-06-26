import React, { useRef, useState, useMemo, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { UnifiedShowroom } from '../racing/UnifiedShowroom'
import { Track } from '../racing/Track'
import { GameStatus } from './FoxRacingGame'
import { FreeRoamCar, CameraMode } from './FreeRoamCar'
import { RollingHills } from '../../racing/components/RollingHills'
import { DistantVolcanoes } from '../../racing/components/DistantVolcanoes'
import { SampledTerrainMesh } from '../../racing/components/SampledTerrainMesh'
import { startFinishT } from './TrackData'
import { SeededRandom, WORLD_SEED } from '../../racing/core/seededRandom'
import { AdvertisingBoards } from './AdvertisingBoards'
import { RemotePlayerCars } from './RemotePlayerCars'
import { StadiumSeating } from './StadiumSeating'
import { StadiumSeating as SpaStadiumSeating } from '../foxracingbelgium/StadiumSeating'
import { PulseLoader } from 'react-spinners'
import type { VoxelBackgroundRemovalStrategy } from '../voxelization/voxelBackgroundStrategy'
import type { RacingGameCollectibleItem as GameItem } from '../../racing/collectibles/collectibleTypes'
import type { RacingWorldPlayer } from '../../racing/multiplayer/worldPlayers'
import { CarTrackShowroomShell } from '../../racing/components/CarTrackShowroomShell'
import { CarTrackWorldShell } from '../../racing/components/CarTrackWorldShell'
import { CarTrackLocalVehicle } from '../../racing/components/CarTrackLocalVehicle'
import { useCarTrackWorldRuntime } from '../../racing/components/useCarTrackWorldRuntime'
import { getStadiumStandPlacement } from '../../racing/components/stadiumPlacement'
import type { RacingQualityPresetId } from '../../racing/performance/qualitySettings'
import { getQualityScaledCount } from '../../racing/performance/sceneryQuality'
import { australiaCarTrackDefinition } from '../../racing/tracks/carTrackDefinitions'
import type { CarTrackDefinition, CarTrackRenderBudget } from '../../racing/tracks/carTrackDefinitions'
import { ImportedCarTrackScenery } from '../../racing/tracks/imported/ImportedCarTrackScenery'
import type { TerrainHeightSampler } from '../../racing/core/roadCorridor'
import { RacingCameraControlButtons } from '../../racing/components/RacingCameraControlButtons'
import { TrackBillboardForest } from '../../racing/components/forest/TrackBillboardForest'
import type { BillboardForestOptions } from '../../racing/components/forest/billboardForestPlacement'
import {
  computeLavaBasinSurfaceY,
  createLavaCrossings,
  createVolcanoLavaBasin,
  createVolcanoLavaPitJumpZones,
  createVolcanoLavaPitRampZones,
  createVolcanoLavaPitRoadExclusionIntervals
} from '../../racing/tracks/imported/volcanoes/volcanoCavePlacement'
import type { CarLavaHazard } from '../../racing/vehicles/carLavaHazard'

// Additional stadium positions around the track - spaced around from start line
const ADDITIONAL_STADIUM_POSITIONS = [
  (startFinishT + 2/3) % 1  // 2/3 of the way around
]

const MELBOURNE_RAIN_DROP_COUNT = 1400
const MELBOURNE_RAIN_AREA = 900
const MELBOURNE_RAIN_HEIGHT = 220
const MELBOURNE_RAIN_BOTTOM = 8
const MELBOURNE_RAIN_SLANT = new THREE.Vector3(-9, -34, 4)
const MELBOURNE_RAIN_MIN_STREAK = 1.4
const MELBOURNE_RAIN_STREAK_VARIATION = 1.4
const DEFAULT_SHADOW_CAMERA_EXTENT = 1000
const IMPORTED_SHADOW_CAMERA_EXTENT = 1800
const IMPORTED_TERRAIN_RESOLUTION = 420
const IMPORTED_TERRAIN_Y_OFFSET = -0.12
const UNITED_KINGDOM_TERRAIN_Y_OFFSET = -0.24
const IMPORTED_SHADOW_MAP_SIZE = 4096
const DEFAULT_SHADOW_MAP_SIZE = 2048
const START_STADIUM_DISTANCE_FROM_TRACK = 48
const START_STADIUM_ROWS = 7
const START_STADIUM_SEATS_PER_ROW = 25
const START_STADIUM_SEAT_WIDTH = 3
const START_STADIUM_ROW_DEPTH = 4.5
const START_STADIUM_PAD_BLEND = 20

// Camera position will be set by follow camera in FreeRoamCar component
// Initial position set for smooth transition during countdown

interface FoxRacingWorldProps {
  gameStatus: GameStatus
  onCrash: () => void
  onScoreUpdate: (score: number) => void
  onDistanceUpdate?: (distance: number) => void
  onTrackLengthUpdate?: (length: number) => void
  onLapComplete?: (lapTime: number) => void
  onLapTimeUpdate?: (currentLapTime: number) => void // Callback to update visual timer
  onSpeedUpdate?: (speed: number) => void // Callback to update speed display (m/s)
  foxOriginOutpoint?: string | null
  backgroundRemovalStrategy?: VoxelBackgroundRemovalStrategy
  playerColor: string
  countdown?: number
  onSceneReady?: () => void
  onGasPressed?: () => void
  onGasReleased?: () => void
  isSoundEnabled?: boolean
  onWorldLoaded?: () => void
  onCarLoaded?: () => void
  items?: GameItem[]
  onCollectItem?: (itemId: string) => void
  otherPlayers?: RacingWorldPlayer[]
  onPositionUpdateForSocket?: (position: THREE.Vector3, rotation: number, speed: number, headlightsEnabled?: boolean) => void
  spawnPosition?: { x: number; y: number; z: number } | null
  localChatMessage?: { text: string; timestamp: number } | null
  cameraMode?: CameraMode
  onShowroomLoaded?: () => void
  showroomLoading?: boolean
  qualityPresetId?: RacingQualityPresetId
  trackDefinition?: CarTrackDefinition
  sceneryMode?: 'australia' | 'imported-basic'
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

const resolveQualityNumberBudget = (
  budget: number | Partial<Record<RacingQualityPresetId, number>> | undefined,
  qualityPresetId: RacingQualityPresetId,
  fallback: number
): number => {
  if (typeof budget === 'number') return budget

  const qualityValue = budget?.[qualityPresetId]
  if (typeof qualityValue === 'number') return qualityValue

  const mediumValue = budget?.medium
  if (typeof mediumValue === 'number') return mediumValue

  return fallback
}

const getTrackRenderBudgetValue = (
  renderBudget: CarTrackRenderBudget | undefined,
  qualityPresetId: RacingQualityPresetId,
  defaults: {
    terrainResolution: number
    terrainYOffset: number
    shadowCameraExtent: number
    shadowMapSize: number
    shadowCameraFar: number
  }
) => ({
  terrainResolution: resolveQualityNumberBudget(
    renderBudget?.sampledTerrain?.resolution,
    qualityPresetId,
    defaults.terrainResolution
  ),
  terrainYOffset: renderBudget?.sampledTerrain?.yOffset ?? defaults.terrainYOffset,
  shadowCameraExtent: renderBudget?.shadows?.cameraExtent ?? defaults.shadowCameraExtent,
  shadowMapSize: resolveQualityNumberBudget(
    renderBudget?.shadows?.mapSize,
    qualityPresetId,
    defaults.shadowMapSize
  ),
  shadowCameraFar: renderBudget?.shadows?.cameraFar ?? defaults.shadowCameraFar
})

const smoothstep = (value: number) => {
  const t = Math.min(Math.max(value, 0), 1)
  return t * t * (3 - 2 * t)
}

const createStartStadiumTerrainSampler = (
  getHeightAtPosition: TerrainHeightSampler | undefined,
  trackDefinition: CarTrackDefinition,
  enabled: boolean
): TerrainHeightSampler | undefined => {
  if (!getHeightAtPosition || !enabled) return getHeightAtPosition

  const placement = getStadiumStandPlacement({
    basePosition: trackDefinition.startFinishPosition,
    baseDirection: trackDefinition.startFinishDirection,
    distanceFromTrack: START_STADIUM_DISTANCE_FROM_TRACK,
    groundY: 0
  })
  const baseWidth = START_STADIUM_SEATS_PER_ROW * START_STADIUM_SEAT_WIDTH + 10 + 12
  const baseDepth = START_STADIUM_ROWS * START_STADIUM_ROW_DEPTH + 14
  const padWidth = baseWidth + 24
  const padDepth = baseDepth + 24
  const padCenterZ = baseDepth / 2 + 6

  const pads = [
    { position: placement.leftPos, rotation: placement.leftRotation },
    { position: placement.rightPos, rotation: placement.rightRotation }
  ].map(pad => {
    const sin = Math.sin(pad.rotation)
    const cos = Math.cos(pad.rotation)
    const centerX = pad.position.x + sin * padCenterZ
    const centerZ = pad.position.z + cos * padCenterZ
    return {
      ...pad,
      sin,
      cos,
      height: getHeightAtPosition(centerX, centerZ)
    }
  })

  return (x, z) => {
    let height = getHeightAtPosition(x, z)

    for (const pad of pads) {
      const dx = x - pad.position.x
      const dz = z - pad.position.z
      const localX = dx * pad.cos - dz * pad.sin
      const localZ = dx * pad.sin + dz * pad.cos
      const edgeDistance = Math.max(
        Math.abs(localX) - padWidth / 2,
        Math.abs(localZ - padCenterZ) - padDepth / 2
      )

      if (edgeDistance <= 0) {
        height = pad.height
      } else if (edgeDistance < START_STADIUM_PAD_BLEND) {
        const terrainInfluence = smoothstep(edgeDistance / START_STADIUM_PAD_BLEND)
        height = pad.height * (1 - terrainInfluence) + height * terrainInfluence
      }
    }

    return height
  }
}

const AustraliaRain: React.FC<{ dropCount: number }> = ({ dropCount }) => {
  const rainRef = useRef<THREE.LineSegments>(null)
  const { camera } = useThree()

  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(dropCount * 2 * 3)
    const speeds = new Float32Array(dropCount)
    const rng = new SeededRandom(WORLD_SEED + 611)

    for (let i = 0; i < dropCount; i++) {
      const offset = i * 6
      const x = (rng.next() - 0.5) * MELBOURNE_RAIN_AREA
      const y = MELBOURNE_RAIN_BOTTOM + rng.next() * MELBOURNE_RAIN_HEIGHT
      const z = (rng.next() - 0.5) * MELBOURNE_RAIN_AREA
      const streak = MELBOURNE_RAIN_MIN_STREAK + rng.next() * MELBOURNE_RAIN_STREAK_VARIATION

      positions[offset] = x
      positions[offset + 1] = y
      positions[offset + 2] = z
      positions[offset + 3] = x + MELBOURNE_RAIN_SLANT.x * (streak / 34)
      positions[offset + 4] = y - streak
      positions[offset + 5] = z + MELBOURNE_RAIN_SLANT.z * (streak / 34)
      speeds[i] = 72 + rng.next() * 46
    }

    return { positions, speeds }
  }, [dropCount])

  useFrame((_, delta) => {
    const geometry = rainRef.current?.geometry
    const positionAttribute = geometry?.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!positionAttribute) return

    const array = positionAttribute.array as Float32Array
    const halfArea = MELBOURNE_RAIN_AREA / 2
    const cameraX = camera.position.x
    const cameraZ = camera.position.z

    for (let i = 0; i < dropCount; i++) {
      const offset = i * 6
      const fall = speeds[i] * delta
      array[offset] += MELBOURNE_RAIN_SLANT.x * delta
      array[offset + 1] -= fall
      array[offset + 2] += MELBOURNE_RAIN_SLANT.z * delta
      array[offset + 3] += MELBOURNE_RAIN_SLANT.x * delta
      array[offset + 4] -= fall
      array[offset + 5] += MELBOURNE_RAIN_SLANT.z * delta

      if (
        array[offset + 1] < MELBOURNE_RAIN_BOTTOM ||
        Math.abs(array[offset] - cameraX) > halfArea ||
        Math.abs(array[offset + 2] - cameraZ) > halfArea
      ) {
        const phase = (i * 37.17 + performance.now() * 0.001) % 1
        const spread = ((i * 91.73) % MELBOURNE_RAIN_AREA) - halfArea
        const cross = (((i * 53.41) + phase * 300) % MELBOURNE_RAIN_AREA) - halfArea
        const x = cameraX + spread
        const y = MELBOURNE_RAIN_BOTTOM + MELBOURNE_RAIN_HEIGHT * (0.72 + phase * 0.28)
        const z = cameraZ + cross
        const streak = MELBOURNE_RAIN_MIN_STREAK + (i % 9) / 8 * MELBOURNE_RAIN_STREAK_VARIATION

        array[offset] = x
        array[offset + 1] = y
        array[offset + 2] = z
        array[offset + 3] = x + MELBOURNE_RAIN_SLANT.x * (streak / 34)
        array[offset + 4] = y - streak
        array[offset + 5] = z + MELBOURNE_RAIN_SLANT.z * (streak / 34)
      }
    }

    positionAttribute.needsUpdate = true
  })

  return (
    <lineSegments ref={rainRef} frustumCulled={false} renderOrder={5}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#c8d8e6" transparent opacity={0.44} depthWrite={false} />
    </lineSegments>
  )
}

export const FoxRacingWorld: React.FC<FoxRacingWorldProps> = ({
  gameStatus,
  onCrash,
  onScoreUpdate,
  onDistanceUpdate,
  onTrackLengthUpdate,
  onLapComplete,
  onLapTimeUpdate,
  onSpeedUpdate,
  foxOriginOutpoint,
  backgroundRemovalStrategy = 'default',
  playerColor,
  countdown = 0,
  onSceneReady,
  onGasPressed,
  onGasReleased,
  isSoundEnabled = false,
  onWorldLoaded,
  onCarLoaded,
  items = [],
  onCollectItem,
  otherPlayers = [],
  onPositionUpdateForSocket,
  spawnPosition = null,
  localChatMessage = null,
  cameraMode = 'smooth',
  onShowroomLoaded,
  showroomLoading = true,
  qualityPresetId = 'medium',
  trackDefinition = australiaCarTrackDefinition,
  sceneryMode = 'australia',
  isFullscreen = false,
  onToggleFullscreen
}) => {
  const worldRuntime = useCarTrackWorldRuntime({
    config: trackDefinition,
    gameStatus,
    qualityPresetId,
    onTrackLengthUpdate,
    onWorldLoaded,
    onSceneReady
  })
  const rainDropCount = getQualityScaledCount(MELBOURNE_RAIN_DROP_COUNT, worldRuntime.qualityPreset, 400)
  const hillLayers = worldRuntime.sceneryQuality.rollingHillLayers
  const isImportedScenery = sceneryMode !== 'australia'
  const isRainyAustralia = sceneryMode === 'australia'
  const isVolcano = trackDefinition.trackId === 'volcanoes'
  const initialHeadlightsEnabled = true
  const terrainHeightSampler = worldRuntime.terrainHeightSampler
  const sceneHeightSampler = useMemo(() => createStartStadiumTerrainSampler(
    terrainHeightSampler,
    trackDefinition,
    trackDefinition.trackId === 'australia' || trackDefinition.trackId === 'belgium' || trackDefinition.trackId === 'germany'
  ), [sceneryMode, terrainHeightSampler, trackDefinition])
  const isTerrainAwareScenery = Boolean(terrainHeightSampler)
  // Volcano lighting: warm molten glow rather than a near-black cave. Ambient and
  // sun are pushed up and tinted orange so the whole arena reads as lit by lava,
  // and the terrain is warmed so it catches that glow instead of swallowing it.
  const skyColor = isVolcano ? '#3a1c0c' : isRainyAustralia ? '#52616c' : isTerrainAwareScenery ? '#87CEEB' : '#52616c'
  const fogColor = isVolcano ? '#502711' : isRainyAustralia ? '#5f6f7b' : isTerrainAwareScenery ? '#87CEEB' : '#5f6f7b'
  const ambientColor = isVolcano ? '#ffa85a' : isRainyAustralia ? '#b7c3cf' : isTerrainAwareScenery ? '#ffffff' : '#b7c3cf'
  const ambientIntensity = isVolcano ? 1.25 : isRainyAustralia ? 0.42 : isTerrainAwareScenery ? 0.6 : 0.42
  const sunIntensity = isVolcano ? 0.95 : isRainyAustralia ? 0.45 : isTerrainAwareScenery ? 1 : 0.45
  const sunColor = isVolcano ? '#ffc279' : isRainyAustralia ? '#d6dde3' : isTerrainAwareScenery ? '#ffffff' : '#d6dde3'
  const terrainColor = isVolcano ? '#5e3a25' : undefined
  const fogNear = isVolcano ? 120 : isTerrainAwareScenery ? 150 : 140
  const fogFar = isVolcano ? 900 : isTerrainAwareScenery ? 1100 : 1400
  // Lava-pit launch zones (volcano only) — same pit centers the scenery draws,
  // so the car arcs over exactly where the molten gaps cut the track.
  const lavaPitJumpZones = useMemo(
    () => (isVolcano ? createVolcanoLavaPitJumpZones(worldRuntime.trackCurve) : []),
    [isVolcano, worldRuntime.trackCurve]
  )
  // Ramp surfaces flanking each pit — the raised ground the car climbs into the
  // launch. Same pit data as the jump zones, so the lip lines up with the launch.
  const lavaPitRampZones = useMemo(
    () => (isVolcano ? createVolcanoLavaPitRampZones(worldRuntime.trackCurve) : []),
    [isVolcano, worldRuntime.trackCurve]
  )
  const lavaPitRoadExclusionIntervals = useMemo(
    () => (isVolcano ? createVolcanoLavaPitRoadExclusionIntervals(worldRuntime.trackCurve) : []),
    [isVolcano, worldRuntime.trackCurve]
  )
  // Molten regions that destroy the car on contact: the central lava lake plus each
  // jump pit's open gap. Driving in (or failing a jump into a pit) burns the car up.
  const lavaHazard = useMemo<CarLavaHazard | undefined>(() => {
    if (!isVolcano) return undefined
    const basin = createVolcanoLavaBasin(worldRuntime.trackCurve)
    return {
      // surfaceY = the rendered lava sheet's height (same sampler the visual plane
      // uses), so the central-lake kill zone only fires where the car is genuinely
      // over visible lava — not on rock that pokes above the buried sheet.
      polygons: [{
        boundary: basin.boundary,
        surfaceY: computeLavaBasinSurfaceY(basin, sceneHeightSampler)
      }],
      pits: createLavaCrossings(worldRuntime.trackCurve).map(crossing => ({
        x: crossing.x,
        z: crossing.z,
        forwardX: Math.sin(crossing.angle),
        forwardZ: Math.cos(crossing.angle),
        halfLength: crossing.length / 2,
        halfWidth: crossing.width / 2
      }))
    }
  }, [isVolcano, worldRuntime.trackCurve, sceneHeightSampler])
  const renderBudget = getTrackRenderBudgetValue(trackDefinition.renderBudget, worldRuntime.qualityPreset.id, {
    terrainResolution: isTerrainAwareScenery ? IMPORTED_TERRAIN_RESOLUTION : 160,
    terrainYOffset: trackDefinition.trackId === 'united-kingdom' ? UNITED_KINGDOM_TERRAIN_Y_OFFSET : IMPORTED_TERRAIN_Y_OFFSET,
    shadowCameraExtent: isTerrainAwareScenery ? IMPORTED_SHADOW_CAMERA_EXTENT : DEFAULT_SHADOW_CAMERA_EXTENT,
    shadowMapSize: isTerrainAwareScenery ? IMPORTED_SHADOW_MAP_SIZE : DEFAULT_SHADOW_MAP_SIZE,
    shadowCameraFar: isTerrainAwareScenery ? 3200 : 2000
  })
  const [treePositions, setTreePositions] = useState<Array<{ x: number; z: number; scale: number; radius: number }>>([])
  const [advertisingBoardPositions, setAdvertisingBoardPositions] = useState<Array<{
    curve: THREE.CatmullRomCurve3
    startT: number
    endT: number
    offset: number
    side: 'left' | 'right'
    height: number
  }>>([])
  // Additional stadium seating positions around the track (outside only)
  const additionalStadiumData = useMemo(() => {
    if (sceneryMode !== 'australia' || sceneHeightSampler) return []

    return ADDITIONAL_STADIUM_POSITIONS.map(t => {
      const position = worldRuntime.trackCurve.getPointAt(t)
      const direction = worldRuntime.trackCurve.getTangentAt(t).normalize()
      return { position, direction }
    })
  }, [sceneryMode, sceneHeightSampler, worldRuntime.trackCurve])

  const forestOptions = useMemo<BillboardForestOptions>(() => {
    const stadium = getStadiumStandPlacement({
      basePosition: trackDefinition.startFinishPosition,
      baseDirection: trackDefinition.startFinishDirection,
      distanceFromTrack: START_STADIUM_DISTANCE_FROM_TRACK,
      groundY: 0
    })
    // Billboard trees can be more than 40 units wide at the canopy. Keep their
    // centers well outside the seating footprint so foliage does not clip into
    // the stands even when a card faces the camera broadside.
    const radius = (START_STADIUM_SEATS_PER_ROW * START_STADIUM_SEAT_WIDTH) / 2 + 30
    return {
      exclusionZones: [
        { x: stadium.leftPos.x, z: stadium.leftPos.z, radius },
        { x: stadium.rightPos.x, z: stadium.rightPos.z, radius }
      ]
    }
  }, [trackDefinition.startFinishDirection, trackDefinition.startFinishPosition])

  const handleToggleManualCamera = useCallback(() => {
    const manualCam = worldRuntime.manualCamera
    manualCam.setIsManualCamera(prev => {
      const next = !prev
      if (next) manualCam.focusControlsOnCar()
      return next
    })
  }, [worldRuntime.manualCamera])

  const handleZoomIn = useCallback(() => {
    const controls = worldRuntime.manualCamera.orbitControlsRef.current as any
    if (!controls?.object) return
    const direction = new THREE.Vector3()
    controls.object.getWorldDirection(direction)
    controls.object.position.addScaledVector(direction, 5)
    controls.update()
  }, [worldRuntime.manualCamera.orbitControlsRef])

  const handleZoomOut = useCallback(() => {
    const controls = worldRuntime.manualCamera.orbitControlsRef.current as any
    if (!controls?.object) return
    const direction = new THREE.Vector3()
    controls.object.getWorldDirection(direction)
    controls.object.position.addScaledVector(direction, -5)
    controls.update()
  }, [worldRuntime.manualCamera.orbitControlsRef])

  const handleRotateLeft = useCallback(() => {
    const controls = worldRuntime.manualCamera.orbitControlsRef.current as any
    if (!controls?.object) return
    const offset = controls.object.position.clone().sub(controls.target)
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.2)
    controls.object.position.copy(controls.target).add(offset)
    controls.update()
  }, [worldRuntime.manualCamera.orbitControlsRef])

  const handleRotateRight = useCallback(() => {
    const controls = worldRuntime.manualCamera.orbitControlsRef.current as any
    if (!controls?.object) return
    const offset = controls.object.position.clone().sub(controls.target)
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.2)
    controls.object.position.copy(controls.target).add(offset)
    controls.update()
  }, [worldRuntime.manualCamera.orbitControlsRef])

  // Showroom Canvas
  if (gameStatus === 'showroom' || gameStatus === 'idle') {
    return (
      <CarTrackShowroomShell
        canvasQuality={worldRuntime.canvasQuality}
        overlay={showroomLoading && gameStatus === 'showroom' ? (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#050510',
            zIndex: 10
          }}>
            <PulseLoader color="#ffffff" size={20} />
          </div>
        ) : undefined}
      >
        {gameStatus === 'showroom' && (
          <UnifiedShowroom
            foxOriginOutpoint={foxOriginOutpoint}
            backgroundRemovalStrategy={backgroundRemovalStrategy}
            playerColor={playerColor}
            vehicleType="car"
            qualityPresetId={worldRuntime.qualityPreset.id}
            onFoxLoaded={onShowroomLoaded}
          />
        )}
      </CarTrackShowroomShell>
    )
  }

  return (
    <>
    <CarTrackWorldShell
      gameStatus={gameStatus}
      countdown={countdown}
      canvasQuality={worldRuntime.canvasQuality}
      startFinishPosition={worldRuntime.trackCurve ? trackDefinition.startFinishPosition : australiaCarTrackDefinition.startFinishPosition}
      startFinishDirection={trackDefinition.startFinishDirection}
      startingGatePoles={worldRuntime.startingGatePoles}
      items={items}
      manualCamera={worldRuntime.manualCamera}
      getHeightAtPosition={terrainHeightSampler}
      staticScenery={(
        <>
          <color attach="background" args={[skyColor]} />
          <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
          <ambientLight intensity={ambientIntensity} color={ambientColor} />
          <directionalLight
            position={isTerrainAwareScenery ? [50, 200, 50] : [-120, 220, 80]}
            intensity={sunIntensity}
            color={sunColor}
            castShadow={worldRuntime.canvasQuality.shadows}
            shadow-mapSize={[renderBudget.shadowMapSize, renderBudget.shadowMapSize]}
            shadow-camera-far={renderBudget.shadowCameraFar}
            shadow-camera-left={-renderBudget.shadowCameraExtent}
            shadow-camera-right={renderBudget.shadowCameraExtent}
            shadow-camera-top={renderBudget.shadowCameraExtent}
            shadow-camera-bottom={-renderBudget.shadowCameraExtent}
          />
          {terrainHeightSampler ? (
            <SampledTerrainMesh
              getHeightAtPosition={sceneHeightSampler}
              resolution={renderBudget.terrainResolution}
              yOffset={renderBudget.terrainYOffset}
              color={terrainColor}
              qualityPresetId={worldRuntime.qualityPreset.id}
              surface={isVolcano ? 'volcanic-rock' : 'grass'}
            />
          ) : (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
              <planeGeometry args={[8000, 8000]} />
              <meshStandardMaterial
                color={isTerrainAwareScenery ? '#4a8c59' : '#3f7651'}
                roughness={isTerrainAwareScenery ? 0.8 : 0.92}
                metalness={0.1}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
          {sceneryMode === 'australia' && <AustraliaRain dropCount={rainDropCount} />}
          <RollingHills radius={1800} layers={hillLayers} />
          {isVolcano && <DistantVolcanoes radius={2200} layers={2} />}
          {sceneryMode === 'australia' && (
            <TrackBillboardForest
              trackCurve={worldRuntime.trackCurve}
              qualityPreset={worldRuntime.qualityPreset}
              getHeightAtPosition={sceneHeightSampler}
              options={forestOptions}
            />
          )}
          {!(sceneryMode === 'australia' && !isTerrainAwareScenery) && (
            <ImportedCarTrackScenery
              trackDefinition={trackDefinition}
              qualityPreset={worldRuntime.qualityPreset}
              getHeightAtPosition={sceneHeightSampler}
              forestOptions={forestOptions}
              onTreesGenerated={setTreePositions}
              onBoardsGenerated={setAdvertisingBoardPositions}
            />
          )}
          <Track
            curve={worldRuntime.trackCurve}
            frames={worldRuntime.trackFrames}
            segments={worldRuntime.trackSegments}
            getHeight={terrainHeightSampler}
            excludedIntervals={lavaPitRoadExclusionIntervals}
            qualityPresetId={worldRuntime.qualityPreset.id}
            wetSurface={sceneryMode === 'australia'}
          />
          {!isTerrainAwareScenery && sceneryMode === 'australia' && <AdvertisingBoards onBoardsGenerated={setAdvertisingBoardPositions} />}
          {!isTerrainAwareScenery && sceneryMode === 'australia' && <StadiumSeating isSoundEnabled={isSoundEnabled} />}
          {isTerrainAwareScenery && (
            <SpaStadiumSeating
              rows={7}
              seatsPerRow={25}
              customPosition={trackDefinition.startFinishPosition}
              customDirection={trackDefinition.startFinishDirection}
              side="both"
              distanceFromTrack={48}
              getHeightAtPosition={sceneHeightSampler}
              isSoundEnabled={isSoundEnabled}
              foxDensityScale={worldRuntime.qualityPreset.scenery.densityScale}
            />
          )}
          {additionalStadiumData.map((data, index) => (
            <StadiumSeating
              key={`stadium-${index}`}
              rows={7}
              seatsPerRow={20}
              customPosition={data.position}
              customDirection={data.direction}
              side="right"
              isSoundEnabled={isSoundEnabled}
            />
          ))}
        </>
      )}
      localVehicle={(
        <CarTrackLocalVehicle
          VehicleComponent={FreeRoamCar}
          qualityPresetId={worldRuntime.qualityPreset.id}
          wetSurface={sceneryMode === 'australia'}
          foxOriginOutpoint={foxOriginOutpoint}
          backgroundRemovalStrategy={backgroundRemovalStrategy}
          playerColor={playerColor}
          gameStatus={gameStatus}
          countdown={countdown}
          manualCamera={worldRuntime.manualCamera}
          trackCurve={worldRuntime.trackCurve}
          trackLength={worldRuntime.trackLength}
          cameraZones={trackDefinition.cameraZones}
          spatialTrackIndex={trackDefinition.spatialTrackIndex}
          startFinishPosition={trackDefinition.startFinishPosition}
          startFinishDirection={trackDefinition.startFinishDirection}
          lapCrossing={{
            width: trackDefinition.metadata.start.lapCrossingWidth,
            depth: trackDefinition.metadata.start.lapCrossingDepth
          }}
          lapValidation={trackDefinition.metadata.lapValidation}
          getHeightAtPosition={terrainHeightSampler}
          treePositions={treePositions}
          startingGatePoles={worldRuntime.startingGatePoles}
          jumpZones={lavaPitJumpZones}
          rampZones={lavaPitRampZones}
          lavaHazard={lavaHazard}
          onCrash={onCrash}
          advertisingBoards={advertisingBoardPositions}
          onDistanceUpdate={onDistanceUpdate}
          onLapComplete={onLapComplete}
          onLapTimeUpdate={onLapTimeUpdate}
          onSpeedUpdate={onSpeedUpdate}
          onGasPressed={onGasPressed}
          onGasReleased={onGasReleased}
          isSoundEnabled={isSoundEnabled}
          onCarLoaded={onCarLoaded}
          items={items}
          onCollectItem={onCollectItem}
          otherPlayers={otherPlayers}
          spawnPosition={spawnPosition}
          cameraMode={cameraMode}
          localChatMessage={localChatMessage}
          initialHeadlightsEnabled={initialHeadlightsEnabled}
          onPositionUpdateForSocket={onPositionUpdateForSocket}
        />
      )}
      remotePlayers={<RemotePlayerCars players={otherPlayers} getHeightAtPosition={terrainHeightSampler} />}
    />
    {(gameStatus === 'racing' || gameStatus === 'countdown') && (
      <RacingCameraControlButtons
        isManualCamera={worldRuntime.manualCamera.isManualCamera}
        isFullscreen={isFullscreen}
        onToggleManualCamera={handleToggleManualCamera}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onRotateLeft={handleRotateLeft}
        onRotateRight={handleRotateRight}
        onToggleFullscreen={onToggleFullscreen}
      />
    )}
    </>
  )
}
