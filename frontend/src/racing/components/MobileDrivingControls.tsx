import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createMobileControlPressTracker,
  type MobileDrivingControlId
} from './mobileDrivingControls'

interface MobileDrivingControlsProps {
  onFirstInteraction?: () => void
}

// Spike wiring (MOBILE_MODE_PLAN.md → Input Architecture): synthetic window
// KeyboardEvents reuse the existing keyboard handlers untouched, including gas
// audio start/stop and status gating. Before a production merge this switches
// to shared pressCarControl/releaseCarControl handlers.
const dispatchSyntheticControlKey = (type: 'keydown' | 'keyup', code: string): void => {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }))
}

const CONTROL_LABELS: Record<MobileDrivingControlId, string> = {
  left: '◀',
  right: '▶',
  brake: 'BRAKE',
  gas: 'GAS'
}

const CONTROL_ARIA_LABELS: Record<MobileDrivingControlId, string> = {
  left: 'Steer left',
  right: 'Steer right',
  brake: 'Brake',
  gas: 'Gas'
}

const getControlButtonStyle = (control: MobileDrivingControlId, isPressed: boolean): React.CSSProperties => ({
  width: control === 'gas' ? '96px' : '80px',
  height: '80px',
  borderRadius: '16px',
  border: isPressed ? '2px solid rgba(78, 205, 196, 0.9)' : '2px solid rgba(255, 255, 255, 0.3)',
  background: isPressed ? 'rgba(78, 205, 196, 0.4)' : 'rgba(0, 0, 0, 0.45)',
  color: '#fff',
  fontFamily: 'monospace',
  fontWeight: 800,
  fontSize: control === 'left' || control === 'right' ? '26px' : '14px',
  letterSpacing: '0.04em',
  cursor: 'pointer',
  touchAction: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  WebkitTapHighlightColor: 'transparent',
  backdropFilter: 'blur(6px)'
})

const CONTROL_CLUSTER_STYLE: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
  display: 'flex',
  gap: '14px',
  pointerEvents: 'auto'
}

export const MobileDrivingControls = memo<MobileDrivingControlsProps>(function MobileDrivingControls({
  onFirstInteraction
}) {
  const [pressedControls, setPressedControls] = useState<readonly MobileDrivingControlId[]>([])
  const hasInteractedRef = useRef(false)
  const onFirstInteractionRef = useRef(onFirstInteraction)

  useEffect(() => {
    onFirstInteractionRef.current = onFirstInteraction
  }, [onFirstInteraction])

  const tracker = useMemo(() => createMobileControlPressTracker(dispatchSyntheticControlKey), [])

  const syncPressedControls = useCallback(() => {
    setPressedControls(tracker.getPressedControls())
  }, [tracker])

  const handlePointerDown = useCallback((control: MobileDrivingControlId) => (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (!hasInteractedRef.current) {
      hasInteractedRef.current = true
      onFirstInteractionRef.current?.()
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    tracker.press(event.pointerId, control)
    syncPressedControls()
  }, [syncPressedControls, tracker])

  const handlePointerEnd = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    tracker.release(event.pointerId)
    syncPressedControls()
  }, [syncPressedControls, tracker])

  useEffect(() => {
    // Backgrounding never delivers the pending pointerups, so lift everything.
    const releaseAllControls = () => {
      tracker.releaseAll()
      setPressedControls([])
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') releaseAllControls()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', releaseAllControls)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', releaseAllControls)
      releaseAllControls()
    }
  }, [tracker])

  const renderControlButton = (control: MobileDrivingControlId) => (
    <button
      key={control}
      type="button"
      aria-label={CONTROL_ARIA_LABELS[control]}
      onPointerDown={handlePointerDown(control)}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onContextMenu={event => event.preventDefault()}
      style={getControlButtonStyle(control, pressedControls.includes(control))}
    >
      {CONTROL_LABELS[control]}
    </button>
  )

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 80,
      pointerEvents: 'none',
      overscrollBehavior: 'none'
    }}>
      <div style={{
        ...CONTROL_CLUSTER_STYLE,
        left: 'calc(env(safe-area-inset-left, 0px) + 16px)'
      }}>
        {renderControlButton('left')}
        {renderControlButton('right')}
      </div>
      <div style={{
        ...CONTROL_CLUSTER_STYLE,
        right: 'calc(env(safe-area-inset-right, 0px) + 16px)'
      }}>
        {renderControlButton('brake')}
        {renderControlButton('gas')}
      </div>
    </div>
  )
})
