import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from './AuthComponents'

function SplashScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/account-type'), 2400)
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
        @keyframes pulse { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{ animation: 'fadeUp 0.7s ease-out' }}>
        <Logo size={110} />
      </div>

      <h1 style={{
        color: 'white',
        fontSize: '30px',
        fontWeight: 800,
        letterSpacing: '2px',
        marginTop: '18px',
        marginBottom: '18px',
        animation: 'fadeUp 0.7s ease-out 0.1s both',
      }}>
        TRAVELER
      </h1>

      <p style={{
        color: 'rgba(255,255,255,0.92)',
        fontSize: '15.5px',
        textAlign: 'center',
        lineHeight: 1.5,
        marginBottom: '56px',
        animation: 'fadeUp 0.7s ease-out 0.2s both',
      }}>
        Your seamless path to<br />a comfortable journey.
      </p>

      <div style={{
        width: '46px', height: '46px', borderRadius: '50%',
        border: '2.5px solid rgba(255,255,255,0.85)',
        animation: 'pulse 1.6s ease-in-out infinite',
        marginBottom: '18px',
      }} />

      <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: 700, marginBottom: '18px' }}>
        Smart travel starts here
      </p>

      <div style={{ display: 'flex', gap: '6px', position: 'absolute', bottom: '48px' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            width: i === 0 ? '20px' : '6px', height: '6px', borderRadius: '3px',
            background: i === 0 ? 'white' : 'rgba(255,255,255,0.4)',
            transition: 'all 0.3s',
          }} />
        ))}
      </div>
    </div>
  )
}

export default SplashScreen
