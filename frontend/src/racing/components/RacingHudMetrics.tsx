import React, { memo } from 'react'
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
}

const metricTextShadow = '2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.5)'

export const RacingHudMetrics = memo<RacingHudMetricsProps>(function RacingHudMetrics({
  distanceTraveled,
  speed,
  showLapTime = false,
  lapTime = 0,
  lapTimes,
  lapTxids = {},
  lapListMarginTop
}) {
  const hasLapList = Boolean(lapTimes)

  return (
    <div style={{ position: 'absolute', top: 20, right: 20, textAlign: 'right', userSelect: 'none' }}>
      <div style={{
        fontSize: '28px',
        fontWeight: 'bold',
        color: '#ffffff',
        fontFamily: 'monospace',
        marginBottom: '8px',
        textShadow: metricTextShadow
      }}>
        {Math.floor(distanceTraveled)} m
      </div>
      {showLapTime && (
        <div style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#ffffff',
          fontFamily: 'monospace',
          marginBottom: '8px',
          textShadow: metricTextShadow
        }}>
          {formatLapTime(lapTime)}
        </div>
      )}
      <div style={{
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#ffffff',
        fontFamily: 'monospace',
        ...(hasLapList ? { marginBottom: '12px' } : {}),
        textShadow: metricTextShadow
      }}>
        {Math.round(speed * 3.6)} km/h
      </div>
      {lapTimes && (
        <RacingLapTimesList lapTimes={lapTimes} lapTxids={lapTxids} marginTop={lapListMarginTop} />
      )}
    </div>
  )
})
