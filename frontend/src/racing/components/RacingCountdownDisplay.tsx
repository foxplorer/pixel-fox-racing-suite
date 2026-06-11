import React, { memo } from 'react'

type RacingCountdownVariant = 'default' | 'snowmobile'

interface RacingCountdownDisplayProps {
  countdown: number
  variant?: RacingCountdownVariant
}

export const getCountdownColor = (countdown: number): string => {
  if (countdown === 1) return '#ff6b6b'
  if (countdown === 2) return '#F7DC6F'
  return '#4ECDC4'
}

export const RacingCountdownDisplay = memo<RacingCountdownDisplayProps>(function RacingCountdownDisplay({
  countdown,
  variant = 'default'
}) {
  const isSnowmobile = variant === 'snowmobile'

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      fontSize: '120px',
      fontWeight: 'bold',
      color: getCountdownColor(countdown),
      textShadow: isSnowmobile
        ? '0 0 30px rgba(255,255,255,0.5), 0 0 60px rgba(0,0,0,0.8)'
        : '0 0 20px rgba(255,255,255,0.5)',
      ...(isSnowmobile ? {
        fontFamily: 'monospace',
        userSelect: 'none' as const,
        pointerEvents: 'none' as const
      } : {})
    }}>
      {countdown}
    </div>
  )
})
