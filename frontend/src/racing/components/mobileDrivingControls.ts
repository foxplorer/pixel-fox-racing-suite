export type MobileDrivingControlId = 'left' | 'right' | 'brake' | 'gas'
export type MobileDrivingInputMode = 'car' | 'keyboard'

// Touch buttons drive the same key codes the keyboard path reads, so car
// handling, gas audio, and multiplayer fairness stay identical to keyboard.
export const MOBILE_CONTROL_KEY_CODES: Record<MobileDrivingControlId, string> = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  brake: 'KeyS',
  gas: 'KeyW'
}

export type MobileControlKeyEmitter = (type: 'keydown' | 'keyup', code: string) => void

export const getMobileControlKeyboardKey = (code: string): string => {
  switch (code) {
    case 'ArrowLeft':
      return 'ArrowLeft'
    case 'ArrowRight':
      return 'ArrowRight'
    case 'KeyS':
      return 's'
    case 'KeyW':
      return 'w'
    default:
      return code
  }
}

export const getMobileSteeringControl = (
  steeringValue: number,
  deadzone = 0.18
): 'left' | 'right' | null => {
  if (steeringValue <= -deadzone) return 'left'
  if (steeringValue >= deadzone) return 'right'
  return null
}

export interface MobileControlPressTracker {
  press: (pointerId: number, control: MobileDrivingControlId) => void
  update: (pointerId: number, control: MobileDrivingControlId | null) => void
  release: (pointerId: number) => void
  releaseAll: () => void
  getPressedControls: () => MobileDrivingControlId[]
}

// Tracks pointers per control so multi-touch works: two fingers on one button
// emit a single keydown, and the key stays held until the last finger lifts.
export const createMobileControlPressTracker = (emit: MobileControlKeyEmitter): MobileControlPressTracker => {
  const controlByPointerId = new Map<number, MobileDrivingControlId>()
  const pointerCountByControl = new Map<MobileDrivingControlId, number>()

  const press = (pointerId: number, control: MobileDrivingControlId) => {
    if (controlByPointerId.has(pointerId)) return
    controlByPointerId.set(pointerId, control)
    const nextCount = (pointerCountByControl.get(control) ?? 0) + 1
    pointerCountByControl.set(control, nextCount)
    if (nextCount === 1) {
      emit('keydown', MOBILE_CONTROL_KEY_CODES[control])
    }
  }

  const releaseControl = (control: MobileDrivingControlId) => {
    const nextCount = (pointerCountByControl.get(control) ?? 0) - 1
    if (nextCount > 0) {
      pointerCountByControl.set(control, nextCount)
      return
    }
    pointerCountByControl.delete(control)
    emit('keyup', MOBILE_CONTROL_KEY_CODES[control])
  }

  const update = (pointerId: number, control: MobileDrivingControlId | null) => {
    const previousControl = controlByPointerId.get(pointerId) ?? null
    if (previousControl === control) return

    if (previousControl) {
      controlByPointerId.delete(pointerId)
      releaseControl(previousControl)
    }

    if (control) {
      controlByPointerId.set(pointerId, control)
      const nextCount = (pointerCountByControl.get(control) ?? 0) + 1
      pointerCountByControl.set(control, nextCount)
      if (nextCount === 1) {
        emit('keydown', MOBILE_CONTROL_KEY_CODES[control])
      }
    }
  }

  const release = (pointerId: number) => {
    const control = controlByPointerId.get(pointerId)
    if (!control) return
    controlByPointerId.delete(pointerId)
    releaseControl(control)
  }

  const releaseAll = () => {
    const pressedControls = [...pointerCountByControl.keys()]
    controlByPointerId.clear()
    pointerCountByControl.clear()
    pressedControls.forEach(control => emit('keyup', MOBILE_CONTROL_KEY_CODES[control]))
  }

  const getPressedControls = () => [...pointerCountByControl.keys()]

  return { press, update, release, releaseAll, getPressedControls }
}
