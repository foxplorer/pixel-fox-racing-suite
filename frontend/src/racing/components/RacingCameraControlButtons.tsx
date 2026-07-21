import React, { memo } from 'react'
import { useRacingDeviceProfile } from '../platform/useRacingDeviceProfile'

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
  const { prefersMobileRacingUi, isLandscape } = useRacingDeviceProfile()
  if (prefersMobileRacingUi && !isLandscape) return null

  const buttonStyle: React.CSSProperties = prefersMobileRacingUi
    ? {
        ...controlButtonStyle,
        width: '42px',
        height: '42px',
        borderRadius: '10px',
        background: 'rgba(0, 0, 0, 0.58)',
        backdropFilter: 'blur(6px)'
      }
    : controlButtonStyle
  const activeButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: 'rgba(54, 191, 250, 0.6)'
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: prefersMobileRacingUi ? 'auto' : bottom,
      top: prefersMobileRacingUi ? 'calc(env(safe-area-inset-top, 0px) + 74px)' : undefined,
      right: prefersMobileRacingUi ? 'calc(env(safe-area-inset-right, 0px) + 10px)' : right,
      transform: undefined,
      display: prefersMobileRacingUi ? 'grid' : 'flex',
      gridTemplateColumns: prefersMobileRacingUi ? 'repeat(2, 42px)' : undefined,
      flexDirection: 'column',
      gap: prefersMobileRacingUi ? '6px' : '5px',
      zIndex,
      pointerEvents: 'auto'
    }}>
      {isManualCamera && (
        <>
          <button onClick={onZoomIn} style={buttonStyle} title="Zoom In">+</button>
          <button onClick={onZoomOut} style={buttonStyle} title="Zoom Out">−</button>
          <button onClick={onRotateLeft} style={buttonStyle} title="Rotate Left">↶</button>
          <button onClick={onRotateRight} style={buttonStyle} title="Rotate Right">↷</button>
        </>
      )}

      <button
        onClick={onToggleManualCamera}
        style={isManualCamera ? activeButtonStyle : buttonStyle}
        title={isManualCamera ? 'Switch to Follow Camera' : 'Switch to Manual Camera'}
      >
        C
      </button>

      {onToggleFullscreen && (
        <button
          onClick={onToggleFullscreen}
          style={buttonStyle}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? '⊠' : '⛶'}
        </button>
      )}
    </div>
  )
})
