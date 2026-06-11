import React, { memo } from 'react'
import { PulseLoader } from 'react-spinners'
import { formatLapTime, shortenTxid } from './hudFormat'

interface RacingLapTimesListProps {
  lapTimes: number[]
  lapTxids: { [index: number]: string }
  marginTop?: string
}

export const RacingLapTimesList = memo<RacingLapTimesListProps>(function RacingLapTimesList({
  lapTimes,
  lapTxids,
  marginTop = '12px'
}) {
  if (lapTimes.length === 0) return null

  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.6)',
      padding: '12px 16px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.1)',
      marginTop,
      minWidth: '180px'
    }}>
      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', marginBottom: '8px', letterSpacing: '0.1em' }}>
        LAP TIMES
      </div>
      {lapTimes.map((time, index) => {
        const txid = lapTxids[index]

        return (
          <div key={index} style={{
            fontSize: '14px',
            color: index === lapTimes.length - 1 ? '#F7DC6F' : '#fff',
            fontFamily: 'monospace',
            marginBottom: '4px'
          }}>
            <div>Lap {index + 1}: {formatLapTime(time)}</div>
            {txid ? (
              <div style={{
                fontSize: '11px',
                color: '#4ECDC4',
                marginTop: '2px',
                opacity: 0.8
              }}>
                {shortenTxid(txid)}
              </div>
            ) : (
              <div style={{ marginTop: '2px' }}>
                <PulseLoader color="#ffffff" size={4} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
})
