import React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { RacingGameCollectibleItem as GameItem } from '../collectibles/collectibleTypes'
import type { RacingCanvasQualitySettings } from '../performance/qualitySettings'
import { CarTrackStartGate, type CarTrackStartGateLayoutOptions } from './CarTrackStartGate'
import { RacingCollectibles } from './RacingCollectibles'
import { RaceCameraLookAtInitializer, getInitialRaceCameraPosition } from './raceCameraSetup'
import type { TerrainHeightSampler } from '../core/roadCorridor'

type CarTrackWorldStatus = 'idle' | 'showroom' | 'loading' | 'countdown' | 'racing' | 'crashed' | 'finished'

interface CarTrackWorldShellManualCamera {
  isManualCamera: boolean
  orbitControlsRef: React.MutableRefObject<any>
  focusControlsOnCar: () => void
}

interface CarTrackWorldShellProps {
  gameStatus: CarTrackWorldStatus
  countdown: number
  canvasQuality: RacingCanvasQualitySettings
  startFinishPosition: THREE.Vector3
  startFinishDirection: THREE.Vector3
  startingGatePoles: [THREE.Vector3, THREE.Vector3] | THREE.Vector3[]
  items: GameItem[]
  manualCamera: CarTrackWorldShellManualCamera
  staticScenery: React.ReactNode
  localVehicle: React.ReactNode
  remotePlayers?: React.ReactNode
  startGateLayout?: CarTrackStartGateLayoutOptions
  getHeightAtPosition?: TerrainHeightSampler
  frameloop?: 'always' | 'demand' | 'never'
}

export const CarTrackWorldShell: React.FC<CarTrackWorldShellProps> = ({
  gameStatus,
  countdown,
  canvasQuality,
  startFinishPosition,
  startFinishDirection,
  startingGatePoles,
  items,
  manualCamera,
  staticScenery,
  localVehicle,
  remotePlayers,
  startGateLayout,
  getHeightAtPosition,
  frameloop = 'always'
}) => {
  const initialCameraPosition = getInitialRaceCameraPosition(startFinishPosition, startFinishDirection)

  return (
    <Canvas
      key="racing"
      shadows={canvasQuality.shadows}
      dpr={canvasQuality.dpr}
      camera={{
        position: [initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z],
        fov: 60,
        far: 10000,
        near: 0.1
      }}
      frameloop={frameloop}
    >
      <RaceCameraLookAtInitializer target={startFinishPosition} />
      {staticScenery}
      <CarTrackStartGate
        gameStatus={gameStatus}
        countdown={countdown}
        startFinishPosition={startFinishPosition}
        startFinishDirection={startFinishDirection}
        startingGatePoles={startingGatePoles}
        {...startGateLayout}
      />
      <RacingCollectibles items={items} getHeightAtPosition={getHeightAtPosition} />
      {localVehicle}
      {remotePlayers}
      <OrbitControls
        ref={manualCamera.orbitControlsRef}
        enabled={manualCamera.isManualCamera}
        enablePan={true}
        enableZoom={true}
        maxDistance={2000}
        minDistance={5}
        enableDamping={true}
        dampingFactor={0.1}
        target={[startFinishPosition.x, startFinishPosition.y + 0.1, startFinishPosition.z]}
        onStart={manualCamera.focusControlsOnCar}
        onEnd={() => {
          // Stay in manual mode until car controls return the camera to follow mode.
        }}
      />
    </Canvas>
  )
}
