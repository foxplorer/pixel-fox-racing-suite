import type React from 'react'

export type RacingGameViewportStatus = 'idle' | 'showroom' | string

export const getCarRacingGameViewportStyle = (
  gameStatus: RacingGameViewportStatus
): React.CSSProperties => ({
  width: '100%',
  height: gameStatus === 'idle' ? '80vh' : gameStatus === 'showroom' ? '100vh' : '90vh',
  maxHeight: gameStatus === 'idle' ? 'none' : gameStatus === 'showroom' ? 'none' : '900px',
  position: 'relative',
  backgroundColor: '#000',
  margin: '0 auto'
})
