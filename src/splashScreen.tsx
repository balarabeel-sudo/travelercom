import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from './AuthComponents'

function SplashScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/account-type'), 5000)
    return () => clearTimeout(t)
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

      <div className="splash-logo">
        <Logo size={130} />
      </div>
    </div>
  )
}

export default SplashScreen
