import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SeededRandom, WORLD_SEED } from '../core/seededRandom'

interface DistantMountainsProps {
  radius?: number
  layers?: number
}

interface MountainPlacement {
  x: number
  z: number
  height: number
  width: number
}

const sharedConeGeometry = new THREE.ConeGeometry(1, 1, 8)

const MountainLayer: React.FC<{
  mountains: MountainPlacement[]
  color: string
  castShadow: boolean
}> = ({ mountains, color, castShadow }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    if (!meshRef.current) return

    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()

    mountains.forEach((mountain, index) => {
      position.set(mountain.x, mountain.height / 2, mountain.z)
      quaternion.identity()
      scale.set(mountain.width, mountain.height, mountain.width)

      matrix.compose(position, quaternion, scale)
      meshRef.current!.setMatrixAt(index, matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
  }, [mountains])

  return (
    <instancedMesh
      ref={meshRef}
      args={[sharedConeGeometry, undefined, mountains.length]}
      castShadow={castShadow}
    >
      <meshStandardMaterial color={color} roughness={0.9} metalness={0.1} />
    </instancedMesh>
  )
}

export const DistantMountains: React.FC<DistantMountainsProps> = ({
  radius = 1800,
  layers = 4
}) => {
  const mountainLayers = useMemo(() => {
    const rng = new SeededRandom(WORLD_SEED)
    const result: Array<{ mountains: MountainPlacement[]; color: string }> = []

    for (let layer = 0; layer < layers; layer++) {
      const layerRadius = radius + layer * 400
      const mountainCount = 20 + layer * 5
      const mountains: MountainPlacement[] = []

      for (let index = 0; index < mountainCount; index++) {
        const angle = (index / mountainCount) * Math.PI * 2
        const angleOffset = (rng.next() - 0.5) * (Math.PI * 2 / mountainCount) * 0.5
        const finalAngle = angle + angleOffset
        const distanceVariation = 1 + (rng.next() - 0.5) * 0.2

        const baseHeight = 440 - layer * 50
        const baseWidth = 360 - layer * 40

        mountains.push({
          x: Math.cos(finalAngle) * layerRadius * distanceVariation,
          z: Math.sin(finalAngle) * layerRadius * distanceVariation,
          height: baseHeight + rng.next() * 200,
          width: baseWidth + rng.next() * 160
        })
      }

      const brightness = 0.35 + layer * 0.12
      const color = new THREE.Color(brightness, brightness * 0.95, brightness * 0.9)
      result.push({ mountains, color: `#${color.getHexString()}` })
    }

    return result
  }, [radius, layers])

  return (
    <>
      {mountainLayers.map((layer, index) => (
        <MountainLayer
          key={index}
          mountains={layer.mountains}
          color={layer.color}
          castShadow={index === 0}
        />
      ))}
    </>
  )
}
