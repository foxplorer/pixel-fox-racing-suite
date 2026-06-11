import { useCallback, useEffect, useRef, useState } from 'react'

interface PreloadedAudioOptions {
  volume?: number
  loop?: boolean
}

export const createPreloadedAudio = (
  src: string | undefined,
  options: PreloadedAudioOptions = {}
): HTMLAudioElement => {
  const audioElement = new Audio(src)
  audioElement.preload = 'auto'

  if (options.volume !== undefined) {
    audioElement.volume = options.volume
  }

  if (options.loop !== undefined) {
    audioElement.loop = options.loop
  }

  return audioElement
}

interface PlayAudioOptions {
  reset?: boolean
  errorMessage?: string
}

export const playAudioElement = (
  audioElement: HTMLAudioElement,
  options: PlayAudioOptions = {}
): void => {
  if (options.reset) {
    audioElement.currentTime = 0
  }

  audioElement.play().catch(err => {
    console.log(options.errorMessage ?? 'Audio playback failed:', err)
  })
}

export const useLoopingIdleAudio = (
  audio: HTMLAudioElement,
  volume = 0.4
) => {
  const [showmuted, setShowMuted] = useState<boolean>(false)
  const [hidemuted, setHideMuted] = useState<boolean>(true)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)
  const soundRef = useRef(false)
  const isSoundEnabledRef = useRef(true)
  const hasUserMutedRef = useRef(false)
  const loopCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioDurationRef = useRef<number | null>(null)
  const wasIdlePlayingBeforeGas = useRef(false)

  useEffect(() => {
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        audioDurationRef.current = audio.duration
      }
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [audio])

  const playJungle = useCallback(() => {
    audio.volume = volume
    const playPromise = audio.play()

    const markSoundEnabled = () => {
      soundRef.current = true
      setIsSoundEnabled(true)
      isSoundEnabledRef.current = true
      hasUserMutedRef.current = false
      setShowMuted(false)
      setHideMuted(true)
    }

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('✅ Idle sound playing')
          markSoundEnabled()

          if (loopCheckIntervalRef.current) {
            clearInterval(loopCheckIntervalRef.current)
          }

          loopCheckIntervalRef.current = setInterval(() => {
            if (audio && !audio.paused && audioDurationRef.current !== null && soundRef.current) {
              if (audio.currentTime >= audioDurationRef.current - 0.5) {
                audio.currentTime = 0
              }
            }
          }, 50)
        })
        .catch(err => {
          console.log('❌ Failed to play idle sound:', err)
        })
    } else {
      markSoundEnabled()
    }
  }, [audio, volume])

  const muteJungle = useCallback(() => {
    audio.pause()
    soundRef.current = false
    setIsSoundEnabled(false)
    isSoundEnabledRef.current = false
    hasUserMutedRef.current = true
    setShowMuted(true)
    setHideMuted(false)

    if (loopCheckIntervalRef.current) {
      clearInterval(loopCheckIntervalRef.current)
      loopCheckIntervalRef.current = null
    }
  }, [audio])

  const pauseIdleAudioForGas = useCallback(() => {
    if (audio && !audio.paused && soundRef.current) {
      audio.pause()
      wasIdlePlayingBeforeGas.current = true
    } else {
      wasIdlePlayingBeforeGas.current = false
    }
  }, [audio])

  const resumeIdleAudioAfterGas = useCallback((gameStatus: string) => {
    if (audio && soundRef.current && !hasUserMutedRef.current && (gameStatus === 'racing' || gameStatus === 'countdown')) {
      if (audio.paused) {
        audio.play().catch(err => console.log('Resume idle sound failed:', err))
      }
    }
    wasIdlePlayingBeforeGas.current = false
  }, [audio])

  useEffect(() => {
    return () => {
      if (loopCheckIntervalRef.current) {
        clearInterval(loopCheckIntervalRef.current)
      }
      if (audio) {
        audio.pause()
        audio.src = ''
      }
    }
  }, [audio])

  return {
    showmuted,
    hidemuted,
    isSoundEnabled,
    soundRef,
    hasUserMutedRef,
    playJungle,
    muteJungle,
    pauseIdleAudioForGas,
    resumeIdleAudioAfterGas
  }
}
