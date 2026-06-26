import React from 'react'
import * as THREE from 'three'
import type { RacingGameCollectibleItem as GameItem } from '../collectibles/collectibleTypes'
import type { RacingWorldPlayer, RacingWorldPlayerCollisionTarget } from '../multiplayer/worldPlayers'
import { getRacingWorldPlayerCollisionTargets } from '../multiplayer/worldPlayers'
import type { RacingAdvertisingBoard } from '../vehicles/carBoardCollision'
import type { CarCameraZoneConfig } from '../vehicles/carCamera'
import type { VoxelBackgroundRemovalStrategy } from '../../components/voxelization/voxelBackgroundStrategy'
import type { TerrainHeightSampler } from '../core/roadCorridor'
import type { SpatialTrackIndex } from '../core/spatialTrackIndex'
import type { TrackLapValidationMetadata } from '../tracks/trackMetadata'
import type { createStartGate } from '../core/startGate'
import type { CarRampZone } from '../vehicles/carRamp'
import type { CarLavaHazard } from '../vehicles/carLavaHazard'
import type { RacingQualityPresetId } from '../performance/qualitySettings'

type CarTrackVehicleStatus = 'idle' | 'showroom' | 'loading' | 'countdown' | 'racing' | 'crashed' | 'finished'
type CarTrackCameraMode = 'simple' | 'smooth' | 'damped' | 'targetsmooth' | 'velocity'
type SocketPositionEmitMode = 'default-missing-values' | 'require-complete-values'

interface CarTrackManualCameraRuntime {
  isManualCamera: boolean
  returnToFollowCamera: () => void
  updateCarPosition: (position: THREE.Vector3) => void
}

interface CarTrackLocalVehicleProps {
  VehicleComponent: React.ComponentType<any>
  foxOriginOutpoint?: string | null
  backgroundRemovalStrategy?: VoxelBackgroundRemovalStrategy
  playerColor: string
  qualityPresetId?: RacingQualityPresetId
  wetSurface?: boolean
  gameStatus: CarTrackVehicleStatus
  countdown: number
  manualCamera: CarTrackManualCameraRuntime
  cameraMode?: CarTrackCameraMode
  cameraZones?: CarCameraZoneConfig[]
  trackCurve: THREE.CatmullRomCurve3
  trackLength: number
  spatialTrackIndex?: SpatialTrackIndex
  startFinishPosition?: THREE.Vector3
  startFinishDirection?: THREE.Vector3
  lapCrossing?: Parameters<typeof createStartGate>[2]
  lapValidation?: Pick<TrackLapValidationMetadata, 'minLapDistanceRatio' | 'requiresReachedEnd'>
  getHeightAtPosition?: TerrainHeightSampler
  treePositions: Array<{ x: number; z: number; scale: number; radius: number }>
  startingGatePoles: Array<{ x: number; y?: number; z: number; radius?: number }>
  jumpZones?: Array<{ x: number; z: number; radius: number }>
  rampZones?: CarRampZone[]
  lavaHazard?: CarLavaHazard
  onCrash?: () => void
  advertisingBoards?: RacingAdvertisingBoard[]
  onDistanceUpdate?: (distance: number) => void
  onLapComplete?: (lapTime: number) => void
  onLapTimeUpdate?: (currentLapTime: number) => void
  onSpeedUpdate?: (speed: number) => void
  onGasPressed?: () => void
  onGasReleased?: () => void
  isSoundEnabled?: boolean
  onCarLoaded?: () => void
  items: GameItem[]
  onCollectItem?: (itemId: string) => void
  otherPlayers: RacingWorldPlayer[]
  spawnPosition?: { x: number; y: number; z: number } | null
  localChatMessage?: { text: string; timestamp: number } | null
  initialHeadlightsEnabled?: boolean
  onPositionUpdateForSocket?: (position: THREE.Vector3, rotation: number, speed: number, headlightsEnabled?: boolean) => void
  socketPositionEmitMode?: SocketPositionEmitMode
}

export const CarTrackLocalVehicle: React.FC<CarTrackLocalVehicleProps> = ({
  VehicleComponent,
  foxOriginOutpoint,
  backgroundRemovalStrategy = 'default',
  playerColor,
  qualityPresetId,
  wetSurface = false,
  gameStatus,
  countdown,
  manualCamera,
  cameraMode = 'smooth',
  cameraZones,
  trackCurve,
  trackLength,
  spatialTrackIndex,
  startFinishPosition,
  startFinishDirection,
  lapCrossing,
  lapValidation,
  getHeightAtPosition,
  treePositions,
  startingGatePoles,
  jumpZones,
  rampZones,
  lavaHazard,
  onCrash,
  advertisingBoards,
  onDistanceUpdate,
  onLapComplete,
  onLapTimeUpdate,
  onSpeedUpdate,
  onGasPressed,
  onGasReleased,
  isSoundEnabled = false,
  onCarLoaded,
  items,
  onCollectItem,
  otherPlayers,
  spawnPosition = null,
  localChatMessage = null,
  initialHeadlightsEnabled = true,
  onPositionUpdateForSocket,
  socketPositionEmitMode = 'default-missing-values'
}) => {
  const optionalCollisionProps = {
    ...(advertisingBoards ? { advertisingBoards } : {})
  }

  return (
    <VehicleComponent
      foxOriginOutpoint={foxOriginOutpoint}
      backgroundRemovalStrategy={backgroundRemovalStrategy}
      playerColor={playerColor}
      qualityPresetId={qualityPresetId}
      wetSurface={wetSurface}
      gameStatus={gameStatus}
      countdown={countdown}
      isManualCamera={manualCamera.isManualCamera}
      cameraMode={cameraMode}
      cameraZones={cameraZones}
      trackCurve={trackCurve}
      trackLength={trackLength}
      spatialTrackIndex={spatialTrackIndex}
      startFinishPosition={startFinishPosition}
      startFinishDirection={startFinishDirection}
      lapCrossing={lapCrossing}
      lapValidation={lapValidation}
      getHeightAtPosition={getHeightAtPosition}
      treePositions={treePositions}
      startingGatePoles={startingGatePoles}
      jumpZones={jumpZones}
      rampZones={rampZones}
      lavaHazard={lavaHazard}
      onCrash={onCrash}
      onDistanceUpdate={onDistanceUpdate}
      onLapComplete={onLapComplete}
      onLapTimeUpdate={onLapTimeUpdate}
      onSpeedUpdate={onSpeedUpdate}
      onCarControlUsed={manualCamera.returnToFollowCamera}
      onGasPressed={onGasPressed}
      onGasReleased={onGasReleased}
      isSoundEnabled={isSoundEnabled}
      onCarLoaded={onCarLoaded}
      items={items}
      onCollectItem={onCollectItem}
      otherPlayers={getRacingWorldPlayerCollisionTargets(otherPlayers) as RacingWorldPlayerCollisionTarget[]}
      spawnPosition={spawnPosition}
      localChatMessage={localChatMessage}
      initialHeadlightsEnabled={initialHeadlightsEnabled}
      onPositionUpdate={(position: THREE.Vector3, rotation?: number, speed?: number, headlightsEnabled?: boolean) => {
        manualCamera.updateCarPosition(position)

        if (!onPositionUpdateForSocket) return

        if (socketPositionEmitMode === 'require-complete-values') {
          if (rotation !== undefined && speed !== undefined) {
            onPositionUpdateForSocket(position, rotation, speed, headlightsEnabled)
          }
          return
        }

        onPositionUpdateForSocket(position, rotation ?? 0, speed ?? 0, headlightsEnabled)
      }}
      {...optionalCollisionProps}
    />
  )
}
