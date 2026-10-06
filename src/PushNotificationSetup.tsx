import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { requestPushToken, listenForegroundMessages } from './firebaseMessaging'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
}

const DISMISS_KEY = 'tc_push_prompt_dismissed'
// After tapping "Ba yanzu ba" the prompt stays hidden for a few days, then asks again.
// (Before, one tap hid it forever, so most people never enabled push.)
const DISMISS_DAYS = 3

function promptRecentlyDismissed() {
  const raw = localStorage.getItem(DISMISS_KEY)
  if (!raw) return false
  const stamp = Number(raw)
  // Old versions stored '1' - treat that as expired so those people get asked again.
  if (!Number.isFinite(stamp) || stamp < 1000) return false
  return Date.now() - stamp < DISMISS_DAYS * 24 * 60 * 60 * 1000
}

async function saveToken(token: string) {
  const { data } = await supabase.auth.getUser()
  const uid = data.user?.id
  if (!uid) return
  await supabase.from('push_subscriptions').upsert(
    {
      user_id: uid,
      fcm_token: token,
      device_label: navigator.userAgent.slice(0, 120),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'fcm_token' }
  )
}

function PushNotificationSetup() {
  const navigate = useNavigate()
  const [showPrompt, setShowPrompt] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [toast, setToast] = useState<{ title: string; body: string; actionUrl: string } | null>(null)
  const handledUserRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      if (!('Notification' in window)) return
      const { data } = await supabase.auth.getUser()
      if (cancelled) return
      if (!data.user) {
        setShowPrompt(false)
        return
      }

      // Only act once per signed-in user (sign-in events can fire again on tab focus).
      const alreadyHandled = handledUserRef.current === data.user.id
      handledUserRef.current = data.user.id

      if (Notification.permission === 'granted') {
        if (alreadyHandled) return
        // Already allowed (e.g. previous visit) — silently (re)register so
        // the token stays fresh, no banner needed.
        const token = await requestPushToken()
        if (token) saveToken(token)
      } else if (Notification.permission === 'default' && !promptRecentlyDismissed()) {
        setShowPrompt(true)
      }
    }
    init()

    // The app mounts this component before the person logs in, so also run again
    // right after login. Without this the prompt only appeared if the app was
    // reopened while already logged in.
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        setTimeout(() => { init() }, 0)
      } else if (event === 'SIGNED_OUT') {
        handledUserRef.current = null
        setShowPrompt(false)
      }
    })

    listenForegroundMessages((title, body, actionUrl) => {
      setToast({ title, body, actionUrl })
      setTimeout(() => setToast(null), 6000)
    })

    return () => {
      cancelled = true
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleEnable = async () => {
    setEnabling(true)
    const token = await requestPushToken()
    if (token) await saveToken(token)
    setEnabling(false)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setShowPrompt(false)
  }

  return (
    <>
      {showPrompt && (
        <div style={{
          position: 'fixed', left: '16px', right: '16px', bottom: '16px',
          background: COLORS.card, borderRadius: '14px', padding: '14px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.18)', border: `1px solid ${COLORS.border}`,
          zIndex: 200, display: 'flex', gap: '10px', alignItems: 'flex-start',
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px', background: '#E0F2FE',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name="bell" size={17} color={COLORS.primary} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>Ba da izinin sanarwa</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>
              Ka sami sanarwa kai tsaye kan wayarka game da booking, updates, da sauransu.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                onClick={handleEnable}
                disabled={enabling}
                style={{
                  fontSize: '12px', fontWeight: 700, color: 'white', background: COLORS.primary,
                  border: 'none', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer',
                }}>
                {enabling ? 'Ana kunnawa...' : 'Kunna'}
              </button>
              <button
                onClick={handleDismiss}
                style={{
                  fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, background: 'transparent',
                  border: 'none', padding: '7px 6px', cursor: 'pointer',
                }}>
                Ba yanzu ba
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          onClick={() => { setToast(null); navigate(toast.actionUrl) }}
          style={{
            position: 'fixed', top: '16px', left: '16px', right: '16px',
            background: COLORS.card, borderRadius: '14px', padding: '12px 14px',
            boxShadow: '0 8px 28px rgba(0,0,0,0.18)', border: `1px solid ${COLORS.border}`,
            zIndex: 200, cursor: 'pointer',
          }}>
          <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{toast.title}</p>
          {toast.body && <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>{toast.body}</p>}
        </div>
      )}
    </>
  )
}

export default PushNotificationSetup
