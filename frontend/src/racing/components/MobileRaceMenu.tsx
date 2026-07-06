import React, { memo, useState } from 'react'

interface MobileRaceMenuProps {
  canLeaveRace: boolean
  onEnterShowroom?: () => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onAnyInteraction?: () => void
}

const MENU_ITEM_STYLE: React.CSSProperties = {
  height: '40px',
  padding: '0 14px',
  borderRadius: '8px',
  border: '1px solid rgba(255, 255, 255, 0.22)',
  background: 'rgba(255, 255, 255, 0.08)',
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.02em',
  cursor: 'pointer',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation'
}

// Mobile fullscreen has no surrounding page, so without this menu the player
// has no way out of a race (MOBILE_MODE_PLAN.md → Racing UI Changes).
// "Switch track" routes through the showroom track selector by design.
export const MobileRaceMenu = memo<MobileRaceMenuProps>(function MobileRaceMenu({
  canLeaveRace,
  onEnterShowroom,
  isFullscreen,
  onToggleFullscreen,
  onAnyInteraction
}) {
  const [isOpen, setIsOpen] = useState(false)

  const handleItemSelect = (action?: () => void) => () => {
    setIsOpen(false)
    action?.()
  }

  return (
    <div
      onPointerDown={() => onAnyInteraction?.()}
      style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
        zIndex: 95,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}
    >
      <button
        type="button"
        aria-label={isOpen ? 'Close race menu' : 'Open race menu'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.28)',
          background: 'rgba(0, 0, 0, 0.62)',
          color: '#fff',
          fontSize: '18px',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation'
        }}
      >
        {isOpen ? '✕' : '☰'}
      </button>

      {isOpen && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          padding: '8px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          background: 'rgba(0, 0, 0, 0.78)',
          backdropFilter: 'blur(10px)'
        }}>
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={handleItemSelect(onToggleFullscreen)}
              style={MENU_ITEM_STYLE}
            >
              {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            </button>
          )}
          {canLeaveRace && onEnterShowroom && (
            <button
              type="button"
              onClick={handleItemSelect(onEnterShowroom)}
              title="Pick a different track from the showroom"
              style={MENU_ITEM_STYLE}
            >
              Switch Track
            </button>
          )}
          {canLeaveRace && onEnterShowroom && (
            <button
              type="button"
              onClick={handleItemSelect(onEnterShowroom)}
              style={MENU_ITEM_STYLE}
            >
              Exit to Showroom
            </button>
          )}
        </div>
      )}
    </div>
  )
})
