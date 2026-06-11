import React, { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// Legacy/unofficial Aspen-local world path.
// The official Aspen route renders `snowmobilerace/SnowmobileWorld` from `FoxRacingGame.tsx`.
// This file remains during the refactor because some Aspen scenery code was authored here first.
import { UnifiedShowroom } from '../racing/UnifiedShowroom'
import { StartLight } from '../racing/StartLight'
// SnowTrack not rendered - track is buried under deep snow, only centerline used for position/walls
import { GameStatus } from './FoxRacingGame'
import { FreeRoamSnowmobile, CameraMode } from './FreeRoamSnowmobile'
import { SimpleTrees } from './SimpleTrees'
import { RollingHills } from '../../racing/components/RollingHills'
import { HillyTerrain, getTerrainHeight } from './HillyTerrain'
import { trackCurve, trackLength, startFinishPosition, startFinishDirection } from './TrackData'
import { SeededRandom, WORLD_SEED } from '../../racing/core/seededRandom'
import { CollectibleItem } from '../../racing/components/CollectibleItem'
// Lake not used for Aspen track
import { AdvertisingBoards } from './AdvertisingBoards'
import { OtherPlayerSnowmobile } from './OtherPlayerSnowmobile'
import { StadiumSeating } from '../aspen/StadiumSeating'
import type { RacingGameCollectibleItem as GameItem } from '../../racing/collectibles/collectibleTypes'
import { getRacingWorldPlayerCollisionTargets, type RacingWorldPlayer } from '../../racing/multiplayer/worldPlayers'
import { useRaceWorldLifecycle } from '../../racing/components/useRaceWorldLifecycle'
import { getInitialRaceCameraPosition, RaceCameraLookAtInitializer } from '../../racing/components/raceCameraSetup'

// Additional stadium positions around the track (t values from 0-1)
const ADDITIONAL_STADIUM_POSITIONS = [0.7]

// Camera position will be set by follow camera in FreeRoamSnowmobile component
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
  onPositionUpdateForSocket?: (position: THREE.Vector3, rotation: number, speed: number) => void
  spawnPosition?: { x: number; y: number; z: number } | null
  localChatMessage?: { text: string; timestamp: number } | null
  cameraMode?: CameraMode
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
  cameraMode = 'smooth'
}) => {
  const [isManualCamera, setIsManualCamera] = useState(false)
  const orbitControlsRef = useRef<any>(null)
  // Car position ref - always current for manual camera (use ref to avoid stale closures)
  // Initialize with start/finish position so manual camera focuses correctly at start line
  const carPositionRef = useRef(new THREE.Vector3(startFinishPosition.x, startFinishPosition.y + 0.15, startFinishPosition.z))
  const [treePositions, setTreePositions] = useState<Array<{ x: number; z: number; scale: number; radius: number }>>([])
  const [advertisingBoardPositions, setAdvertisingBoardPositions] = useState<Array<{
    curve: THREE.CatmullRomCurve3
    startT: number
    endT: number
    offset: number
    side: 'left' | 'right'
    height: number
  }>>([])

  // Keyboard listener for 'C' key to toggle manual camera mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        setIsManualCamera(prev => {
          const newValue = !prev
          if (newValue && orbitControlsRef.current) {
            // Entering manual mode - set target to current car position
            const targetPosition = carPositionRef.current.lengthSq() > 0
              ? carPositionRef.current
              : new THREE.Vector3(startFinishPosition.x, startFinishPosition.y + 0.15, startFinishPosition.z)
            orbitControlsRef.current.target.copy(targetPosition)
            orbitControlsRef.current.update()
          }
          console.log(`📷 Camera mode: ${newValue ? 'MANUAL (press C or drive to return)' : 'FOLLOW'}`)
          return newValue
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Mountain collision detection removed - not needed for Belgium track
  
  // Additional stadium seating positions around the track (outside only)
  const additionalStadiumData = useMemo(() => {
    return ADDITIONAL_STADIUM_POSITIONS.map(t => {
      const position = trackCurve.getPointAt(t)
      const direction = trackCurve.getTangentAt(t).normalize()
      return { position, direction }
    })
  }, [])

  // Starting gate pole positions - positioned perpendicular to track direction at start/finish line
  const startingGatePoles = useMemo(() => {
    // Calculate perpendicular direction (90 degrees from track direction)
    const perpDirection = new THREE.Vector3(-startFinishDirection.z, 0, startFinishDirection.x).normalize()
    const poleOffset = 10 // Distance from center line (increased from 7 to 10 for wider 18-unit track)
    
    return [
      { 
        x: startFinishPosition.x + perpDirection.x * poleOffset, 
        z: startFinishPosition.z + perpDirection.z * poleOffset, 
        radius: 0.5 
      },
      { 
        x: startFinishPosition.x - perpDirection.x * poleOffset, 
        z: startFinishPosition.z - perpDirection.z * poleOffset, 
        radius: 0.5 
      }
    ]
  }, [])
  
  // Notify parent of track length
  useEffect(() => {
    if (onTrackLengthUpdate && trackLength) {
      onTrackLengthUpdate(trackLength)
    }
  }, [onTrackLengthUpdate])

  useRaceWorldLifecycle({ gameStatus, onWorldLoaded, onSceneReady })
  
  // Render other players with interpolation for smooth movement (snowmobiles)
  // Memoized to avoid recreating on every render
  const renderedPlayers = useMemo(() => otherPlayers.map((player) => (
    <OtherPlayerSnowmobile
      key={player.id}
      id={player.id}
      position={player.position}
      rotation={player.rotation}
      carColor={player.carColor}
      foxTextureUrl={player.foxTextureUrl}
      chatMessage={player.chatMessage}
      chatTimestamp={player.chatTimestamp}
    />
  )), [otherPlayers])

  // Showroom Canvas
  if (gameStatus === 'showroom' || gameStatus === 'idle') {
    return (
      <Canvas key="showroom" shadows camera={{ position: [0, 3, 14], fov: 45 }}>
        <color attach="background" args={['#050510']} />
        <ambientLight intensity={0.5} />
        {gameStatus === 'showroom' && (
          <UnifiedShowroom
            foxOriginOutpoint={foxOriginOutpoint}
            playerColor={playerColor}
            vehicleType="snowmobile"
          />
        )}
        <OrbitControls 
          autoRotate 
          autoRotateSpeed={0.5} 
          enableZoom={true}
          enablePan={true}
          minPolarAngle={Math.PI/4} 
          maxPolarAngle={Math.PI/1.5}
          minDistance={5}
          maxDistance={20}
          target={[0, 0.5, 0]}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>
    )
  }

  const initialCameraPosition = getInitialRaceCameraPosition(startFinishPosition, startFinishDirection)

  // Frame rate limiter: 30fps for better performance
  return (
    <Canvas key="racing" shadows camera={{ position: [initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z], fov: 60, far: 10000, near: 0.1 }} frameloop="always">
      <RaceCameraLookAtInitializer target={startFinishPosition} />
      {/* Snowy sky background */}
      <color attach="background" args={['#c8d8e8']} />
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
      
      {/* Deep snow surface - high up so snowmobile sinks deep INTO it */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 2.5, 0]} receiveShadow>
        <planeGeometry args={[8000, 8000]} />
        <meshStandardMaterial
          color="#f0f5ff"
          roughness={0.85}
          metalness={0.0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Snowy rolling hills around the track */}
      <RollingHills radius={1800} layers={4} colorScheme="snow" />
      
      {/* Trees - placed around track, avoiding obstacles */}
      {/* PERFORMANCE: Reduced to 25 trees for better performance */}
      <SimpleTrees
        count={25}
        area={2000}
        maxDistanceFromTrack={60}
        trackCurve={trackCurve}
        onTreesGenerated={setTreePositions}
        advertisingBoards={advertisingBoardPositions}
      />
      
      {/* Track not rendered - buried under deep snow */}
      {/* trackCurve still used by FreeRoamSnowmobile for lap detection and by AdvertisingBoards for wall placement */}
      
      {/* No lake for Belgium - track layout doesn't have interior space for it */}
      
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

      {/* Start Line with Stoplight - positioned at start/finish line on longest straightaway */}
      {/* PERFORMANCE: Track is flat (y=0.01), so use ground height instead of expensive getTerrainHeight */}
      {(gameStatus === 'loading' || gameStatus === 'countdown' || gameStatus === 'racing') && (
        <group position={[startFinishPosition.x, 0.01, startFinishPosition.z]}>
          {/* Checkered flag strip - alternating black and white squares */}
          {/* Rotated to align with track direction */}
          {/* Calculate rotation angle from track direction */}
          <group 
            rotation={[
              -Math.PI/2, 
              0, 
              Math.atan2(startFinishDirection.x, startFinishDirection.z)
            ]} 
            position={[0, 0.17, 0]}
          >
            {Array.from({ length: 18 }).map((_, i) => 
              Array.from({ length: 4 }).map((_, j) => {
                // X position: -9 to +8 (18 squares wide, centered at 0, matching track width)
                const x = (i - 9) * 1.0 + 0.5
                // Y position (becomes world Z after rotation): -1.5, -0.5, 0.5, 1.5 (4 squares in a row)
                const y = (j - 1.5) * 1.0
                // Z position (becomes world -Y after rotation): keep at 0 so all squares at same height
                const z = 0
                const isBlack = (i + j) % 2 === 0
                return (
                  <mesh key={`${i}-${j}`} position={[x, y, z]} receiveShadow>
                    <planeGeometry args={[1, 1]} />
                    <meshStandardMaterial color={isBlack ? '#000000' : '#FFFFFF'} />
                  </mesh>
                )
              })
            )}
          </group>
          
          {/* Arch Columns - positioned at start gate poles */}
          <mesh position={[startingGatePoles[0].x - startFinishPosition.x, 4, startingGatePoles[0].z - startFinishPosition.z]} castShadow>
            <cylinderGeometry args={[0.5, 0.5, 8]} />
            <meshStandardMaterial color="#444" />
          </mesh>
          <mesh position={[startingGatePoles[1].x - startFinishPosition.x, 4, startingGatePoles[1].z - startFinishPosition.z]} castShadow>
            <cylinderGeometry args={[0.5, 0.5, 8]} />
            <meshStandardMaterial color="#444" />
          </mesh>
          
          {/* Arch Top - spans between the two poles */}
          <mesh 
            position={[
              ((startingGatePoles[0].x + startingGatePoles[1].x) / 2) - startFinishPosition.x, 
              8, 
              ((startingGatePoles[0].z + startingGatePoles[1].z) / 2) - startFinishPosition.z
            ]} 
            rotation={[0, Math.atan2(startFinishDirection.x, startFinishDirection.z), 0]}
            castShadow
          >
            <boxGeometry args={[22, 1, 1]} />
            <meshStandardMaterial color="#222" />
          </mesh>

          {/* 3D Start Light - Face the direction cars approach from (opposite of track direction) */}
          <group rotation={[0, Math.atan2(-startFinishDirection.x, -startFinishDirection.z), 0]}>
            <StartLight countdown={countdown} visible={gameStatus === 'countdown' || gameStatus === 'racing'} gameStatus={gameStatus} />
          </group>
        </group>
      )}
      
      {/* Collectibles */}
      {items.map((item) => (
        <CollectibleItem
          key={item.id}
          id={item.id}
          type={item.type}
          position={[item.position.x, item.position.y, item.position.z]}
        />
      ))}
      
      {/* Free-roaming snowmobile with voxel fox */}
      <FreeRoamSnowmobile
        foxOriginOutpoint={foxOriginOutpoint}
        playerColor={playerColor}
        gameStatus={gameStatus}
        countdown={countdown}
        isManualCamera={isManualCamera}
        trackCurve={trackCurve}
        trackLength={trackLength}
        treePositions={treePositions}
        startingGatePoles={startingGatePoles}
        advertisingBoards={advertisingBoardPositions}
        onDistanceUpdate={onDistanceUpdate}
        onLapComplete={onLapComplete}
        onLapTimeUpdate={onLapTimeUpdate}
        onSpeedUpdate={onSpeedUpdate}
        onCarControlUsed={() => {
          // Return to follow mode when car controls are used
          setIsManualCamera(false)
        }}
        onGasPressed={onGasPressed}
        onGasReleased={onGasReleased}
        isSoundEnabled={isSoundEnabled}
        onCarLoaded={onCarLoaded}
        items={items}
        onCollectItem={onCollectItem}
        otherPlayers={getRacingWorldPlayerCollisionTargets(otherPlayers)}
        spawnPosition={spawnPosition}
          cameraMode={cameraMode}
        localChatMessage={localChatMessage}
        onPositionUpdate={(pos, rot, spd) => {
          carPositionRef.current.copy(pos)
          // Update OrbitControls target to follow car when in manual mode
          if (isManualCamera && orbitControlsRef.current) {
            // Use faster lerp (0.2) for more responsive target following, especially at start line
            orbitControlsRef.current.target.lerp(pos, 0.2)
            orbitControlsRef.current.update() // Force update to apply target change immediately
          }
          // Emit position update to socket for multiplayer
          // Always call onPositionUpdateForSocket if provided, even during countdown
          // This ensures minimap shows blue dot from the start
          if (onPositionUpdateForSocket) {
            // Use default rotation and speed if not provided (e.g., during countdown when car is stationary)
            const rotation = rot !== undefined ? rot : 0
            const speed = spd !== undefined ? spd : 0
            onPositionUpdateForSocket(pos, rotation, speed)
          }
        }}
      />
      
      {/* Other Players - Render cars with voxel foxes for multiplayer */}
      {/* Server filters to only include players who are racing */}
      {renderedPlayers}
      
          {/* Camera controls - click and drag to orbit */}
          {/* IMPORTANT: Only enable OrbitControls in manual mode, otherwise it fights with FreeRoamSnowmobile's camera lerp */}
          {/* Press 'C' key to toggle manual camera mode, or use car controls to return to follow mode */}
          <OrbitControls
            ref={orbitControlsRef}
            enabled={isManualCamera}
            enablePan={true}
            enableZoom={true}
            maxDistance={2000}
            minDistance={5}
            enableDamping={true}
            dampingFactor={0.1}
            target={[startFinishPosition.x, startFinishPosition.y + 0.1, startFinishPosition.z]} // Initial target (car position)
        onStart={() => {
          // Set target to current car position when starting manual control
          // Use carPositionRef which is always up-to-date, or fallback to start/finish position
          if (orbitControlsRef.current) {
            // Ensure we have a valid car position (use current ref value or start position as fallback)
            const targetPosition = carPositionRef.current.lengthSq() > 0
              ? carPositionRef.current
              : new THREE.Vector3(startFinishPosition.x, startFinishPosition.y + 0.15, startFinishPosition.z)
            orbitControlsRef.current.target.copy(targetPosition)
            orbitControlsRef.current.update() // Force immediate update to center on car
          }
        }}
        onEnd={() => {
          // Don't automatically return to follow mode - wait for car controls
          // Camera will stay in manual mode until car controls are used
        }}
      />
    </Canvas>
  )
}
