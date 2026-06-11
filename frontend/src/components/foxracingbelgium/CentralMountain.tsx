import React, { useMemo } from 'react'
import * as THREE from 'three'

interface CentralMountainProps {
  position?: [number, number, number]
  height?: number
  baseRadius?: number
}

// Mountain parameters - exported for use in terrain height calculation
export const MOUNTAIN_CONFIG = {
  centerX: 700,        // Center of mountain (inside the track loop)
  centerZ: 0,
  height: 150,         // Peak height
  baseRadius: 400,     // Base radius for collision and height calculation
  snowLineHeight: 120, // Height where snow starts
}

// Calculate mountain height contribution at a given point
// Uses smooth falloff from peak to base
export const getMountainHeight = (x: number, z: number): number => {
  const dx = x - MOUNTAIN_CONFIG.centerX
  const dz = z - MOUNTAIN_CONFIG.centerZ
  const distance = Math.sqrt(dx * dx + dz * dz)
  
  // Outside mountain base radius - no contribution
  if (distance > MOUNTAIN_CONFIG.baseRadius) {
    return 0
  }
  
  // Smooth falloff using cosine for natural mountain shape
  // At center (distance=0): full height
  // At edge (distance=baseRadius): 0 height
  const normalizedDistance = distance / MOUNTAIN_CONFIG.baseRadius
  
  // Use smoothstep for smoother transition at base
  const smoothFactor = 1 - (normalizedDistance * normalizedDistance * (3 - 2 * normalizedDistance))
  
  // Add some variation for more natural look
  const variation = Math.sin(dx * 0.02) * Math.cos(dz * 0.02) * 10 * (1 - normalizedDistance)
  
  return MOUNTAIN_CONFIG.height * smoothFactor + variation
}

// Check if a point is inside the mountain (for collision)
// margin: extra distance to add for early collision (e.g., car radius)
export const isInsideMountain = (x: number, z: number, margin: number = 0): boolean => {
  const dx = x - MOUNTAIN_CONFIG.centerX
  const dz = z - MOUNTAIN_CONFIG.centerZ
  const distance = Math.sqrt(dx * dx + dz * dz)
  
  // Collision radius is smaller than visual radius for better gameplay
  // Add margin so collision happens when car's edge touches, not center
  const collisionRadius = MOUNTAIN_CONFIG.baseRadius * 0.8 // 80% of visual radius
  return distance < (collisionRadius + margin)
}

export const CentralMountain: React.FC<CentralMountainProps> = ({
  position = [MOUNTAIN_CONFIG.centerX, 0, MOUNTAIN_CONFIG.centerZ],
  height = MOUNTAIN_CONFIG.height,
  baseRadius = MOUNTAIN_CONFIG.baseRadius
}) => {
  // Create mountain geometry using multiple cone layers for visual interest
  const mountainGeometry = useMemo(() => {
    // Create a more detailed mountain shape using BufferGeometry
    const segments = 64
    const layers = 8
    const geometry = new THREE.BufferGeometry()
    
    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    
    // Generate vertices for each layer
    for (let layer = 0; layer <= layers; layer++) {
      const layerHeight = (layer / layers) * height
      const layerRadius = baseRadius * (1 - layer / layers) * 0.95 // Taper toward top
      
      // Add variation to make it look more natural
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2
        
        // Add some randomness to the radius for natural look
        const variation = 1 + Math.sin(angle * 5 + layer * 0.5) * 0.1 + Math.cos(angle * 3) * 0.05
        const r = layerRadius * variation
        
        const x = Math.cos(angle) * r
        const z = Math.sin(angle) * r
        const y = layerHeight
        
        vertices.push(x, y, z)
        
        // Calculate normal (pointing outward and up)
        const nx = Math.cos(angle) * 0.7
        const ny = 0.7
        const nz = Math.sin(angle) * 0.7
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
        normals.push(nx / len, ny / len, nz / len)
        
        uvs.push(i / segments, layer / layers)
      }
    }
    
    // Add peak vertex
    vertices.push(0, height, 0)
    normals.push(0, 1, 0)
    uvs.push(0.5, 1)
    const peakIndex = (layers + 1) * (segments + 1)
    
    // Generate indices for the sides
    for (let layer = 0; layer < layers; layer++) {
      for (let i = 0; i < segments; i++) {
        const current = layer * (segments + 1) + i
        const next = current + segments + 1
        
        indices.push(current, next, current + 1)
        indices.push(current + 1, next, next + 1)
      }
    }
    
    // Generate indices for the peak cap
    const topLayerStart = layers * (segments + 1)
    for (let i = 0; i < segments; i++) {
      indices.push(topLayerStart + i, peakIndex, topLayerStart + i + 1)
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    
    return geometry
  }, [height, baseRadius])

  // Snow cap geometry (smaller cone at the top)
  const snowCapGeometry = useMemo(() => {
    const snowHeight = height - MOUNTAIN_CONFIG.snowLineHeight
    const snowRadius = baseRadius * (1 - MOUNTAIN_CONFIG.snowLineHeight / height) * 0.9
    return new THREE.ConeGeometry(snowRadius, snowHeight, 32)
  }, [height, baseRadius])

  return (
    <group position={position}>
      {/* Main mountain body - rock/brown color */}
      <mesh geometry={mountainGeometry} receiveShadow castShadow>
        <meshStandardMaterial 
          color="#6b5a4a"
          roughness={0.9}
          metalness={0.1}
          flatShading={false}
        />
      </mesh>
      
      {/* Snow cap at the peak */}
      <mesh 
        geometry={snowCapGeometry}
        position={[0, MOUNTAIN_CONFIG.snowLineHeight + (height - MOUNTAIN_CONFIG.snowLineHeight) / 2, 0]}
        receiveShadow 
        castShadow
      >
        <meshStandardMaterial 
          color="#ffffff"
          roughness={0.3}
          metalness={0.1}
          emissive="#eeeeff"
          emissiveIntensity={0.1}
        />
      </mesh>
      
      {/* Additional rock detail layers for visual interest */}
      <mesh position={[baseRadius * 0.3, height * 0.2, baseRadius * 0.2]} castShadow>
        <coneGeometry args={[baseRadius * 0.15, height * 0.3, 8]} />
        <meshStandardMaterial color="#5a4a3a" roughness={0.9} />
      </mesh>
      <mesh position={[-baseRadius * 0.25, height * 0.15, -baseRadius * 0.3]} castShadow>
        <coneGeometry args={[baseRadius * 0.12, height * 0.25, 8]} />
        <meshStandardMaterial color="#6b5a4a" roughness={0.9} />
      </mesh>
    </group>
  )
}

