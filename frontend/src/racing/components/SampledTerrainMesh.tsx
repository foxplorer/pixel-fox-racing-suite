import React, { useMemo } from 'react'
import * as THREE from 'three'
import type { TerrainHeightSampler } from '../core/roadCorridor'

interface SampledTerrainMeshProps {
  getHeightAtPosition: TerrainHeightSampler
  size?: number
  resolution?: number
  yOffset?: number
  color?: string
}

export const SampledTerrainMesh: React.FC<SampledTerrainMeshProps> = ({
  getHeightAtPosition,
  size = 3200,
  resolution = 160,
  yOffset = -0.4,
  color = '#4a8c59'
}) => {
  const geometry = useMemo(() => {
    const halfSize = size / 2
    const vertices: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    for (let zIndex = 0; zIndex <= resolution; zIndex++) {
      const z = -halfSize + (zIndex / resolution) * size
      for (let xIndex = 0; xIndex <= resolution; xIndex++) {
        const x = -halfSize + (xIndex / resolution) * size
        vertices.push(x, getHeightAtPosition(x, z) + yOffset, z)
        uvs.push(xIndex / resolution, zIndex / resolution)
      }
    }

    const rowSize = resolution + 1
    for (let zIndex = 0; zIndex < resolution; zIndex++) {
      for (let xIndex = 0; xIndex < resolution; xIndex++) {
        const a = zIndex * rowSize + xIndex
        const b = a + 1
        const c = a + rowSize
        const d = c + 1
        indices.push(a, c, b)
        indices.push(b, c, d)
      }
    }

    const terrainGeometry = new THREE.BufferGeometry()
    terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    terrainGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    terrainGeometry.setIndex(indices)
    terrainGeometry.computeVertexNormals()
    return terrainGeometry
  }, [getHeightAtPosition, resolution, size, yOffset])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.86} metalness={0.05} side={THREE.DoubleSide} />
    </mesh>
  )
}
