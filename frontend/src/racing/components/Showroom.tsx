import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VoxelBackgroundRemovalStrategy } from '../../components/voxelization/voxelBackgroundStrategy'
import type { RacingQualityPresetId } from '../performance/qualitySettings'
import { CarTrackVehicleModel } from './CarTrackVehicleModel'

interface ShowroomProps {
  foxOriginOutpoint?: string | null
  backgroundRemovalStrategy?: VoxelBackgroundRemovalStrategy
  playerColor: string
  /** Drives the car detail tier so the showroom matches what's raced. */
  qualityPresetId?: RacingQualityPresetId
}

export const Showroom: React.FC<ShowroomProps> = ({
  foxOriginOutpoint,
  backgroundRemovalStrategy = 'default',
  playerColor,
  qualityPresetId = 'low'
}) => {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.4
    }
  })

  return (
    <group position={[0, 0, 0]}>
      <ambientLight intensity={0.4} />
      <spotLight position={[8, 1.5, 0]} angle={0.6} penumbra={0.4} intensity={8} castShadow target-position={[0, 0, 0]} />
      <spotLight position={[-8, 1.5, 0]} angle={0.6} penumbra={0.4} intensity={8} castShadow target-position={[0, 0, 0]} />
      <spotLight position={[0, 1.5, 8]} angle={0.6} penumbra={0.4} intensity={8} castShadow target-position={[0, 0, 0]} />
      <spotLight position={[0, 1.5, -8]} angle={0.6} penumbra={0.4} intensity={8} castShadow target-position={[0, 0, 0]} />
      <spotLight position={[5, 12, 5]} angle={0.8} penumbra={0.5} intensity={6} castShadow target-position={[0, 0, 0]} />
      <spotLight position={[-5, 12, 5]} angle={0.8} penumbra={0.5} intensity={6} castShadow target-position={[0, 0, 0]} />

      <mesh position={[0, -0.1, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.7} />
      </mesh>

      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.8, 6.2, 64]} />
        <meshBasicMaterial color="#4ECDC4" />
      </mesh>

      <group ref={groupRef}>
        {/* Detail tier mirrors the raced model: Low keeps the boxy kart, Medium/High
            upgrade to the sculpted sports-car. The model bundles its own VoxelFox driver. */}
        <CarTrackVehicleModel
          foxOriginOutpoint={foxOriginOutpoint}
          backgroundRemovalStrategy={backgroundRemovalStrategy}
          playerColor={playerColor}
          qualityPresetId={qualityPresetId}
        />
      </group>
    </group>
  )
}
