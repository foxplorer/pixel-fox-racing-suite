import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface StartLightProps {
  countdown: number
  visible: boolean
  gameStatus?: 'idle' | 'showroom' | 'loading' | 'countdown' | 'racing' | 'crashed' | 'finished'
  position?: [number, number, number]
  scale?: number
}

interface StartLightLensState {
  color: string
  emissive: string
  emissiveIntensity: number
}

export const getStartLightLensStates = (
  countdown: number,
  gameStatus?: StartLightProps['gameStatus']
): [StartLightLensState, StartLightLensState, StartLightLensState] => {
  const redLit = gameStatus === 'countdown'
  const yellowLit = (countdown === 2 || countdown === 1) && gameStatus === 'countdown'
  const greenLit = gameStatus === 'racing'

  return [
    {
      color: redLit ? '#ff0000' : '#330000',
      emissive: redLit ? '#ff0000' : '#000000',
      emissiveIntensity: redLit ? 2 : 0
    },
    {
      color: yellowLit ? '#ffff00' : '#333300',
      emissive: yellowLit ? '#ffff00' : '#000000',
      emissiveIntensity: yellowLit ? 2 : 0
    },
    {
      color: greenLit ? '#008800' : '#003300',
      emissive: greenLit ? '#00cc00' : '#000000',
      emissiveIntensity: greenLit ? 2 : 0
    }
  ]
}

const LENS_SPACING = 0.82
const LENS_SIZE = 0.66

export const StartLight: React.FC<StartLightProps> = ({
  countdown,
  visible,
  gameStatus,
  position = [0, 0, 0],
  scale = 1
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const lensStates = getStartLightLensStates(countdown, gameStatus)

  useFrame((_, delta) => {
    if (groupRef.current) {
      const targetScale = visible ? scale : 0.001
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5)
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <mesh castShadow>
        <boxGeometry args={[1.5, 3.1, 0.9]} />
        <meshStandardMaterial color="#141414" roughness={0.55} metalness={0.35} />
      </mesh>

      {lensStates.map((lens, index) => {
        const lensY = (1 - index) * LENS_SPACING
        return (
          <React.Fragment key={index}>
            {/* Lenses on both faces so the gate reads from either race direction */}
            <mesh position={[0, lensY, 0.5]}>
              <boxGeometry args={[LENS_SIZE, LENS_SIZE, 0.12]} />
              <meshStandardMaterial
                color={lens.color}
                emissive={lens.emissive}
                emissiveIntensity={lens.emissiveIntensity}
              />
            </mesh>
            <mesh position={[0, lensY, -0.5]}>
              <boxGeometry args={[LENS_SIZE, LENS_SIZE, 0.12]} />
              <meshStandardMaterial
                color={lens.color}
                emissive={lens.emissive}
                emissiveIntensity={lens.emissiveIntensity}
              />
            </mesh>
          </React.Fragment>
        )
      })}
    </group>
  )
}
