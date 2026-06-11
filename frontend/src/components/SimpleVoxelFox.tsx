import { useEffect, useState, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  buildReferenceBackgroundMask,
  type VoxelBackgroundRemovalStrategy
} from './voxelization/voxelBackgroundStrategy'

interface SimpleVoxelFoxProps {
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  isWalking?: boolean
  color?: string
  foxTextureUrl?: string
  backgroundRemovalStrategy?: VoxelBackgroundRemovalStrategy
  onTextureLoaded?: () => void
}

// Helper to get color distance
const getColorDistance = (c1: {r:number, g:number, b:number, a?:number}, c2: {r:number, g:number, b:number, a?:number}) => {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  )
}

interface VoxelData {
  x: number
  y: number
  z: number
  color: THREE.Color
}

export function SimpleVoxelFox({
  position,
  rotation = [0, 0, 0],
  scale = 1,
  isWalking = false,
  foxTextureUrl,
  backgroundRemovalStrategy = 'default',
  onTextureLoaded
}: SimpleVoxelFoxProps) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const [voxels, setVoxels] = useState<VoxelData[]>([])

  // Stable ref for callback to avoid re-triggering effect on every render
  const onTextureLoadedRef = useRef(onTextureLoaded)
  onTextureLoadedRef.current = onTextureLoaded

  // Smart Voxelizer with Flood Fill & Island Removal
  useEffect(() => {
    if (!foxTextureUrl) {
      onTextureLoadedRef.current?.()
      return
    }

    let cancelled = false // Cleanup flag to prevent state updates after unmount

    const img = new Image()
    img.crossOrigin = "Anonymous"
    img.src = foxTextureUrl

    img.onload = () => {
      if (cancelled) return // Don't update state if component unmounted
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      // Grid configuration
      const size = 480
      const gridSize = 24
      const blockSize = 20 // 480 / 24 = 20
      
      canvas.width = size
      canvas.height = size
      ctx.drawImage(img, 0, 0, size, size)
      
      // 1. Read all pixels into a grid first
      const gridColors: {r:number, g:number, b:number, a:number}[][] = []
      
      for (let y = 0; y < gridSize; y++) {
        const row = []
        for (let x = 0; x < gridSize; x++) {
          const sampleX = x * blockSize + blockSize / 2
          const sampleY = y * blockSize + blockSize / 2
          const p = ctx.getImageData(sampleX, sampleY, 1, 1).data
          row.push({ r: p[0], g: p[1], b: p[2], a: p[3] })
        }
        gridColors.push(row)
      }

      const referenceBackgroundMask = buildReferenceBackgroundMask(
        gridColors,
        backgroundRemovalStrategy
      )

      // 2. Flood Fill to identify Background
      const isBackground = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false))
      const queue: [number, number][] = []
      
      // Start from corners
      const corners = [[0, 0], [gridSize-1, 0], [0, gridSize-1], [gridSize-1, gridSize-1]]
      const bgRef = gridColors[0][0] 
      
      corners.forEach(([x, y]) => {
        if (getColorDistance(gridColors[y][x], bgRef) < 40) { // Increased tolerance slightly
          queue.push([x, y])
          isBackground[y][x] = true
        }
      })

      const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]]
      while (queue.length > 0) {
        const [cx, cy] = queue.pop()!
        
        for (const [dx, dy] of directions) {
          const nx = cx + dx
          const ny = cy + dy
          
          if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && !isBackground[ny][nx]) {
            const neighborColor = gridColors[ny][nx]
            // Use stricter tolerance for propagation to avoid eating into fox
            if (getColorDistance(neighborColor, bgRef) < 40) {
              isBackground[ny][nx] = true
              queue.push([nx, ny])
            }
          }
        }
      }

      // 3. Identify "Solid" Candidates (Body)
      const isBodyCandidate = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false))
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          // Must not be background AND must be opaque
          if (!isBackground[y][x] && !referenceBackgroundMask?.[y]?.[x] && gridColors[y][x].a >= 20) {
            isBodyCandidate[y][x] = true
          }
        }
      }

      // 4. Island Removal: Keep only the Largest Connected Component
      // This removes floating artifacts that aren't attached to the main fox
      const visited = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false))
      let largestComponent: {x:number, y:number}[] = []
      
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (isBodyCandidate[y][x] && !visited[y][x]) {
            // Found a new component, trace it
            const component: {x:number, y:number}[] = []
            const q = [[x, y]]
            visited[y][x] = true
            component.push({x, y})
            
            while (q.length > 0) {
              const [cx, cy] = q.pop()!
              for (const [dx, dy] of directions) {
                const nx = cx + dx
                const ny = cy + dy
                if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
                  if (isBodyCandidate[ny][nx] && !visited[ny][nx]) {
                    visited[ny][nx] = true
                    component.push({x: nx, y: ny})
                    q.push([nx, ny])
                  }
                }
              }
            }
            
            if (component.length > largestComponent.length) {
              largestComponent = component
            }
          }
        }
      }
      
      // Create Final Mask from largest component
      const finalBodyMask = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false))
      largestComponent.forEach(({x, y}) => {
        finalBodyMask[y][x] = true
      })

      // 5. Generate Voxels from Final Mask
      const generatedVoxels: VoxelData[] = []
      
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (!finalBodyMask[y][x]) continue
          
          const c = gridColors[y][x]
          const threeColor = new THREE.Color(`rgb(${c.r}, ${c.g}, ${c.b})`)

          const vx = (x - gridSize / 2) * 0.1
          // Y position: Bottom (y=23) -> 0. Top (y=0) -> 2.3
          const vy = (gridSize - 1 - y) * 0.1
          
          // Add FRONT voxel (z=0.1)
          generatedVoxels.push({ x: vx, y: vy, z: 0.1, color: threeColor })
          
          // Add BACK voxel (z=0) for uniform thickness everywhere
          generatedVoxels.push({ x: vx, y: vy, z: 0, color: threeColor })
        }
      }

      setVoxels(generatedVoxels)
      onTextureLoadedRef.current?.()
    }

    img.onerror = () => {
      if (cancelled) return
      onTextureLoadedRef.current?.() // Still signal ready even on error
    }

    return () => { cancelled = true } // Cleanup on unmount
  }, [backgroundRemovalStrategy, foxTextureUrl]) // Removed onTextureLoaded - using ref instead

  // Update InstancedMesh
  useEffect(() => {
    if (!meshRef.current || voxels.length === 0) return
    
    const tempObject = new THREE.Object3D()
    
    voxels.forEach((voxel, i) => {
      tempObject.position.set(voxel.x, voxel.y, voxel.z)
      tempObject.updateMatrix()
      meshRef.current!.setMatrixAt(i, tempObject.matrix)
      meshRef.current!.setColorAt(i, voxel.color)
    })
    
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
  }, [voxels])

  // Animation
  useFrame((state) => {
    if (!groupRef.current) return
    const time = state.clock.elapsedTime
    
    if (isWalking) {
      const bobSpeed = 10
      const bobHeight = 0.1
      const tiltAmt = 0.05
      
      groupRef.current.position.y = position[1] + Math.sin(time * bobSpeed) * bobHeight
      groupRef.current.rotation.z = rotation[2] + Math.cos(time * bobSpeed) * tiltAmt
      groupRef.current.rotation.x = rotation[0] + Math.sin(time * bobSpeed) * 0.05
    } else {
      groupRef.current.position.y = position[1] + Math.sin(time * 2) * 0.02
      groupRef.current.rotation.z = rotation[2]
      groupRef.current.rotation.x = rotation[0]
    }
  })

  // Return null if not ready to avoid artifacts
  if (voxels.length === 0) return null

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <instancedMesh 
        ref={meshRef} 
        args={[undefined, undefined, voxels.length]}
        castShadow 
        receiveShadow
      >
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
    </group>
  )
}
