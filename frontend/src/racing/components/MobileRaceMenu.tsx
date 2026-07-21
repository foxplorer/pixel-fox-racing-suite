import React, { memo } from 'react'
import { getOrdinalContentUrl } from '../transactions/ordinalLinks'

interface MobileRaceMenuProps {
  canLeaveRace: boolean
  onEnterShowroom?: () => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onAnyInteraction?: () => void
  foxName?: string | null
  foxOriginOutpoint?: string | null
}

const MENU_ITEM_STYLE: React.CSSProperties = {
  height: '34px',
  padding: '0 10px',
  borderRadius: '7px',
  border: '1px solid rgba(255, 255, 255, 0.22)',
  background: 'rgba(0, 0, 0, 0.58)',
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: 0,
  cursor: 'pointer',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
  backdropFilter: 'blur(8px)'
}

// Mobile fullscreen has no surrounding page, so without this menu the player
// has no way out of a race (MOBILE_MODE_PLAN.md → Racing UI Changes).
// "Switch track" routes through the showroom track selector by design.
export const MobileRaceMenu = memo<MobileRaceMenuProps>(function MobileRaceMenu({
  canLeaveRace,
  onEnterShowroom,
  isFullscreen,
  onToggleFullscreen,
  onAnyInteraction,
  foxName,
  foxOriginOutpoint
}) {
  const foxImageUrl = foxOriginOutpoint ? getOrdinalContentUrl(foxOriginOutpoint) : null

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
        alignItems: 'flex-start',
        gap: '6px'
      }}
    >
      {(foxImageUrl || foxName) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            maxWidth: '180px',
            minHeight: '40px',
            padding: '5px 8px 5px 5px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            background: 'rgba(0, 0, 0, 0.62)',
            color: '#fff',
            fontFamily: 'monospace',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 8px 20px rgba(0,0,0,0.24)'
          }}
        >
          {foxImageUrl && (
            <img
              src={foxImageUrl}
              alt={foxName ?? 'Pixel Fox'}
              style={{
                width: 30,
                height: 30,
                borderRadius: '5px',
                imageRendering: 'pixelated',
                objectFit: 'cover',
                flex: '0 0 auto'
              }}
            />
          )}
          <div style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '11px',
            fontWeight: 800,
            color: '#9BE7E0'
          }}>
            {foxName ?? 'Pixel Fox'}
          </div>
        </div>
      )}

      <div style={{
          display: 'flex',
          gap: '6px',
          flexWrap: 'nowrap',
          maxWidth: 'min(260px, calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px) - 24px))'
        }}
      >
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            style={MENU_ITEM_STYLE}
          >
            {isFullscreen ? 'Exit FS' : 'Full Screen'}
          </button>
        )}
        {canLeaveRace && onEnterShowroom && (
          <button
            type="button"
            onClick={onEnterShowroom}
            title="Pick a different track from the showroom"
            style={MENU_ITEM_STYLE}
          >
            Switch Track
          </button>
        )}
      </div>
    </div>
  )
})
