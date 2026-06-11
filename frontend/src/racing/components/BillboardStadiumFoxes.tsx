import React, { useEffect, useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import crowdSound from '../../assets/crowd_long.mp3'

// Compact voxel format: [x, y, z, r, g, b]
export type VoxelTuple = [number, number, number, number, number, number]

// Fox voxel data structure
export interface FoxVoxelData {
  id: number
  dominantColor: string
  voxels: VoxelTuple[]
}

// Compact format uses base36 for grid coords and hex for colors
// Each voxel is 9 chars: XY Z RRGGBB (X,Y are base36, Z is 0/1, RGB is hex)
function decodeVoxelString(str: string): VoxelTuple[] {
  const voxels: VoxelTuple[] = []
  for (let i = 0; i < str.length; i += 9) {
    const gx = parseInt(str[i], 36)     // grid X (0-23)
    const gy = parseInt(str[i + 1], 36) // grid Y (0-23)
    const gz = str[i + 2] === '1' ? 0.1 : 0  // z depth
    const r = parseInt(str.slice(i + 3, i + 5), 16)
    const g = parseInt(str.slice(i + 5, i + 7), 16)
    const b = parseInt(str.slice(i + 7, i + 9), 16)

    // Convert grid back to world coords
    const x = (gx - 12) * 0.1
    const y = (23 - gy) * 0.1

    voxels.push([x, y, gz, r, g, b])
  }
  return voxels
}

// Shared preload state - only loads once across all tracks
let preloadedFoxData: FoxVoxelData[] | null = null
let preloadPromise: Promise<FoxVoxelData[]> | null = null

/**
 * Preload stadium fox data (shared across all tracks)
 * Call this early from FoxRacingGame to ensure data is ready
 */
export function preloadStadiumFoxes(): Promise<FoxVoxelData[]> {
  if (preloadedFoxData) {
    return Promise.resolve(preloadedFoxData)
  }
  if (!preloadPromise) {
    preloadPromise = fetch('/data/stadium-foxes.json')
      .then(res => res.json())
      .then(data => {
        // Decode compact format
        preloadedFoxData = data.foxes.map((fox: { id: number; c: string; v: string }) => ({
          id: fox.id,
          dominantColor: fox.c,
          voxels: decodeVoxelString(fox.v)
        }))
        return preloadedFoxData!
      })
      .catch(err => {
        console.error('Failed to preload fox data:', err)
        return []
      })
  }
  return preloadPromise
}

// Start preloading immediately when this module is imported
// This happens when /foxracing page loads, before any track is selected
preloadStadiumFoxes()

interface FoxPlacement {
  position: [number, number, number]
  rotation: number
  scale: number
  voxels: VoxelTuple[]
  foxIndex: number
}

interface BillboardStadiumFoxesProps {
  foxPlacements: FoxPlacement[]
  textureAtlas: THREE.CanvasTexture | null
  atlasSize: { cols: number; rows: number }
  stadiumPosition?: THREE.Vector3
  hopDistance?: number
  isSoundEnabled?: boolean
}

/**
 * BillboardStadiumFoxes - Renders stadium foxes as instanced billboard sprites
 * Uses a single InstancedMesh with texture atlas - ONE draw call for all foxes
 */
// Hopping animation constants
const HOP_INTERVAL = 0.8 // seconds between new hop groups (overlapping waves)
const HOP_DURATION = 0.8 // seconds for hop animation
const HOP_HEIGHT = 0.6 // max hop height
const HOP_PERCENTAGE = 0.3 // 30% of foxes per wave (overlapping = ~continuous)

export const BillboardStadiumFoxes = React.memo(function BillboardStadiumFoxes({
  foxPlacements,
  textureAtlas,
  atlasSize,
  stadiumPosition,
  hopDistance = 150,
  isSoundEnabled = false
}: BillboardStadiumFoxesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  // Map of fox index -> { startTime, phaseOffset } for chaotic hopping
  const hoppingFoxesRef = useRef<Map<number, { startTime: number; phase: number }>>(new Map())
  const lastHopTriggerRef = useRef<number>(0)
  const basePositionsRef = useRef<Float32Array | null>(null)
  const crowdAudioRef = useRef<HTMLAudioElement | null>(null)
  const isPlayingRef = useRef(false)
  const { camera } = useThree()

  // Set up crowd audio
  useEffect(() => {
    const audio = new Audio(crowdSound)
    audio.loop = true
    audio.volume = 0.4
    crowdAudioRef.current = audio

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [])

  // Create custom geometry with UV attributes for atlas lookup
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1)
    return geo
  }, [])

  // Create material with the atlas texture
  const material = useMemo(() => {
    if (!textureAtlas) return null

    return new THREE.MeshBasicMaterial({
      map: textureAtlas,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide
    })
  }, [textureAtlas])

  // Set up instance matrices and modify UVs per-instance
  useEffect(() => {
    if (!meshRef.current || foxPlacements.length === 0 || !textureAtlas) return

    const mesh = meshRef.current
    const tempMatrix = new THREE.Matrix4()
    const tempPosition = new THREE.Vector3()
    const tempQuaternion = new THREE.Quaternion()
    const tempScale = new THREE.Vector3()

    // We need to create custom UV offsets per instance
    // Since InstancedMesh doesn't support per-instance UVs natively,
    // we'll bake the UVs into the geometry by creating instanced buffer attributes

    const uvOffsets = new Float32Array(foxPlacements.length * 2) // x, y offset per instance
    const uvScales = new Float32Array(foxPlacements.length * 2)  // x, y scale per instance

    const cellWidth = 1 / atlasSize.cols
    const cellHeight = 1 / atlasSize.rows

    foxPlacements.forEach((placement, i) => {
      const { position, scale, foxIndex, rotation } = placement

      // Set instance transform - foxes face the track based on their rotation
      tempPosition.set(position[0], position[1], position[2])
      tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation)
      tempScale.set(scale * 2.4, scale * 2.4, 1)

      tempMatrix.compose(tempPosition, tempQuaternion, tempScale)
      mesh.setMatrixAt(i, tempMatrix)

      // Calculate UV offset for this fox in the atlas
      const col = foxIndex % atlasSize.cols
      const row = Math.floor(foxIndex / atlasSize.cols)

      uvOffsets[i * 2] = col * cellWidth
      uvOffsets[i * 2 + 1] = 1 - (row + 1) * cellHeight // Flip Y

      uvScales[i * 2] = cellWidth
      uvScales[i * 2 + 1] = cellHeight
    })

    mesh.instanceMatrix.needsUpdate = true

    // Store base Y positions for hopping animation
    const basePositions = new Float32Array(foxPlacements.length)
    foxPlacements.forEach((placement, i) => {
      basePositions[i] = placement.position[1]
    })
    basePositionsRef.current = basePositions

    // Store UV data for shader (we'll need custom shader for per-instance UVs)
    const geo = mesh.geometry as THREE.BufferGeometry
    geo.setAttribute('uvOffset', new THREE.InstancedBufferAttribute(uvOffsets, 2))
    geo.setAttribute('uvScale', new THREE.InstancedBufferAttribute(uvScales, 2))

    // Quality changes can replace the placement array with fewer instances.
    // Clear old hopper indexes so the frame loop cannot animate stale instance ids.
    hoppingFoxesRef.current.clear()
  }, [foxPlacements, textureAtlas, atlasSize])

  // Hopping animation - reuse objects to avoid GC
  const tempMatrix = useMemo(() => new THREE.Matrix4(), [])
  const tempPosition = useMemo(() => new THREE.Vector3(), [])
  const tempQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const tempScale = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    if (!meshRef.current || foxPlacements.length === 0 || !basePositionsRef.current) return

    // Check distance - only animate hopping when close enough
    if (stadiumPosition) {
      const distance = camera.position.distanceTo(stadiumPosition)
      const shouldHop = distance <= hopDistance

      // Handle crowd audio with fade in/out (respects mute setting)
      // Fade range: hopDistance to hopDistance + 50 (e.g., 150-200 units)
      if (crowdAudioRef.current) {
        const fadeStart = hopDistance + 50
        const maxVolume = 0.6 // Louder to be heard over snowmobile engine

        if (distance <= fadeStart && isSoundEnabled) {
          // Calculate volume: full at hopDistance, zero at fadeStart
          const fadeProgress = Math.max(0, (fadeStart - distance) / 50)
          const volume = Math.min(maxVolume, fadeProgress * maxVolume)
          crowdAudioRef.current.volume = volume

          if (!isPlayingRef.current) {
            crowdAudioRef.current.play().catch(() => {})
            isPlayingRef.current = true
          }
        } else if (isPlayingRef.current) {
          crowdAudioRef.current.pause()
          isPlayingRef.current = false
        }
      }

      if (!shouldHop) return // Skip animation when too far away
    }

    const time = state.clock.elapsedTime
    const mesh = meshRef.current
    const hoppingFoxes = hoppingFoxesRef.current

    // Check if it's time to trigger new hoppers (additive - don't clear existing)
    if (time - lastHopTriggerRef.current >= HOP_INTERVAL) {
      lastHopTriggerRef.current = time

      // Add new random foxes to hop (overlapping with existing hoppers)
      const hopCount = Math.ceil(foxPlacements.length * HOP_PERCENTAGE)
      let added = 0
      let attempts = 0
      while (added < hopCount && attempts < hopCount * 3) {
        attempts++
        const foxIdx = Math.floor(Math.random() * foxPlacements.length)
        if (!hoppingFoxes.has(foxIdx)) {
          hoppingFoxes.set(foxIdx, {
            startTime: time + Math.random() * 0.4, // Random delay 0-0.4s
            phase: Math.random() * Math.PI * 0.5   // Random phase offset
          })
          added++
        }
      }
    }

    // Animate hopping foxes - each with their own timing
    if (hoppingFoxes.size > 0) {
      let needsUpdate = false
      const toRemove: number[] = []

      hoppingFoxes.forEach((hopData, foxIdx) => {
        const { startTime, phase } = hopData
        const foxTime = time - startTime

        if (foxTime < 0) {
          // Not started yet
          return
        }

        const hopProgress = foxTime / HOP_DURATION
        const placement = foxPlacements[foxIdx]
        const baseY = basePositionsRef.current[foxIdx]

        if (!placement || baseY === undefined) {
          toRemove.push(foxIdx)
          return
        }

        if (hopProgress <= 1) {
          // Double bounce with phase offset for chaos
          const bouncePhase = hopProgress * Math.PI * 2 + phase
          const hopOffset = Math.abs(Math.sin(bouncePhase)) * HOP_HEIGHT * (1 - hopProgress * 0.4)

          tempPosition.set(placement.position[0], baseY + hopOffset, placement.position[2])
          tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.rotation)
          tempScale.set(placement.scale * 2.4, placement.scale * 2.4, 1)

          tempMatrix.compose(tempPosition, tempQuaternion, tempScale)
          mesh.setMatrixAt(foxIdx, tempMatrix)
          needsUpdate = true
        } else {
          // Reset this fox to base position and mark for removal
          tempPosition.set(placement.position[0], baseY, placement.position[2])
          tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.rotation)
          tempScale.set(placement.scale * 2.4, placement.scale * 2.4, 1)

          tempMatrix.compose(tempPosition, tempQuaternion, tempScale)
          mesh.setMatrixAt(foxIdx, tempMatrix)
          needsUpdate = true
          toRemove.push(foxIdx)
        }
      })

      // Remove finished hoppers
      toRemove.forEach(idx => hoppingFoxes.delete(idx))

      if (needsUpdate) {
        mesh.instanceMatrix.needsUpdate = true
      }
    }
  })

  // Note: Stadium foxes face the track (set via rotation in placement), not the camera
  // This is more performant and appropriate for static stadium seating

  // Memoize shader material to prevent recreation on every render (which would reset the mesh)
  // Includes fog support so foxes blend with environment like other stadium elements
  const shaderMaterial = useMemo(() => {
    if (!textureAtlas) return null

    return new THREE.ShaderMaterial({
      uniforms: {
        ...THREE.UniformsLib.fog,
        map: { value: textureAtlas }
      },
      vertexShader: `
        attribute vec2 uvOffset;
        attribute vec2 uvScale;
        varying vec2 vUv;
        varying float vFogDepth;

        void main() {
          // Transform UV based on instance's atlas position
          vUv = uvOffset + uv * uvScale;

          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          // Pass fog depth to fragment shader
          vFogDepth = -mvPosition.z;
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        uniform vec3 fogColor;
        uniform float fogNear;
        uniform float fogFar;
        varying vec2 vUv;
        varying float vFogDepth;

        void main() {
          vec4 texColor = texture2D(map, vUv);
          if (texColor.a < 0.1) discard;

          // Apply fog
          float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
          vec3 finalColor = mix(texColor.rgb, fogColor, fogFactor);

          gl_FragColor = vec4(finalColor, texColor.a);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      fog: true
    })
  }, [textureAtlas])

  if (!textureAtlas || foxPlacements.length === 0 || !material || !shaderMaterial) {
    return null
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, shaderMaterial, foxPlacements.length]}
      frustumCulled={false}
    />
  )
})

/**
 * Generate a texture atlas from fox voxel data
 */
export function generateFoxTextureAtlas(
  foxVoxels: { voxels: VoxelTuple[] }[],
  foxSize: number = 24
): { texture: THREE.CanvasTexture; cols: number; rows: number } {
  const foxCount = foxVoxels.length
  const cols = Math.ceil(Math.sqrt(foxCount))
  const rows = Math.ceil(foxCount / cols)

  const atlasWidth = cols * foxSize
  const atlasHeight = rows * foxSize

  const canvas = document.createElement('canvas')
  canvas.width = atlasWidth
  canvas.height = atlasHeight
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, atlasWidth, atlasHeight)

  let totalPixelsDrawn = 0

  foxVoxels.forEach((fox, foxIndex) => {
    const col = foxIndex % cols
    const row = Math.floor(foxIndex / cols)
    const offsetX = col * foxSize
    const offsetY = row * foxSize

    fox.voxels.forEach(voxel => {
      const [x, y, z, r, g, b] = voxel

      // Only render front face (z = 0.1)
      if (z <= 0) return

      // Map voxel coords to pixel coords
      const px = Math.round((x + 1.2) / 0.1)
      const py = Math.round((2.3 - y) / 0.1)

      if (px >= 0 && px < foxSize && py >= 0 && py < foxSize) {
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
        ctx.fillRect(offsetX + px, offsetY + py, 1, 1)
        totalPixelsDrawn++
      }
    })
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false

  return { texture, cols, rows }
}
