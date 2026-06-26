import React, { memo, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelFox } from '../VoxelFox'
import type { RemotePlayerLodTier } from '../../racing/multiplayer/remotePlayerLod'
import type { TerrainHeightSampler } from '../../racing/core/roadCorridor'
import { getCarForwardVector } from '../../racing/vehicles/carHandling'
import { getVehicleVisualTilt, smoothVehicleVisualTilt } from '../../racing/vehicles/vehicleElevation'
import { applyVehicleVisualSurfaceFrameRotation, createVehicleVisualSurfaceFrameScratch } from '../../racing/vehicles/vehicleVisualSurfaceFrame'
import { CarHeadlightBeam } from '../../racing/components/CarHeadlightBeam'

interface OtherPlayerCarProps {
  id: string
  position: [number, number, number]
  rotation: [number, number, number]
  carColor: string
  foxTextureUrl?: string
  chatMessage?: string
  chatTimestamp?: number
  headlightsEnabled?: boolean
  lodTier?: RemotePlayerLodTier
  getHeightAtPosition?: TerrainHeightSampler
}

interface RemoteCarVisualProps {
  carColor: string
  foxTextureUrl?: string
  chatMessage?: string
  chatTimestamp?: number
  headlightsEnabled?: boolean
  lodTier: RemotePlayerLodTier
}

interface FullRemoteCarModelProps {
  carColor: string
  foxTextureUrl?: string
  chatMessage?: string
  chatTimestamp?: number
  headlightsEnabled?: boolean
}

const LERP_FACTOR = 0.12
const CAR_MODEL_TERRAIN_PITCH_SCALE = 1.75
const CAR_MODEL_TERRAIN_ROLL_SCALE = 2.4

const MID_WHEEL_POSITIONS: Array<[number, number, number]> = [
  [-0.95, 0.28, 1.05],
  [0.95, 0.28, 1.05],
  [-0.95, 0.28, -1.05],
  [0.95, 0.28, -1.05]
]

const RemoteCarHeadlights = memo<{ headlightsEnabled?: boolean }>(function RemoteCarHeadlights({ headlightsEnabled = false }) {
  return (
    <>
      {[-0.55, 0.55].map(x => (
        <mesh key={x} position={[x, 0.55, 1.92]}>
          <boxGeometry args={[0.34, 0.14, 0.08]} />
          <meshStandardMaterial
            color={headlightsEnabled ? '#fffbe0' : '#c9c2a4'}
            emissive={headlightsEnabled ? '#fff4c2' : '#000000'}
            emissiveIntensity={headlightsEnabled ? 1.8 : 0}
          />
        </mesh>
      ))}
      {headlightsEnabled && (
        <>
          {[-0.55, 0.55].map(x => (
            <pointLight
              key={`remote-headlight-glow-${x}`}
              position={[x, 0.55, 2.05]}
              color="#fff4c2"
              intensity={2.2}
              distance={18}
              decay={1.6}
            />
          ))}
        </>
      )}
    </>
  )
})

const MidRemoteCarModel = memo<{ carColor: string; headlightsEnabled?: boolean }>(function MidRemoteCarModel({
  carColor,
  headlightsEnabled
}) {
  return (
    <>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.55, 3.2]} />
        <meshStandardMaterial color={carColor} metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.88, -0.2]} castShadow>
        <boxGeometry args={[1.35, 0.45, 1.25]} />
        <meshStandardMaterial color={carColor} metalness={0.45} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.1, -1.45]} castShadow>
        <boxGeometry args={[2.1, 0.08, 0.42]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {MID_WHEEL_POSITIONS.map((wheelPosition, index) => (
        <mesh key={index} position={wheelPosition} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.34, 0.34, 0.32, 8]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      <RemoteCarHeadlights headlightsEnabled={headlightsEnabled} />
    </>
  )
})

const Wheel = memo<{
  position: [number, number, number]
  radius: number
  width: number
  hubOffset: number
  hubRadius: number
}>(function Wheel({ position, radius, width, hubOffset, hubRadius }) {
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[radius, radius, width, 16]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[hubOffset, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[hubRadius, hubRadius, 0.05, 16]} />
        <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  )
})

const FullRemoteCarModel = memo<FullRemoteCarModelProps>(function FullRemoteCarModel({
  carColor,
  foxTextureUrl,
  chatMessage,
  chatTimestamp,
  headlightsEnabled
}) {
  return (
    <>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.1, 3.8]} />
        <meshStandardMaterial color={carColor} metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[-0.9, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.4, 2.0]} />
        <meshStandardMaterial color={carColor} metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[0.9, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.4, 2.0]} />
        <meshStandardMaterial color={carColor} metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[0, 0.55, 1.4]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.7, 1.0]} />
        <meshStandardMaterial color={carColor} metalness={0.8} roughness={0.2} />
      </mesh>

      <RemoteCarHeadlights headlightsEnabled={headlightsEnabled} />

      <mesh position={[0, 0.55, -1.4]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.7, 1.0]} />
        <meshStandardMaterial color={carColor} metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[0, 1.4, -1.6]} castShadow>
        <boxGeometry args={[2.4, 0.1, 0.6]} />
        <meshStandardMaterial color={carColor} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-0.8, 0.9, -1.6]} castShadow>
        <boxGeometry args={[0.1, 0.8, 0.3]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.8, 0.9, -1.6]} castShadow>
        <boxGeometry args={[0.1, 0.8, 0.3]} />
        <meshStandardMaterial color="#111" />
      </mesh>

      <Wheel position={[-1.1, 0.3, 1.2]} radius={0.4} width={0.4} hubOffset={-0.21} hubRadius={0.15} />
      <Wheel position={[1.1, 0.3, 1.2]} radius={0.4} width={0.4} hubOffset={0.21} hubRadius={0.15} />
      <Wheel position={[-1.1, 0.3, -1.2]} radius={0.45} width={0.5} hubOffset={-0.26} hubRadius={0.18} />
      <Wheel position={[1.1, 0.3, -1.2]} radius={0.45} width={0.5} hubOffset={0.26} hubRadius={0.18} />

      <mesh position={[0, 1.0, 1.4]} rotation={[-0.4, 0, 0]}>
        <boxGeometry args={[1.8, 0.6, 0.1]} />
        <meshPhysicalMaterial
          color="#aaf"
          transmission={0.5}
          opacity={0.5}
          transparent
          roughness={0}
        />
      </mesh>

      <group position={[0, 0.5, 0.2]} scale={1.0}>
        <VoxelFox
          position={[0, 0, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          foxTextureUrl={foxTextureUrl}
          color={carColor}
          message={chatMessage}
          messageTime={chatTimestamp}
        />
      </group>
    </>
  )
})

