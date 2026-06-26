import * as THREE from 'three'
import { SeededRandom, WORLD_SEED } from '../../core/seededRandom'
import {
  getRacingSurfaceTextureConfig,
  type RacingSurfaceId,
  type RacingSurfaceTextureConfig
} from './proceduralSurfaceConfig'
import type { RacingQualityPresetId } from '../../performance/qualitySettings'

// Browser-side companion to proceduralSurfaceConfig: paints the actual asphalt and
// grass canvases and wraps them as tiling THREE textures. Painting is the expensive
// part, so the rendered canvases are cached per (surface, quality) and reused across
// every track and every remount — only the lightweight THREE.CanvasTexture wrapper is
// rebuilt per consumer, which lets each mesh own its own repeat/anisotropy settings.

export interface RacingSurfaceTextureSet {
  map: THREE.Texture
  normalMap: THREE.Texture | null
  config: RacingSurfaceTextureConfig
  dispose: () => void
}

interface BakedSurfaceCanvases {
  albedo: HTMLCanvasElement
  normal: HTMLCanvasElement | null
}

const surfaceCanvasCache = new Map<string, BakedSurfaceCanvases>()

const SURFACE_SEEDS: Record<RacingSurfaceId, number> = {
  asphalt: WORLD_SEED + 1301,
  grass: WORLD_SEED + 2207,
  'volcanic-rock': WORLD_SEED + 3413,
  'road-paint-yellow': WORLD_SEED + 4519,
  'road-paint-white': WORLD_SEED + 5623
}

const canCreateCanvas = (): boolean =>
  typeof document !== 'undefined' && typeof document.createElement === 'function'

const createCanvas = (size: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  return canvas
}

