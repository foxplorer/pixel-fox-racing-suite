import React, { useMemo } from 'react'
import * as THREE from 'three'
import { trackInterior } from './TrackData'

interface LakeProps {
  size?: number // Radius of the circular lake (default 200)
}

export const Lake: React.FC<LakeProps> = ({ size = 200 }) => {
  const { center, radius } = useMemo(() => {
    // Use pre-calculated track interior data from TrackData
    const interior = trackInterior
    
    if (!interior || !interior.center) {
      console.warn('⚠️ Lake: No valid track interior data, using default center')
      return { 
        center: new THREE.Vector3(0, 0.15, 0), 
        radius: size
      }
    }
    
    return { 
      center: interior.center, 
      radius: size
    }
  }, [size])
  
  // Create simple circular geometry
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.absarc(0, 0, radius, 0, Math.PI * 2, false)
    const geom = new THREE.ShapeGeometry(shape)
    return geom
  }, [radius])
  
  return (
    <mesh 
      position={[center.x-200, 0.15, center.z-750]} 
      receiveShadow 
      castShadow={false}
      rotation={[-Math.PI / 2, 0, 0]}
      geometry={geometry}
      renderOrder={1}
    >
      <meshStandardMaterial 
        color="#4a90e2" 
        roughness={0.1}
        metalness={0.3}
        transparent={false}
        opacity={1.0}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

