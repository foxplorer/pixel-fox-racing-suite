import React, { memo } from 'react'

interface RacingOnlineBadgeProps {
  count: number
  top?: number
  right?: number
}

export const RacingOnlineBadge = memo<RacingOnlineBadgeProps>(function RacingOnlineBadge({
  count,
  top = 100,
  right = 20
}) {
  return (
    <div style={{
      position: 'absolute',
      top,
      right,
      background: 'rgba(0, 0, 0, 0.6)',
      padding: '8px 12px',
      borderRadius: '6px',
      color: '#fff',
      fontSize: '12px',
      fontFamily: 'monospace',
      border: '1px solid rgba(255,255,255,0.1)',
      userSelect: 'none'
    }}>
      {count} online
    </div>
  )
})
