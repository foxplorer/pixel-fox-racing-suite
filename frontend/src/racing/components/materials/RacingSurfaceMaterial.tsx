import React, { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { RacingQualityPresetId } from '../../performance/qualitySettings'
import { createRacingSurfaceTextures } from './proceduralSurfaceTextures'
import type { RacingSurfaceId } from './proceduralSurfaceConfig'

// Single source of truth for painting a procedural surface onto any mesh. Both the
// shared road ribbon (Track) and every grass ground — the sampled terrain mesh plus
// the flat ground planes on Belgium and San Luis — render this instead of hand-rolling
// their own meshStandardMaterial, so the asphalt/grass look and its quality scaling
// live in exactly one place. `surface: 'none'` (or a non-DOM environment) falls back to
// a flat tinted material, which is how non-grass terrain such as volcanic rock opts out.

interface RacingSurfaceMaterialProps {
  surface: RacingSurfaceId | 'none'
  qualityPresetId?: RacingQualityPresetId
  /**
   * Texture repeat. A single number tiles both axes equally (square ground plane);
   * pass x/y separately for a road ribbon whose UV axes span different world spans.
   */
  repeat: number | { x: number; y: number }
  /** Fallback/flat colour used when the surface is untextured ('none' or SSR). */
  color?: string
  /** Roughness for the fallback material (textured surfaces use their own budget). */
  roughness?: number
  /** Metalness for the fallback material (textured surfaces use their own budget). */
  metalness?: number
  roughnessOverride?: number
  metalnessOverride?: number
  colorOverride?: string
  side?: THREE.Side
}

export const RacingSurfaceMaterial: React.FC<RacingSurfaceMaterialProps> = ({
  surface,
  qualityPresetId = 'medium',
  repeat,
  color = '#4a8c59',
  roughness = 0.86,
  metalness = 0.05,
  roughnessOverride,
  metalnessOverride,
  colorOverride,
  side = THREE.DoubleSide
}) => {
  // Depend on the numeric repeat components, not the `repeat` object's identity, so a
  // caller passing a fresh { x, y } literal each render doesn't rebuild the textures.
  const repeatX = typeof repeat === 'number' ? repeat : repeat.x
  const repeatY = typeof repeat === 'number' ? repeat : repeat.y
  const textures = useMemo(() => {
    if (surface === 'none') return null
    return createRacingSurfaceTextures({ surface, qualityPresetId, repeat: { x: repeatX, y: repeatY } })
  }, [surface, qualityPresetId, repeatX, repeatY])

  useEffect(() => () => textures?.dispose(), [textures])

  if (!textures) {
    return (
      <meshStandardMaterial
        color={colorOverride ?? color}
        roughness={roughnessOverride ?? roughness}
        metalness={metalnessOverride ?? metalness}
        side={side}
      />
    )
  }

  return (
    <meshStandardMaterial
      map={textures.map}
      normalMap={textures.normalMap ?? undefined}
      normalScale={textures.normalMap
        ? new THREE.Vector2(textures.config.normalScale, textures.config.normalScale)
        : undefined}
      color={colorOverride ?? '#ffffff'}
      roughness={roughnessOverride ?? textures.config.roughness}
      metalness={metalnessOverride ?? textures.config.metalness}
      side={side}
    />
  )
}
