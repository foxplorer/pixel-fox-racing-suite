import React, { useState, useCallback } from 'react'
import { Showroom } from '../racingsanluis/Showroom'
import { Track } from '../racingsanluis/Track'
import { GameStatus } from './FoxRacingGame'
import { FreeRoamCar, CameraMode } from './FreeRoamCar'
import { SimpleTrees } from './SimpleTrees'
import { DistantMountains } from '../../racing/components/DistantMountains'
import { getTerrainHeight } from './HillyTerrain'
import { startFinishDirection, startFinishPosition } from './TrackData'
import { RemotePlayerCars } from '../foxracing/RemotePlayerCars'
import { StadiumSeating } from './StadiumSeating'
import * as THREE from 'three'
import type { VoxelBackgroundRemovalStrategy } from '../voxelization/voxelBackgroundStrategy'
import type { RacingGameCollectibleItem as GameItem } from '../../racing/collectibles/collectibleTypes'
import type { RacingWorldPlayer } from '../../racing/multiplayer/worldPlayers'
import { CarTrackShowroomShell } from '../../racing/components/CarTrackShowroomShell'
import { CarTrackWorldShell } from '../../racing/components/CarTrackWorldShell'
import { CarTrackLocalVehicle } from '../../racing/components/CarTrackLocalVehicle'
import { useCarTrackWorldRuntime } from '../../racing/components/useCarTrackWorldRuntime'
import type { RacingQualityPresetId } from '../../racing/performance/qualitySettings'
import { getRacingSurfaceTextureConfig, getSurfaceTextureRepeat } from '../../racing/components/materials/proceduralSurfaceConfig'
import { RacingSurfaceMaterial } from '../../racing/components/materials/RacingSurfaceMaterial'
import { sanLuisCarTrackDefinition } from '../../racing/tracks/carTrackDefinitions'
import { RacingCameraControlButtons } from '../../racing/components/RacingCameraControlButtons'
import { TrackBirds } from '../../racing/components/birds/TrackBirds'

