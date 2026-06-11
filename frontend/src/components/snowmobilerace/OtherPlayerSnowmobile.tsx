import React, { useRef, useEffect, useMemo, memo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelFox } from '../VoxelFox'
import { getOrdinalContentUrl } from '../../racing/transactions/ordinalLinks'
import snowmobileGasSound from '../../assets/snowmobile_on_gas.mp3'

// ========== SHARED AUDIO CONTEXT ==========
// Single AudioContext shared by all other players (avoids context leak)
let sharedAudioContext: AudioContext | null = null
let sharedAudioBuffer: AudioBuffer | null = null
let audioLoadPromise: Promise<void> | null = null

const getSharedAudioContext = (): AudioContext => {
  if (!sharedAudioContext) {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return sharedAudioContext
}

const loadSharedAudioBuffer = async (): Promise<AudioBuffer | null> => {
  if (!snowmobileGasSound) return null
  if (sharedAudioBuffer) return sharedAudioBuffer

  if (!audioLoadPromise) {
    audioLoadPromise = (async () => {
      try {
        const ctx = getSharedAudioContext()
        const response = await fetch(snowmobileGasSound)
        const arrayBuffer = await response.arrayBuffer()
        sharedAudioBuffer = await ctx.decodeAudioData(arrayBuffer)
      } catch (err) {
        console.error('Failed to load shared audio:', err)
      }
    })()
  }

  await audioLoadPromise
  return sharedAudioBuffer
}

// Snow spray effect for other players - reduced particle count for performance
const OtherPlayerSnowSpray: React.FC<{
  speed: number
  sledPosition: THREE.Vector3
  sledRotation: number
}> = ({ speed, sledPosition, sledRotation }) => {
  const particlesRef = useRef<THREE.Points>(null)
  const particleCount = 200 // Reduced for performance - use varying sizes for visual density
  const velocitiesRef = useRef<Float32Array>(new Float32Array(particleCount * 3))
  const lifetimesRef = useRef<Float32Array>(new Float32Array(particleCount))
  const sizesRef = useRef<Float32Array>(new Float32Array(particleCount))

  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = 0
      pos[i * 3 + 1] = -10
      pos[i * 3 + 2] = 0
      lifetimesRef.current[i] = 0
      sizesRef.current[i] = 1.0
    }
    return pos
  }, [])

  // Disable frustum culling
  useEffect(() => {
    if (particlesRef.current) {
      particlesRef.current.frustumCulled = false
    }
  }, [])

  // Transform local to world space
  const localToWorld = (localX: number, localY: number, localZ: number) => {
    const cos = Math.cos(sledRotation)
    const sin = Math.sin(sledRotation)
    return {
      x: sledPosition.x + localX * cos + localZ * sin,
      y: sledPosition.y + localY,
      z: sledPosition.z - localX * sin + localZ * cos
    }
  }

  const localVelToWorld = (localVx: number, localVy: number, localVz: number) => {
    const cos = Math.cos(sledRotation)
    const sin = Math.sin(sledRotation)
    return {
      x: localVx * cos + localVz * sin,
      y: localVy,
      z: -localVx * sin + localVz * cos
    }
  }

  useFrame((state, delta) => {
    if (!particlesRef.current) return

    const posArray = particlesRef.current.geometry.attributes.position.array as Float32Array
    const velocities = velocitiesRef.current
    const lifetimes = lifetimesRef.current

    // Get current sled position for distance checks
    const sledX = sledPosition.x
    const sledY = sledPosition.y
    const sledZ = sledPosition.z

    const sprayIntensity = Math.min(speed / 20, 1.5)

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3

      if (lifetimes[i] <= 0) {
        // Spawn new particles based on speed - higher chance
        const spawnChance = 0.5 + sprayIntensity * 0.4

        if (Math.random() < spawnChance && speed > 1) {
          let localX = 0, localY = 0, localZ = 0
          let localVx = 0, localVy = 0, localVz = 0

          const rand = Math.random()

          // Track rooster tail (main spray from back)
          if (rand < 0.6) {
            localX = (Math.random() - 0.5) * 1.8
            localY = 0.8 + Math.random() * 1.2 // Higher spawn
            localZ = 2.5 + Math.random() * 3

            const trackForce = sprayIntensity * 1.3
            localVx = (Math.random() - 0.5) * 15 * trackForce
            localVy = (12 + Math.random() * 18) * trackForce // More upward
            localVz = (12 + Math.random() * 18) * trackForce
          }
          // Side spray from skis
          else if (rand < 0.85) {
            const isLeft = Math.random() < 0.5
            localX = isLeft ? (-0.9 - Math.random() * 0.4) : (0.9 + Math.random() * 0.4)
            localY = 0.8 + Math.random() * 1.0 // Higher spawn
            localZ = -0.5 + Math.random() * 2.5

            const skiForce = sprayIntensity
            const dir = isLeft ? -1 : 1
            localVx = dir * (8 + Math.random() * 12) * skiForce
            localVy = (8 + Math.random() * 12) * skiForce // More upward
            localVz = (Math.random() - 0.3) * 6 * skiForce
          }
          // Front plow
          else {
            localX = (Math.random() - 0.5) * 2.5
            localY = 1.0 + Math.random() * 1.0 // Higher spawn
            localZ = -3.5 - Math.random() * 1

            const frontForce = sprayIntensity * 0.9
            localVx = (Math.random() - 0.5) * 10 * frontForce
            localVy = (12 + Math.random() * 15) * frontForce // More upward
            localVz = (5 + Math.random() * 10) * frontForce
          }

          // Transform to world space
          const worldPos = localToWorld(localX, localY, localZ)
          const worldVel = localVelToWorld(localVx, localVy, localVz)

          posArray[idx] = worldPos.x
          posArray[idx + 1] = worldPos.y
          posArray[idx + 2] = worldPos.z

          velocities[idx] = worldVel.x
          velocities[idx + 1] = worldVel.y
          velocities[idx + 2] = worldVel.z

          // Assign varying sizes - mostly small with some medium
          const sizeRand = Math.random()
          if (sizeRand < 0.5) {
            sizesRef.current[i] = 0.3 + Math.random() * 0.3 // Small: 0.3-0.6
          } else if (sizeRand < 0.85) {
            sizesRef.current[i] = 0.5 + Math.random() * 0.4 // Medium: 0.5-0.9
          } else {
            sizesRef.current[i] = 0.8 + Math.random() * 0.5 // Large: 0.8-1.3
          }

          lifetimes[i] = 0.8 + Math.random() * 1.2 // Longer lasting
        }
      } else {
        // Update particle physics
        posArray[idx] += velocities[idx] * delta
        posArray[idx + 1] += velocities[idx + 1] * delta
        posArray[idx + 2] += velocities[idx + 2] * delta

        // Gravity
        velocities[idx + 1] -= 5 * delta
        // Air resistance
        velocities[idx] *= 0.97
        velocities[idx + 1] *= 0.97
        velocities[idx + 2] *= 0.97

        lifetimes[i] -= delta

        // RECYCLE particles that are too far from sled (prevents spray halt)
        const dx = posArray[idx] - sledX
        const dy = posArray[idx + 1] - sledY
        const dz = posArray[idx + 2] - sledZ
        const distSq = dx * dx + dy * dy + dz * dz
        const MAX_DIST_SQ = 50 * 50 // 50 units max distance

        if (lifetimes[i] <= 0 || distSq > MAX_DIST_SQ || posArray[idx + 1] < sledY - 10) {
          lifetimes[i] = 0
          posArray[idx + 1] = -10
        }
      }
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true
    // Update size attribute
    if (particlesRef.current.geometry.attributes.size) {
      ;(particlesRef.current.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true
    }
  })

  // Shader material for per-particle sizes - square particles matching local player spray
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color('#ffffff') },
        opacity: { value: 0.9 }
      },
      vertexShader: `
        attribute float size;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float opacity;

        void main() {
          // Square particle - no discard, full coverage
          gl_FragColor = vec4(color, opacity);
        }
      `,
      transparent: true,
      depthWrite: false
    })
  }, [])

  return (
    <points ref={particlesRef} material={shaderMaterial}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={particleCount}
          array={sizesRef.current}
          itemSize={1}
        />
      </bufferGeometry>
    </points>
  )
}

