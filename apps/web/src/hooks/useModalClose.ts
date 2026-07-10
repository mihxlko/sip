import { useState, useCallback, useRef } from 'react'

// Exit-animation gate: the modal never unmounts itself directly. close(cb)
// flips `closing` (CSS plays the exit animation via the --closing modifier),
// then fires cb after `duration` — which must match the CSS exit duration.
export function useModalClose(duration = 130) {
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)

  const close = useCallback((callback?: () => void) => {
    // Only the first close() wins — Escape + backdrop click inside the exit
    // window must not fire the callback twice.
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    setTimeout(() => callback?.(), duration)
  }, [duration])

  return { closing, close }
}
