// Analog steering channel for touch controls. Holds a proportional steering value
// in [-1, 1] (negative = left, positive = right). When set, the rotation step turns
// the car proportionally to this value instead of the binary left/right key turn, so
// a small pad offset makes a small turn (feathering). `null` means no touch steering
// is active — the physics falls back to the keyboard's binary turn, so desktop is
// unaffected (nothing ever calls the setter there). One local car drives at a time,
// mirroring carControlInput.
let analogSteeringInput: number | null = null

export const setAnalogSteeringInput = (value: number | null): void => {
  if (value === null || !Number.isFinite(value)) {
    analogSteeringInput = null
    return
  }
  analogSteeringInput = Math.max(-1, Math.min(1, value))
}

export const getAnalogSteeringInput = (): number | null => analogSteeringInput
