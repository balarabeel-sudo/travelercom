import { useNavigate } from 'react-router-dom'
import logo from './assets/logo.png'

function AccountType() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      textAlign: 'center'
    }}>
      <img src={logo} alt="Traveler.com" style={{ width: '64px', height: '64px', marginBottom: '14px' }} />

      <h1 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '4px' }}>
        Welcome to <span style={{ color: '#0ea5e9' }}>TRAVELER</span><span style={{ color: '#f97316' }}>.COM</span>
      </h1>
      <p style={{ color: '#1a1a1a', fontSize: '15px', fontWeight: 'bold', marginBottom: '4px', marginTop: '10px' }}>
        Choose your account type
      </p>
      <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '28px' }}>
        Before you sign up, tell us who you are.
      </p>

      {/* Personal Account */}
      <div
        onClick={() => navigate('/register?type=personal')}
        style={{
          background: 'white',
          borderRadius: '18px',
          padding: '22px',
          width: '100%',
          maxWidth: '340px',
          marginBottom: '16px',
          cursor: 'pointer',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0'
        }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '50%', background: '#0ea5e9',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
          margin: '0 auto 12px', color: 'white'
        }}>
          👤
        </div>
        <h2 style={{ fontSize: '17px', fontWeight: 'bold', marginBottom: '6px', color: '#1a1a1a' }}>
          Personal Account
        </h2>
        <p style={{ color: '#64748b', fontSize: '12.5px', marginBottom: '16px', lineHeight: '1.5' }}>
          For individuals. Book your bus, track your trips, and manage your waybills.
        </p>
        <button style={{
          width: '100%', padding: '12px', border: 'none', borderRadius: '10px',
          background: '#0ea5e9', color: 'white', fontSize: '14.5px', fontWeight: 'bold', cursor: 'pointer'
        }}>
          Select Personal
        </button>
      </div>

      {/* Company Account */}
      <div
        onClick={() => navigate('/register?type=company')}
        style={{
          background: 'white',
          borderRadius: '18px',
          padding: '22px',
          width: '100%',
          maxWidth: '340px',
          cursor: 'pointer',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0'
        }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '50%', background: '#f97316',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
          margin: '0 auto 12px', color: 'white'
        }}>
          💼
        </div>
        <h2 style={{ fontSize: '17px', fontWeight: 'bold', marginBottom: '6px', color: '#1a1a1a' }}>
          Company/Agency Account
        </h2>
        <p style={{ color: '#64748b', fontSize: '12.5px', marginBottom: '16px', lineHeight: '1.5' }}>
          For transportation companies and cargo agencies. List your vehicles, manage operations, and track deliveries.
        </p>
        <button style={{
          width: '100%', padding: '12px', border: 'none', borderRadius: '10px',
          background: '#f97316', color: 'white', fontSize: '14.5px', fontWeight: 'bold', cursor: 'pointer'
        }}>
          Select Company/Agency
        </button>
      </div>

      <p style={{ color: '#64748b', fontSize: '12.5px', marginTop: '20px' }}>
        Already have an account?{' '}
        <span onClick={() => navigate('/login')} style={{ color: '#0ea5e9', fontWeight: 'bold', cursor: 'pointer' }}>
          Login
        </span>
      </p>

      <p style={{ color: '#94a3b8', fontSize: '11px', marginTop: '14px' }}>
        By continuing, you agree to our Terms and Privacy Policy
      </p>
    </div>
  )
}

export default AccountType
