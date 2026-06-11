import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface StartLightProps {
  countdown: number
  visible: boolean
  gameStatus?: 'idle' | 'showroom' | 'loading' | 'countdown' | 'racing' | 'crashed' | 'finished'
}

export const StartLight: React.FC<StartLightProps> = ({ countdown, visible, gameStatus }) => {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current) {
      const targetScale = visible ? 1 : 0
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5)
    }
  })

  return (
    <group ref={groupRef} position={[0, 8, 0]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.5, 4, 1]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      <mesh position={[0, 1.2, 0.6]}>
        <sphereGeometry args={[0.5]} />
        <meshStandardMaterial
          color={gameStatus === 'countdown' ? '#ff0000' : '#330000'}
          emissive={gameStatus === 'countdown' ? '#ff0000' : '#000000'}
          emissiveIntensity={gameStatus === 'countdown' ? 2 : 0}
        />
      </mesh>

      <mesh position={[0, 0, 0.6]}>
        <sphereGeometry args={[0.5]} />
        <meshStandardMaterial
          color={(countdown === 2 || countdown === 1) && gameStatus === 'countdown' ? '#ffff00' : '#333300'}
          emissive={(countdown === 2 || countdown === 1) && gameStatus === 'countdown' ? '#ffff00' : '#000000'}
          emissiveIntensity={(countdown === 2 || countdown === 1) && gameStatus === 'countdown' ? 2 : 0}
        />
      </mesh>

      <mesh position={[0, -1.2, 0.6]}>
        <sphereGeometry args={[0.5]} />
        <meshStandardMaterial
          color={gameStatus === 'racing' ? '#008800' : '#003300'}
          emissive={gameStatus === 'racing' ? '#00cc00' : '#000000'}
          emissiveIntensity={gameStatus === 'racing' ? 2 : 0}
        />
      </mesh>
    </group>
  )
}
