import React, { memo } from 'react'
import {
  RACING_QUALITY_PRESETS,
  type RacingQualityPresetId
} from '../performance/qualitySettings'

interface RacingQualitySelectorProps {
  selectedPresetId: RacingQualityPresetId
  onPresetChange: (presetId: RacingQualityPresetId) => void
  layout?: 'horizontal' | 'vertical'
  compact?: boolean
  allowedPresetIds?: RacingQualityPresetId[]
  theme?: 'racing' | 'courier'
}

const QUALITY_PRESET_IDS: RacingQualityPresetId[] = ['mobile', 'low', 'medium', 'high']

export const RacingQualitySelector = memo<RacingQualitySelectorProps>(function RacingQualitySelector({
  selectedPresetId,
  onPresetChange,
  layout = 'horizontal',
  compact = false,
  allowedPresetIds,
  theme = 'racing'
}) {
  const isVertical = layout === 'vertical'
  const presetIds = allowedPresetIds ?? QUALITY_PRESET_IDS

  return (
    <div style={{ marginBottom: isVertical ? 0 : compact ? '10px' : '15px' }}>
      <label style={{
        display: 'block',
        color: '#fff',
        marginBottom: isVertical ? '12px' : compact ? '5px' : '8px',
        fontSize: isVertical ? '11px' : compact ? '12px' : '14px',
        fontWeight: 'bold',
        letterSpacing: isVertical ? '0.1em' : 0,
        textTransform: isVertical ? 'uppercase' : 'none'
      }}>
        Quality
      </label>
      <div
        role="group"
        aria-label="Graphics quality"
        style={{
          display: isVertical ? 'flex' : 'grid',
          flexDirection: isVertical ? 'column' : undefined,
          gridTemplateColumns: isVertical ? undefined : `repeat(${presetIds.length}, 1fr)`,
          gap: isVertical ? '4px' : '6px',
          width: '100%'
        }}
      >
        {presetIds.map(presetId => {
          const preset = RACING_QUALITY_PRESETS[presetId]
          const isSelected = selectedPresetId === presetId
          return (
            <button
              key={presetId}
              type="button"
              onClick={() => onPresetChange(presetId)}
              aria-pressed={isSelected}
              style={{
                height: isVertical ? undefined : compact ? '30px' : '34px',
                padding: isVertical ? '6px 12px' : undefined,
                borderRadius: isVertical ? '4px' : '6px',
                border: isSelected ? (isVertical ? '1px solid #4ECDC4' : '2px solid #fff') : (isVertical ? '1px solid rgba(255, 255, 255, 0.2)' : '2px solid rgba(255,255,255,0.2)'),
                background: isSelected ? (isVertical ? 'rgba(78, 205, 196, 0.3)' : 'rgba(255,255,255,0.2)') : (isVertical ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0,0,0,0.45)'),
                color: '#fff',
                cursor: 'pointer',
                fontSize: isVertical ? '11px' : compact ? '11px' : '13px',
                fontFamily: 'monospace',
                fontWeight: isSelected ? 'bold' : 'normal',
                textTransform: isVertical ? 'capitalize' : 'none',
                whiteSpace: 'nowrap'
              }}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
    </div>
  )
})
