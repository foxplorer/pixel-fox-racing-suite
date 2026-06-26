import type { RacingQualityPresetId } from '../../performance/qualitySettings'
import { resolveRacingQualityPresetId } from '../../performance/qualitySettings'

// Procedural ground/road surfaces are shared by every car track (Australia first,
// then Belgium and the imported tracks). This module owns the *pure* description of
// what each surface should look like at each quality tier — texture resolution,
// how many world units a tile spans, how much painted detail to bake in, and the
// colour palette. The canvas/THREE texture builder consumes this config, and the
// pure shape keeps the quality decisions unit-testable without a DOM.

export type RacingSurfaceId =
  | 'asphalt'
  | 'grass'
  | 'volcanic-rock'
  | 'road-paint-yellow'
  | 'road-paint-white'

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
  /** Whether to also bake a normal map. Disabled for shared racing surfaces by default. */
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
  // Worn racing asphalt: a mid-dark grey base (lifted from near-charcoal so it actually
  // catches diffuse headlight instead of staying black at night) with lighter aggregate
  // stones and dark oil/shadow streaks so it reads as mottled tarmac, not a flat fill.
  asphalt: {
    base: '#4e4f56',
    shadow: '#34353a',
    highlight: '#6a6d77',
    accent: '#979aa6'
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
  },
  // Worn yellow edge paint: a real road yellow (not a flat saturated #FFD700) with
  // grimy faded-down patches, sun-bleached bright streaks, and an accent that is dark
  // tarmac — used for chips where the paint has worn through to the asphalt beneath, so
  // the line reads as aged thermoplastic rather than a plastic-flat strip.
  'road-paint-yellow': {
    base: '#e3b021',
    shadow: '#9a7414',
    highlight: '#f7d65b',
    accent: '#2f3034'
  },
  // Worn white centre-dash paint: an off-white road white that has greyed with grime,
  // with fresh bright spots and the same dark-tarmac chip accent as the yellow paint.
  'road-paint-white': {
    base: '#d9d9cf',
    shadow: '#9b9b90',
    highlight: '#f5f5ef',
    accent: '#2f3034'
  }
}

// IMPORTANT: tileWorldSize is held CONSTANT across quality tiers per surface. It is a
// world-scale art decision, not a performance knob — shrinking it with quality (as a
// first pass did) just multiplies the texture repeat, and once a texture repeats a few
// hundred times across the ground the GPU mips it down to its average colour, so the
// painted detail vanishes and only a flat tint remains. Keeping the tile fixed means
// the detail stays the same real-world size and is genuinely visible near the camera.
// Quality changes sharpness through resolution, detail passes, and anisotropy. Baked
// tangent-space normals stay disabled for now because the moving headlight cone can
// expose sharp triangle-diagonal seams on generated road, paint, and terrain meshes.
const ASPHALT_TILE_WORLD_SIZE = 7
const GRASS_TILE_WORLD_SIZE = 26
const VOLCANIC_ROCK_TILE_WORLD_SIZE = 22
// Road paint tiles along the thin line ribbon. A short tile keeps the wear/grime
// pattern at a believable real-world cadence (chips and scuffs every few metres)
// rather than one stretched smear over the whole lap.
const ROAD_PAINT_TILE_WORLD_SIZE = 4

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
      roughness: 0.96,
      metalness: 0
    },
    medium: {
      textureSize: 512,
      tileWorldSize: ASPHALT_TILE_WORLD_SIZE,
      detailPasses: 1400,
      anisotropy: 4,
      normalMap: false,
      normalScale: 0,
      roughness: 0.96,
      metalness: 0
    },
    high: {
      textureSize: 1024,
      tileWorldSize: ASPHALT_TILE_WORLD_SIZE,
      detailPasses: 4200,
      anisotropy: 8,
      normalMap: false,
      normalScale: 0,
      roughness: 0.96,
      metalness: 0
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
      roughness: 0.96,
      metalness: 0
    },
    medium: {
      textureSize: 512,
      tileWorldSize: GRASS_TILE_WORLD_SIZE,
      detailPasses: 3200,
      anisotropy: 4,
      normalMap: false,
      normalScale: 0,
      roughness: 0.96,
      metalness: 0
    },
    high: {
      textureSize: 1024,
      tileWorldSize: GRASS_TILE_WORLD_SIZE,
      detailPasses: 9000,
      anisotropy: 8,
      normalMap: false,
      normalScale: 0,
      roughness: 0.96,
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
      normalMap: false,
      normalScale: 0,
      roughness: 0.9,
      metalness: 0.03
    }
  },
  // Paint is glossier than the tarmac it sits on (slight thermoplastic sheen), so it
  // runs a lower roughness. detailPasses here are grime flecks + worn chips.
  'road-paint-yellow': {
    low: {
      textureSize: 128,
      tileWorldSize: ROAD_PAINT_TILE_WORLD_SIZE,
      detailPasses: 110,
      anisotropy: 1,
      normalMap: false,
      normalScale: 0,
      roughness: 0.72,
      metalness: 0.0
    },
    medium: {
      textureSize: 256,
      tileWorldSize: ROAD_PAINT_TILE_WORLD_SIZE,
      detailPasses: 360,
      anisotropy: 4,
      normalMap: false,
      normalScale: 0,
      roughness: 0.66,
      metalness: 0.0
    },
    high: {
      textureSize: 512,
      tileWorldSize: ROAD_PAINT_TILE_WORLD_SIZE,
      detailPasses: 900,
      anisotropy: 8,
      normalMap: false,
      normalScale: 0,
      roughness: 0.6,
      metalness: 0.0
    }
  },
  'road-paint-white': {
    low: {
      textureSize: 128,
      tileWorldSize: ROAD_PAINT_TILE_WORLD_SIZE,
      detailPasses: 110,
      anisotropy: 1,
      normalMap: false,
      normalScale: 0,
      roughness: 0.72,
      metalness: 0.0
    },
    medium: {
      textureSize: 256,
      tileWorldSize: ROAD_PAINT_TILE_WORLD_SIZE,
      detailPasses: 360,
      anisotropy: 4,
      normalMap: false,
      normalScale: 0,
      roughness: 0.66,
      metalness: 0.0
    },
    high: {
      textureSize: 512,
      tileWorldSize: ROAD_PAINT_TILE_WORLD_SIZE,
      detailPasses: 900,
      anisotropy: 8,
      normalMap: false,
      normalScale: 0,
      roughness: 0.6,
      metalness: 0.0
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
