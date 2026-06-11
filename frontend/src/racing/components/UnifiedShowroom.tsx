import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { VoxelFox } from '../../components/VoxelFox'
import * as THREE from 'three'
import type { VoxelBackgroundRemovalStrategy } from '../../components/voxelization/voxelBackgroundStrategy'
import { getOrdinalContentUrl } from '../transactions/ordinalLinks'

interface UnifiedShowroomProps {
  foxOriginOutpoint?: string | null
  backgroundRemovalStrategy?: VoxelBackgroundRemovalStrategy
  playerColor: string
  vehicleType: 'car' | 'snowmobile'
  onFoxLoaded?: () => void
}

// Car vehicle component (no VoxelFox - that's rendered separately)
const CarVehicle: React.FC<{ playerColor: string }> = ({ playerColor }) => (
  <group rotation={[0, Math.PI, 0]}>
    {/* Car Body - Bottom Floor */}
    <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
      <boxGeometry args={[2, 0.1, 3.8]} />
      <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
    </mesh>

    {/* Left Side */}
    <mesh position={[-0.9, 0.5, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.2, 0.4, 2.0]} />
      <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
    </mesh>

    {/* Right Side */}
    <mesh position={[0.9, 0.5, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.2, 0.4, 2.0]} />
      <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
    </mesh>

    {/* Front Nose */}
    <mesh position={[0, 0.55, 1.4]} castShadow receiveShadow>
      <boxGeometry args={[2, 0.7, 1.0]} />
      <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
    </mesh>

    {/* Back Trunk */}
    <mesh position={[0, 0.55, -1.4]} castShadow receiveShadow>
      <boxGeometry args={[2, 0.7, 1.0]} />
      <meshStandardMaterial color={playerColor} metalness={0.8} roughness={0.2} />
    </mesh>

    {/* Spoiler */}
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

    {/* Front Left Wheel */}
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

    {/* Front Right Wheel */}
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

    {/* Rear Left Wheel */}
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

    {/* Rear Right Wheel */}
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

    {/* Windshield */}
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
  </group>
)

// Snowmobile vehicle component (no VoxelFox - that's rendered separately)
const SnowmobileVehicle: React.FC<{ playerColor: string }> = ({ playerColor }) => (
  <group rotation={[0, Math.PI, 0]} scale={1.2}>
    {/* Main Body/Chassis */}
    <mesh position={[0, 0.35, 0.3]} castShadow receiveShadow>
      <boxGeometry args={[1.3, 0.3, 3.2]} />
      <meshStandardMaterial color={playerColor} metalness={0.7} roughness={0.3} />
    </mesh>

    {/* Engine Hood (front) */}
    <mesh position={[0, 0.55, 1.4]} castShadow receiveShadow>
      <boxGeometry args={[1.2, 0.35, 1.2]} />
      <meshStandardMaterial color={playerColor} metalness={0.7} roughness={0.3} />
    </mesh>

    {/* Engine vent */}
    <mesh position={[0, 0.75, 1.4]}>
      <boxGeometry args={[0.8, 0.05, 0.8]} />
      <meshStandardMaterial color="#111" />
    </mesh>

    {/* Windshield */}
    <mesh position={[0, 1.0, 0.9]} rotation={[-0.4, 0, 0]}>
      <boxGeometry args={[1.1, 0.7, 0.08]} />
      <meshPhysicalMaterial
        color="#88ccff"
        transmission={0.6}
        opacity={0.5}
        transparent
        roughness={0}
      />
    </mesh>

    {/* Handlebars */}
    <mesh position={[0, 0.95, 0.5]}>
      <boxGeometry args={[1.5, 0.1, 0.1]} />
      <meshStandardMaterial color="#222" metalness={0.9} roughness={0.2} />
    </mesh>
    <mesh position={[-0.7, 0.95, 0.5]}>
      <cylinderGeometry args={[0.08, 0.08, 0.25, 8]} />
      <meshStandardMaterial color="#333" />
    </mesh>
    <mesh position={[0.7, 0.95, 0.5]}>
      <cylinderGeometry args={[0.08, 0.08, 0.25, 8]} />
      <meshStandardMaterial color="#333" />
    </mesh>

    {/* Seat */}
    <mesh position={[0, 0.65, -0.3]} castShadow>
      <boxGeometry args={[0.9, 0.25, 1.6]} />
      <meshStandardMaterial color="#111" roughness={0.9} />
    </mesh>
    <mesh position={[0, 0.85, -1.0]} castShadow>
      <boxGeometry args={[0.85, 0.4, 0.15]} />
      <meshStandardMaterial color="#111" roughness={0.9} />
    </mesh>

    {/* Front Skis */}
    <group position={[-0.55, 0.1, 1.5]}>
      <mesh castShadow>
        <boxGeometry args={[0.2, 0.06, 1.8]} />
        <meshStandardMaterial color="#333" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.08, 0.85]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.2, 0.06, 0.3]} />
        <meshStandardMaterial color="#333" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
    <group position={[0.55, 0.1, 1.5]}>
      <mesh castShadow>
        <boxGeometry args={[0.2, 0.06, 1.8]} />
        <meshStandardMaterial color="#333" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.08, 0.85]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.2, 0.06, 0.3]} />
        <meshStandardMaterial color="#333" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>

    {/* Long Powder Track */}
    <group position={[0, 0.25, -1.2]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.55, 3.2]} />
        <meshStandardMaterial color="#0a0a0a" roughness={1} />
      </mesh>
      {[-1.2, -0.6, 0, 0.6, 1.2].map((z, i) => (
        <mesh key={i} position={[0, -0.22, z]}>
          <boxGeometry args={[0.55, 0.18, 0.2]} />
          <meshStandardMaterial color="#1a1a1a" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.7, 0.15, 3.0]} />
        <meshStandardMaterial color={playerColor} metalness={0.6} roughness={0.4} />
      </mesh>
    </group>

    {/* Running boards */}
    <mesh position={[-0.7, 0.2, -0.2]} castShadow>
      <boxGeometry args={[0.3, 0.08, 2.0]} />
      <meshStandardMaterial color="#222" roughness={0.8} />
    </mesh>
    <mesh position={[0.7, 0.2, -0.2]} castShadow>
      <boxGeometry args={[0.3, 0.08, 2.0]} />
      <meshStandardMaterial color="#222" roughness={0.8} />
    </mesh>

    {/* Headlight */}
    <group position={[0, 0.65, 2.0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.05]}>
        <cylinderGeometry args={[0.32, 0.32, 0.15, 16]} />
        <meshStandardMaterial color={playerColor} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <circleGeometry args={[0.28, 16]} />
        <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={2.5} />
      </mesh>
    </group>

    {/* Tail light */}
    <mesh position={[0, 0.75, -2.7]}>
      <boxGeometry args={[0.6, 0.12, 0.05]} />
      <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={0.4} />
    </mesh>
  </group>
)

