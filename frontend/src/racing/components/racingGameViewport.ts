import type React from 'react'

export type RacingGameViewportStatus = 'idle' | 'showroom' | string

export interface RacingGameViewportOptions {
  // Mobile browsers overlay retracting chrome on `vh`; `dvh` tracks the visible
  // viewport, and the desktop max-height clamp would fight fullscreen racing.
  useMobileViewportUnits?: boolean
}

export const getCarRacingGameViewportStyle = (
  gameStatus: RacingGameViewportStatus,
  options: RacingGameViewportOptions = {}
): React.CSSProperties => {
  if (options.useMobileViewportUnits) {
    return {
      width: '100%',
      height: gameStatus === 'idle' ? '80dvh' : '100dvh',
      maxHeight: 'none',
      position: 'relative',
      backgroundColor: '#000',
      margin: '0 auto',
      overscrollBehavior: 'none'
    }
  }

  return {
    width: '100%',
    height: gameStatus === 'idle' ? '80vh' : gameStatus === 'showroom' ? '100vh' : '90vh',
    maxHeight: gameStatus === 'idle' ? 'none' : gameStatus === 'showroom' ? 'none' : '900px',
    position: 'relative',
    backgroundColor: '#000',
    margin: '0 auto'
  }
}
