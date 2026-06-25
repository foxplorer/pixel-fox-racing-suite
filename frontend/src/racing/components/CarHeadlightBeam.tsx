import React, { useMemo } from 'react'
import * as THREE from 'three'

interface CarHeadlightBeamProps {
  x: number
  lightPosition: [number, number, number]
  targetPosition: [number, number, number]
  intensity: number
  distance: number
  angle: number
  penumbra: number
  decay: number
}

export const CarHeadlightBeam: React.FC<CarHeadlightBeamProps> = ({
  x,
  lightPosition,
  targetPosition,
  intensity,
  distance,
  angle,
  penumbra,
  decay
}) => {
  const target = useMemo(() => new THREE.Object3D(), [])

  return (
    <>
      <primitive object={target} position={targetPosition} />
      <spotLight
        key={`headlight-beam-${x}`}
        position={lightPosition}
        target={target}
        color="#fff2b8"
        intensity={intensity}
        distance={distance}
        angle={angle}
        penumbra={penumbra}
        decay={decay}
        castShadow={false}
      />
    </>
  )
}
