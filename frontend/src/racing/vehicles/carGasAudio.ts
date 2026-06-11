import { getCarGasVolume } from './carHandling'

export interface MutableBooleanRef {
  current: boolean
}

export interface CarGasAudioElement {
  volume: number
  currentTime: number
  duration?: number
  loop?: boolean
  play: () => Promise<unknown>
  pause: () => void
}

export const CAR_GAS_AUDIO_LOOP_START_SECONDS = 1.4
export const CAR_GAS_AUDIO_LOOP_END_TRIM_SECONDS = 1.2

export const getCarGasAudioLoopEndSeconds = (
  audio: Pick<CarGasAudioElement, 'duration'>,
  loopStartSeconds = CAR_GAS_AUDIO_LOOP_START_SECONDS,
  loopEndTrimSeconds = CAR_GAS_AUDIO_LOOP_END_TRIM_SECONDS
): number | null => {
  if (audio.duration === undefined || !Number.isFinite(audio.duration) || audio.duration <= loopStartSeconds) {
    return null
  }

  return Math.max(loopStartSeconds, audio.duration - loopEndTrimSeconds)
}

export const seekCarGasAudioIntoLoopWindow = (audio: CarGasAudioElement): void => {
  const loopEndSeconds = getCarGasAudioLoopEndSeconds(audio)
  if (loopEndSeconds !== null && audio.currentTime >= loopEndSeconds) {
    audio.currentTime = CAR_GAS_AUDIO_LOOP_START_SECONDS
    return
  }

  if (audio.currentTime < CAR_GAS_AUDIO_LOOP_START_SECONDS) {
    audio.currentTime = CAR_GAS_AUDIO_LOOP_START_SECONDS
  }
}

export interface StartCarGasAudioOptions {
  audio: CarGasAudioElement
  speed: number
  isPlaying: MutableBooleanRef
  onGasPressed?: () => void
  onPlayError?: (err: unknown) => void
}

export interface StopCarGasAudioOptions {
  audio: CarGasAudioElement
  isPlaying: MutableBooleanRef
  onGasReleased?: () => void
}

export interface UpdateCarGasAudioOptions {
  audio: CarGasAudioElement
  speed: number
  isSoundEnabled: boolean
  isPlaying: MutableBooleanRef
}

export const startCarGasAudio = ({
  audio,
  speed,
  isPlaying,
  onGasPressed,
  onPlayError
}: StartCarGasAudioOptions): void => {
  audio.volume = getCarGasVolume(speed)
  audio.loop = false
  seekCarGasAudioIntoLoopWindow(audio)
  audio.play().catch(err => onPlayError?.(err))
  isPlaying.current = true
  onGasPressed?.()
}

export const stopCarGasAudio = ({
  audio,
  isPlaying,
  onGasReleased
}: StopCarGasAudioOptions): void => {
  if (!isPlaying.current) return

  audio.pause()
  audio.currentTime = 0
  isPlaying.current = false
  onGasReleased?.()
}

export const updateCarGasAudio = ({
  audio,
  speed,
  isSoundEnabled,
  isPlaying
}: UpdateCarGasAudioOptions): void => {
  if (!isPlaying.current) return

  if (!isSoundEnabled) {
    stopCarGasAudio({ audio, isPlaying })
    return
  }

  seekCarGasAudioIntoLoopWindow(audio)
  audio.volume = getCarGasVolume(speed)
}
