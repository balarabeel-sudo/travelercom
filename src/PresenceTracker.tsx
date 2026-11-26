import { useEffect } from 'react'
import { supabase } from './supabaseClient'

// Silent background component: tells the database that the signed-in user is active.
// The admin dashboard uses profiles.last_seen_at to show "Online" or "Last active ...".
const PING_INTERVAL_MS = 60 * 1000
const MIN_GAP_MS = 30 * 1000

function PresenceTracker() {
  useEffect(() => {
    let lastPing = 0
    let stopped = false

    const ping = async () => {
      if (stopped) return
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastPing < MIN_GAP_MS) return
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session) return
        lastPing = Date.now()
        await supabase.rpc('touch_last_seen')
      } catch {
        // Presence is best-effort, so never show errors to the user
      }
    }

    ping()
    const timer = window.setInterval(ping, PING_INTERVAL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') ping() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', ping)

    // Ping right after a fresh sign-in too
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') { lastPing = 0; ping() }
    })

    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', ping)
      sub.subscription.unsubscribe()
    }
  }, [])

  return null
}

export default PresenceTracker
