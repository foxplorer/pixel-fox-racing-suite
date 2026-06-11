import React, { memo } from 'react'

export type RacingCameraMode = 'simple' | 'smooth' | 'damped' | 'targetsmooth' | 'velocity'

interface RacingCameraModeSelectorProps<TCameraMode extends RacingCameraMode = RacingCameraMode> {
  cameraMode: TCameraMode
  onCameraModeChange: (mode: TCameraMode) => void
  top?: number
  left?: number
}

export const RACING_CAMERA_MODES: RacingCameraMode[] = ['simple', 'smooth', 'damped', 'targetsmooth', 'velocity']

export const formatCameraModeLabel = (mode: RacingCameraMode): string => {
  return mode === 'targetsmooth' ? 'Target Smooth' : mode
}

export const RacingCameraModeSelector = memo(function RacingCameraModeSelector<TCameraMode extends RacingCameraMode = RacingCameraMode>({
  cameraMode,
  onCameraModeChange,
  top = 200,
  left = 20
}: RacingCameraModeSelectorProps<TCameraMode>) {
  return (
    <div style={{
      position: 'absolute',
      top,
      left,
      background: 'rgba(0, 0, 0, 0.6)',
      padding: '12px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.1)',
      pointerEvents: 'auto',
      userSelect: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 60
    }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: '4px',
        letterSpacing: '0.1em',
        textTransform: 'uppercase'
      }}>
        Camera
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {RACING_CAMERA_MODES.map((mode) => (
          <button
            key={mode}
            onClick={() => onCameraModeChange(mode as TCameraMode)}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontFamily: 'monospace',
              background: cameraMode === mode ? 'rgba(78, 205, 196, 0.3)' : 'rgba(255, 255, 255, 0.1)',
              border: cameraMode === mode ? '1px solid #4ECDC4' : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (cameraMode !== mode) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
              }
            }}
            onMouseLeave={(e) => {
              if (cameraMode !== mode) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              }
            }}
          >
            {formatCameraModeLabel(mode)}
          </button>
        ))}
      </div>
    </div>
  )
})