// Paint a tileable noisy surface: solid base, a soft cloud of large tonal blotches
// to break up flatness, then `detailPasses` small flecks (aggregate for asphalt,
// blades for grass). Every draw wraps across the canvas edges so the texture tiles
// seamlessly when repeated over the ground/road.
const paintAlbedo = (
  surface: RacingSurfaceId,
  config: RacingSurfaceTextureConfig,
  rng: SeededRandom
): HTMLCanvasElement => {
  const size = config.textureSize
  const canvas = createCanvas(size)
  const ctx = canvas.getContext('2d')!
  const { base, shadow, highlight, accent } = config.palette

  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  // Wrap-aware blob: drawn up to four times so a blob near an edge bleeds onto the
  // opposite edge, keeping the tile seamless.
  const drawWrapped = (
    cx: number,
    cy: number,
    radius: number,
    paint: (x: number, y: number) => void
  ) => {
    const offsets = [0, size, -size]
    for (const ox of offsets) {
      if (cx + ox + radius < 0 || cx + ox - radius > size) continue
      for (const oy of offsets) {
        if (cy + oy + radius < 0 || cy + oy - radius > size) continue
        paint(cx + ox, cy + oy)
      }
    }
  }

  // Broad tonal variation — large translucent blotches in shadow/highlight tones.
  // Bold enough to read as patchy ground rather than wash out under mip-mapping.
  const blotchCount = Math.round(size / 10)
  for (let i = 0; i < blotchCount; i++) {
    const cx = rng.next() * size
    const cy = rng.next() * size
    const radius = (size / 12) * (0.5 + rng.next() * 1.8)
    const tone = rng.next() < 0.5 ? shadow : highlight
    ctx.globalAlpha = 0.12 + rng.next() * 0.22
    ctx.fillStyle = tone
    drawWrapped(cx, cy, radius, (x, y) => {
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    })
  }
  ctx.globalAlpha = 1

  if (surface === 'road-paint-yellow' || surface === 'road-paint-white') {
    // Worn road paint. The canvas V axis (y) runs ALONG the line, U (x) across its
    // narrow width, so grime/tyre scuffing is painted as long faint streaks down the
    // line while chips that expose the dark tarmac (accent) are small scattered specks.
    // Three passes share the detailPasses budget: grime flecks, longitudinal scuffs and
    // worn-through chips, so a low tier still reads as aged paint, just coarser.
    const grimeFlecks = Math.round(config.detailPasses * 0.55)
    for (let i = 0; i < grimeFlecks; i++) {
      const cx = rng.next() * size
      const cy = rng.next() * size
      const r = (size / 256) * (0.5 + rng.next() * 1.6)
      ctx.fillStyle = rng.next() < 0.6 ? shadow : highlight
      ctx.globalAlpha = 0.12 + rng.next() * 0.3
      drawWrapped(cx, cy, r, (x, y) => {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    const scuffStreaks = Math.round(config.detailPasses * 0.18)
    ctx.strokeStyle = shadow
    for (let i = 0; i < scuffStreaks; i++) {
      const cx = rng.next() * size
      const cy = rng.next() * size
      const len = size * (0.15 + rng.next() * 0.5)
      const drift = (rng.next() - 0.5) * size * 0.08
      ctx.globalAlpha = 0.08 + rng.next() * 0.18
      ctx.lineWidth = (size / 256) * (0.6 + rng.next() * 1.4)
      drawWrapped(cx, cy, len, (x, y) => {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + drift, y - len)
        ctx.stroke()
      })
    }

    const chips = config.detailPasses - grimeFlecks - scuffStreaks
    ctx.fillStyle = accent
    for (let i = 0; i < chips; i++) {
      const cx = rng.next() * size
      const cy = rng.next() * size
      const r = (size / 256) * (0.5 + rng.next() * 1.9)
      // Most chips are subtle scratches; a few fully expose the tarmac beneath.
      ctx.globalAlpha = rng.next() < 0.2 ? 0.5 + rng.next() * 0.4 : 0.12 + rng.next() * 0.25
      drawWrapped(cx, cy, r, (x, y) => {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      })
    }
  } else if (surface === 'grass') {
    // Grass blades: short angled strokes in varied greens give a turf-like grain.
    const bladeLength = Math.max(3, size / 70)
    for (let i = 0; i < config.detailPasses; i++) {
      const cx = rng.next() * size
      const cy = rng.next() * size
      const roll = rng.next()
      const len = bladeLength * (0.6 + rng.next() * 1.2)
      const lean = (rng.next() - 0.5) * len * 0.7
      ctx.strokeStyle = roll < 0.4 ? shadow : roll < 0.76 ? highlight : accent
      ctx.globalAlpha = 0.4 + rng.next() * 0.5
      ctx.lineWidth = (size / 512) * (0.9 + rng.next() * 1.1)
      drawWrapped(cx, cy, len, (x, y) => {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + lean, y - len)
        ctx.stroke()
      })
    }
  } else {
    // Granular surface (asphalt aggregate / volcanic dirt): light and dark grains
    // embedded in the base, plus a few dark hairline cracks — tarmac wear for asphalt,
    // charred lava fissures for volcanic rock — so it reads as a gritty surface up close.
    for (let i = 0; i < config.detailPasses; i++) {
      const cx = rng.next() * size
      const cy = rng.next() * size
      const r = (size / 512) * (0.6 + rng.next() * 2.1)
      const roll = rng.next()
      ctx.fillStyle = roll < 0.42 ? shadow : roll < 0.82 ? highlight : accent
      ctx.globalAlpha = 0.35 + rng.next() * 0.5
      drawWrapped(cx, cy, r, (x, y) => {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    const crackCount = Math.round(size / 90)
    ctx.strokeStyle = shadow
    for (let i = 0; i < crackCount; i++) {
      let x = rng.next() * size
      let y = rng.next() * size
      const steps = 6 + Math.floor(rng.next() * 8)
      let angle = rng.next() * Math.PI * 2
      ctx.globalAlpha = 0.25 + rng.next() * 0.25
      ctx.lineWidth = (size / 512) * (0.6 + rng.next() * 0.7)
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let s = 0; s < steps; s++) {
        angle += (rng.next() - 0.5) * 1.1
        x += Math.cos(angle) * (size / 40)
        y += Math.sin(angle) * (size / 40)
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1

  return canvas
}

// Derive a tangent-space normal map from the painted albedo's luminance, treating
// brighter flecks as raised bumps. Cheap Sobel pass, only run for the high tier.
const bakeNormalFromAlbedo = (albedo: HTMLCanvasElement, strength: number): HTMLCanvasElement => {
  const size = albedo.width
  const srcCtx = albedo.getContext('2d')!
  const src = srcCtx.getImageData(0, 0, size, size).data

  const luminance = new Float32Array(size * size)
  for (let i = 0; i < size * size; i++) {
    const o = i * 4
    luminance[i] = (src[o] * 0.299 + src[o + 1] * 0.587 + src[o + 2] * 0.114) / 255
  }

  const at = (x: number, y: number) => luminance[((y + size) % size) * size + ((x + size) % size)]

  const normalCanvas = createCanvas(size)
  const dstCtx = normalCanvas.getContext('2d')!
  const dst = dstCtx.createImageData(size, size)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const nz = 1
      const len = Math.hypot(dx, dy, nz) || 1
      const o = (y * size + x) * 4
      dst.data[o] = Math.round((-dx / len * 0.5 + 0.5) * 255)
      dst.data[o + 1] = Math.round((-dy / len * 0.5 + 0.5) * 255)
      dst.data[o + 2] = Math.round((nz / len * 0.5 + 0.5) * 255)
      dst.data[o + 3] = 255
    }
  }

  dstCtx.putImageData(dst, 0, 0)
  return normalCanvas
}

const getBakedCanvases = (
  surface: RacingSurfaceId,
  config: RacingSurfaceTextureConfig,
  cacheKey: string
): BakedSurfaceCanvases => {
  const cached = surfaceCanvasCache.get(cacheKey)
  if (cached) return cached

  const rng = new SeededRandom(SURFACE_SEEDS[surface])
  const albedo = paintAlbedo(surface, config, rng)
  const normal = config.normalMap ? bakeNormalFromAlbedo(albedo, config.normalScale * 6) : null
  const baked: BakedSurfaceCanvases = { albedo, normal }
  surfaceCanvasCache.set(cacheKey, baked)
  return baked
}

const wrapAsTexture = (
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
  colorSpace: THREE.ColorSpace
): THREE.CanvasTexture => {
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.anisotropy = anisotropy
  texture.colorSpace = colorSpace
  texture.needsUpdate = true
  return texture
}

export interface RacingSurfaceTextureRequest {
  surface: RacingSurfaceId
  qualityPresetId: RacingQualityPresetId | string | null | undefined
  /**
   * Texture repeat. A single number tiles both axes equally (terrain plane); pass
   * separate x/y when the geometry's UV axes span different world distances (a road
   * ribbon whose U spans the width and V spans the full track length).
   */
  repeat: number | { x: number; y: number }
}

/**
 * Build a ready-to-use texture set for a surface. Returns null in non-DOM
 * environments (SSR/tests) so callers fall back to a flat colour material.
 */
export const createRacingSurfaceTextures = ({
  surface,
  qualityPresetId,
  repeat
}: RacingSurfaceTextureRequest): RacingSurfaceTextureSet | null => {
  if (!canCreateCanvas()) return null

  const config = getRacingSurfaceTextureConfig(surface, qualityPresetId)
  const cacheKey = `${surface}:${config.textureSize}:${config.detailPasses}:${config.normalMap}`
  const baked = getBakedCanvases(surface, config, cacheKey)

  const sanitizeRepeat = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 1)
  const repeatX = sanitizeRepeat(typeof repeat === 'number' ? repeat : repeat.x)
  const repeatY = sanitizeRepeat(typeof repeat === 'number' ? repeat : repeat.y)
  const map = wrapAsTexture(baked.albedo, repeatX, repeatY, config.anisotropy, THREE.SRGBColorSpace)
  const normalMap = baked.normal
    ? wrapAsTexture(baked.normal, repeatX, repeatY, config.anisotropy, THREE.NoColorSpace)
    : null

  return {
    map,
    normalMap,
    config,
    dispose: () => {
      map.dispose()
      normalMap?.dispose()
    }
  }
}
