import React, { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { SeededRandom, WORLD_SEED } from '../../racing/core/seededRandom'
import { getTerrainHeight } from './HillyTerrain'
import { startFinishPosition, startFinishDirection, trackInterior } from './TrackData'
import { getTrackEdgeClearance } from '../../racing/core/trackProfile'
import { getTrackRuntimeConfig } from '../../racing/tracks/trackRuntimeConfig'
import { TreeInstances } from '../../racing/components/TreeInstances'

const trackRuntimeConfig = getTrackRuntimeConfig('australia')

interface SimpleTreesProps {
  count?: number
  area?: number
  trackCurve?: THREE.CatmullRomCurve3
  onTreesGenerated?: (trees: Array<{ x: number; z: number; scale: number; radius: number }>) => void
  advertisingBoards?: Array<{
    curve: THREE.CatmullRomCurve3
    startT: number
    endT: number
    offset: number
    side: 'left' | 'right'
  }>
}

export const SimpleTrees: React.FC<SimpleTreesProps> = ({ 
  count = 400,
  area = 2000,
  trackCurve,
  onTreesGenerated,
  advertisingBoards = []
}) => {
  const trees = useMemo(() => {
    const rng = new SeededRandom(WORLD_SEED)
    const treePositions: Array<{ x: number; z: number; scale: number; radius: number }> = []
    const MIN_DISTANCE_FROM_TRACK_EDGE = 5 // At least 5 units from track edge
    const MIN_DISTANCE_FROM_TRACK_CENTER = getTrackEdgeClearance(trackRuntimeConfig.surfaceProfile, MIN_DISTANCE_FROM_TRACK_EDGE) // At least 14 units from track centerline
    const MAX_DISTANCE_FROM_TRACK = 100 // Place trees within 100 units of track (mostly near track)
    const NEAR_TRACK_SAMPLES = 200 // Reduced from 500 for better performance (still accurate enough)
    
    // Lake configuration (from Lake.tsx)
    const LAKE_RADIUS = 200
    const LAKE_CENTER = trackInterior?.center ? new THREE.Vector3(
      trackInterior.center.x - 200,
      0,
      trackInterior.center.z - 750
    ) : new THREE.Vector3(0, 0, 0)
    const MIN_DISTANCE_FROM_LAKE = 5 // At least 5 units from lake edge
    
    // Start gate configuration (from FoxRacingWorld.tsx)
    const START_GATE_POLE_OFFSET = 10 // Distance from center line
    const START_GATE_POLE_RADIUS = 0.5
    const START_GATE_AREA_RADIUS = 15 // Keep trees away from start gate area
    const perpDirection = new THREE.Vector3(-startFinishDirection.z, 0, startFinishDirection.x).normalize()
    const startGatePole1 = new THREE.Vector3(
      startFinishPosition.x + perpDirection.x * START_GATE_POLE_OFFSET,
      0,
      startFinishPosition.z + perpDirection.z * START_GATE_POLE_OFFSET
    )
    const startGatePole2 = new THREE.Vector3(
      startFinishPosition.x - perpDirection.x * START_GATE_POLE_OFFSET,
      0,
      startFinishPosition.z - perpDirection.z * START_GATE_POLE_OFFSET
    )
    
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
    
    // Helper to check distance from advertising boards
    const getDistanceFromAdvertisingBoards = (x: number, z: number): number => {
      if (!advertisingBoards || advertisingBoards.length === 0) return Infinity
      
      const pos = new THREE.Vector3(x, 0, z)
      let minDistance = Infinity
      const tempVec1 = new THREE.Vector3()
      const tempVec2 = new THREE.Vector3()
      const tempVec3 = new THREE.Vector3()
      
      for (const board of advertisingBoards) {
        // Sample board curve to find closest point
        const samples = 50
        for (let i = 0; i <= samples; i++) {
          const t = board.startT + (board.endT - board.startT) * (i / samples)
          const wrappedT = t < 0 ? t + 1 : (t > 1 ? t - 1 : t)
          
          board.curve.getPointAt(wrappedT, tempVec1)
          board.curve.getTangentAt(wrappedT, tempVec2)
          tempVec2.normalize()
          
          tempVec3.set(-tempVec2.z, 0, tempVec2.x).normalize()
          if (board.side === 'right') {
            tempVec3.multiplyScalar(-1)
          }
          tempVec3.multiplyScalar(board.offset)
          const boardPoint = tempVec1.clone().add(tempVec3)
          
          const distance = pos.distanceTo(boardPoint)
          if (distance < minDistance) {
            minDistance = distance
          }
        }
      }
      
      return minDistance
    }
    
    // Helper to check if position is valid (not too close, not too far, not on obstacles)
    const isValidTreePosition = (x: number, z: number): boolean => {
      const pos = new THREE.Vector3(x, 0, z)
      
      // Check distance from track centerline
      // distFromTrack is distance to track centerline, so we need to account for track width
      const distFromTrack = getDistanceFromTrack(x, z)
      if (distFromTrack < MIN_DISTANCE_FROM_TRACK_CENTER) {
        return false // Too close to track (within track width/2 + margin)
      }
      if (distFromTrack > MAX_DISTANCE_FROM_TRACK) {
        return false // Too far from track
      }
      
      // Check distance from lake
      const distFromLake = pos.distanceTo(LAKE_CENTER) - LAKE_RADIUS
      if (distFromLake < MIN_DISTANCE_FROM_LAKE) {
        return false // Too close to lake
      }
      
      // Check distance from start gate poles
      const distFromPole1 = pos.distanceTo(startGatePole1) - START_GATE_POLE_RADIUS
      const distFromPole2 = pos.distanceTo(startGatePole2) - START_GATE_POLE_RADIUS
      if (distFromPole1 < MIN_DISTANCE_FROM_TRACK_EDGE || distFromPole2 < MIN_DISTANCE_FROM_TRACK_EDGE) {
        return false // Too close to start gate poles
      }
      
      // Check distance from start gate area (keep trees away from start line)
      const distFromStartGate = pos.distanceTo(new THREE.Vector3(startFinishPosition.x, 0, startFinishPosition.z))
      if (distFromStartGate < START_GATE_AREA_RADIUS) {
        return false // Too close to start gate area
      }
      
      // Check distance from advertising boards
      const distFromBoards = getDistanceFromAdvertisingBoards(x, z)
      if (distFromBoards < MIN_DISTANCE_FROM_TRACK_EDGE) {
        return false // Too close to advertising boards
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
        
        // Random distance from track centerline (between MIN and MAX)
        // MIN_DISTANCE_FROM_TRACK_CENTER ensures we're outside the track
        const distance = MIN_DISTANCE_FROM_TRACK_CENTER + rng.next() * (MAX_DISTANCE_FROM_TRACK - MIN_DISTANCE_FROM_TRACK_CENTER)
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
  }, [count, area, trackCurve, advertisingBoards])

  useEffect(() => {
    onTreesGenerated?.(trees)
  }, [onTreesGenerated, trees])

  return <TreeInstances trees={trees} />
}
