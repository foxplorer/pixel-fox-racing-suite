import { useEffect, useRef } from 'react'
import {
  startCarGasAudio,
  stopCarGasAudio,
  type CarGasAudioElement,
  type MutableBooleanRef
} from './carGasAudio'
import {
  hasActiveCarGasKey,
  isCarGasKey,
  isCarMovementKey
} from './carHandling'

type KeyState = Record<string, boolean>

const isEditableKeyboardTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

interface MutableRef<TValue> {
  current: TValue
}

interface UseCarKeyboardControlsOptions {
  keys: MutableRef<KeyState>
  gameStatus: string
  isSoundEnabled: boolean
  gasAudio: CarGasAudioElement
  speed: MutableRef<number>
  isGasSoundPlaying: MutableBooleanRef
  onGasPressed?: () => void
  onGasReleased?: () => void
  onGasPlayError?: (err: unknown) => void
  onHeadlightsToggle?: () => void
}

export const useCarKeyboardControls = ({
  keys,
  gameStatus,
  isSoundEnabled,
  gasAudio,
  speed,
  isGasSoundPlaying,
  onGasPressed,
  onGasReleased,
  onGasPlayError,
  onHeadlightsToggle
}: UseCarKeyboardControlsOptions): void => {
  const onGasPressedRef = useRef(onGasPressed)
  const onGasReleasedRef = useRef(onGasReleased)
  const onGasPlayErrorRef = useRef(onGasPlayError)
  const onHeadlightsToggleRef = useRef(onHeadlightsToggle)

  useEffect(() => {
    onGasPressedRef.current = onGasPressed
    onGasReleasedRef.current = onGasReleased
    onGasPlayErrorRef.current = onGasPlayError
    onHeadlightsToggleRef.current = onHeadlightsToggle
  }, [onGasPlayError, onGasPressed, onGasReleased, onHeadlightsToggle])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) return

      if ((isCarMovementKey(event.code) || event.code === 'Space') && gameStatus === 'racing') {
        event.preventDefault()
      }

      if (event.code === 'KeyL' && !event.repeat && (gameStatus === 'racing' || gameStatus === 'countdown')) {
        event.preventDefault()
        onHeadlightsToggleRef.current?.()
      }

      keys.current[event.code] = true

      if (isCarGasKey(event.code) && gameStatus === 'racing' && !isGasSoundPlaying.current && isSoundEnabled) {
        startCarGasAudio({
          audio: gasAudio,
          speed: speed.current,
          isPlaying: isGasSoundPlaying,
          onGasPressed: () => onGasPressedRef.current?.(),
          onPlayError: err => onGasPlayErrorRef.current?.(err)
        })
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      keys.current[event.code] = false

      if (isCarGasKey(event.code) && isGasSoundPlaying.current && !hasActiveCarGasKey(keys.current)) {
        stopCarGasAudio({
          audio: gasAudio,
          isPlaying: isGasSoundPlaying,
          onGasReleased: () => onGasReleasedRef.current?.()
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      stopCarGasAudio({ audio: gasAudio, isPlaying: isGasSoundPlaying })
    }
  }, [gameStatus, gasAudio, isGasSoundPlaying, isSoundEnabled, keys, speed])
}
