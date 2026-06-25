import * as THREE from 'three'
import { SeededRandom } from '../../core/seededRandom'

export type TreeSpecies = 'broadleaf' | 'conifer'

export type TreeBillboardQuality = 'low' | 'medium' | 'high'

export interface TreeBillboardPalette {
  trunk: string
  foliage: [string, string, string, string]
  highlight?: string
}

export interface TreeBillboardAtlas {
  texture: THREE.CanvasTexture
  cols: number
  rows: number
  variantCount: number
  aspect: number
}

export interface TreeBillboardAtlasOptions {
  species?: TreeSpecies
  variants?: number
  cellSize?: number
  seed?: number
  quality?: TreeBillboardQuality
}

export const TEMPERATE_TREE_PALETTE: TreeBillboardPalette = {
  trunk: '#4a3522',
  foliage: ['#1d3d28', '#27512f', '#357a3e', '#4e9b52'],
  highlight: '#9fd47a'
}

export const AUTUMN_TREE_PALETTE: TreeBillboardPalette = {
  trunk: '#46301f',
  foliage: ['#5a2f12', '#8a4516', '#c06a1f', '#d99632'],
  highlight: '#f2c64d'
}

export const SNOW_TREE_PALETTE: TreeBillboardPalette = {
  trunk: '#3a2515',
  foliage: ['#16361f', '#1f4a2a', '#cfe0e8', '#f3f9ff'],
  highlight: '#ffffff'
}

const CARD_ASPECT = 0.72

// Quality tiers trade canvas resolution and leaf-dab density for fidelity, mirroring
// the Low / Medium / High split used by the rest of the racing scenery. The leaf
// grain is what lifts the trees out of "flat cartoon blob" territory, so the high
// tier paints noticeably denser foliage on a larger cell.
interface TreeQualityProfile {
  cellSize: number
  detailScale: number
}

const QUALITY_PROFILES: Record<TreeBillboardQuality, TreeQualityProfile> = {
  low: { cellSize: 96, detailScale: 0.55 },
  medium: { cellSize: 128, detailScale: 1 },
  high: { cellSize: 192, detailScale: 1.7 }
}

type Rgb = [number, number, number]

