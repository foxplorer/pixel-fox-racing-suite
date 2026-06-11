import React, { memo } from 'react'
import { PLAYER_COLORS } from '../core/playerColors'

interface RacingColorPickerProps {
  selectedColor: string
  onColorChange: (color: string) => void
  className?: string
  gap?: string
  marginBottom?: string
  swatchSize?: string
  swatchRadius?: string
  selectedBorderWidth?: string
  selectedBoxShadow?: string
  enableHoverScale?: boolean
}

export const RacingColorPicker = memo<RacingColorPickerProps>(function RacingColorPicker({
  selectedColor,
  onColorChange,
  className = 'color-picker',
  gap = '10px',
  marginBottom = '15px',
  swatchSize = '30px',
  swatchRadius = '4px',
  selectedBorderWidth = '2px',
  selectedBoxShadow = 'none',
  enableHoverScale = false
}) {
  return (
    <div
      className={className}
      style={{
        marginBottom,
        display: 'flex',
        justifyContent: 'center',
        gap
      }}
    >
      {PLAYER_COLORS.map(color => (
        <div
          key={color}
          className={`color-option ${selectedColor === color ? 'selected' : ''}`}
          style={{
            backgroundColor: color,
            width: swatchSize,
            height: swatchSize,
            cursor: 'pointer',
            borderRadius: swatchRadius,
            border: selectedColor === color ? `${selectedBorderWidth} solid #fff` : `${selectedBorderWidth} solid transparent`,
            boxShadow: selectedColor === color ? selectedBoxShadow : 'none',
            transition: enableHoverScale ? 'all 0.15s ease' : undefined
          }}
          onClick={() => onColorChange(color)}
          onMouseEnter={(event) => {
            if (enableHoverScale) {
              event.currentTarget.style.transform = 'scale(1.15)'
            }
          }}
          onMouseLeave={(event) => {
            if (enableHoverScale) {
              event.currentTarget.style.transform = 'scale(1)'
            }
          }}
        />
      ))}
    </div>
  )
})
