import * as THREE from 'three'
import { SeededRandom } from '../../core/seededRandom'

export type TreeSpecies = 'broadleaf' | 'conifer'

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

const hexToRgb = (hex: string): [number, number, number] => {
  const value = parseInt(hex.replace('#', ''), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

const mixHex = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return `rgb(${Math.round(ar + (br - ar) * t)}, ${Math.round(ag + (bg - ag) * t)}, ${Math.round(ab + (bb - ab) * t)})`
}

const paintTrunk = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  height: number,
  width: number,
  palette: TreeBillboardPalette
) => {
  const gradient = ctx.createLinearGradient(cx - width, 0, cx + width, 0)
  gradient.addColorStop(0, mixHex(palette.trunk, '#000000', 0.35))
  gradient.addColorStop(0.5, palette.trunk)
  gradient.addColorStop(1, mixHex(palette.trunk, '#000000', 0.2))
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.moveTo(cx - width, groundY)
  ctx.lineTo(cx + width, groundY)
  ctx.lineTo(cx + width * 0.55, groundY - height)
  ctx.lineTo(cx - width * 0.55, groundY - height)
  ctx.closePath()
  ctx.fill()
}

const paintBroadleaf = (
  ctx: CanvasRenderingContext2D,
  rng: SeededRandom,
  size: number,
  palette: TreeBillboardPalette
) => {
  const cx = size / 2
  const groundY = size * 0.97
  const trunkHeight = size * 0.32
  const canopyCenterY = size * 0.4
  const canopyRadius = size * 0.34
  const canopyBottom = groundY - trunkHeight + size * 0.02
  const canopyTop = size * 0.05
  paintTrunk(ctx, cx, groundY, trunkHeight, size * 0.045, palette)

  const blobCount = 16 + Math.floor(rng.next() * 8)
  for (let i = 0; i < blobCount; i++) {
    const depth = i / blobCount
    const angle = rng.next() * Math.PI * 2
    const spread = canopyRadius * (0.45 + rng.next() * 0.55)
    const x = cx + Math.cos(angle) * spread
    const radius = canopyRadius * (0.34 + rng.next() * 0.3)
    let y = canopyCenterY + Math.sin(angle) * spread * 0.85 - depth * size * 0.05
    if (y + radius > canopyBottom) y = canopyBottom - radius
    if (y - radius < canopyTop) y = canopyTop + radius
    ctx.fillStyle = mixHex(palette.foliage[0], palette.foliage[3], depth)
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  if (palette.highlight) {
    ctx.globalAlpha = 0.5
    ctx.fillStyle = palette.highlight
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.arc(
        cx - canopyRadius * 0.3 + (rng.next() - 0.5) * canopyRadius * 0.5,
        canopyCenterY - canopyRadius * 0.4 + (rng.next() - 0.5) * canopyRadius * 0.4,
        canopyRadius * (0.12 + rng.next() * 0.12),
        0,
        Math.PI * 2
      )
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

const paintConifer = (
  ctx: CanvasRenderingContext2D,
  rng: SeededRandom,
  size: number,
  palette: TreeBillboardPalette
) => {
  const cx = size / 2
  const groundY = size * 0.97
  const topY = size * 0.06
  const baseY = size * 0.86
  const maxHalfWidth = size * 0.34
  const tiers = 4 + Math.floor(rng.next() * 2)
  paintTrunk(ctx, cx, groundY, size * 0.16, size * 0.035, palette)

  for (let tier = 0; tier < tiers; tier++) {
    const t = tier / tiers
    const tierTop = topY + (baseY - topY) * t
    const tierBottom = tierTop + ((baseY - topY) / tiers) * 1.5
    const halfWidth = maxHalfWidth * (0.35 + t * 0.65)
    ctx.fillStyle = mixHex(palette.foliage[0], palette.foliage[3], 0.2 + t * 0.6)
    ctx.beginPath()
    ctx.moveTo(cx, tierTop)
    ctx.lineTo(cx + halfWidth, tierBottom)
    ctx.lineTo(cx - halfWidth, tierBottom)
    ctx.closePath()
    ctx.fill()
  }
}

export const generateTreeBillboardAtlas = (
  palette: TreeBillboardPalette = TEMPERATE_TREE_PALETTE,
  options: TreeBillboardAtlasOptions = {}
): TreeBillboardAtlas => {
  const variants = Math.max(1, options.variants ?? 6)
  const cellSize = options.cellSize ?? 128
  const canvas = document.createElement('canvas')
  canvas.width = variants * cellSize
  canvas.height = cellSize
  const ctx = canvas.getContext('2d')!

  for (let variant = 0; variant < variants; variant++) {
    ctx.save()
    ctx.translate(variant * cellSize, 0)
    const rng = new SeededRandom((options.seed ?? 9100) + variant * 977)
    if (options.species === 'conifer') paintConifer(ctx, rng, cellSize, palette)
    else paintBroadleaf(ctx, rng, cellSize, palette)
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
