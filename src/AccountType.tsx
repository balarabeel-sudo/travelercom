import { useNavigate } from 'react-router-dom'

function AccountType() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0ea5e9 0%, #f97316 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      textAlign: 'center'
    }}>
      <h1 style={{ color: 'white', fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>
        WELCOME TO TRAVELER.COM
      </h1>
      <p style={{ color: 'white', fontSize: '16px', marginBottom: '40px' }}>
        Choose Your Account Type
      </p>

      {/* Personal Account */}
      <div
        onClick={() => navigate('/register?type=personal')}
        style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          width: '100%',
          maxWidth: '320px',
          marginBottom: '16px',
          cursor: 'pointer'
        }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎒</div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
          Personal Account
        </h2>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
          For individuals. Book your bus, track your trips, and manage your waybills.
        </p>
        <button style={{
          width: '100%',
          padding: '12px',
          border: '2px solid #0ea5e9',
          borderRadius: '8px',
          background: 'white',
          color: '#0ea5e9',
          fontSize: '16px',
          cursor: 'pointer'
        }}>
          Select Personal
        </button>
      </div>

      {/* Company Account */}
      <div
        onClick={() => navigate('/register?type=company')}
        style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          width: '100%',
          maxWidth: '320px',
          cursor: 'pointer'
        }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏢</div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
          Company/Agency Account
        </h2>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
          For transportation companies and cargo agencies. List your vehicles, manage operations.
        </p>
        <button style={{
          width: '100%',
          padding: '12px',
          border: '2px solid #f97316',
          borderRadius: '8px',
          background: 'white',
          color: '#f97316',
          fontSize: '16px',
          cursor: 'pointer'
        }}>
          Select Company/Agency
        </button>
      </div>

      <p style={{ color: 'white', fontSize: '12px', marginTop: '24px', opacity: 0.8 }}>
        By continuing, you agree to our Terms and Privacy Policy
      </p>
    </div>
  )
}

export default AccountType