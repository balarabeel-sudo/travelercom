import { useEffect, useState } from 'react'

// Screens at or above this width get the desktop layout.
export const DESKTOP_MIN_WIDTH = 900

const QUERY = `(min-width: ${DESKTOP_MIN_WIDTH}px)`

function readMatch(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(QUERY).matches
}

// Returns true when the viewport is wide enough for the desktop layout.
// Updates live when the window is resized or the device is rotated.
export default function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(readMatch)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const mql = window.matchMedia(QUERY)
    const onChange = () => setIsDesktop(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isDesktop
}
