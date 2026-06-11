import { useCallback, useEffect, useRef, useState } from 'react'

export const useFullscreenToggle = <TElement extends HTMLElement>() => {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<TElement>(null)

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true)
      }).catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false)
      })
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  return {
    containerRef,
    isFullscreen,
    toggleFullscreen
  }
}
