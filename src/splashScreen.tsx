import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function SplashScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    setTimeout(() => {
      navigate('/account-type')
    }, 3000)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0ea5e9 0%, #0284c7 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <img
        src="https://raw.githubusercontent.com/balarabeel-sudo/travelercom/main/public/logo.png"
        alt="Traveler.com Logo"
        style={{
          width: '180px',
          height: '180px',
          objectFit: 'contain',
          marginBottom: '24px'
        }}
      />
      <h1 style={{
        color: 'white',
        fontSize: '32px',
        fontWeight: 'bold',
        letterSpacing: '2px',
        marginBottom: '12px'
      }}>
        TRAVELER.COM
      </h1>
      <p style={{
        color: 'rgba(255,255,255,0.9)',
        fontSize: '16px',
        textAlign: 'center',
        marginBottom: '8px'
      }}>
        Your seamless path to a comfortable journey.
      </p>
      <p style={{
        color: 'rgba(255,255,255,0.8)',
        fontSize: '14px',
        fontWeight: 'bold'
      }}>
        Start Exploring.
      </p>

      <button
        onClick={() => navigate('/account-type')}
        style={{
          marginTop: '48px',
          padding: '14px 48px',
          background: 'white',
          color: '#0ea5e9',
          border: 'none',
          borderRadius: '30px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer'
        }}>
        Get Started
      </button>
    </div>
  )
}

export default SplashScreen