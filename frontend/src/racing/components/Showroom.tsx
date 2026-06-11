import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelFox } from '../../components/VoxelFox'
import type { VoxelBackgroundRemovalStrategy } from '../../components/voxelization/voxelBackgroundStrategy'
import { getOrdinalContentUrl } from '../transactions/ordinalLinks'

interface ShowroomProps {
  foxOriginOutpoint?: string | null
  backgroundRemovalStrategy?: VoxelBackgroundRemovalStrategy
  playerColor: string
}

export const Showroom: React.FC<ShowroomProps> = ({
  foxOriginOutpoint,
  backgroundRemovalStrategy = 'default',
  playerColor
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
            <meshPhysicalMaterial color="#aaf" transmission={0.5} opacity={0.5} transparent roughness={0} />
          </mesh>

          <group position={[0, 0.4, 0]} scale={0.8}>
            <VoxelFox
              position={[0, 0, 0]}
              rotation={[0, -Math.PI / 2, 0]}
              foxTextureUrl={getOrdinalContentUrl(foxOriginOutpoint) || undefined}
              backgroundRemovalStrategy={backgroundRemovalStrategy}
              color={playerColor}
            />
          </group>
        </group>
      </group>
    </group>
  )
}
