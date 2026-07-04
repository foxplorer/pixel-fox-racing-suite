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
  const isFinalCountdown = countdown <= 3
  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60
  const label = isFinalCountdown
    ? String(countdown)
    : `RACE STARTS IN ${minutes}:${seconds.toString().padStart(2, '0')}`

  if (!isFinalCountdown) {
    // Red digital marquee styling to match the start gate LED board
    return (
      <div style={{
        position: 'absolute',
        top: '18%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '30px',
        fontWeight: 'bold',
        fontFamily: '"Courier New", monospace',
        letterSpacing: '0.14em',
        color: '#ff2200',
        background: 'rgba(11, 3, 2, 0.88)',
        border: '2px solid #2b1310',
        borderRadius: '2px',
        boxShadow: 'inset 0 0 18px rgba(0,0,0,0.9), 0 0 22px rgba(255,34,0,0.28)',
        padding: '10px 18px',
        whiteSpace: 'nowrap',
        textShadow: '0 0 8px rgba(255,60,0,0.85), 0 0 22px rgba(255,34,0,0.45)',
        userSelect: 'none',
        pointerEvents: 'none'
      }}>
        {label}
      </div>
    )
  }

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      fontSize: '120px',
      fontWeight: 'bold',
      color: getCountdownColor(countdown),
      whiteSpace: 'nowrap',
      textShadow: isSnowmobile
        ? '0 0 30px rgba(255,255,255,0.5), 0 0 60px rgba(0,0,0,0.8)'
        : '0 0 20px rgba(255,255,255,0.5)',
      ...(isSnowmobile ? {
        fontFamily: 'monospace',
        userSelect: 'none' as const,
        pointerEvents: 'none' as const
      } : {})
    }}>
      {label}
    </div>
  )
})
