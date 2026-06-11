import React, { useRef, useEffect, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import {
  DEFAULT_MINIMAP_TRACK_DRAW_SAMPLES,
  getMinimapTrackBounds,
  shouldDrawMinimapVehicleFrame,
  type MinimapWorldPosition,
  worldToMinimapCanvas
} from './minimapGeometry'

export type TrackMinimapPosition = 'top-right' | 'bottom-right'

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

export const TrackMinimap: React.FC<TrackMinimapProps> = ({
  vehiclePosition,
  trackCurve,
  startFinishPosition,
  width = 200,
  height = 200,
  trackLocation = null,
  position = 'bottom-right',
  updateEveryFrames = 1
}) => {
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

  const positionStyles = position === 'top-right'
    ? { top: '20px', right: '20px', bottom: 'auto' }
    : { bottom: '20px', right: '20px', top: 'auto' }

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
      padding: '0 10px'
    }}>
      {trackLocation && (
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
}
