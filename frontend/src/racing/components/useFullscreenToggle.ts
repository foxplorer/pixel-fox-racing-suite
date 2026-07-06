import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'

interface WebkitFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void
}

interface WebkitFullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

const getNativeFullscreenElement = (): Element | null => {
  const doc = document as WebkitFullscreenDocument
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

// iOS Safari has no Element.requestFullscreen, so the last resort is pinning
// the race container over the page. Merged by consumers on top of the normal
// viewport style so exiting restores the regular layout declaratively.
const FALLBACK_FULLSCREEN_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  width: '100vw',
  height: '100dvh',
  maxHeight: 'none',
  margin: 0,
  zIndex: 1000,
  backgroundColor: '#000'
}

export const useFullscreenToggle = <TElement extends HTMLElement>() => {
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false)
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(false)
  const containerRef = useRef<TElement>(null)
  const previousBodyOverflowRef = useRef<string | null>(null)

  const enterFallbackFullscreen = useCallback(() => {
    previousBodyOverflowRef.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setIsFallbackFullscreen(true)
  }, [])

  const exitFallbackFullscreen = useCallback(() => {
    if (previousBodyOverflowRef.current !== null) {
      document.body.style.overflow = previousBodyOverflowRef.current
      previousBodyOverflowRef.current = null
    }
    setIsFallbackFullscreen(false)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    if (isFallbackFullscreen) {
      exitFallbackFullscreen()
      return
    }

    if (!getNativeFullscreenElement()) {
      const webkitContainer = container as HTMLElement as WebkitFullscreenElement
      if (typeof container.requestFullscreen === 'function') {
        container.requestFullscreen().then(() => {
          setIsNativeFullscreen(true)
        }).catch(() => {
          enterFallbackFullscreen()
        })
      } else if (typeof webkitContainer.webkitRequestFullscreen === 'function') {
        try {
          webkitContainer.webkitRequestFullscreen()
        } catch {
          enterFallbackFullscreen()
        }
      } else {
        enterFallbackFullscreen()
      }
    } else {
      const doc = document as WebkitFullscreenDocument
      if (typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().then(() => {
          setIsNativeFullscreen(false)
        }).catch(() => {
          setIsNativeFullscreen(false)
        })
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        doc.webkitExitFullscreen()
      }
    }
  }, [enterFallbackFullscreen, exitFallbackFullscreen, isFallbackFullscreen])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsNativeFullscreen(!!getNativeFullscreenElement())
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (previousBodyOverflowRef.current !== null) {
        document.body.style.overflow = previousBodyOverflowRef.current
      }
    }
  }, [])

  return {
    containerRef,
    isFullscreen: isNativeFullscreen || isFallbackFullscreen,
    toggleFullscreen,
    fallbackFullscreenStyle: isFallbackFullscreen ? FALLBACK_FULLSCREEN_STYLE : null
  }
}
