import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createMobileControlPressTracker,
  getMobileControlKeyboardKey,
  getMobileSteeringControl,
  MOBILE_CONTROL_KEY_CODES,
  type MobileDrivingControlId,
  type MobileDrivingInputMode
} from './mobileDrivingControls'
import { pressCarControl, releaseCarControl } from '../vehicles/carControlInput'
import { setAnalogSteeringInput } from '../vehicles/carSteeringInput'

interface MobileDrivingControlsProps {
  onFirstInteraction?: () => void
  inputMode?: MobileDrivingInputMode
}

const dispatchControlKeyboardEvent = (type: 'keydown' | 'keyup', code: string): void => {
  window.dispatchEvent(new KeyboardEvent(type, {
    code,
    key: getMobileControlKeyboardKey(code),
    bubbles: true
  }))
}

const CONTROL_LABELS: Record<MobileDrivingControlId, string> = {
  brake: 'BRAKE',
  gas: 'GAS',
  left: '◀',
  right: '▶'
}

const CONTROL_ARIA_LABELS: Record<MobileDrivingControlId, string> = {
  left: 'Steer left',
  right: 'Steer right',
  brake: 'Brake',
  gas: 'Gas'
}

const getPedalAccentColor = (control: MobileDrivingControlId): string => (
  control === 'gas' ? '#4ade80' : '#f87171'
)

const getPedalButtonStyle = (control: MobileDrivingControlId, isPressed: boolean): React.CSSProperties => ({
  width: control === 'gas' ? '88px' : '82px',
  height: control === 'gas' ? '118px' : '102px',
  alignSelf: 'flex-end',
  borderRadius: control === 'gas' ? '18px 18px 28px 28px' : '20px 20px 26px 26px',
  border: isPressed ? `2px solid ${getPedalAccentColor(control)}` : '2px solid rgba(255, 255, 255, 0.26)',
  background: control === 'gas'
    ? isPressed
      ? 'linear-gradient(180deg, rgba(74,222,128,0.74), rgba(18,82,44,0.9))'
      : 'linear-gradient(180deg, rgba(70,92,80,0.9), rgba(9,28,19,0.92))'
    : isPressed
      ? 'linear-gradient(180deg, rgba(248,113,113,0.72), rgba(94,24,24,0.92))'
      : 'linear-gradient(180deg, rgba(94,78,78,0.92), rgba(34,15,15,0.92))',
  color: '#fff',
  fontFamily: 'monospace',
  fontWeight: 800,
  fontSize: '13px',
  letterSpacing: '0.06em',
  cursor: 'pointer',
  touchAction: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  WebkitTapHighlightColor: 'transparent',
  backdropFilter: 'blur(6px)',
  boxShadow: isPressed
    ? `0 5px 0 rgba(0,0,0,0.58), 0 0 22px ${control === 'gas' ? 'rgba(74,222,128,0.32)' : 'rgba(248,113,113,0.28)'}`
    : '0 10px 0 rgba(0,0,0,0.5), 0 14px 24px rgba(0,0,0,0.34)',
  transform: isPressed ? 'translateY(5px)' : 'translateY(0)',
  transition: 'transform 70ms ease-out, box-shadow 70ms ease-out, background 70ms ease-out',
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  placeItems: 'center',
  clipPath: control === 'gas'
    ? 'polygon(11% 0, 89% 0, 100% 100%, 0 100%)'
    : 'polygon(7% 0, 93% 0, 100% 100%, 0 100%)'
})

const CONTROL_CLUSTER_STYLE: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
  display: 'flex',
  gap: '14px',
  pointerEvents: 'auto'
}

// Relative auto-center steering: wherever the finger presses becomes "straight
// ahead", and the turn is proportional to how far it then slides from that point.
// There is no absolute position to track, and lifting the finger snaps straight —
// the reliable anchor touch controls need when your eyes are on the car.
const RELATIVE_FULL_LOCK_PX = 92   // slide this far from the press point = full lock
const STEER_RESPONSE_EXPO = 1.5    // >1 makes small offsets extra gentle (precision)
// Threshold on the curved value for emitting the binary left/right keys. The analog
// value drives the car turn; the keys keep camera-return and keyboard-only vehicles
// (snowmobile) steering working.
const KEY_EMIT_DEADZONE = 0.1

const clampSteeringValue = (value: number): number => Math.max(-1, Math.min(1, value))

// Map a raw relative offset ratio (slide distance / full-lock distance) to a curved
// steering value in [-1, 1], so a small slide yields a small, precise turn.
const getCurvedSteeringValue = (offsetRatio: number): number => {
  const clamped = clampSteeringValue(offsetRatio)
  return Math.sign(clamped) * Math.pow(Math.abs(clamped), STEER_RESPONSE_EXPO)
}

const MAX_VISUAL_LOCK_DEG = 120  // red-stripe wheel rotation at full lock (readability only)