interface FoxRacingWorldProps {
  gameStatus: GameStatus
  onCrash: () => void
  onScoreUpdate: (score: number) => void
  onDistanceUpdate?: (distance: number) => void
  onTrackLengthUpdate?: (length: number) => void
  onLapComplete?: (lapTime: number) => void
  onLapTimeUpdate?: (currentLapTime: number) => void // Callback to update visual timer with current lap time
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
  qualityPresetId?: RacingQualityPresetId
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
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
  qualityPresetId = 'medium',
  isFullscreen = false,
  onToggleFullscreen
}) => {
  const worldRuntime = useCarTrackWorldRuntime({
    config: sanLuisCarTrackDefinition,
    gameStatus,
    qualityPresetId,
    onTrackLengthUpdate,
    onWorldLoaded,
    onSceneReady
  })
  const [treePositions, setTreePositions] = useState<Array<{ x: number; z: number; scale: number; radius: number }>>([])
  
  // Track segment generators (defined outside useMemo so they're accessible)
  const createStraightSegment = (start: THREE.Vector3, direction: THREE.Vector3, length: number, pointCount: number): THREE.Vector3[] => {
      const points: THREE.Vector3[] = []
      const normalizedDir = direction.clone().normalize()
      for (let i = 0; i <= pointCount; i++) {
        const progress = i / pointCount
        const point = start.clone().add(normalizedDir.clone().multiplyScalar(progress * length))
        point.y = 0.1
        points.push(point)
      }
      return points
    }

  const create90TurnSegment = (start: THREE.Vector3, startTangent: THREE.Vector3, radius: number, turnDirection: 'left' | 'right', pointCount: number): THREE.Vector3[] => {
      const points: THREE.Vector3[] = []
      const normalizedTangent = startTangent.clone().normalize()
      
      // Calculate center of the arc
      // For a right turn, center is to the right of the start tangent
      // For a left turn, center is to the left
      const right = new THREE.Vector3(0, 1, 0).cross(normalizedTangent).normalize()
      const centerOffset = right.multiplyScalar(turnDirection === 'right' ? radius : -radius)
      const center = start.clone().add(centerOffset)
      
      // Calculate start angle (from center to start point)
      const toStart = start.clone().sub(center).normalize()
      let startAngle = Math.atan2(toStart.z, toStart.x)
      
      // Turn 90 degrees
      const angleStep = (Math.PI / 2) / pointCount
      const turnSign = turnDirection === 'right' ? -1 : 1
      
      for (let i = 0; i <= pointCount; i++) {
        const angle = startAngle + (angleStep * i * turnSign)
        const point = new THREE.Vector3(
          center.x + Math.cos(angle) * radius,
          0.1,
          center.z + Math.sin(angle) * radius
        )
        points.push(point)
      }
      return points
    }

  const createUTurnSegment = (start: THREE.Vector3, startTangent: THREE.Vector3, radius: number, turnDirection: 'left' | 'right', pointCount: number): THREE.Vector3[] => {
      const points: THREE.Vector3[] = []
      const normalizedTangent = startTangent.clone().normalize()
      
      // Calculate center of the arc
      const right = new THREE.Vector3(0, 1, 0).cross(normalizedTangent).normalize()
      const centerOffset = right.multiplyScalar(turnDirection === 'right' ? radius : -radius)
      const center = start.clone().add(centerOffset)
      
      // Calculate start angle
      const toStart = start.clone().sub(center).normalize()
      let startAngle = Math.atan2(toStart.z, toStart.x)
      
      // Turn 180 degrees
      const angleStep = Math.PI / pointCount
      const turnSign = turnDirection === 'right' ? -1 : 1
      
      for (let i = 0; i <= pointCount; i++) {
        const angle = startAngle + (angleStep * i * turnSign)
        const point = new THREE.Vector3(
          center.x + Math.cos(angle) * radius,
          0.1,
          center.z + Math.sin(angle) * radius
        )
        points.push(point)
      }
      return points
    }

  const createSlalomSegment = (start: THREE.Vector3, startTangent: THREE.Vector3, length: number, amplitude: number, waves: number, pointCount: number): THREE.Vector3[] => {
      const points: THREE.Vector3[] = []
      const normalizedTangent = startTangent.clone().normalize()
      const right = new THREE.Vector3(0, 1, 0).cross(normalizedTangent).normalize()
      
      for (let i = 0; i <= pointCount; i++) {
        const progress = i / pointCount
        const forwardDist = progress * length
        
        // Create S-curve pattern
        const wavePhase = progress * waves * Math.PI * 2
        const lateralOffset = Math.sin(wavePhase) * amplitude
        
        const point = start.clone()
          .add(normalizedTangent.clone().multiplyScalar(forwardDist))
          .add(right.clone().multiplyScalar(lateralOffset))
        point.y = 0.1
        points.push(point)
      }
      return points
    }

  const createLongCurveSegment = (start: THREE.Vector3, startTangent: THREE.Vector3, radius: number, angleDegrees: number, turnDirection: 'left' | 'right', pointCount: number): THREE.Vector3[] => {
      const points: THREE.Vector3[] = []
      const normalizedTangent = startTangent.clone().normalize()
      const angleRadians = (angleDegrees * Math.PI) / 180
      
      // Calculate center
      const right = new THREE.Vector3(0, 1, 0).cross(normalizedTangent).normalize()
      const centerOffset = right.multiplyScalar(turnDirection === 'right' ? radius : -radius)
      const center = start.clone().add(centerOffset)
      
      // Calculate start angle
      const toStart = start.clone().sub(center).normalize()
      let startAngle = Math.atan2(toStart.z, toStart.x)
      
      const angleStep = angleRadians / pointCount
      const turnSign = turnDirection === 'right' ? -1 : 1
      
      for (let i = 0; i <= pointCount; i++) {
        const angle = startAngle + (angleStep * i * turnSign)
        const point = new THREE.Vector3(
          center.x + Math.cos(angle) * radius,
          0.1,
          center.z + Math.sin(angle) * radius
        )
        points.push(point)
      }
      return points
    }

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
      <CarTrackShowroomShell canvasQuality={worldRuntime.canvasQuality}>
        {gameStatus === 'showroom' && (
           <Showroom foxOriginOutpoint={foxOriginOutpoint} backgroundRemovalStrategy={backgroundRemovalStrategy} playerColor={playerColor} qualityPresetId={worldRuntime.qualityPreset.id} />
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
      startFinishPosition={startFinishPosition}
      startFinishDirection={startFinishDirection}
      startingGatePoles={worldRuntime.startingGatePoles}
      items={items}
      manualCamera={worldRuntime.manualCamera}
      startGateLayout={worldRuntime.startGateLayout}
      staticScenery={(
        <>
          <color attach="background" args={['#87CEEB']} />
          <fog attach="fog" args={['#87CEEB', 250, 2000]} />
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[50, 200, 50]}
            intensity={1.0}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-far={2000}
            shadow-camera-left={-1000}
            shadow-camera-right={1000}
            shadow-camera-top={1000}
            shadow-camera-bottom={-1000}
          />
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[8000, 8000]} />
            <RacingSurfaceMaterial
              surface="grass"
              qualityPresetId={qualityPresetId}
              repeat={getSurfaceTextureRepeat(8000, getRacingSurfaceTextureConfig('grass', qualityPresetId).tileWorldSize)}
              color="#4a7c59"
              side={THREE.FrontSide}
            />
          </mesh>
          <DistantMountains radius={2000} layers={5} />
          <SimpleTrees
            count={50}
            area={1500}
            trackCurve={worldRuntime.trackCurve}
            onTreesGenerated={setTreePositions}
          />
          <TrackBirds
            trackCurve={worldRuntime.trackCurve}
            qualityPreset={worldRuntime.qualityPreset}
            getHeightAtPosition={getTerrainHeight}
          />
          <Track
            curve={worldRuntime.trackCurve}
            frames={worldRuntime.trackFrames}
            segments={worldRuntime.trackSegments}
            qualityPresetId={qualityPresetId}
          />
          <StadiumSeating isSoundEnabled={isSoundEnabled} />
        </>
      )}
      localVehicle={(
        <CarTrackLocalVehicle
          VehicleComponent={FreeRoamCar}
          qualityPresetId={qualityPresetId}
          foxOriginOutpoint={foxOriginOutpoint}
          backgroundRemovalStrategy={backgroundRemovalStrategy}
          playerColor={playerColor}
          gameStatus={gameStatus}
          countdown={countdown}
          manualCamera={worldRuntime.manualCamera}
          cameraMode={cameraMode}
          trackCurve={worldRuntime.trackCurve}
          trackLength={worldRuntime.trackLength}
          treePositions={treePositions}
          startingGatePoles={worldRuntime.startingGatePoles}
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
          localChatMessage={localChatMessage}
          onPositionUpdateForSocket={onPositionUpdateForSocket}
          socketPositionEmitMode="require-complete-values"
        />
      )}
      remotePlayers={<RemotePlayerCars players={otherPlayers} />}
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
