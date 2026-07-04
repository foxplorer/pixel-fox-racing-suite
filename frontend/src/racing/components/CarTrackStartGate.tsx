import React from 'react'
import * as THREE from 'three'
import { StartLight } from './StartLight'
import { StartGateMarquee } from './StartGateMarquee'
import { getStartLineRotationZ } from './startGatePresentation'
import type { StartGateMarqueeModel } from './startGateMarquee'
import type { RacingQualityPresetId } from '../performance/qualitySettings'

type CarTrackStartGateStatus = 'idle' | 'showroom' | 'loading' | 'countdown' | 'racing' | 'crashed' | 'finished'

export interface CarTrackStartGateLayoutOptions {
  yPosition?: number
  stripYOffset?: number
  stripColumns?: number
  stripRows?: number
  archTopWidth?: number
  archTopPosition?: [number, number, number]
  alignArchTopToTrack?: boolean
}

interface CarTrackStartGateProps extends CarTrackStartGateLayoutOptions {
  gameStatus: CarTrackStartGateStatus
  countdown: number
  startFinishPosition: THREE.Vector3
  startFinishDirection: THREE.Vector3
  startingGatePoles: [THREE.Vector3, THREE.Vector3] | THREE.Vector3[]
  marqueeModel?: StartGateMarqueeModel | null
  qualityPresetId?: RacingQualityPresetId
}

const HEADER_RAIL_DEPTH = 1.2
const MARQUEE_HEIGHT = 2

export const CarTrackStartGate: React.FC<CarTrackStartGateProps> = ({
  gameStatus,
  countdown,
  startFinishPosition,
  startFinishDirection,
  startingGatePoles,
  marqueeModel = null,
  qualityPresetId,
  yPosition = 0.01,
  stripYOffset = 0.17,
  stripColumns = 18,
  stripRows = 4,
  archTopWidth = 22,
  archTopPosition,
  alignArchTopToTrack = true
}) => {
  if (
    gameStatus !== 'loading' &&
    gameStatus !== 'countdown' &&
    gameStatus !== 'racing' &&
    gameStatus !== 'crashed' &&
    gameStatus !== 'finished'
  ) {
    return null
  }

  const [leftPole, rightPole] = startingGatePoles
  const lineRotationZ = getStartLineRotationZ(startFinishDirection)
  const archRotationY = alignArchTopToTrack ? lineRotationZ : 0
  const defaultArchTopPosition: [number, number, number] = [
    ((leftPole.x + rightPole.x) / 2) - startFinishPosition.x,
    8,
    ((leftPole.z + rightPole.z) / 2) - startFinishPosition.z
  ]
  const columnOffsetY = 4
  const marqueeWidth = archTopWidth * 0.66
  const lightOffsetX = marqueeWidth / 2 + 0.25 + 1.1
  const lightsVisible = gameStatus === 'countdown' || gameStatus === 'racing'

  const renderPylon = (pole: THREE.Vector3, key: string) => (
    <group
      key={key}
      position={[pole.x - startFinishPosition.x, 0, pole.z - startFinishPosition.z]}
      rotation={[0, archRotationY, 0]}
    >
      <mesh position={[0, columnOffsetY, 0]} castShadow>
        <boxGeometry args={[1.3, 8, 1.3]} />
        <meshStandardMaterial color="#2b2b2b" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[2.2, 0.5, 2.2]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, 5.6, 0]}>
        <boxGeometry args={[1.36, 0.5, 1.36]} />
        <meshStandardMaterial color="#8f1006" emissive="#5a0a03" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )

  return (
    <group position={[startFinishPosition.x, startFinishPosition.y + yPosition, startFinishPosition.z]}>
      <group rotation={[-Math.PI / 2, 0, lineRotationZ]} position={[0, stripYOffset, 0]}>
        {Array.from({ length: stripColumns }).map((_, i) =>
          Array.from({ length: stripRows }).map((_, j) => {
            const x = (i - stripColumns / 2) * 1.0 + 0.5
            const y = (j - (stripRows - 1) / 2) * 1.0
            const isBlack = (i + j) % 2 === 0
            return (
              <mesh key={`${i}-${j}`} position={[x, y, 0]} receiveShadow>
                <planeGeometry args={[1, 1]} />
                <meshStandardMaterial color={isBlack ? '#000000' : '#FFFFFF'} />
              </mesh>
            )
          })
        )}
      </group>

      {renderPylon(leftPole, 'left-pylon')}
      {renderPylon(rightPole, 'right-pylon')}

      <group
        position={archTopPosition ?? defaultArchTopPosition}
        rotation={[0, archRotationY, 0]}
      >
        <mesh position={[0, 1.55, 0]} castShadow>
          <boxGeometry args={[archTopWidth, 0.6, HEADER_RAIL_DEPTH]} />
          <meshStandardMaterial color="#1c1c1c" roughness={0.6} metalness={0.35} />
        </mesh>
        <mesh position={[0, -1.5, 0]} castShadow>
          <boxGeometry args={[archTopWidth, 0.45, HEADER_RAIL_DEPTH]} />
          <meshStandardMaterial color="#1c1c1c" roughness={0.6} metalness={0.35} />
        </mesh>

        <StartGateMarquee
          model={marqueeModel}
          width={marqueeWidth}
          height={MARQUEE_HEIGHT}
          qualityPresetId={qualityPresetId}
        />

        <StartLight
          countdown={countdown}
          visible={lightsVisible}
          gameStatus={gameStatus}
          position={[-lightOffsetX, 0, 0]}
        />
        <StartLight
          countdown={countdown}
          visible={lightsVisible}
          gameStatus={gameStatus}
          position={[lightOffsetX, 0, 0]}
        />
      </group>
    </group>
  )
}
