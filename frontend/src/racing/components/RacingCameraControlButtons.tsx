import React, { memo } from 'react'

interface RacingCameraControlButtonsProps {
  isManualCamera: boolean
  isFullscreen?: boolean
  onToggleManualCamera: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onRotateLeft: () => void
  onRotateRight: () => void
  onToggleFullscreen?: () => void
  bottom?: number | string
  right?: number | string
  zIndex?: number
}

const controlButtonStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.6)',
  border: '2px solid rgba(255,255,255,0.3)',
  borderRadius: '8px',
  color: '#ffffff',
  width: '36px',
  height: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  outline: 'none',
  padding: 0,
  fontSize: '18px',
  fontWeight: 'bold'
}

export const RacingCameraControlButtons = memo<RacingCameraControlButtonsProps>(function RacingCameraControlButtons({
  isManualCamera,
  isFullscreen = false,
  onToggleManualCamera,
  onZoomIn,
  onZoomOut,
  onRotateLeft,
  onRotateRight,
  onToggleFullscreen,
  bottom = '270px',
  right = '20px',
  zIndex = 150
}) {
  return (
    <div style={{
      position: 'absolute',
      bottom,
      right,
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      zIndex
    }}>
      {isManualCamera && (
        <>
          <button onClick={onZoomIn} style={controlButtonStyle} title="Zoom In">+</button>
          <button onClick={onZoomOut} style={controlButtonStyle} title="Zoom Out">−</button>
          <button onClick={onRotateLeft} style={controlButtonStyle} title="Rotate Left">↶</button>
          <button onClick={onRotateRight} style={controlButtonStyle} title="Rotate Right">↷</button>
        </>
      )}

      <button
        onClick={onToggleManualCamera}
        style={isManualCamera ? {
          ...controlButtonStyle,
          background: 'rgba(54, 191, 250, 0.6)'
        } : controlButtonStyle}
        title={isManualCamera ? 'Switch to Follow Camera' : 'Switch to Manual Camera'}
      >
        C
      </button>

      {onToggleFullscreen && (
        <button
          onClick={onToggleFullscreen}
          style={controlButtonStyle}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? '⊠' : '⛶'}
        </button>
      )}
    </div>
  )
})