interface OtherPlayerSnowmobileProps {
  id: string
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  color: string
  speed: number
  localPlayerPosition: { x: number; y: number; z: number }
  originOutpoint?: string
  chatMessage?: string
  chatTimestamp?: number
}

// Interpolation factor - higher = more responsive, lower = smoother
const LERP_FACTOR = 0.15

export const OtherPlayerSnowmobile: React.FC<OtherPlayerSnowmobileProps> = memo(({
  id,
  position,
  rotation,
  color,
  speed,
  localPlayerPosition,
  originOutpoint,
  chatMessage,
  chatTimestamp
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const rotationGroupRef = useRef<THREE.Group>(null)

  // Store current displayed position/rotation
  const currentPos = useRef(new THREE.Vector3(position.x, position.y, position.z))
  const currentRotX = useRef(rotation.x)
  const currentRotY = useRef(rotation.y)
  const currentRotZ = useRef(rotation.z)

  // Store target position/rotation from props
  const targetPos = useRef(new THREE.Vector3(position.x, position.y, position.z))
  const targetRotX = useRef(rotation.x)
  const targetRotY = useRef(rotation.y)
  const targetRotZ = useRef(rotation.z)

  // Audio refs for spatial engine sound (uses shared AudioContext)
  const gainNodeRef = useRef<GainNode | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const audioStartedRef = useRef(false)
  const audioReadyRef = useRef(false)

  // Update targets when props change
  useEffect(() => {
    targetPos.current.set(position.x, position.y, position.z)
    targetRotX.current = rotation.x
    targetRotY.current = rotation.y
    targetRotZ.current = rotation.z
  }, [position, rotation])

  // Initialize on first render
  useEffect(() => {
    currentPos.current.set(position.x, position.y, position.z)
    currentRotX.current = rotation.x
    currentRotY.current = rotation.y
    currentRotZ.current = rotation.z
    if (groupRef.current) {
      groupRef.current.position.copy(currentPos.current)
    }
    if (rotationGroupRef.current) {
      rotationGroupRef.current.rotation.set(currentRotX.current, currentRotY.current, currentRotZ.current)
    }
  }, [])

  // Initialize audio using shared context (no leak on disconnect/reconnect)
  useEffect(() => {
    const initAudio = async () => {
      const audioContext = getSharedAudioContext()
      const buffer = await loadSharedAudioBuffer()
      if (!buffer) return

      const gainNode = audioContext.createGain()
      gainNode.gain.value = 0
      gainNode.connect(audioContext.destination)
      gainNodeRef.current = gainNode
      audioReadyRef.current = true
    }

    initAudio()

    return () => {
      // Only cleanup source, NOT the shared context
      if (sourceRef.current) {
        try { sourceRef.current.stop() } catch (e) {}
        sourceRef.current = null
      }
      if (gainNodeRef.current) {
        try { gainNodeRef.current.disconnect() } catch (e) {}
        gainNodeRef.current = null
      }
      audioStartedRef.current = false
      audioReadyRef.current = false
    }
  }, [])

  // Update audio based on speed and distance
  useEffect(() => {
    if (!audioReadyRef.current || !gainNodeRef.current || !sharedAudioBuffer) return

    const audioContext = getSharedAudioContext()
    const gainNode = gainNodeRef.current

    // Calculate distance to local player
    const dx = position.x - localPlayerPosition.x
    const dz = position.z - localPlayerPosition.z
    const distance = Math.sqrt(dx * dx + dz * dz)

    // Distance-based volume (louder when close, quieter when far)
    const MAX_DISTANCE = 150 // Beyond this, no sound
    const MIN_DISTANCE = 5 // Full volume at this distance
    const MAX_VOLUME = 0.4 // Maximum volume for other players

    let distanceVolume = 0
    if (distance < MAX_DISTANCE) {
      distanceVolume = Math.max(0, 1 - (distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE))
      distanceVolume = distanceVolume * distanceVolume // Quadratic falloff
    }

    // Speed-based volume (only play when moving)
    const speedVolume = Math.min(speed / 30, 1)

    // Combined volume
    const targetVolume = distanceVolume * speedVolume * MAX_VOLUME

    // Smoothly adjust gain
    gainNode.gain.value += (targetVolume - gainNode.gain.value) * 0.1

    // Start/stop audio based on whether we should hear it
    const shouldPlay = targetVolume > 0.01

    if (shouldPlay && !audioStartedRef.current) {
      // Resume context if suspended
      if (audioContext.state === 'suspended') {
        audioContext.resume()
      }

      // Start playing
      const source = audioContext.createBufferSource()
      source.buffer = sharedAudioBuffer
      source.loop = true
      source.connect(gainNode)
      source.start(0)
      sourceRef.current = source
      audioStartedRef.current = true
    } else if (!shouldPlay && audioStartedRef.current) {
      // Stop playing
      if (sourceRef.current) {
        try { sourceRef.current.stop() } catch (e) {}
        sourceRef.current = null
      }
      audioStartedRef.current = false
    }
  }, [speed, position, localPlayerPosition])

  // Interpolate every frame
  useFrame(() => {
    if (!groupRef.current || !rotationGroupRef.current) return

    // Lerp position
    currentPos.current.lerp(targetPos.current, LERP_FACTOR)
    groupRef.current.position.copy(currentPos.current)

    // Lerp Y rotation (handle wraparound for angles)
    let rotYDiff = targetRotY.current - currentRotY.current
    while (rotYDiff > Math.PI) rotYDiff -= Math.PI * 2
    while (rotYDiff < -Math.PI) rotYDiff += Math.PI * 2
    currentRotY.current += rotYDiff * LERP_FACTOR

    // Lerp X and Z rotation (tilt and lean)
    currentRotX.current += (targetRotX.current - currentRotX.current) * LERP_FACTOR
    currentRotZ.current += (targetRotZ.current - currentRotZ.current) * LERP_FACTOR

    rotationGroupRef.current.rotation.set(currentRotX.current, currentRotY.current, currentRotZ.current)
  })

  // Calculate distance to local player for spray culling
  // Don't even render spray component when far away (saves particle updates)
  const distanceToLocal = Math.sqrt(
    (position.x - localPlayerPosition.x) ** 2 +
    (position.z - localPlayerPosition.z) ** 2
  )
  const showSpray = distanceToLocal < 100

  return (
    <>
      {/* Snow spray effect - only render when close enough */}
      {showSpray && (
        <OtherPlayerSnowSpray
          speed={speed}
          sledPosition={currentPos.current}
          sledRotation={currentRotY.current}
        />
      )}
      <group ref={groupRef}>
        <group ref={rotationGroupRef}>
          <group rotation={[0, Math.PI, 0]} scale={1.9}>
            {/* Main Body/Chassis */}
            <mesh position={[0, 0.35, 0.3]} castShadow receiveShadow>
            <boxGeometry args={[1.3, 0.3, 3.2]} />
            <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
          </mesh>

          {/* Engine Hood */}
          <mesh position={[0, 0.55, 1.4]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.35, 1.2]} />
            <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
          </mesh>

          {/* Windshield */}
          <mesh position={[0, 1.0, 0.9]} rotation={[-0.4, 0, 0]}>
            <boxGeometry args={[1.1, 0.7, 0.08]} />
            <meshPhysicalMaterial
              color="#88ccff"
              transmission={0.6}
              opacity={0.5}
              transparent
              roughness={0}
            />
          </mesh>

          {/* Handlebars */}
          <mesh position={[0, 0.95, 0.5]}>
            <boxGeometry args={[1.5, 0.1, 0.1]} />
            <meshStandardMaterial color="#222" metalness={0.9} roughness={0.2} />
          </mesh>

          {/* Seat */}
          <mesh position={[0, 0.65, -0.3]} castShadow>
            <boxGeometry args={[0.9, 0.25, 1.6]} />
            <meshStandardMaterial color="#111" roughness={0.9} />
          </mesh>

          {/* Front Skis */}
          <group position={[-0.55, 0.1, 1.5]}>
            <mesh castShadow>
              <boxGeometry args={[0.2, 0.06, 1.8]} />
              <meshStandardMaterial color="#333" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
          <group position={[0.55, 0.1, 1.5]}>
            <mesh castShadow>
              <boxGeometry args={[0.2, 0.06, 1.8]} />
              <meshStandardMaterial color="#333" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>

          {/* Track */}
          <group position={[0, 0.25, -1.2]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.5, 0.55, 3.2]} />
              <meshStandardMaterial color="#0a0a0a" roughness={1} />
            </mesh>
            <mesh position={[0, 0.35, 0]} castShadow>
              <boxGeometry args={[0.7, 0.15, 3.0]} />
              <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
            </mesh>
          </group>

          {/* Headlight */}
          <group position={[0, 0.65, 2.0]}>
            {/* Headlight housing */}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.05]}>
              <cylinderGeometry args={[0.32, 0.32, 0.15, 16]} />
              <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Headlight lens - glowing */}
            <mesh position={[0, 0, 0.03]}>
              <circleGeometry args={[0.28, 16]} />
              <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={2.5} />
            </mesh>
            {/* Point light for illumination */}
            <pointLight
              position={[0, 0, 0.5]}
              intensity={15}
              color="#ffffee"
              distance={30}
              decay={2}
            />
          </group>

          {/* Tail light */}
          <mesh position={[0, 0.75, -2.7]}>
            <boxGeometry args={[0.6, 0.12, 0.05]} />
            <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={0.4} />
          </mesh>

          {/* VoxelFox Driver */}
          <group position={[0, 0.85, 0]} scale={1.0}>
            <VoxelFox
              position={[0, 0, 0]}
              rotation={[0, -Math.PI / 2, 0]}
              foxTextureUrl={getOrdinalContentUrl(originOutpoint) || undefined}
              color={color}
              message={chatMessage}
              messageTime={chatTimestamp}
            />
          </group>
        </group>
      </group>
    </group>
    </>
  )
})
