import React, { useMemo } from 'react'
import * as THREE from 'three'

interface HillyTerrainProps {
  size?: number
  segments?: number
}

export const HillyTerrain: React.FC<HillyTerrainProps> = ({ 
  size = 2000, 
  segments = 200 
}) => {
  const geometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments)
    const positions = geometry.attributes.position.array as Float32Array
    
    // Create hilly terrain using multiple noise-like functions
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]
      const z = positions[i + 2]
      
      // Large rolling hills
      const largeHills = Math.sin(x * 0.003) * Math.cos(z * 0.003) * 100
      
      // Medium hills
      const mediumHills = Math.sin(x * 0.008) * Math.cos(z * 0.006) * 50
      
      // Small hills for detail
      const smallHills = Math.sin(x * 0.02) * Math.cos(z * 0.015) * 25
      
      // Additional variation
      const variation = Math.sin(x * 0.005 + z * 0.007) * 30
      
      // Combine all hills
      const height = largeHills + mediumHills + smallHills + variation
      
      positions[i + 1] = height // y coordinate
    }
    
    geometry.computeVertexNormals()
    return geometry
  }, [size, segments])

  return (
    <mesh 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, 0, 0]} 
      receiveShadow
      castShadow
      geometry={geometry}
    >
      <meshStandardMaterial 
        color="#4a7c59" 
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  )
}

// Helper function to get terrain height at a specific point (must match terrain generation)
export const getTerrainHeight = (x: number, z: number): number => {
  const largeHills = Math.sin(x * 0.003) * Math.cos(z * 0.003) * 100
  const mediumHills = Math.sin(x * 0.008) * Math.cos(z * 0.006) * 50
  const smallHills = Math.sin(x * 0.02) * Math.cos(z * 0.015) * 25
  const variation = Math.sin(x * 0.005 + z * 0.007) * 30
  return largeHills + mediumHills + smallHills + variation
}


