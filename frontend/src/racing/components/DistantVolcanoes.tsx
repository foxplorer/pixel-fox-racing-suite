import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SeededRandom, WORLD_SEED } from '../core/seededRandom'

interface DistantVolcanoesProps {
  radius?: number
  layers?: number
}

interface VolcanoPlacement {
  x: number
  z: number
  height: number
  width: number
  yaw: number
}

const volcanoGeometry = new THREE.ConeGeometry(1, 1, 9)

const VolcanoLayer: React.FC<{
  volcanoes: VolcanoPlacement[]
  color: string
  castShadow: boolean
}> = ({ volcanoes, color, castShadow }) => {
  const bodyRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const euler = new THREE.Euler()
    const scale = new THREE.Vector3()

    if (bodyRef.current) {
      volcanoes.forEach((volcano, index) => {
        position.set(volcano.x, volcano.height / 2 - 8, volcano.z)
        euler.set(0, volcano.yaw, 0)
        quaternion.setFromEuler(euler)
        scale.set(volcano.width, volcano.height, volcano.width)
        matrix.compose(position, quaternion, scale)
        bodyRef.current!.setMatrixAt(index, matrix)
      })
      bodyRef.current.instanceMatrix.needsUpdate = true
      bodyRef.current.computeBoundingSphere()
    }
  }, [volcanoes])

  return (
    <instancedMesh ref={bodyRef} args={[volcanoGeometry, undefined, volcanoes.length]} castShadow={castShadow} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.96} metalness={0.04} />
    </instancedMesh>
  )
}

export const DistantVolcanoes: React.FC<DistantVolcanoesProps> = ({
  radius = 1900,
  layers = 3
}) => {
  const volcanoLayers = useMemo(() => {
    const rng = new SeededRandom(WORLD_SEED + 8600)
    const result: Array<{ volcanoes: VolcanoPlacement[]; color: string }> = []

    for (let layer = 0; layer < layers; layer++) {
      const layerRadius = radius + layer * 430
      const volcanoCount = 11 + layer * 4
      const volcanoes: VolcanoPlacement[] = []

      for (let index = 0; index < volcanoCount; index++) {
        const angle = (index / volcanoCount) * Math.PI * 2
        const angleOffset = (rng.next() - 0.5) * (Math.PI * 2 / volcanoCount) * 0.55
        const finalAngle = angle + angleOffset
        const distanceVariation = 1 + (rng.next() - 0.5) * 0.18
        const distance = layerRadius * distanceVariation
        const baseHeight = 360 - layer * 48
        const baseWidth = 260 - layer * 28

        volcanoes.push({
          x: Math.cos(finalAngle) * distance,
          z: Math.sin(finalAngle) * distance,
          height: baseHeight + rng.next() * 220,
          width: baseWidth + rng.next() * 170,
          yaw: rng.next() * Math.PI * 2
        })
      }

      const brightness = 0.18 + layer * 0.055
      const color = new THREE.Color(brightness * 1.2, brightness * 0.82, brightness * 0.62)
      result.push({ volcanoes, color: `#${color.getHexString()}` })
    }

    return result
  }, [layers, radius])

  return (
    <>
      {volcanoLayers.map((layer, index) => (
        <VolcanoLayer
          key={index}
          volcanoes={layer.volcanoes}
          color={layer.color}
          castShadow={index === 0}
        />
      ))}
    </>
  )
}
