import React from 'react'
import { VoxelFox } from '../../components/VoxelFox'
import type { VoxelBackgroundRemovalStrategy } from '../../components/voxelization/voxelBackgroundStrategy'
import type { RacingQualityPresetId } from '../performance/qualitySettings'
import { getOrdinalContentUrl } from '../transactions/ordinalLinks'
import { CarTrackVehicleModelDetailed } from './CarTrackVehicleModelDetailed'

interface CarTrackVehicleModelProps {
  foxOriginOutpoint?: string | null
  backgroundRemovalStrategy?: VoxelBackgroundRemovalStrategy
  playerColor: string
  localChatMessage?: { text: string; timestamp: number } | null
  qualityPresetId?: RacingQualityPresetId
  headlightsEnabled?: boolean
  /** Fired once the fox texture finishes loading (used by the showroom loading indicator). */
  onFoxLoaded?: () => void
}

export const CarTrackVehicleModel: React.FC<CarTrackVehicleModelProps> = ({
  foxOriginOutpoint,
  backgroundRemovalStrategy = 'default',
  playerColor,
  localChatMessage = null,
  qualityPresetId = 'low',
  headlightsEnabled = false,
  onFoxLoaded
}) => {
  // Low keeps the lightweight boxy kart; Medium/High get the sculpted sports-car model,
  // with High adding extra trim and a clearcoat finish.
  if (qualityPresetId === 'medium' || qualityPresetId === 'high') {
    return (
      <CarTrackVehicleModelDetailed
        foxOriginOutpoint={foxOriginOutpoint}
        backgroundRemovalStrategy={backgroundRemovalStrategy}
        playerColor={playerColor}
        localChatMessage={localChatMessage}
        highDetail={qualityPresetId === 'high'}
        headlightsEnabled={headlightsEnabled}
        onFoxLoaded={onFoxLoaded}
      />
    )
  }

  return (
    <group rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.1, 3.8]} />
        <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[-0.9, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.4, 2.0]} />
        <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[0.9, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.4, 2.0]} />
        <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[0, 0.55, 1.4]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.7, 1.0]} />
        <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Headlights */}
      {[-0.55, 0.55].map(x => (
        <mesh key={x} position={[x, 0.55, 1.92]}>
          <boxGeometry args={[0.34, 0.14, 0.08]} />
          <meshStandardMaterial
            color={headlightsEnabled ? '#fffbe0' : '#c9c2a4'}
            emissive={headlightsEnabled ? '#fff4c2' : '#000000'}
            emissiveIntensity={headlightsEnabled ? 1.8 : 0}
          />
        </mesh>
      ))}

      {headlightsEnabled && (
        <>
          {[-0.55, 0.55].map(x => (
            <pointLight
              key={`headlight-glow-${x}`}
              position={[x, 0.55, 2.05]}
              color="#fff4c2"
              intensity={2.2}
              distance={18}
              decay={1.6}
            />
          ))}
        </>
      )}

      <mesh position={[0, 0.55, -1.4]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.7, 1.0]} />
        <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[0, 1.4, -1.6]} castShadow>
        <boxGeometry args={[2.4, 0.1, 0.6]} />
        <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-0.8, 0.9, -1.6]} castShadow>
        <boxGeometry args={[0.1, 0.8, 0.3]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.8, 0.9, -1.6]} castShadow>
        <boxGeometry args={[0.1, 0.8, 0.3]} />
        <meshStandardMaterial color="#111" />
      </mesh>

      <group position={[-1.1, 0.3, 1.2]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.4, 0.4, 0.4, 16]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[-0.21, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.15, 0.05, 16]} />
          <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      <group position={[1.1, 0.3, 1.2]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.4, 0.4, 0.4, 16]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[0.21, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.15, 0.05, 16]} />
          <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      <group position={[-1.1, 0.3, -1.2]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.45, 0.45, 0.5, 16]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[-0.26, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.18, 0.18, 0.05, 16]} />
          <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      <group position={[1.1, 0.3, -1.2]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.45, 0.45, 0.5, 16]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[0.26, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.18, 0.18, 0.05, 16]} />
          <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      <mesh position={[0, 1.0, 1.4]} rotation={[-0.4, 0, 0]}>
        <boxGeometry args={[1.8, 0.6, 0.1]} />
        <meshPhysicalMaterial
          color="#aaf"
          transmission={0.5}
          opacity={0.5}
          transparent
          roughness={0}
        />
      </mesh>

      <group position={[0, 0.5, 0.2]} scale={1.0}>
        <VoxelFox
          position={[0, 0, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          foxTextureUrl={getOrdinalContentUrl(foxOriginOutpoint) || undefined}
          backgroundRemovalStrategy={backgroundRemovalStrategy}
          color={playerColor}
          message={localChatMessage?.text}
          messageTime={localChatMessage?.timestamp}
          onTextureLoaded={onFoxLoaded}
        />
      </group>
    </group>
  )
}
