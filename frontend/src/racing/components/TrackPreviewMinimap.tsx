import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

interface TrackPreviewMinimapProps {
  trackCurve: THREE.CatmullRomCurve3
  trackName: string
  isSelected: boolean
  onClick: () => void
  width?: number
  height?: number
}

export const TrackPreviewMinimap: React.FC<TrackPreviewMinimapProps> = ({
  trackCurve,
  trackName,
  isSelected,
  onClick,
  width = 100,
  height = 100
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const trackBounds = useMemo(() => {
    const samples = 100
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity

    for (let i = 0; i <= samples; i++) {
      const point = trackCurve.getPointAt(i / samples)
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minZ = Math.min(minZ, point.z)
      maxZ = Math.max(maxZ, point.z)
    }

    const padding = 30
    minX -= padding
    maxX += padding
    minZ -= padding
    maxZ += padding

    const centerX = (minX + maxX) / 2
    const centerZ = (minZ + maxZ) / 2
    const range = Math.max(maxX - minX, maxZ - minZ)

    return { centerX, centerZ, range }
  }, [trackCurve])

  const padding = 8
  const worldToCanvas = useCallback((x: number, z: number) => {
    const drawWidth = width - (padding * 2)
    const drawHeight = height - (padding * 2)
    const scale = Math.min(drawWidth, drawHeight) / trackBounds.range
    const canvasX = width - (((x - trackBounds.centerX) * scale) + drawWidth / 2 + padding)
    const canvasY = height - (((z - trackBounds.centerZ) * scale) + drawHeight / 2 + padding)
    return { x: canvasX, y: canvasY }
  }, [height, trackBounds, width])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = isSelected ? '#4ECDC4' : '#888'
    ctx.lineWidth = isSelected ? 2.5 : 1.5
    ctx.beginPath()

    const samples = 80
    for (let i = 0; i <= samples; i++) {
      const point = trackCurve.getPointAt(i / samples)
      const canvasPos = worldToCanvas(point.x, point.z)

      if (i === 0) {
        ctx.moveTo(canvasPos.x, canvasPos.y)
      } else {
        ctx.lineTo(canvasPos.x, canvasPos.y)
      }
    }

    if (trackCurve.closed) {
      ctx.closePath()
    }

    ctx.stroke()
    ctx.fillStyle = isSelected ? 'rgba(78, 205, 196, 0.15)' : 'rgba(100, 100, 100, 0.2)'
    ctx.fill()
  }, [height, isSelected, trackCurve, width, worldToCanvas])

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        transition: 'transform 0.2s'
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = 'scale(1.05)'
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'scale(1)'
      }}
    >
      <div style={{
        width: `${width}px`,
        height: `${height}px`,
        border: isSelected ? '3px solid #4ECDC4' : '2px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: isSelected ? '0 0 15px rgba(78, 205, 196, 0.5)' : 'none',
        transition: 'all 0.2s'
      }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            display: 'block',
            width: `${width}px`,
            height: `${height}px`
          }}
        />
      </div>
      <span style={{
        marginTop: '4px',
        fontSize: '10px',
        fontWeight: isSelected ? 'bold' : 'normal',
        color: isSelected ? '#4ECDC4' : '#fff',
        textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
        lineHeight: 1.2
      }}>
        {trackName}
      </span>
    </div>
  )
}
