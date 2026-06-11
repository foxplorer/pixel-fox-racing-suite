import React, { memo } from 'react'

export type RacingControlsVariant = 'car' | 'snowmobile'

interface RacingControlsHelperProps {
  variant?: RacingControlsVariant
}

export const getGasControlLabel = (variant: RacingControlsVariant): string => {
  return variant === 'snowmobile' ? 'W / ↑ — Gas' : 'G / W / ↑ — Gas'
}

export const getCameraSnapLabel = (variant: RacingControlsVariant): string => {
  return variant === 'snowmobile' ? 'Ride to snap camera back.' : 'Drive to snap camera back.'
}

export const RacingControlsHelper = memo<RacingControlsHelperProps>(function RacingControlsHelper({
  variant = 'car'
}) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: 20,
      background: 'rgba(0, 0, 0, 0.6)',
      padding: '12px 16px',
      borderRadius: '8px',
      color: '#fff',
      maxWidth: '240px',
      fontSize: '12px',
      lineHeight: 1.6,
      fontFamily: 'monospace',
      border: '1px solid rgba(255,255,255,0.1)',
      pointerEvents: 'auto',
      userSelect: 'none'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '6px', letterSpacing: '0.1em' }}>
        Controls
      </div>
      <div>{getGasControlLabel(variant)}</div>
      <div>S / ↓ — Brake</div>
      <div>A / D / ← / → — Steer</div>
      <div>C — Toggle manual camera</div>
      <div style={{ color: '#888', fontSize: '11px' }}>
        (drag to orbit in manual mode)
      </div>
      <div style={{ color: '#4ECDC4', marginTop: '6px' }}>
        {getCameraSnapLabel(variant)}
      </div>
    </div>
  )
})
