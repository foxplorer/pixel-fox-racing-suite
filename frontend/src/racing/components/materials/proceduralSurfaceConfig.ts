import type { RacingQualityPresetId } from '../../performance/qualitySettings'
import { resolveRacingQualityPresetId } from '../../performance/qualitySettings'

// Procedural ground/road surfaces are shared by every car track (Australia first,
// then Belgium and the imported tracks). This module owns the *pure* description of
// what each surface should look like at each quality tier — texture resolution,
// how many world units a tile spans, how much painted detail to bake in, and the
// colour palette. The canvas/THREE texture builder consumes this config, and the
// pure shape keeps the quality decisions unit-testable without a DOM.

export type RacingSurfaceId = 'asphalt' | 'grass' | 'volcanic-rock'

export interface RacingSurfacePalette {
  /** Base fill colour for the surface. */
  base: string
  /** Darker speckle/shadow colour painted on top of the base. */
  shadow: string
  /** Lighter speckle/highlight colour painted on top of the base. */
  highlight: string
  /** Accent colour — aggregate flecks for asphalt, lush blades for grass. */
  accent: string
}

export interface RacingSurfaceTextureConfig {
  /** Square texture resolution in pixels (power of two). */
  textureSize: number
  /** How many world units a single texture tile spans. Smaller = denser detail. */
  tileWorldSize: number
  /** Number of speckle/detail passes painted into the albedo canvas. */
  detailPasses: number
  /** Texture anisotropy — sharpens the surface at grazing angles. */
  anisotropy: number
  /** Whether to also bake a normal map (only worth it on the top tier). */
  normalMap: boolean
  /** Strength of the baked normal map, ignored when normalMap is false. */
  normalScale: number
  /** Material roughness for the standard material. */
  roughness: number
  /** Material metalness for the standard material. */
  metalness: number
  palette: RacingSurfacePalette
}

const SURFACE_PALETTES: Record<RacingSurfaceId, RacingSurfacePalette> = {
  // Worn racing asphalt: charcoal base with clearly lighter aggregate stones and
  // dark oil/shadow streaks so it reads as mottled tarmac rather than a flat fill.
  asphalt: {
    base: '#3b3c41',
    shadow: '#26272b',
    highlight: '#5e616b',
    accent: '#878a96'
  },
  // Mown trackside grass: a mid green with distinctly darker clumps and bright
  // sun-bleached tips so the turf reads as blades, not a single solid green sheet.
  grass: {
    base: '#4c9a51',
    shadow: '#2d6b37',
    highlight: '#74c267',
    accent: '#9bd87f'
  },
  // Volcanic dirt: warm orange-brown scorched earth with dark charred fissures and
  // bright ember-lit ochre flecks, so the volcano floor reads as cracked molten rock
  // rather than a flat brown fill. Painted with the same fleck+crack pass as asphalt.
  'volcanic-rock': {
    base: '#7a4327',
    shadow: '#41230f',
    highlight: '#a8602f',
    accent: '#d98a3e'
  }
}

// IMPORTANT: tileWorldSize is held CONSTANT across quality tiers per surface. It is a
// world-scale art decision, not a performance knob — shrinking it with quality (as a
// first pass did) just multiplies the texture repeat, and once a texture repeats a few
// hundred times across the ground the GPU mips it down to its average colour, so the
// painted detail vanishes and only a flat tint remains. Keeping the tile fixed means
// the detail stays the same real-world size and is genuinely visible near the camera;
// quality then changes *sharpness and relief* (resolution + a baked normal map on high)
// rather than shifting the average brightness. textureSize / detailPasses / anisotropy
// are the real per-tier budget.
const ASPHALT_TILE_WORLD_SIZE = 7
const GRASS_TILE_WORLD_SIZE = 26
const VOLCANIC_ROCK_TILE_WORLD_SIZE = 22

const SURFACE_QUALITY_TABLE: Record<
  RacingSurfaceId,
  Record<RacingQualityPresetId, Omit<RacingSurfaceTextureConfig, 'palette'>>
> = {
  asphalt: {
    low: {
      textureSize: 256,
      tileWorldSize: ASPHALT_TILE_WORLD_SIZE,
      detailPasses: 380,
      anisotropy: 1,
      normalMap: false,
      normalScale: 0,
      roughness: 0.92,
      metalness: 0.04
    },
    medium: {
      textureSize: 512,
      tileWorldSize: ASPHALT_TILE_WORLD_SIZE,
      detailPasses: 1400,
      anisotropy: 4,
      normalMap: false,
      normalScale: 0,
      roughness: 0.88,
      metalness: 0.05
    },
    high: {
      textureSize: 1024,
      tileWorldSize: ASPHALT_TILE_WORLD_SIZE,
      detailPasses: 4200,
      anisotropy: 8,
      normalMap: true,
      normalScale: 0.85,
      roughness: 0.84,
      metalness: 0.06
    }
  },
  grass: {
    low: {
      textureSize: 256,
      tileWorldSize: GRASS_TILE_WORLD_SIZE,
      detailPasses: 900,
      anisotropy: 1,
      normalMap: false,
      normalScale: 0,
      roughness: 0.95,
      metalness: 0
    },
    medium: {
      textureSize: 512,
      tileWorldSize: GRASS_TILE_WORLD_SIZE,
      detailPasses: 3200,
      anisotropy: 4,
      normalMap: false,
      normalScale: 0,
      roughness: 0.93,
      metalness: 0
    },
    high: {
      textureSize: 1024,
      tileWorldSize: GRASS_TILE_WORLD_SIZE,
      detailPasses: 9000,
      anisotropy: 8,
      normalMap: true,
      normalScale: 0.7,
      roughness: 0.9,
      metalness: 0
    }
  },
  'volcanic-rock': {
    low: {
      textureSize: 256,
      tileWorldSize: VOLCANIC_ROCK_TILE_WORLD_SIZE,
      detailPasses: 520,
      anisotropy: 1,
      normalMap: false,
      normalScale: 0,
      roughness: 0.95,
      metalness: 0.02
    },
    medium: {
      textureSize: 512,
      tileWorldSize: VOLCANIC_ROCK_TILE_WORLD_SIZE,
      detailPasses: 2000,
      anisotropy: 4,
      normalMap: false,
      normalScale: 0,
      roughness: 0.93,
      metalness: 0.02
    },
    high: {
      textureSize: 1024,
      tileWorldSize: VOLCANIC_ROCK_TILE_WORLD_SIZE,
      detailPasses: 6000,
      anisotropy: 8,
      normalMap: true,
      normalScale: 0.9,
      roughness: 0.9,
      metalness: 0.03
    }
  }
}

export const getRacingSurfaceTextureConfig = (
  surface: RacingSurfaceId,
  qualityPresetId: RacingQualityPresetId | string | null | undefined
): RacingSurfaceTextureConfig => {
  const resolvedQuality = resolveRacingQualityPresetId(
    typeof qualityPresetId === 'string' ? qualityPresetId : undefined
  )
  return {
    ...SURFACE_QUALITY_TABLE[surface][resolvedQuality],
    palette: SURFACE_PALETTES[surface]
  }
}

/**
 * Texture repeat counts needed to tile a surface across a given world span without
 * stretching. Pure so the geometry → repeat math can be verified in isolation.
 */
export const getSurfaceTextureRepeat = (
  worldSpan: number,
  tileWorldSize: number
): number => {
  if (!Number.isFinite(worldSpan) || !Number.isFinite(tileWorldSize) || tileWorldSize <= 0) {
    return 1
  }
  return Math.max(1, worldSpan / tileWorldSize)
}
