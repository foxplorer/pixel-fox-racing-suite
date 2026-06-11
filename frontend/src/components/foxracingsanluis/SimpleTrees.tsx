import React, { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { SeededRandom, WORLD_SEED } from '../../racing/core/seededRandom'
import { getTrackEdgeClearance } from '../../racing/core/trackProfile'
import { getTrackRuntimeConfig } from '../../racing/tracks/trackRuntimeConfig'
import { TreeInstances } from '../../racing/components/TreeInstances'

const trackRuntimeConfig = getTrackRuntimeConfig('san-luis')

interface SimpleTreesProps {
  count?: number
  area?: number
  trackCurve?: THREE.CatmullRomCurve3
  onTreesGenerated?: (trees: Array<{ x: number; z: number; scale: number; radius: number }>) => void
}

export const SimpleTrees: React.FC<SimpleTreesProps> = ({
  count = 400,
  area = 2000,
  trackCurve,
  onTreesGenerated
}) => {
  const trees = useMemo(() => {
    const rng = new SeededRandom(WORLD_SEED)
    const treePositions: Array<{ x: number; z: number; scale: number; radius: number }> = []
    const TRACK_MARGIN = 8 // Extra margin to keep trees off track
    const MIN_DISTANCE_FROM_TRACK = getTrackEdgeClearance(trackRuntimeConfig.surfaceProfile, TRACK_MARGIN)
    const MAX_DISTANCE_FROM_TRACK = 60 // Only place trees within 60 units of track
    const NEAR_TRACK_SAMPLES = 200 // Sample points along track for tree placement
    
    // Helper to get distance from track
    const getDistanceFromTrack = (x: number, z: number): number => {
      if (!trackCurve) return Infinity
      
      const pos = new THREE.Vector3(x, 0.1, z)
      let minDistance = Infinity
      
      // Sample track to find closest point
      for (let i = 0; i <= NEAR_TRACK_SAMPLES; i++) {
        const t = i / NEAR_TRACK_SAMPLES
        const curvePoint = trackCurve.getPointAt(t)
        const dx = pos.x - curvePoint.x
        const dz = pos.z - curvePoint.z
        const distance = Math.sqrt(dx * dx + dz * dz)
        if (distance < minDistance) {
          minDistance = distance
        }
      }
      
      return minDistance
    }
    
    // Helper to check if position is valid (not too close, not too far)
    const isValidTreePosition = (x: number, z: number): boolean => {
      const distFromCenter = Math.sqrt(x * x + z * z)
      if (distFromCenter < 30) {
        return false // Too close to spawn
      }
      
      const distFromTrack = getDistanceFromTrack(x, z)
      if (distFromTrack < MIN_DISTANCE_FROM_TRACK) {
        return false // Too close to track
      }
      if (distFromTrack > MAX_DISTANCE_FROM_TRACK) {
        return false // Too far from track
      }
      
      return true
    }
    
    let attempts = 0
    const maxAttempts = count * 20 // Try many times to place trees near track
    
    for (let i = 0; i < count && attempts < maxAttempts; attempts++) {
      // Strategy: Place trees near track by sampling track points and offsetting
      let x: number, z: number
      
      if (trackCurve && rng.next() < 0.8) {
        // 80% of trees: place near track by sampling track and adding random offset
        const t = rng.next()
        const trackPoint = trackCurve.getPointAt(t)
        const tangent = trackCurve.getTangentAt(t).normalize()
        const right = new THREE.Vector3(0, 1, 0).cross(tangent).normalize()
        
        // Random distance from track (between MIN and MAX)
        const distance = MIN_DISTANCE_FROM_TRACK + rng.next() * (MAX_DISTANCE_FROM_TRACK - MIN_DISTANCE_FROM_TRACK)
        // Random side (left or right)
        const side = rng.next() < 0.5 ? -1 : 1
        
        const offset = right.multiplyScalar(side * distance)
        x = trackPoint.x + offset.x
        z = trackPoint.z + offset.z
      } else {
        // 20% of trees: random position but still check if near track
        x = (rng.next() - 0.5) * area
        z = (rng.next() - 0.5) * area
      }
      
      // Validate position
      if (!isValidTreePosition(x, z)) {
        continue // Skip this position
      }
      
      // Vary tree size more - from small to large
      const sizeType = rng.next()
      let scale: number
      if (sizeType < 0.3) {
        // Small trees (30%)
        scale = 0.5 + rng.next() * 0.3
      } else if (sizeType < 0.7) {
        // Medium trees (40%)
        scale = 0.8 + rng.next() * 0.4
      } else {
        // Large trees (30%)
        scale = 1.2 + rng.next() * 0.6
      }
      
      // Tree collision radius (trunk + some foliage)
      const radius = 0.5 * scale + 0.3
      
      treePositions.push({ x, z, scale, radius })
      i++
    }
    
    return treePositions
  }, [count, area, trackCurve])

  useEffect(() => {
    onTreesGenerated?.(trees)
  }, [onTreesGenerated, trees])

  return <TreeInstances trees={trees} frustumCulled={false} />
}
