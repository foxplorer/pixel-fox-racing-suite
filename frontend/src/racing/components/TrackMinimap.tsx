import React, { memo, useRef, useEffect, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import {
  DEFAULT_MINIMAP_TRACK_DRAW_SAMPLES,
  getMinimapTrackBounds,
  hasMinimapPositionChanged,
  shouldDrawMinimapVehicleFrame,
  type MinimapWorldPosition,
  worldToMinimapCanvas
} from './minimapGeometry'

export type TrackMinimapPosition = 'top-right' | 'middle-left' | 'bottom-right'

interface TrackMinimapProps {
  vehiclePosition: MinimapWorldPosition | null
  trackCurve: THREE.CatmullRomCurve3
  startFinishPosition: THREE.Vector3
  width?: number
  height?: number
  trackLocation?: string | null
  position?: TrackMinimapPosition
  updateEveryFrames?: number
}

const areMinimapPositionsEquivalent = (
  previous: MinimapWorldPosition | null,
  next: MinimapWorldPosition | null
): boolean => {
  if (previous === next) return true
  if (!previous || !next) return false
  return !hasMinimapPositionChanged(next, previous)
}

export const TrackMinimap = memo<TrackMinimapProps>(function TrackMinimap({
  vehiclePosition,
  trackCurve,
  startFinishPosition,
  width = 200,
  height = 200,
  trackLocation = null,
  position = 'bottom-right',
  updateEveryFrames = 1
}) {
  const normalizedUpdateEveryFrames = Math.max(1, Math.floor(updateEveryFrames))
  const trackBounds = useMemo(() => {
    return getMinimapTrackBounds(trackCurve)
  }, [trackCurve])

  const worldToCanvas = useCallback((x: number, z: number) => {
    return worldToMinimapCanvas(x, z, { width, height, bounds: trackBounds })
  }, [width, height, trackBounds])

  const trackCanvasRef = useRef<HTMLCanvasElement>(null)
  const vehicleCanvasRef = useRef<HTMLCanvasElement>(null)
  const lastVehiclePositionRef = useRef<MinimapWorldPosition | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const skippedVehicleFrameCountRef = useRef(0)

  useEffect(() => {
    const canvas = trackCanvasRef.current
    if (!canvas || !trackCurve) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = '#666'
    ctx.lineWidth = 2
    ctx.beginPath()

    const samples = DEFAULT_MINIMAP_TRACK_DRAW_SAMPLES
    for (let index = 0; index <= samples; index++) {
      const point = trackCurve.getPointAt(index / samples)
      const canvasPos = worldToCanvas(point.x, point.z)

      if (index === 0) {
        ctx.moveTo(canvasPos.x, canvasPos.y)
      } else {
        ctx.lineTo(canvasPos.x, canvasPos.y)
      }
    }

    if (trackCurve.closed) {
      ctx.closePath()
    }

    ctx.stroke()

    ctx.fillStyle = 'rgba(100, 100, 100, 0.3)'
    ctx.fill()

    const startFinishCanvasPos = worldToCanvas(startFinishPosition.x, startFinishPosition.z)
    const flagSize = 12
    const squares = 4

    for (let i = 0; i < squares; i++) {
      for (let j = 0; j < squares; j++) {
        const isBlack = (i + j) % 2 === 0
        ctx.fillStyle = isBlack ? '#000000' : '#FFFFFF'
        ctx.fillRect(
          startFinishCanvasPos.x - flagSize / 2 + (i * flagSize / squares),
          startFinishCanvasPos.y - flagSize / 2 + (j * flagSize / squares),
          flagSize / squares,
          flagSize / squares
        )
      }
    }

    lastVehiclePositionRef.current = null
  }, [trackCurve, width, height, trackBounds, worldToCanvas, startFinishPosition])

  useEffect(() => {
    const vehicleCanvas = vehicleCanvasRef.current
    if (!vehicleCanvas || !trackCurve) return

    const ctx = vehicleCanvas.getContext('2d')
    if (!ctx) return

    const frameDecision = shouldDrawMinimapVehicleFrame({
      vehiclePosition,
      lastVehiclePosition: lastVehiclePositionRef.current,
      skippedFrameCount: skippedVehicleFrameCountRef.current,
      updateEveryFrames: normalizedUpdateEveryFrames
    })
    skippedVehicleFrameCountRef.current = frameDecision.nextSkippedFrameCount

    if (!frameDecision.shouldDraw) {
      return
    }

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      ctx.clearRect(0, 0, width, height)

      if (vehiclePosition) {
        const vehicleCanvasPos = worldToCanvas(vehiclePosition.x, vehiclePosition.z)

        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
        ctx.shadowBlur = 3
        ctx.shadowOffsetX = 1
        ctx.shadowOffsetY = 1

        ctx.fillStyle = '#36bffa'
        ctx.beginPath()
        ctx.arc(vehicleCanvasPos.x, vehicleCanvasPos.y, 5, 0, Math.PI * 2)
        ctx.fill()

        ctx.shadowBlur = 0
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.stroke()

        lastVehiclePositionRef.current = { ...vehiclePosition }
      } else {
        lastVehiclePositionRef.current = null
      }

      animationFrameRef.current = null
    })

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [vehiclePosition, trackCurve, worldToCanvas, width, height, normalizedUpdateEveryFrames])

  const isCompact = width <= 120 || height <= 120
  const positionStyles = position === 'top-right'
    ? {
        // Compact (mobile) top-right sits BELOW the camera control cluster (C + fullscreen), which
        // is anchored at safe-area-top + 74px. 124px clears that single button row so the minimap
        // tucks under those squares on the right, as requested.
        top: isCompact ? 'calc(env(safe-area-inset-top, 0px) + 124px)' : '20px',
        right: isCompact ? 'calc(env(safe-area-inset-right, 0px) + 10px)' : '20px',
        bottom: 'auto',
        left: 'auto',
        transform: 'none'
      }
    : position === 'middle-left'
      ? {
          top: '50%',
          left: isCompact ? 'calc(env(safe-area-inset-left, 0px) + 10px)' : '20px',
          right: 'auto',
          bottom: 'auto',
          transform: 'translateY(-50%)'
        }
      : {
          bottom: isCompact ? 'calc(env(safe-area-inset-bottom, 0px) + 10px)' : '20px',
          right: isCompact ? 'calc(env(safe-area-inset-right, 0px) + 10px)' : '20px',
          top: 'auto',
          left: 'auto',
          transform: 'none'
        }

  return (
    <div style={{
      position: 'absolute',
      ...positionStyles,
      minWidth: `${width}px`,
      zIndex: 100,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: isCompact ? 0 : '0 10px'
    }}>
      {/* Desktop: the name sits as a header above the map. Compact (mobile) has no room above,
          so it is drawn as an overlay across the top of the map itself instead (see below). */}
      {trackLocation && !isCompact && (
        <h3 style={{
          margin: '0 0 8px 0',
          padding: '0 5px',
          color: '#fff',
          fontSize: '20px',
          fontWeight: 'bold',
          textAlign: 'center',
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
          whiteSpace: 'nowrap'
        }}>
          {trackLocation}
        </h3>
      )}
      <div style={{
        position: 'relative',
        width: `${width}px`,
        height: `${height}px`,
        minWidth: `${width}px`,
        minHeight: `${height}px`,
        border: '1px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '8px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        {trackLocation && isCompact && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            padding: '3px 4px',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '0.02em',
            textAlign: 'center',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.9)',
            background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0))',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            pointerEvents: 'none'
          }}>
            {trackLocation}
          </div>
        )}
        <canvas
          ref={trackCanvasRef}
          width={width}
          height={height}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            display: 'block',
            width: `${width}px`,
            height: `${height}px`
          }}
        />
        <canvas
          ref={vehicleCanvasRef}
          width={width}
          height={height}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            display: 'block',
            width: `${width}px`,
            height: `${height}px`
          }}
        />
      </div>
    </div>
  )
}, (previous, next) => (
  previous.trackCurve === next.trackCurve &&
  previous.startFinishPosition === next.startFinishPosition &&
  previous.width === next.width &&
  previous.height === next.height &&
  previous.trackLocation === next.trackLocation &&
  previous.position === next.position &&
  previous.updateEveryFrames === next.updateEveryFrames &&
  areMinimapPositionsEquivalent(previous.vehiclePosition, next.vehiclePosition)
))