const hexToRgb = (hex: string): Rgb => {
  const value = parseInt(hex.replace('#', ''), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

const mixRgb = (a: string, b: string, t: number): Rgb => {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return [
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t)
  ]
}

const lerpRgb = ([ar, ag, ab]: Rgb, [br, bg, bb]: Rgb, t: number): Rgb => [
  Math.round(ar + (br - ar) * t),
  Math.round(ag + (bg - ag) * t),
  Math.round(ab + (bb - ab) * t)
]

const shade = ([r, g, b]: Rgb, t: number): Rgb =>
  t >= 0
    ? [Math.round(r + (255 - r) * t), Math.round(g + (255 - g) * t), Math.round(b + (255 - b) * t)]
    : [Math.round(r * (1 + t)), Math.round(g * (1 + t)), Math.round(b * (1 + t))]

const rgba = ([r, g, b]: Rgb, a: number): string => `rgba(${r}, ${g}, ${b}, ${a})`

const mixHex = (a: string, b: string, t: number): string => rgba(mixRgb(a, b, t), 1)

// Bark: a softly lit trapezoid with a handful of vertical grain streaks so the trunk
// reads as a textured surface up close rather than a flat brown wedge.
const paintTrunk = (
  ctx: CanvasRenderingContext2D,
  rng: SeededRandom,
  cx: number,
  groundY: number,
  height: number,
  width: number,
  palette: TreeBillboardPalette
) => {
  const topY = groundY - height
  const topWidth = width * 0.55
  const gradient = ctx.createLinearGradient(cx - width, 0, cx + width, 0)
  gradient.addColorStop(0, mixHex(palette.trunk, '#000000', 0.4))
  gradient.addColorStop(0.45, palette.trunk)
  gradient.addColorStop(0.7, mixHex(palette.trunk, '#ffffff', 0.12))
  gradient.addColorStop(1, mixHex(palette.trunk, '#000000', 0.25))
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.moveTo(cx - width, groundY)
  ctx.lineTo(cx + width, groundY)
  ctx.lineTo(cx + topWidth, topY)
  ctx.lineTo(cx - topWidth, topY)
  ctx.closePath()
  ctx.fill()

  const trunkBase = hexToRgb(palette.trunk)
  const streaks = 4 + Math.floor(rng.next() * 3)
  for (let i = 0; i < streaks; i++) {
    const t = (i + 0.5) / streaks
    const x = cx - width + t * width * 2
    ctx.strokeStyle = rgba(shade(trunkBase, rng.next() < 0.5 ? -0.35 : 0.2), 0.35 + rng.next() * 0.3)
    ctx.lineWidth = Math.max(0.6, width * 0.18)
    ctx.beginPath()
    ctx.moveTo(x + (rng.next() - 0.5) * width * 0.3, groundY)
    ctx.lineTo(cx + (x - cx) * 0.5 + (rng.next() - 0.5) * width * 0.2, topY)
    ctx.stroke()
  }
}

// Paint a leafy mass from a soft base canopy plus dense short leaf strokes. The strokes
// share the grass texture's recipe — many small marks in varied tones with jittered
// alpha — so foliage and turf read as the same illustrated material. Directional
// shading (brighter toward the upper-left) keeps the crown from looking like a sticker.
const paintBroadleaf = (
  ctx: CanvasRenderingContext2D,
  rng: SeededRandom,
  size: number,
  palette: TreeBillboardPalette,
  detail: number
) => {
  const cx = size / 2
  const groundY = size * 0.98
  const trunkHeight = size * 0.34
  const canopyCenterY = size * 0.42
  const canopyRadius = size * 0.36
  const canopyTop = size * 0.04
  const canopyBottom = groundY - trunkHeight * 0.55

  paintTrunk(ctx, rng, cx, groundY, trunkHeight, size * 0.05, palette)

  // Irregular cluster of lobes defining the crown silhouette; leaf strokes are gated to
  // these so the outline stays organic instead of a perfect circle.
  const lobes: { x: number; y: number; r: number }[] = []
  const lobeCount = 7 + Math.floor(rng.next() * 4)
  for (let i = 0; i < lobeCount; i++) {
    const angle = rng.next() * Math.PI * 2
    const spread = canopyRadius * (0.2 + rng.next() * 0.7)
    let x = cx + Math.cos(angle) * spread
    let y = canopyCenterY + Math.sin(angle) * spread * 0.78
    const r = canopyRadius * (0.4 + rng.next() * 0.34)
    if (y + r > canopyBottom) y = canopyBottom - r
    if (y - r < canopyTop) y = canopyTop + r
    x = Math.min(Math.max(x, cx - canopyRadius), cx + canopyRadius)
    lobes.push({ x, y, r })
  }

  const lightFactor = (x: number, y: number): number => {
    const vertical = THREE.MathUtils.clamp((canopyBottom - y) / (canopyBottom - canopyTop), 0, 1)
    const sided = THREE.MathUtils.clamp((cx + canopyRadius - x) / (canopyRadius * 2), 0, 1)
    return THREE.MathUtils.clamp(vertical * 0.7 + sided * 0.3, 0, 1)
  }

  const inside = (x: number, y: number, slack: number): boolean => {
    for (const lobe of lobes) {
      const dx = x - lobe.x
      const dy = y - lobe.y
      if (dx * dx + dy * dy < (lobe.r * slack) * (lobe.r * slack)) return true
    }
    return false
  }

  // Soft base mass: opaque cores with feathered edges give a ragged leafy outline once
  // the shader applies its alpha cutoff.
  for (const lobe of lobes) {
    const light = lightFactor(lobe.x, lobe.y)
    const base = mixRgb(palette.foliage[0], palette.foliage[2], light)
    const gradient = ctx.createRadialGradient(lobe.x, lobe.y, lobe.r * 0.25, lobe.x, lobe.y, lobe.r)
    gradient.addColorStop(0, rgba(base, 1))
    gradient.addColorStop(0.7, rgba(base, 0.95))
    gradient.addColorStop(1, rgba(base, 0))
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(lobe.x, lobe.y, lobe.r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Leaf grain: short angled dabs in varied greens, same idea as the grass blades.
  const dabCount = Math.round(size * 1.5 * detail)
  const dabLen = size * 0.05
  for (let i = 0; i < dabCount; i++) {
    const lobe = lobes[Math.floor(rng.next() * lobes.length)]
    const a = rng.next() * Math.PI * 2
    const rad = Math.sqrt(rng.next()) * lobe.r * 0.95
    const x = lobe.x + Math.cos(a) * rad
    const y = lobe.y + Math.sin(a) * rad
    if (!inside(x, y, 0.95)) continue
    const light = lightFactor(x, y)
    const roll = rng.next()
    const tone = roll < 0.45
      ? mixRgb(palette.foliage[0], palette.foliage[1], rng.next())
      : roll < 0.85
        ? mixRgb(palette.foliage[1], palette.foliage[2], rng.next())
        : hexToRgb(palette.foliage[3])
    const lit = lerpRgb(tone, shade(tone, 0.35), light * 0.8)
    const len = dabLen * (0.5 + rng.next() * 1.1)
    const lean = (rng.next() - 0.5) * len * 0.8
    ctx.strokeStyle = rgba(lit, 0.4 + rng.next() * 0.45)
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(0.8, size * 0.012 * (0.7 + rng.next() * 0.8))
    ctx.beginPath()
    ctx.moveTo(x, y + len * 0.4)
    ctx.lineTo(x + lean, y - len * 0.6)
    ctx.stroke()
  }

  // Sunlit speckle on the upper-left shoulder.
  if (palette.highlight) {
    const highlightRgb = hexToRgb(palette.highlight)
    const speckles = Math.round(size * 0.18 * detail)
    for (let i = 0; i < speckles; i++) {
      const x = cx - canopyRadius * 0.35 + (rng.next() - 0.4) * canopyRadius * 0.7
      const y = canopyCenterY - canopyRadius * 0.35 + (rng.next() - 0.5) * canopyRadius * 0.55
      if (!inside(x, y, 0.85)) continue
      ctx.fillStyle = rgba(highlightRgb, 0.18 + rng.next() * 0.28)
      ctx.beginPath()
      ctx.arc(x, y, size * 0.012 * (0.8 + rng.next()), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.lineCap = 'butt'
}

const paintConifer = (
  ctx: CanvasRenderingContext2D,
  rng: SeededRandom,
  size: number,
  palette: TreeBillboardPalette,
  detail: number
) => {
  const cx = size / 2
  const groundY = size * 0.98
  const topY = size * 0.05
  const baseY = size * 0.88
  const maxHalfWidth = size * 0.32
  const tiers = 4 + Math.floor(rng.next() * 2)

  paintTrunk(ctx, rng, cx, groundY, size * 0.18, size * 0.04, palette)

  const halfWidthAt = (y: number): number => {
    const t = THREE.MathUtils.clamp((y - topY) / (baseY - topY), 0, 1)
    return maxHalfWidth * (0.05 + t * 0.95)
  }

  for (let tier = 0; tier < tiers; tier++) {
    const t = tier / tiers
    const tierTop = topY + (baseY - topY) * t
    const tierBottom = tierTop + ((baseY - topY) / tiers) * 1.5
    const halfWidth = maxHalfWidth * (0.3 + t * 0.7)
    const light = 0.2 + t * 0.5
    const base = mixRgb(palette.foliage[0], palette.foliage[3], light)
    ctx.fillStyle = rgba(base, 1)
    ctx.beginPath()
    ctx.moveTo(cx, tierTop)
    ctx.lineTo(cx + halfWidth, tierBottom)
    ctx.lineTo(cx - halfWidth, tierBottom)
    ctx.closePath()
    ctx.fill()
  }

  // Needle grain: short downward strokes scattered across the silhouette, brighter on
  // the left so the cone catches a directional light like the broadleaf crown.
  const needleCount = Math.round(size * 1.4 * detail)
  for (let i = 0; i < needleCount; i++) {
    const y = topY + Math.pow(rng.next(), 0.7) * (baseY - topY)
    const hw = halfWidthAt(y)
    const x = cx + (rng.next() - 0.5) * hw * 2
    const sided = THREE.MathUtils.clamp((cx + hw - x) / (hw * 2 || 1), 0, 1)
    const vertical = THREE.MathUtils.clamp((baseY - y) / (baseY - topY), 0, 1)
    const light = vertical * 0.55 + sided * 0.45
    const roll = rng.next()
    const tone = roll < 0.5
      ? mixRgb(palette.foliage[0], palette.foliage[1], rng.next())
      : roll < 0.85
        ? mixRgb(palette.foliage[1], palette.foliage[2], rng.next())
        : hexToRgb(palette.foliage[3])
    const lit = lerpRgb(tone, shade(tone, 0.4), light * 0.8)
    const len = size * 0.04 * (0.6 + rng.next())
    const lean = (rng.next() < 0.5 ? -1 : 1) * len * 0.6
    ctx.strokeStyle = rgba(lit, 0.35 + rng.next() * 0.45)
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(0.7, size * 0.01 * (0.7 + rng.next() * 0.7))
    ctx.beginPath()
    ctx.moveTo(x, y - len * 0.4)
    ctx.lineTo(x + lean, y + len * 0.6)
    ctx.stroke()
  }

  if (palette.highlight) {
    const highlightRgb = hexToRgb(palette.highlight)
    const speckles = Math.round(size * 0.14 * detail)
    for (let i = 0; i < speckles; i++) {
      const y = topY + rng.next() * (baseY - topY)
      const hw = halfWidthAt(y)
      const x = cx - hw * 0.5 + rng.next() * hw * 0.4
      ctx.fillStyle = rgba(highlightRgb, 0.14 + rng.next() * 0.22)
      ctx.beginPath()
      ctx.arc(x, y, size * 0.01 * (0.8 + rng.next()), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.lineCap = 'butt'
}

export const generateTreeBillboardAtlas = (
  palette: TreeBillboardPalette = TEMPERATE_TREE_PALETTE,
  options: TreeBillboardAtlasOptions = {}
): TreeBillboardAtlas => {
  const variants = Math.max(1, options.variants ?? 6)
  const profile = QUALITY_PROFILES[options.quality ?? 'medium']
  const cellSize = options.cellSize ?? profile.cellSize
  const detail = profile.detailScale
  const canvas = document.createElement('canvas')
  canvas.width = variants * cellSize
  canvas.height = cellSize
  const ctx = canvas.getContext('2d')!

  for (let variant = 0; variant < variants; variant++) {
    ctx.save()
    ctx.translate(variant * cellSize, 0)
    ctx.beginPath()
    ctx.rect(0, 0, cellSize, cellSize)
    ctx.clip()
    const rng = new SeededRandom((options.seed ?? 9100) + variant * 977)
    if (options.species === 'conifer') paintConifer(ctx, rng, cellSize, palette, detail)
    else paintBroadleaf(ctx, rng, cellSize, palette, detail)
    ctx.restore()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 4
  texture.needsUpdate = true
  return { texture, cols: variants, rows: 1, variantCount: variants, aspect: CARD_ASPECT }
}
