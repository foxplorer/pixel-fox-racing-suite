import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { RacingQualityPresetId } from '../performance/qualitySettings'
import type { StartGateMarqueeModel } from './startGateMarquee'

export interface StartGateMarqueeQualitySettings {
  canvasWidth: number
  canvasHeight: number
  redrawsPerSecond: number
  ledGridMask: boolean
  glow: boolean
}

export const START_GATE_MARQUEE_QUALITY: Record<RacingQualityPresetId, StartGateMarqueeQualitySettings> = {
  low: {
    canvasWidth: 192,
    canvasHeight: 48,
    redrawsPerSecond: 5,
    ledGridMask: false,
    glow: false
  },
  medium: {
    canvasWidth: 256,
    canvasHeight: 64,
    redrawsPerSecond: 12,
    ledGridMask: true,
    glow: false
  },
  high: {
    canvasWidth: 384,
    canvasHeight: 96,
    redrawsPerSecond: 20,
    ledGridMask: true,
    glow: true
  }
}

export const MARQUEE_INFO_LINE_SECONDS = 3

export const getMarqueeInfoLineIndex = (elapsedSeconds: number, infoLineCount: number): number => {
  if (infoLineCount <= 0) return -1
  return Math.floor(elapsedSeconds / MARQUEE_INFO_LINE_SECONDS) % infoLineCount
}

interface StartGateMarqueeProps {
  model: StartGateMarqueeModel | null
  width: number
  height?: number
  qualityPresetId?: RacingQualityPresetId
}

const MARQUEE_BACKGROUND = '#0b0302'
const MARQUEE_RED = '#ff2200'
const MARQUEE_RED_DIM = '#7a1204'
const SCROLL_PIXELS_PER_SECOND = 28
const SCROLL_GAP_PX = 40
const MARQUEE_TEXT_PADDING_PX = 18

const createLedGridMask = (cellSize: number): HTMLCanvasElement => {
  const mask = document.createElement('canvas')
  mask.width = cellSize
  mask.height = cellSize
  const ctx = mask.getContext('2d')
  if (ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, cellSize, 1)
    ctx.fillRect(0, 0, 1, cellSize)
  }
  return mask
}

const drawMarqueeRow = (
  ctx: CanvasRenderingContext2D,
  text: string,
  options: {
    canvasWidth: number
    centerY: number
    fontSize: number
    color: string
    glow: boolean
    scrollOffsetPx: number
  }
): void => {
  const { canvasWidth, centerY, fontSize, color, glow, scrollOffsetPx } = options
  ctx.font = `bold ${fontSize}px "Courier New", monospace`
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  if (glow) {
    ctx.shadowColor = color
    ctx.shadowBlur = Math.max(2, Math.round(fontSize / 8))
  } else {
    ctx.shadowBlur = 0
  }

  const textWidth = ctx.measureText(text).width
  const safeTextWidth = canvasWidth - MARQUEE_TEXT_PADDING_PX * 2
  if (textWidth <= safeTextWidth) {
    ctx.fillText(text, Math.round((canvasWidth - textWidth) / 2), centerY)
  } else {
    const cycleWidth = textWidth + SCROLL_GAP_PX
    const offset = scrollOffsetPx % cycleWidth
    ctx.fillText(text, Math.round(-offset), centerY)
    ctx.fillText(text, Math.round(-offset + cycleWidth), centerY)
  }
  ctx.shadowBlur = 0
}

export const StartGateMarquee: React.FC<StartGateMarqueeProps> = ({
  model,
  width,
  height = 2,
  qualityPresetId = 'medium'
}) => {
  const quality = START_GATE_MARQUEE_QUALITY[qualityPresetId] ?? START_GATE_MARQUEE_QUALITY.medium
  const elapsedRef = useRef(0)
  const timeSinceRedrawRef = useRef(Number.POSITIVE_INFINITY)
  const modelRef = useRef(model)

  const { canvas, ctx, texture, gridMask } = useMemo(() => {
    const marqueeCanvas = document.createElement('canvas')
    marqueeCanvas.width = quality.canvasWidth
    marqueeCanvas.height = quality.canvasHeight
    const context = marqueeCanvas.getContext('2d')
    const canvasTexture = new THREE.CanvasTexture(marqueeCanvas)
    canvasTexture.magFilter = THREE.NearestFilter
    canvasTexture.minFilter = THREE.LinearFilter
    canvasTexture.generateMipmaps = false
    canvasTexture.colorSpace = THREE.SRGBColorSpace
    return {
      canvas: marqueeCanvas,
      ctx: context,
      texture: canvasTexture,
      gridMask: quality.ledGridMask ? createLedGridMask(quality.canvasHeight >= 96 ? 3 : 2) : null
    }
  }, [quality])

  useEffect(() => () => texture.dispose(), [texture])

  useEffect(() => {
    modelRef.current = model
    timeSinceRedrawRef.current = Number.POSITIVE_INFINITY
  }, [model])

  useFrame((_, delta) => {
    elapsedRef.current += delta
    timeSinceRedrawRef.current += delta
    if (!ctx) return
    if (timeSinceRedrawRef.current < 1 / quality.redrawsPerSecond) return
    timeSinceRedrawRef.current = 0

    const currentModel = modelRef.current
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = MARQUEE_BACKGROUND
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (currentModel) {
      const scrollOffsetPx = elapsedRef.current * SCROLL_PIXELS_PER_SECOND
      const statusFontSize = Math.round(canvas.height * 0.44)
      drawMarqueeRow(ctx, currentModel.statusLine, {
        canvasWidth: canvas.width,
        centerY: Math.round(canvas.height * 0.32),
        fontSize: statusFontSize,
        color: MARQUEE_RED,
        glow: quality.glow,
        scrollOffsetPx
      })

      const infoLineIndex = getMarqueeInfoLineIndex(elapsedRef.current, currentModel.infoLines.length)
      if (infoLineIndex >= 0) {
        drawMarqueeRow(ctx, currentModel.infoLines[infoLineIndex], {
          canvasWidth: canvas.width,
          centerY: Math.round(canvas.height * 0.78),
          fontSize: Math.round(canvas.height * 0.24),
          color: MARQUEE_RED,
          glow: false,
          scrollOffsetPx
        })
      }
    } else {
      // Unpowered panel: a dim standby dot so the display never reads as missing
      ctx.fillStyle = MARQUEE_RED_DIM
      ctx.fillRect(4, canvas.height - 8, 4, 4)
    }

    if (gridMask) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = ctx.createPattern(gridMask, 'repeat') as CanvasPattern
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = MARQUEE_BACKGROUND
      ctx.globalCompositeOperation = 'destination-over'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'source-over'
    }

    texture.needsUpdate = true
  })

  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[width + 0.5, height + 0.5, 0.9]} />
        <meshStandardMaterial color="#101010" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.47]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.47]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  )
}
