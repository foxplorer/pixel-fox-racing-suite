import React, { memo } from 'react'
import { RacingColorPicker } from './RacingColorPicker'

interface SnowmobileShowroomControlsProps {
  playerColor: string
  onColorChange: (color: string) => void
  onEnterRide?: () => void
}

export const SnowmobileShowroomControls = memo<SnowmobileShowroomControlsProps>(function SnowmobileShowroomControls({
  playerColor,
  onColorChange,
  onEnterRide
}) {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 50
    }}>
      <div style={{
        position: 'absolute',
        top: 220,
        left: 10,
        background: 'rgba(13, 31, 51, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '24px 32px',
        borderRadius: '12px',
        border: '1px solid rgba(135, 206, 235, 0.3)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
        pointerEvents: 'auto',
        minWidth: '320px',
        textAlign: 'left'
      }}>
        <div style={{
          fontSize: '11px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#87CEEB',
          marginBottom: '16px'
        }}>
          CUSTOMIZE YOUR RIDE
        </div>

        <div style={{
          fontSize: '11px',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#888',
          marginBottom: '10px'
        }}>
          SLED COLOR
        </div>

        <RacingColorPicker
          selectedColor={playerColor}
          onColorChange={onColorChange}
          className=""
          gap="12px"
          marginBottom="24px"
          swatchSize="36px"
          swatchRadius="6px"
          selectedBorderWidth="3px"
          selectedBoxShadow="0 0 12px rgba(255,255,255,0.4)"
          enableHoverScale
        />

        <button
          onClick={onEnterRide}
          style={{
            width: '100%',
            padding: '14px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            letterSpacing: '0.1em',
            background: '#87CEEB',
            color: '#0d1f33',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = '#a8daef'
            event.currentTarget.style.transform = 'translateY(-2px)'
            event.currentTarget.style.boxShadow = '0 4px 16px rgba(135, 206, 235, 0.5)'
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = '#87CEEB'
            event.currentTarget.style.transform = 'translateY(0)'
            event.currentTarget.style.boxShadow = 'none'
          }}
        >
          START RIDING
        </button>
      </div>
    </div>
  )
})
