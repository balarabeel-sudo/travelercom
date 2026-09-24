import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  navy: '#0B1E3D',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  red: '#dc2626',
}

// Routes that happen before/during onboarding, where there is either no
// session yet or the user hasn't had a chance to set a PIN yet — the
// lock screen must never appear here.
const SKIP_ROUTES = new Set([
  '/', '/account-type', '/login', '/register',
  '/verify-otp', '/upload-docs', '/pending-approval', '/accept-invite',
])

type Status = 'checking' | 'inactive' | 'locked' | 'unlocked'

function AppLockScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [hasSession, setHasSession] = useState(false)
  const [pinExists, setPinExists] = useState(false)

  // --- unlock (enter PIN) state ---
  const [unlockPin, setUnlockPin] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [unlockError, setUnlockError] = useState('')
  const [shake, setShake] = useState(false)

  const skipThisRoute = SKIP_ROUTES.has(location.pathname)
  const checkedOnce = useRef(false)

  const checkPinState = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData.session
    setHasSession(!!session)

    if (!session || skipThisRoute) {
      setStatus('inactive')
      return
    }

    const { data: exists } = await supabase.rpc('has_user_pin')
    setPinExists(!!exists)
    setStatus(exists ? 'locked' : 'inactive')
  }

  useEffect(() => {
    checkPinState()
    checkedOnce.current = true

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setStatus('inactive')
        setHasSession(false)
      } else if (event === 'SIGNED_IN') {
        checkPinState()
      }
    })
    return () => listener.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-check whenever the route changes (covers navigating away from a
  // skipped onboarding route into the real app for the first time).
  useEffect(() => {
    if (checkedOnce.current) checkPinState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Re-lock every time the app is backgrounded/hidden, like a bank app.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && hasSession && pinExists && status === 'unlocked') {
        setStatus('locked')
        setUnlockPin('')
        setUnlockError('')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [hasSession, pinExists, status])

  const handleUnlockDigit = (d: string) => {
    if (unlockPin.length >= 6 || verifying) return
    const next = unlockPin + d
    setUnlockPin(next)
    if (next.length === 6) submitUnlock(next)
  }

  const handleUnlockBackspace = () => {
    if (verifying) return
    setUnlockError('')
    setUnlockPin((p) => p.slice(0, -1))
  }

  const submitUnlock = async (pin: string) => {
    setVerifying(true)
    setUnlockError('')
    const { data: ok, error } = await supabase.rpc('verify_user_pin', { p_pin: pin })
    setVerifying(false)

    if (error) {
      setUnlockError(error.message || 'Something went wrong. Try again.')
      setUnlockPin('')
      setShake(true)
      setTimeout(() => setShake(false), 400)
      return
    }
    if (!ok) {
      setUnlockError('Incorrect PIN. Try again.')
      setUnlockPin('')
      setShake(true)
      setTimeout(() => setShake(false), 400)
      return
    }
    setStatus('unlocked')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setStatus('inactive')
    navigate('/login', { replace: true })
  }

  if (status !== 'locked') {
    return null
  }

  const activeLength = unlockPin.length
  const title = 'Enter your PIN'
  const subtitle = 'Enter your 6-digit PIN to continue.'
  const errorText = unlockError
  const busy = verifying

  const onDigit = handleUnlockDigit
  const onBackspace = handleUnlockBackspace

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: COLORS.navy,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', boxSizing: 'border-box' as const,
    }}>
      <style>{`
        @keyframes tcPinShake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-8px); }
          40%, 60% { transform: translateX(8px); }
        }
        .tc-pin-shake { animation: tcPinShake 0.4s; }
      `}</style>

      <p style={{ fontSize: '18px', fontWeight: 800, color: 'white', marginBottom: '6px', textAlign: 'center' }}>{title}</p>
      <p style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.65)', marginBottom: '26px', textAlign: 'center', maxWidth: '280px' }}>{subtitle}</p>

      <div className={shake ? 'tc-pin-shake' : ''} style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{
            width: '14px', height: '14px', borderRadius: '50%',
            border: `2px solid ${errorText ? COLORS.red : 'rgba(255,255,255,0.5)'}`,
            background: i < activeLength ? (errorText ? COLORS.red : 'white') : 'transparent',
          }} />
        ))}
      </div>

      <div style={{ height: '18px', marginBottom: '18px' }}>
        {errorText && <p style={{ fontSize: '12px', color: '#FCA5A5', textAlign: 'center' }}>{errorText}</p>}
        {busy && !errorText && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', textAlign: 'center' }}>Please wait...</p>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gap: '14px', marginBottom: '20px' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            onClick={() => onDigit(d)}
            disabled={busy}
            style={{
              width: '64px', height: '64px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: '22px', fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}>
            {d}
          </button>
        ))}
        <div />
        <button
          onClick={() => onDigit('0')}
          disabled={busy}
          style={{
            width: '64px', height: '64px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: '22px', fontWeight: 700,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}>
          0
        </button>
        <button
          onClick={onBackspace}
          disabled={busy}
          style={{
            width: '64px', height: '64px', borderRadius: '50%', border: 'none',
            background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 700,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}>
          Delete
        </button>
      </div>

      <span onClick={handleSignOut} style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.6)', textDecoration: 'underline', cursor: 'pointer' }}>
        Sign out instead
      </span>
    </div>
  )
}

export default AppLockScreen
