import React, { useMemo, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { getMountainHeight, MOUNTAIN_CONFIG } from './CentralMountain'
// PERFORMANCE: Removed getTrackHeightAndInfluence import - track is flat, so no expensive calculations needed

interface HillyTerrainProps {
  size?: number
  segments?: number
}

// Terrain height scale factor - controls overall terrain amplitude
// Reduced from original (200+ units) to create gentle hills suitable for racing
// Can be adjusted to make terrain more/less dramatic
const TERRAIN_SCALE = 0.15 // Scale down hills to ~30 units max height

export const HillyTerrain: React.FC<HillyTerrainProps> = ({ 
  size = 8000, // Large terrain to cover race track area
  segments = 200 // Balanced segments for detail and performance
}) => {
  const geometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments)
    const positions = geometry.attributes.position.array as Float32Array
    
    // PlaneGeometry creates vertices in XY plane with Z=0
    // After rotation of -π/2 around X axis:
    // - Local X → World X
    // - Local Y → World Z (negated)
    // - Local Z → World Y (height)
    // So we read (x, -y) as world (x, z) and set z as height
    
    let minHeight = Infinity
    let maxHeight = -Infinity
    
    for (let i = 0; i < positions.length; i += 3) {
      const localX = positions[i]       // This becomes world X
      const localY = positions[i + 1]   // This becomes world -Z after rotation
      
      // World coordinates after rotation
      const worldX = localX
      const worldZ = -localY  // Negated because of rotation direction
      
      // Get terrain height at world position
      const height = getTerrainHeight(worldX, worldZ)
      
      // Set local Z which becomes world Y (height) after rotation
      positions[i + 2] = height
      
      minHeight = Math.min(minHeight, height)
      maxHeight = Math.max(maxHeight, height)
    }
    
    console.log('🌱 HillyTerrain created:', { size, segments, minHeight, maxHeight, vertices: positions.length / 3 })
    
    geometry.computeVertexNormals()
    return geometry
  }, [size, segments])

  const meshRef = useRef<THREE.Mesh>(null)
  
  useEffect(() => {
    if (meshRef.current) {
      console.log('🌱 HillyTerrain mesh mounted:', meshRef.current.position, meshRef.current.rotation)
    }
  }, [])
  
  return (
    <mesh 
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, -0.1, 0]} 
      receiveShadow
      castShadow
      geometry={geometry}
      renderOrder={-1}
    >
      <meshStandardMaterial 
        color="#4a8c59" 
        roughness={0.8}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// Raw terrain height calculation (before scaling)
// Uses multiple sine waves to create natural-looking rolling hills
const getTerrainHeightRaw = (x: number, z: number): number => {
  // Large rolling hills - gentle, wide waves
  const largeHills = Math.sin(x * 0.002) * Math.cos(z * 0.002) * 80
  
  // Medium hills - moderate waves
  const mediumHills = Math.sin(x * 0.005) * Math.cos(z * 0.004) * 40
  
  // Small hills for detail - fine waves
  const smallHills = Math.sin(x * 0.012) * Math.cos(z * 0.010) * 15
  
  // Additional variation - asymmetric for more natural look
  const variation = Math.sin(x * 0.003 + z * 0.004) * 20
  
  // Combine all hills with scale factor
  return (largeHills + mediumHills + smallHills + variation) * TERRAIN_SCALE
}

// Helper function to get terrain height at a specific point
// This MUST match the terrain generation exactly for car/track to align
// Includes both rolling hills AND central mountain
export const getTerrainHeight = (x: number, z: number): number => {
  // PERFORMANCE: Track is flat (y=0), so skip expensive track influence calculation
  // Just return natural terrain height (hills + mountains)
  // Track is always at ground level (0.01), so no need to blend with track height
  
  // 1. Natural Terrain (Hills + Mountain)
  const hillHeight = getTerrainHeightRaw(x, z)
  const mountainHeight = getMountainHeight(x, z)
  const naturalHeight = Math.max(hillHeight, mountainHeight)
  
  // PERFORMANCE: Skip expensive getTrackHeightAndInfluence call
  // Track is flat, so just return natural terrain height
  // If we're on track, the track surface is at 0.01, but terrain can still have hills/mountains
  return naturalHeight
}

// Get terrain height with a small offset above the surface
// Useful for placing objects (car, track) slightly above terrain
export const getTerrainHeightWithOffset = (x: number, z: number, offset: number = 0.1): number => {
  return getTerrainHeight(x, z) + offset
}


