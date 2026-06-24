/**
 * Pure state machine for the "drove into lava" death sequence: the car/fox glow
 * red-hot for a couple of seconds, then explode, then the game-over screen shows.
 * Kept out of the render loop so the timing is testable.
 *
 *   alive ──overLava──▶ burning ──(LAVA_BURN_SECONDS)──▶ exploding
 *                                ──(LAVA_EXPLODE_SECONDS)──▶ dead (fires game over)
 */
import * as THREE from 'three'

export type LavaDeathPhase = 'alive' | 'burning' | 'exploding' | 'dead'

export interface LavaDeathState {
  phase: LavaDeathPhase
  /** clock time (seconds) the current phase started. */
  phaseStartSeconds: number
}

export const createLavaDeathState = (): LavaDeathState => ({
  phase: 'alive',
  phaseStartSeconds: 0
})

export const resetLavaDeathState = (state: LavaDeathState): void => {
  state.phase = 'alive'
  state.phaseStartSeconds = 0
}

// Glow red-hot this long before blowing up, then the fireball plays this long
// before the game-over screen takes over.
export const LAVA_BURN_SECONDS = 2.6
export const LAVA_EXPLODE_SECONDS = 1.1

export interface LavaDeathFrame {
  phase: LavaDeathPhase
  /** 0..1 red-hot ramp during burning, held at 1 once exploding/dead. */
  heat: number
  /** 0..1 fireball progress (0 until exploding). */
  explosion: number
  /** True on the single frame the sequence completes — caller fires game over. */
  justFinished: boolean
}

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value)

export const advanceLavaDeath = ({
  state,
  overLava,
  nowSeconds
}: {
  state: LavaDeathState
  /** Car is currently touching lava and eligible to start burning. */
  overLava: boolean
  nowSeconds: number
}): LavaDeathFrame => {
  if (state.phase === 'alive') {
    if (!overLava) return { phase: 'alive', heat: 0, explosion: 0, justFinished: false }
    state.phase = 'burning'
    state.phaseStartSeconds = nowSeconds
  }

  if (state.phase === 'burning') {
    const t = (nowSeconds - state.phaseStartSeconds) / LAVA_BURN_SECONDS
    if (t < 1) return { phase: 'burning', heat: clamp01(t), explosion: 0, justFinished: false }
    state.phase = 'exploding'
    state.phaseStartSeconds = nowSeconds
  }

  if (state.phase === 'exploding') {
    const t = (nowSeconds - state.phaseStartSeconds) / LAVA_EXPLODE_SECONDS
    if (t < 1) return { phase: 'exploding', heat: 1, explosion: clamp01(t), justFinished: false }
    state.phase = 'dead'
    return { phase: 'dead', heat: 1, explosion: 1, justFinished: true }
  }

  return { phase: 'dead', heat: 1, explosion: 1, justFinished: false }
}

const HEAT_LOW = new THREE.Color('#ff2200') // dull red as it starts to glow
const HEAT_HIGH = new THREE.Color('#ffd055') // white-hot just before it blows
const scratchColor = new THREE.Color()

const applyHeatToMaterial = (material: THREE.Material, heat: number): void => {
  const standard = material as THREE.MeshStandardMaterial
  if (!standard.emissive) return
  scratchColor.copy(HEAT_LOW).lerp(HEAT_HIGH, clamp01((heat - 0.5) * 2))
  standard.emissive.copy(scratchColor)
  standard.emissiveIntensity = heat * 2.4
}

/**
 * Drives the vehicle group's emissive toward red/white-hot as `heat` rises 0→1.
 * `heat` 0 fully clears the glow, so this also resets the look on restart.
 */
export const applyVehicleHeatTint = (group: THREE.Object3D | null, heat: number): void => {
  if (!group) return
  group.traverse(object => {
    const material = (object as THREE.Mesh).material
    if (!material) return
    if (Array.isArray(material)) material.forEach(entry => applyHeatToMaterial(entry, heat))
    else applyHeatToMaterial(material, heat)
  })
}
