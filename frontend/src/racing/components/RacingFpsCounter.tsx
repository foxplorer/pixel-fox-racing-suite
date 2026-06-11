import React, { memo, useEffect, useRef, useState } from 'react'

interface RacingFpsCounterProps {
  top?: number
  right?: number | string
  left?: number | string
  position?: 'absolute' | 'fixed' | 'static'
  transform?: string
  zIndex?: number
}

const getFpsColor = (fps: number): string => {
  if (fps >= 50) return '#4ade80'
  if (fps >= 30) return '#fbbf24'
  return '#f87171'
}

export const RacingFpsCounter = memo<RacingFpsCounterProps>(function RacingFpsCounter({
  top = 138,
  right = 20,
  left,
  position = 'absolute',
  transform,
  zIndex
}) {
  const [fps, setFps] = useState(0)
  const framesRef = useRef(0)
  const lastTimeRef = useRef(performance.now())

  useEffect(() => {
    let animationId: number

    const countFrame = () => {
      framesRef.current++
      animationId = requestAnimationFrame(countFrame)
    }

    const updateFps = setInterval(() => {
      const now = performance.now()
      const delta = now - lastTimeRef.current
      const currentFps = Math.round((framesRef.current * 1000) / delta)
      setFps(currentFps)
      framesRef.current = 0
      lastTimeRef.current = now
    }, 500)

    animationId = requestAnimationFrame(countFrame)

    return () => {
      cancelAnimationFrame(animationId)
      clearInterval(updateFps)
    }
  }, [])

  return (
    <div style={{
      position,
      top,
      right,
      left,
      transform,
      background: 'rgba(0, 0, 0, 0.6)',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '12px',
      fontFamily: 'monospace',
      border: '1px solid rgba(255,255,255,0.1)',
      userSelect: 'none',
      zIndex,
      textAlign: 'center',
      color: getFpsColor(fps)
    }}>
      FPS: {fps}
    </div>
  )
})
