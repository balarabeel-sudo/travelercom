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
      background: 'linear-gradient(135deg, #0ea5e9 0%, #f97316 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '10px' }}>
        TRAVELER.COM
      </h1>
      <p style={{ fontSize: '16px', opacity: 0.9 }}>
        Your seamless path to a comfortable journey
      </p>
      <p style={{ fontSize: '14px', marginTop: '8px', opacity: 0.8 }}>
        Start Exploring
      </p>
    </div>
  )
}

export default SplashScreen