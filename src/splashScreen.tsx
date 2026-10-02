import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { Logo } from './AuthComponents'

function SplashScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    // Keep the splash visible for a short moment, and in parallel check whether the user
    // is still signed in. A saved session means they go straight to Home; they only see
    // the login/sign-up flow if they have no session (new user, or they logged out).
    const minimumDelay = new Promise((resolve) => setTimeout(resolve, 2500))
    const sessionCheck = supabase.auth
      .getSession()
      .then(({ data }) => data.session)
      .catch(() => null)

    Promise.all([minimumDelay, sessionCheck]).then(([, session]) => {
      if (cancelled) return
      navigate(session ? '/home' : '/account-type', { replace: true })
    })

    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 50% 35%, #38bdf8 0%, #0ea5e9 35%, #0369a1 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(255,255,255,0)); }
          50% { transform: scale(1.08); filter: drop-shadow(0 0 22px rgba(255,255,255,0.45)); }
        }
        @keyframes enter {
          from { opacity: 0; transform: scale(0.75); }
          to { opacity: 1; transform: scale(1); }
        }
        .splash-logo {
          animation: enter 0.5s ease-out both, breathe 1.8s ease-in-out 0.5s infinite;
        }
      `}</style>

      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '260px',
        height: '260px',
        transform: 'translate(-50%, -50%)',
        background: 'radial-gradient(circle, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0) 72%)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      <div className="splash-logo">
        <Logo size={130} />
      </div>
    </div>
  )
}

export default SplashScreen
