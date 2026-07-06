import React, { memo, type ReactNode } from 'react'
import { formatLapTime } from './hudFormat'
import { RacingLapTimesList } from './RacingLapTimesList'

interface RacingHudMetricsProps {
  distanceTraveled: number
  speed: number
  showLapTime?: boolean
  lapTime?: number
  lapTimes?: number[]
  lapTxids?: { [index: number]: string }
  lapListMarginTop?: string
  lapListReplacement?: ReactNode
  // Mobile racing: smaller type, safe-area offsets, and no lap-history list —
  // only lap/time/speed (and standings, when racing multiplayer) stay up.
  compact?: boolean
}

const metricTextShadow = '2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.5)'

export const RacingHudMetrics = memo<RacingHudMetricsProps>(function RacingHudMetrics({
  distanceTraveled,
  speed,
  showLapTime = false,
  lapTime = 0,
  lapTimes,
  lapTxids = {},
  lapListMarginTop,
  lapListReplacement,
  compact = false
}) {
  const hasLapList = compact ? Boolean(lapListReplacement) : (Boolean(lapTimes) || Boolean(lapListReplacement))
  const metricStyle = (fontSize: string, compactFontSize: string, marginBottom?: string): React.CSSProperties => ({
    fontSize: compact ? compactFontSize : fontSize,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'monospace',
    ...(marginBottom ? { marginBottom: compact ? '4px' : marginBottom } : {}),
    textShadow: metricTextShadow
  })

  return (
    <div style={{
      position: 'absolute',
      top: compact ? 'calc(env(safe-area-inset-top, 0px) + 12px)' : 20,
      right: compact ? 'calc(env(safe-area-inset-right, 0px) + 12px)' : 20,
      textAlign: 'right',
      userSelect: 'none'
    }}>
      <div style={metricStyle('28px', '16px', '8px')}>
        {Math.floor(distanceTraveled)} m
      </div>
      {showLapTime && (
        <div style={metricStyle('24px', '16px', '8px')}>
          {formatLapTime(lapTime)}
        </div>
      )}
      <div style={{
        ...metricStyle('20px', '14px'),
        ...(hasLapList ? { marginBottom: compact ? '6px' : '12px' } : {})
      }}>
        {Math.round(speed * 3.6)} km/h
      </div>
      {lapListReplacement ?? (!compact && lapTimes && (
        <RacingLapTimesList lapTimes={lapTimes} lapTxids={lapTxids} marginTop={lapListMarginTop} />
      ))}
    </div>
  )
})
