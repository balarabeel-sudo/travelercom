import { useNavigate } from 'react-router-dom'

function AccountType() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0ea5e9 0%, #0284c7 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      textAlign: 'center'
    }}>
      {/* Logo */}
      <div style={{
        width: '80px',
        height: '80px',
        background: 'white',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
        fontSize: '36px',
        fontWeight: 'bold',
        color: '#0ea5e9'
      }}>
        T
      </div>

      <h1 style={{
        color: 'white',
        fontSize: '28px',
        fontWeight: 'bold',
        marginBottom: '4px'
      }}>
        WELCOME TO
      </h1>
      <h1 style={{
        color: 'white',
        fontSize: '28px',
        fontWeight: 'bold',
        marginBottom: '8px'
      }}>
        TRAVELER.COM
      </h1>
      <p style={{
        color: 'rgba(255,255,255,0.9)',
        fontSize: '16px',
        fontWeight: 'bold',
        marginBottom: '8px'
      }}>
        Choose Your Account Type
      </p>
      <p style={{
        color: 'rgba(255,255,255,0.8)',
        fontSize: '13px',
        marginBottom: '32px'
      }}>
        Before you sign up, tell us who you are:
      </p>

      {/* Personal Account */}
      <div
        onClick={() => navigate('/register?type=personal')}
        style={{
          background: 'white',
          borderRadius: '20px',
          padding: '24px',
          width: '100%',
          maxWidth: '340px',
          marginBottom: '16px',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
        <div style={{ fontSize: '56px', marginBottom: '12px' }}>🎒</div>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          marginBottom: '8px',
          color: '#1a1a1a'
        }}>
          Personal Account
        </h2>
        <p style={{
          color: '#666',
          fontSize: '13px',
          marginBottom: '16px',
          lineHeight: '1.5'
        }}>
          For individuals. Book your bus, track your trips, and manage your waybills.
        </p>
        <button style={{
          width: '100%',
          padding: '12px',
          border: '2px solid #0ea5e9',
          borderRadius: '10px',
          background: 'white',
          color: '#0ea5e9',
          fontSize: '15px',
          fontWeight: 'bold',
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
          borderRadius: '20px',
          padding: '24px',
          width: '100%',
          maxWidth: '340px',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
        <div style={{ fontSize: '56px', marginBottom: '12px' }}>🏢</div>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          marginBottom: '8px',
          color: '#1a1a1a'
        }}>
          Company/Agency Account
        </h2>
        <p style={{
          color: '#666',
          fontSize: '13px',
          marginBottom: '16px',
          lineHeight: '1.5'
        }}>
          For transportation companies and cargo agencies. List your vehicles, manage operations, and track deliveries.
        </p>
        <button style={{
          width: '100%',
          padding: '12px',
          border: '2px solid #f97316',
          borderRadius: '10px',
          background: 'white',
          color: '#f97316',
          fontSize: '15px',
          fontWeight: 'bold',
          cursor: 'pointer'
        }}>
          Select Company/Agency
        </button>
      </div>

      <p style={{
        color: 'rgba(255,255,255,0.7)',
        fontSize: '12px',
        marginTop: '24px'
      }}>
        By continuing, you agree to our Terms and Privacy Policy
      </p>
    </div>
  )
}

export default AccountType