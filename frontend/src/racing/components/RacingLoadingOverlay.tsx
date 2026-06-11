import React, { memo } from 'react'
import { PulseLoader } from 'react-spinners'

interface RacingLoadingOverlayProps {
  color?: string
  zIndex?: number
  label?: string
  spinnerMargin?: number
}

export const RacingLoadingOverlay = memo<RacingLoadingOverlayProps>(function RacingLoadingOverlay({
  color = '#ffffff',
  zIndex = 1000,
  label,
  spinnerMargin
}) {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      backgroundColor: '#000000',
      zIndex,
      display: 'flex',
      flexDirection: label ? 'column' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      userSelect: label ? 'none' : undefined,
      caretColor: label ? 'transparent' : undefined
    }}>
      <PulseLoader color={color} size={15} margin={spinnerMargin} />
      {label && (
        <div style={{
          marginTop: '20px',
          color,
          fontSize: '14px',
          fontFamily: 'monospace',
          letterSpacing: '0.1em'
        }}>
          {label}
        </div>
      )}
    </div>
  )
})
