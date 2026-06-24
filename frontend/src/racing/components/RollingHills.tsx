import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SeededRandom, WORLD_SEED } from '../core/seededRandom'

interface RollingHillsProps {
  radius?: number
  layers?: number
  colorScheme?: 'green' | 'snow'
}

interface HillPlacement {
  x: number
  z: number
  height: number
  width: number
}

const sharedSphereGeometry = new THREE.SphereGeometry(1, 12, 8)

const getHillColor = (layer: number, colorScheme: RollingHillsProps['colorScheme']): string => {
  if (colorScheme === 'snow') {
    const snowBrightness = 0.9 - layer * 0.08
    const color = new THREE.Color(snowBrightness * 0.95, snowBrightness * 0.97, snowBrightness)
    return `#${color.getHexString()}`
  }

  const greenBrightness = 0.6 - layer * 0.15
  const color = new THREE.Color(0.15 + greenBrightness * 0.2, greenBrightness, greenBrightness * 0.3)
  return `#${color.getHexString()}`
}

const HillLayer: React.FC<{
  hills: HillPlacement[]
  color: string
  castShadow: boolean
}> = ({ hills, color, castShadow }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    if (!meshRef.current) return

    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()

    hills.forEach((hill, index) => {
      const sphereVerticalRadius = hill.height / 2
      const visibleHeight = hill.height * 0.45
      const yPosition = visibleHeight - sphereVerticalRadius

      position.set(hill.x, yPosition, hill.z)
      quaternion.identity()
      scale.set(hill.width, hill.height, hill.width)

      matrix.compose(position, quaternion, scale)
      meshRef.current!.setMatrixAt(index, matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
    // Instance matrices don't refresh the mesh bounds; without this the bounding
    // sphere stays a unit sphere at the origin while the hills sit ~1800+ units out,
    // so the whole ring gets frustum culled and pops in/out as the camera moves.
    meshRef.current.computeBoundingSphere()
  }, [hills])

  return (
    <instancedMesh ref={meshRef} args={[sharedSphereGeometry, undefined, hills.length]} castShadow={castShadow} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.9} metalness={0.0} />
    </instancedMesh>
  )
}

export const RollingHills: React.FC<RollingHillsProps> = ({
  radius = 1800,
  layers = 2,
  colorScheme = 'green'
}) => {
  const hillLayers = useMemo(() => {
    const rng = new SeededRandom(WORLD_SEED + 1000)
    const result: Array<{ hills: HillPlacement[]; color: string }> = []

    for (let layer = 0; layer < layers; layer++) {
      const layerRadius = radius + layer * 400 + 200
      const hillCount = 20 + layer * 5
      const hills: HillPlacement[] = []

      for (let index = 0; index < hillCount; index++) {
        const angle = (index / hillCount) * Math.PI * 2
        const angleOffset = (rng.next() - 0.5) * (Math.PI * 2 / hillCount) * 0.5
        const finalAngle = angle + angleOffset

        const distanceVariation = 1 + (rng.next() - 0.5) * 0.1
        const minDistance = layerRadius * 0.95
        const distance = Math.max(minDistance, layerRadius * distanceVariation)
        let x = Math.cos(finalAngle) * distance
        let z = Math.sin(finalAngle) * distance

        const baseHeight = 90 - layer * 10
        const height = baseHeight + rng.next() * 30
        const baseWidth = 300 - layer * 30
        const width = baseWidth + rng.next() * 100

        const hillRadius = width / 2
        const distanceFromCenter = Math.sqrt(x * x + z * z)
        const minSafeDistance = 1000

        if (distanceFromCenter - hillRadius < minSafeDistance) {
          const pushDistance = minSafeDistance + hillRadius - distanceFromCenter
          const pushAngle = Math.atan2(z, x)
          x = Math.cos(pushAngle) * (distanceFromCenter + pushDistance)
          z = Math.sin(pushAngle) * (distanceFromCenter + pushDistance)
        }

        hills.push({ x, z, height, width })
      }

      result.push({ hills, color: getHillColor(layer, colorScheme) })
    }

    return result
  }, [radius, layers, colorScheme])

  return (
    <>
      {hillLayers.map((layer, index) => (
        <HillLayer key={index} hills={layer.hills} color={layer.color} castShadow={index === 0} />
      ))}
    </>
  )
}
