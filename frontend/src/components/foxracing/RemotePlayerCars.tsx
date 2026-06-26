import React from 'react'
import { OtherPlayerCar } from './OtherPlayerCar'
import type { RacingWorldPlayer } from '../../racing/multiplayer/worldPlayers'
import type { TerrainHeightSampler } from '../../racing/core/roadCorridor'
import type { RacingQualityPresetId } from '../../racing/performance/qualitySettings'

interface RemotePlayerCarsProps {
  players: RacingWorldPlayer[]
  getHeightAtPosition?: TerrainHeightSampler
  qualityPresetId?: RacingQualityPresetId
}

export const RemotePlayerCars: React.FC<RemotePlayerCarsProps> = ({ players, getHeightAtPosition, qualityPresetId = 'medium' }) => (
  <>
    {players.map((player) => (
      <OtherPlayerCar
        key={player.id}
        id={player.id}
        position={player.position}
        rotation={player.rotation}
        carColor={player.carColor}
        foxTextureUrl={player.foxTextureUrl}
        chatMessage={player.chatMessage}
        chatTimestamp={player.chatTimestamp}
        headlightsEnabled={player.headlightsEnabled}
        lodTier={player.remoteLodTier}
        qualityPresetId={qualityPresetId}
        getHeightAtPosition={getHeightAtPosition}
      />
    ))}
  </>
)