export const UnifiedShowroom: React.FC<UnifiedShowroomProps> = ({
  foxOriginOutpoint,
  backgroundRemovalStrategy = 'default',
  playerColor,
  vehicleType,
  onFoxLoaded
}) => {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.4
    }
  })

  // Fox position differs between car and snowmobile
  const foxPosition: [number, number, number] = vehicleType === 'car'
    ? [0, 0.4, 0]
    : [0, 0.85 * 1.2, 0] // Snowmobile is scaled 1.2x
  const foxScale = vehicleType === 'car' ? 0.8 : 0.8 * 1.2

  return (
    <group position={[0, 0, 0]}>
      {/* Lighting - same for both vehicles */}
      <ambientLight intensity={0.4} />
      <spotLight position={[8, 1.5, 0]} angle={0.6} penumbra={0.4} intensity={8} castShadow target-position={[0, 0, 0]} />
      <spotLight position={[-8, 1.5, 0]} angle={0.6} penumbra={0.4} intensity={8} castShadow target-position={[0, 0, 0]} />
      <spotLight position={[0, 1.5, 8]} angle={0.6} penumbra={0.4} intensity={8} castShadow target-position={[0, 0, 0]} />
      <spotLight position={[0, 1.5, -8]} angle={0.6} penumbra={0.4} intensity={8} castShadow target-position={[0, 0, 0]} />
      <spotLight position={[5, 12, 5]} angle={0.8} penumbra={0.5} intensity={6} castShadow target-position={[0, 0, 0]} />
      <spotLight position={[-5, 12, 5]} angle={0.8} penumbra={0.5} intensity={6} castShadow target-position={[0, 0, 0]} />

      {/* Platform */}
      <mesh position={[0, -0.1, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Platform ring */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.8, 6.2, 64]} />
        <meshBasicMaterial color="#4ECDC4" />
      </mesh>

      {/* Rotating Vehicle Group */}
      <group ref={groupRef}>
        {/* Vehicle - conditionally render car or snowmobile */}
        {vehicleType === 'car' ? (
          <CarVehicle playerColor={playerColor} />
        ) : (
          <SnowmobileVehicle playerColor={playerColor} />
        )}

        {/* VoxelFox Driver - ALWAYS mounted, just repositioned */}
        <group position={foxPosition} scale={foxScale}>
          <VoxelFox
            position={[0, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
            foxTextureUrl={getOrdinalContentUrl(foxOriginOutpoint) || undefined}
            backgroundRemovalStrategy={backgroundRemovalStrategy}
            color={playerColor}
            onTextureLoaded={onFoxLoaded}
          />
        </group>
      </group>
    </group>
  )
}
