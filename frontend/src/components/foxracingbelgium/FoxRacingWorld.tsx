import React, { useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { Showroom } from '../racing/Showroom'
import { Track } from '../racing/Track'
import { GameStatus } from './FoxRacingGame'
import { FreeRoamCar, CameraMode } from './FreeRoamCar'
import { SimpleTrees } from './SimpleTrees'
import { RollingHills } from '../../racing/components/RollingHills'
import { trackCurve, trackFrames, trackSegments, startFinishPosition, startFinishDirection } from './TrackData'
// Lake not used for Belgium track
import { AdvertisingBoards } from './AdvertisingBoards'
import { RemotePlayerCars } from '../foxracing/RemotePlayerCars'
import { StadiumSeating } from './StadiumSeating'
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
import { belgiumCarTrackDefinition } from '../../racing/tracks/carTrackDefinitions'
import { RacingCameraControlButtons } from '../../racing/components/RacingCameraControlButtons'

// Additional stadium positions around the track (t values from 0-1)
const ADDITIONAL_STADIUM_POSITIONS = [0.7]

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
  qualityPresetId?: RacingQualityPresetId
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

type TreePlacement = { x: number; z: number; scale: number; radius: number }

type AdvertisingBoardPlacement = {
  curve: THREE.CatmullRomCurve3
  startT: number
  endT: number
  offset: number
  side: 'left' | 'right'
  height: number
}

type StadiumPlacement = {
  position: THREE.Vector3
  direction: THREE.Vector3
}

interface SpaStaticSceneryProps {
  rollingHillLayers: number
  setTreePositions: React.Dispatch<React.SetStateAction<TreePlacement[]>>
  advertisingBoardPositions: AdvertisingBoardPlacement[]
  setAdvertisingBoardPositions: React.Dispatch<React.SetStateAction<AdvertisingBoardPlacement[]>>
  additionalStadiumData: StadiumPlacement[]
  isSoundEnabled: boolean
  qualityPresetId: RacingQualityPresetId
}

const SpaStaticScenery = React.memo(({
  rollingHillLayers,
  setTreePositions,
  advertisingBoardPositions,
  setAdvertisingBoardPositions,
  additionalStadiumData,
  isSoundEnabled,
  qualityPresetId
}: SpaStaticSceneryProps) => (
  <>
    {/* Sky blue background */}
    <color attach="background" args={['#87CEEB']} />
    <fog attach="fog" args={['#87CEEB', 250, 2000]} />

    {/* Lighting */}
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

    {/* Shared procedural grass plane */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
      <planeGeometry args={[8000, 8000]} />
      <RacingSurfaceMaterial
        surface="grass"
        qualityPresetId={qualityPresetId}
        repeat={getSurfaceTextureRepeat(8000, getRacingSurfaceTextureConfig('grass', qualityPresetId).tileWorldSize)}
        color="#4a8c59"
      />
    </mesh>

    {/* Rolling green hills around the track */}
    <RollingHills radius={1800} layers={rollingHillLayers} />

    {/* Trees - placed around track, avoiding obstacles */}
    <SimpleTrees
      count={25}
      area={2000}
      maxDistanceFromTrack={60}
      trackCurve={trackCurve}
      onTreesGenerated={setTreePositions}
      advertisingBoards={advertisingBoardPositions}
    />

    {/* Big Race Track */}
    <Track
      curve={trackCurve}
      frames={trackFrames}
      segments={trackSegments}
      getHeight={undefined}
      qualityPresetId={qualityPresetId}
    />

    {/* Advertising boards around entire track - act as barriers */}
    <AdvertisingBoards onBoardsGenerated={setAdvertisingBoardPositions} />

    {/* Stadium seating on either side of start/finish line */}
    <StadiumSeating rows={7} seatsPerRow={25} isSoundEnabled={isSoundEnabled} />

    {/* Additional stadium seating around the track (outside only) */}
    {additionalStadiumData.map((data, index) => (
      <StadiumSeating
        key={`stadium-${index}`}
        rows={7}
        seatsPerRow={20}
        customPosition={data.position}
        customDirection={data.direction}
        side="right"
        isSoundEnabled={isSoundEnabled}
        distanceFromTrack={index === 1 ? 60 : 38}
      />
    ))}
  </>
))

SpaStaticScenery.displayName = 'SpaStaticScenery'

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
    config: belgiumCarTrackDefinition,
    gameStatus,
    qualityPresetId,
    onTrackLengthUpdate,
    onWorldLoaded,
    onSceneReady
  })
  const [treePositions, setTreePositions] = useState<TreePlacement[]>([])
  const [advertisingBoardPositions, setAdvertisingBoardPositions] = useState<AdvertisingBoardPlacement[]>([])
  
  // Additional stadium seating positions around the track (outside only)
  const additionalStadiumData = useMemo(() => {
    return ADDITIONAL_STADIUM_POSITIONS.map(t => {
      const position = trackCurve.getPointAt(t)
      const direction = trackCurve.getTangentAt(t).normalize()
      return { position, direction }
    })
  }, [])

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
           <Showroom foxOriginOutpoint={foxOriginOutpoint} backgroundRemovalStrategy={backgroundRemovalStrategy} playerColor={playerColor} qualityPresetId={qualityPresetId} />
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
      staticScenery={(
        <SpaStaticScenery
          rollingHillLayers={worldRuntime.sceneryQuality.rollingHillLayers}
          setTreePositions={setTreePositions}
          advertisingBoardPositions={advertisingBoardPositions}
          setAdvertisingBoardPositions={setAdvertisingBoardPositions}
          additionalStadiumData={additionalStadiumData}
          isSoundEnabled={isSoundEnabled}
          qualityPresetId={qualityPresetId}
        />
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
          trackCurve={worldRuntime.trackCurve}
          trackLength={worldRuntime.trackLength}
          treePositions={treePositions}
          startingGatePoles={worldRuntime.startingGatePoles}
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
          onPositionUpdateForSocket={onPositionUpdateForSocket}
        />
      )}
      remotePlayers={<RemotePlayerCars players={otherPlayers} qualityPresetId={qualityPresetId} />}
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
