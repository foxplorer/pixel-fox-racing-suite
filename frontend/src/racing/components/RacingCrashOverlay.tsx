import React, { memo } from 'react'

interface RacingCrashOverlayProps {
  score: number
  onRestart: () => void
  title?: string
  description?: string
  restartLabel?: string
}

export const RacingCrashOverlay = memo<RacingCrashOverlayProps>(function RacingCrashOverlay({
  score,
  onRestart,
  title = 'CRASHED!',
  description = 'You fell off the track.',
  restartLabel = 'Race Again'
}) {
  return (
    <div className="join-overlay" style={{ pointerEvents: 'auto' }}>
      <div className="join-modal modern">
        <div className="join-modal-header" style={{ textAlign: 'center' }}>
          <h3 style={{ color: '#ff6b6b', fontSize: '32px' }}>{title}</h3>
          <p className="join-description">{description}</p>
          <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#fff', margin: '20px 0' }}>
            {Math.floor(score)} m
          </div>
          <button onClick={onRestart} className="join-button neon">
            {restartLabel}
          </button>
        </div>
      </div>
    </div>
  )
})
