import React, { memo } from 'react'

// Shown above the game when a touch-first device is in portrait: real racing
// needs landscape, and orientation lock is best-effort at most on the web.
export const MobileOrientationOverlay = memo(function MobileOrientationOverlay() {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 200,
      pointerEvents: 'auto',
      display: 'grid',
      placeItems: 'center',
      background: 'rgba(0, 0, 0, 0.88)',
      backdropFilter: 'blur(4px)',
      textAlign: 'center',
      userSelect: 'none',
      WebkitUserSelect: 'none'
    }}>
      <div style={{ color: '#fff', fontFamily: 'monospace', padding: '0 24px' }}>
        <div aria-hidden="true" style={{ fontSize: '44px', marginBottom: '14px' }}>
          📱↻
        </div>
        <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.04em', marginBottom: '8px' }}>
          Rotate your device
        </div>
        <div style={{ fontSize: '12px', lineHeight: 1.5, color: '#c9c9c9' }}>
          Racing works best in landscape.
        </div>
      </div>
    </div>
  )
})
