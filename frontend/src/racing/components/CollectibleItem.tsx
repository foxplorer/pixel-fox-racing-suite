import React, { useMemo, useRef } from 'react'
import { Billboard, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { RacingCollectibleType } from '../collectibles/collectibleTypes'
import blueberryUrl from '../../assets/blueberries.svg'
import rabbitUrl from '../../assets/rabbit-face.svg'
import saladUrl from '../../assets/salad.svg'

interface CollectibleItemProps {
  id: string
  type: RacingCollectibleType
  position: [number, number, number]
}

export const CollectibleItem: React.FC<CollectibleItemProps> = ({
  id,
  type,
  position
}) => {
  const groupRef = useRef<THREE.Group>(null)

  const textureUrl = useMemo(() => {
    switch (type) {
      case 'blueberry':
        return blueberryUrl
      case 'rabbit':
        return rabbitUrl
      case 'salad':
        return saladUrl
      default:
        return blueberryUrl
    }
  }, [type])

  const texture = useTexture(textureUrl)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + 0.5 + Math.sin(state.clock.elapsedTime * 2 + parseInt(id.slice(-3) || '0', 36)) * 0.2
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <Billboard>
        <mesh>
          <planeGeometry args={[1.5, 1.5]} />
          <meshBasicMaterial
            map={texture}
            transparent
            alphaTest={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      </Billboard>
      <pointLight distance={3} intensity={2} color={type === 'rabbit' ? '#ffaaaa' : '#aaffaa'} />
    </group>
  )
}