export const MobileDrivingControls = memo<MobileDrivingControlsProps>(function MobileDrivingControls({
  inputMode = 'car',
  onFirstInteraction
}) {
  const [pressedControls, setPressedControls] = useState<readonly MobileDrivingControlId[]>([])
  const [steeringValue, setSteeringValue] = useState(0)
  const [activeSteeringControl, setActiveSteeringControl] = useState<'left' | 'right' | null>(null)
  const hasInteractedRef = useRef(false)
  const onFirstInteractionRef = useRef(onFirstInteraction)
  const activeSteeringControlRef = useRef<'left' | 'right' | null>(null)
  const steeringPointerIdRef = useRef<number | null>(null)
  const steeringOriginXRef = useRef<number | null>(null)
  const pedalRefs = useRef<Record<'brake' | 'gas', HTMLButtonElement | null>>({
    brake: null,
    gas: null
  })

  useEffect(() => {
    onFirstInteractionRef.current = onFirstInteraction
  }, [onFirstInteraction])

  const emitControlKey = useCallback((type: 'keydown' | 'keyup', code: string) => {
    if (inputMode === 'car') {
      const handled = type === 'keydown' ? pressCarControl(code) : releaseCarControl(code)
      if (handled) return
    }
    dispatchControlKeyboardEvent(type, code)
  }, [inputMode])

  const tracker = useMemo(() => createMobileControlPressTracker(emitControlKey), [emitControlKey])

  const syncPressedControls = useCallback(() => {
    setPressedControls(tracker.getPressedControls())
  }, [tracker])

  const releaseSteering = useCallback(() => {
    const active = activeSteeringControlRef.current
    if (active) {
      emitControlKey('keyup', MOBILE_CONTROL_KEY_CODES[active])
      activeSteeringControlRef.current = null
      setActiveSteeringControl(null)
    }
    steeringPointerIdRef.current = null
    steeringOriginXRef.current = null
    setAnalogSteeringInput(null)
    setSteeringValue(0)
  }, [emitControlKey])

  const setSteeringFromValue = useCallback((nextValue: number) => {
    setSteeringValue(nextValue)
    // Analog turn for car tracks — proportional to how far the finger slid.
    setAnalogSteeringInput(nextValue)

    // Binary left/right keys still fire past a small threshold so camera-return and
    // keyboard-only vehicles (snowmobile) keep steering; car turn uses the analog value.
    const nextControl = getMobileSteeringControl(nextValue, KEY_EMIT_DEADZONE)
    const previousControl = activeSteeringControlRef.current

    if (previousControl === nextControl) return

    if (previousControl) {
      emitControlKey('keyup', MOBILE_CONTROL_KEY_CODES[previousControl])
    }
    if (nextControl) {
      emitControlKey('keydown', MOBILE_CONTROL_KEY_CODES[nextControl])
    }

    activeSteeringControlRef.current = nextControl
    setActiveSteeringControl(nextControl)
  }, [emitControlKey])

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

  const getPedalControlFromPointer = useCallback((clientX: number, clientY: number): 'brake' | 'gas' | null => {
    for (const control of ['brake', 'gas'] as const) {
      const element = pedalRefs.current[control]
      if (!element) continue
      const rect = element.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return control
      }
    }
    return null
  }, [])

  const handlePedalPointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    tracker.update(event.pointerId, getPedalControlFromPointer(event.clientX, event.clientY))
    syncPressedControls()
  }, [getPedalControlFromPointer, syncPressedControls, tracker])

  const handlePointerEnd = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    tracker.release(event.pointerId)
    syncPressedControls()
  }, [syncPressedControls, tracker])

  const handleSteeringPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (steeringPointerIdRef.current !== null) return
    if (!hasInteractedRef.current) {
      hasInteractedRef.current = true
      onFirstInteractionRef.current?.()
    }
    steeringPointerIdRef.current = event.pointerId
    steeringOriginXRef.current = event.clientX
    event.currentTarget.setPointerCapture?.(event.pointerId)
    // Press point = straight ahead; steering stays neutral until the finger slides.
    setSteeringFromValue(0)
  }, [setSteeringFromValue])

  const handleSteeringPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (steeringPointerIdRef.current !== event.pointerId) return
    event.preventDefault()
    const originX = steeringOriginXRef.current
    if (originX === null) return
    setSteeringFromValue(getCurvedSteeringValue((event.clientX - originX) / RELATIVE_FULL_LOCK_PX))
  }, [setSteeringFromValue])

  const handleSteeringPointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (steeringPointerIdRef.current !== event.pointerId) return
    event.preventDefault()
    releaseSteering()
  }, [releaseSteering])

  useEffect(() => {
    // Backgrounding never delivers the pending pointerups, so lift everything.
    const releaseAllControls = () => {
      tracker.releaseAll()
      releaseSteering()
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
  }, [releaseSteering, tracker])

  const renderControlButton = (control: MobileDrivingControlId) => (
    <button
      key={control}
      type="button"
      aria-label={CONTROL_ARIA_LABELS[control]}
      onPointerDown={handlePointerDown(control)}
      onPointerMove={control === 'gas' || control === 'brake' ? handlePedalPointerMove : undefined}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onContextMenu={event => event.preventDefault()}
      ref={control === 'gas' || control === 'brake' ? element => {
        pedalRefs.current[control] = element
      } : undefined}
      style={getPedalButtonStyle(control, pressedControls.includes(control))}
    >
      <span style={{
        position: 'absolute',
        inset: '13px 14px auto',
        height: control === 'gas' ? 58 : 46,
        borderRadius: '12px',
        display: 'grid',
        gap: 6,
        alignContent: 'center',
        pointerEvents: 'none'
      }}>
        {[0, 1, 2].map(index => (
          <span
            key={index}
            style={{
              height: 4,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.48)',
              boxShadow: '0 1px 0 rgba(0,0,0,0.5)'
            }}
          />
        ))}
      </span>
      <span style={{
        position: 'absolute',
        bottom: 15,
        left: 0,
        right: 0,
        pointerEvents: 'none'
      }}>
        {CONTROL_LABELS[control]}
      </span>
    </button>
  )

  const steeringWheelRotation = steeringValue * 78
  const steeringPuckX = steeringValue * 66

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
        left: 'calc(env(safe-area-inset-left, 0px) + 14px)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        {/* Red-stripe steering wheel indicator above the pad; rotates with the slider value so you
            can see where the wheels point (like a real racing wheel's 12 o'clock marker). */}
        <div style={{ width: '84px', height: '84px', position: 'relative', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid rgba(255,255,255,0.82)', background: 'rgba(8,12,18,0.72)', boxShadow: '0 6px 18px rgba(0,0,0,0.4)' }} />
          <div style={{
            position: 'absolute',
            inset: 0,
            transform: `rotate(${steeringValue * MAX_VISUAL_LOCK_DEG}deg)`,
            transition: steeringPointerIdRef.current === null ? 'transform 0.12s ease-out' : 'none'
          }}>
            <div style={{ position: 'absolute', left: '50%', top: '4px', marginLeft: '-5px', width: '10px', height: '12px', borderRadius: '4px', background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.75)' }} />
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: '14px', height: '14px', marginLeft: '-7px', marginTop: '-7px', borderRadius: '50%', background: 'rgba(255,255,255,0.85)' }} />
          </div>
        </div>
        {/* Analog relative slide-pad: touch = straight, slide the puck left/right for a
            proportional turn, and release to re-center. */}
        <div
          role="slider"
          aria-label="Steering"
          aria-valuemin={-100}
          aria-valuemax={100}
          aria-valuenow={Math.round(steeringValue * 100)}
          onPointerDown={handleSteeringPointerDown}
          onPointerMove={handleSteeringPointerMove}
          onPointerUp={handleSteeringPointerEnd}
          onPointerCancel={handleSteeringPointerEnd}
          onLostPointerCapture={handleSteeringPointerEnd}
          onContextMenu={event => event.preventDefault()}
          style={{
            // Kept compact so it clears the chat field — relative steering only needs
            // room to slide ~92px from the press point, not a full-width slider.
            width: '200px',
            height: '104px',
            borderRadius: '18px',
            border: activeSteeringControl ? '2px solid rgba(78, 205, 196, 0.9)' : '2px solid rgba(255, 255, 255, 0.3)',
            background: 'rgba(0, 0, 0, 0.45)',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            WebkitTapHighlightColor: 'transparent',
            backdropFilter: 'blur(6px)',
            boxShadow: activeSteeringControl ? '0 0 18px rgba(78, 205, 196, 0.18)' : 'none'
          }}
        >
          <div style={{
            position: 'absolute',
            inset: '10px 18px',
            borderRadius: '999px',
            border: '1px solid rgba(255,255,255,0.16)',
            background: 'linear-gradient(90deg, rgba(78,205,196,0.22), rgba(255,255,255,0.08), rgba(78,205,196,0.22))'
          }} />
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '54px',
            height: '54px',
            marginLeft: '-27px',
            marginTop: '-27px',
            borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.86)',
            background: 'rgba(8, 12, 18, 0.86)',
            transform: `translateX(${steeringPuckX}px) rotate(${steeringWheelRotation}deg)`,
            transition: steeringPointerIdRef.current === null ? 'transform 0.12s ease-out' : 'none',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'monospace',
            fontSize: '22px',
            fontWeight: 900,
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)'
          }}>
            ◉
          </div>
          <div style={{
            position: 'absolute',
            left: 14,
            bottom: 8,
            color: activeSteeringControl === 'left' ? '#9BE7E0' : 'rgba(255,255,255,0.5)',
            fontFamily: 'monospace',
            fontSize: 13,
            fontWeight: 900
          }}>
            ◀
          </div>
          <div style={{
            position: 'absolute',
            right: 14,
            bottom: 8,
            color: activeSteeringControl === 'right' ? '#9BE7E0' : 'rgba(255,255,255,0.5)',
            fontFamily: 'monospace',
            fontSize: 13,
            fontWeight: 900
          }}>
            ▶
          </div>
        </div>
        </div>
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
