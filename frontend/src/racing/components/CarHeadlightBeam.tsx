import React, { useMemo } from 'react'
import * as THREE from 'three'

// Single source of truth for the car headlight beam shape. Every car that mounts
// headlights (local simple/detailed models and remote players) renders this with the
// same tuning, so the beam is adjusted in ONE place instead of three drifting copies.
//
// Tuning notes (the single knob board for headlight reach/brightness):
//  - The emitter is mounted HIGH (well above the real lamp). A low mount hits the road
//    far ahead at a razor angle, so the road's normal·light is tiny and the dark asphalt
//    reflects almost nothing; a higher mount steepens that angle, lights the road
//    brighter, and clears hill crests so an uphill road still catches the beam.
//  - The aim is far ahead but pulled further downward than a visual-only beam. That
//    makes the cone meet the road near the bumper, overlapping the lamp glow instead of
//    leaving a dark gap before the main throw starts.
//  - The cone is broad enough to cover road width through curves and over slopes, and
//    intensity/decay are pushed so the beam still registers on dark asphalt.
const DEFAULT_LIGHT_HEIGHT = 0.95
const DEFAULT_LIGHT_FORWARD = 2.85
const DEFAULT_TARGET_DROP = -14
const DEFAULT_TARGET_FORWARD = 58
const DEFAULT_INTENSITY = 58
const DEFAULT_DISTANCE = 160
const DEFAULT_ANGLE = 0.5
const DEFAULT_PENUMBRA = 0.65
const DEFAULT_DECAY = 0.55

interface CarHeadlightBeamProps {
  x: number
  /**
   * Local forward direction for the beam. Car model meshes are flipped 180 degrees
   * inside the vehicle root, so stable root-mounted beams use -1.
   */
  localForward?: 1 | -1
  /** Override the emitter position; defaults to [x, 0.95, 2.85] (just above the lamp). */
  lightPosition?: [number, number, number]
  /** Override the aim point; defaults to [x, -14, 58] (ahead and down). */
  targetPosition?: [number, number, number]
  intensity?: number
  distance?: number
  angle?: number
  penumbra?: number
  decay?: number
}

export const CarHeadlightBeam: React.FC<CarHeadlightBeamProps> = ({
  x,
  localForward = 1,
  lightPosition = [x, DEFAULT_LIGHT_HEIGHT, DEFAULT_LIGHT_FORWARD * localForward],
  targetPosition = [x, DEFAULT_TARGET_DROP, DEFAULT_TARGET_FORWARD * localForward],
  intensity = DEFAULT_INTENSITY,
  distance = DEFAULT_DISTANCE,
  angle = DEFAULT_ANGLE,
  penumbra = DEFAULT_PENUMBRA,
  decay = DEFAULT_DECAY
}) => {
  const target = useMemo(() => new THREE.Object3D(), [])

  return (
    <>
      <primitive object={target} position={targetPosition} />
      <spotLight
        key={`headlight-beam-${x}`}
        position={lightPosition}
        target={target}
        color="#fff2b8"
        intensity={intensity}
        distance={distance}
        angle={angle}
        penumbra={penumbra}
        decay={decay}
        castShadow={false}
      />
    </>
  )
}
