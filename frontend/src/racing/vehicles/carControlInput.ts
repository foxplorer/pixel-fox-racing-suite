export interface CarControlHandlers {
  press: (code: string) => void
  release: (code: string) => void
}

// One local car drives at a time: the mounted keyboard-controls hook registers
// its press/release logic here so touch controls call the same code path (key
// state, gas audio, status gating) instead of faking keyboard events
// (MOBILE_MODE_PLAN.md step 6b).
let activeHandlers: CarControlHandlers | null = null

export const registerCarControlHandlers = (handlers: CarControlHandlers): (() => void) => {
  activeHandlers = handlers
  return () => {
    if (activeHandlers === handlers) {
      activeHandlers = null
    }
  }
}

export const pressCarControl = (code: string): boolean => {
  if (!activeHandlers) return false
  activeHandlers.press(code)
  return true
}

export const releaseCarControl = (code: string): boolean => {
  if (!activeHandlers) return false
  activeHandlers.release(code)
  return true
}