const RemoteCarVisual = memo<RemoteCarVisualProps>(function RemoteCarVisual({
  carColor,
  foxTextureUrl,
  chatMessage,
  chatTimestamp,
  headlightsEnabled,
  lodTier
}) {
  return lodTier === 'mid'
    ? <MidRemoteCarModel carColor={carColor} headlightsEnabled={headlightsEnabled} />
    : (
      <FullRemoteCarModel
        carColor={carColor}
        foxTextureUrl={foxTextureUrl}
        chatMessage={chatMessage}
        chatTimestamp={chatTimestamp}
        headlightsEnabled={headlightsEnabled}
      />
    )
})

export const OtherPlayerCar: React.FC<OtherPlayerCarProps> = ({
  position,
  rotation,
  carColor,
  foxTextureUrl,
  chatMessage,
  chatTimestamp,
  headlightsEnabled,
  lodTier = 'near',
  getHeightAtPosition
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const rotationGroupRef = useRef<THREE.Group>(null)
  const visualTiltGroupRef = useRef<THREE.Group>(null)

  const currentPos = useRef(new THREE.Vector3(position[0], position[1], position[2]))
  const currentRotY = useRef(rotation[1])
  const currentVisualPitch = useRef(rotation[0])
  const currentVisualRoll = useRef(rotation[2])
  const visualSurfaceFrameScratch = useRef(createVehicleVisualSurfaceFrameScratch())

  const targetPos = useRef(new THREE.Vector3(position[0], position[1], position[2]))
  const targetRotY = useRef(rotation[1])

  useEffect(() => {
    targetPos.current.set(position[0], position[1], position[2])
    targetRotY.current = rotation[1]
  }, [position, rotation])

  useEffect(() => {
    currentPos.current.set(position[0], position[1], position[2])
    currentRotY.current = rotation[1]
    if (groupRef.current) {
      groupRef.current.position.copy(currentPos.current)
    }
    if (rotationGroupRef.current) {
      rotationGroupRef.current.rotation.set(0, currentRotY.current, 0)
    }
    if (visualTiltGroupRef.current) {
      visualTiltGroupRef.current.rotation.set(currentVisualPitch.current, 0, currentVisualRoll.current)
    }
  }, [])

  useFrame((_, delta) => {
    if (!groupRef.current || !rotationGroupRef.current || !visualTiltGroupRef.current) return

    currentPos.current.lerp(targetPos.current, LERP_FACTOR)
    groupRef.current.position.copy(currentPos.current)

    let rotDiff = targetRotY.current - currentRotY.current
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
    currentRotY.current += rotDiff * LERP_FACTOR
    rotationGroupRef.current.rotation.set(0, currentRotY.current, 0)

    const currentForward = getCarForwardVector(currentRotY.current)
    const targetVisualTilt = getHeightAtPosition
      ? getVehicleVisualTilt({
          x: currentPos.current.x,
          z: currentPos.current.z,
          currentY: currentPos.current.y,
          forward: currentForward,
          right: {
            x: -currentForward.z,
            z: currentForward.x
          },
          getHeightAtPosition
        })
      : {
          pitch: rotation[0],
          roll: rotation[2]
        }
    const smoothedTilt = smoothVehicleVisualTilt({
      currentPitch: currentVisualPitch.current,
      currentRoll: currentVisualRoll.current,
      targetPitch: targetVisualTilt.pitch,
      targetRoll: targetVisualTilt.roll,
      deltaSeconds: delta
    })
    currentVisualPitch.current = smoothedTilt.pitch
    currentVisualRoll.current = smoothedTilt.roll
    applyVehicleVisualSurfaceFrameRotation({
      group: visualTiltGroupRef.current,
      tilt: smoothedTilt,
      pitchScale: CAR_MODEL_TERRAIN_PITCH_SCALE,
      rollScale: CAR_MODEL_TERRAIN_ROLL_SCALE,
      scratch: visualSurfaceFrameScratch.current
    })
  })

  return (
    <group ref={groupRef}>
      <group ref={rotationGroupRef}>
        {headlightsEnabled && [-0.55, 0.55].map(x => (
          <CarHeadlightBeam key={`stable-remote-headlight-beam-${x}`} x={x} localForward={-1} />
        ))}
        <group ref={visualTiltGroupRef}>
          <group rotation={[0, Math.PI, 0]}>
            <RemoteCarVisual
              carColor={carColor}
              foxTextureUrl={foxTextureUrl}
              chatMessage={chatMessage}
              chatTimestamp={chatTimestamp}
              headlightsEnabled={headlightsEnabled}
              lodTier={lodTier}
            />
          </group>
        </group>
      </group>
    </group>
  )
}
