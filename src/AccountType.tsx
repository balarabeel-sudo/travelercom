import { useNavigate } from 'react-router-dom'
import { AccountTypeCard, COLORS } from './AuthComponents'

function AccountType() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '4px', marginTop: '14px' }}>
        Welcome to<br />
        <span style={{ color: COLORS.primary, fontSize: '15px' }}>traveler</span><span style={{ color: COLORS.secondary, fontSize: '15px' }}>.com</span>
      </h1>
      <p style={{ color: COLORS.text, fontSize: '15px', fontWeight: 700, marginBottom: '4px', marginTop: '14px' }}>
        Choose your account type
      </p>
      <p style={{ color: COLORS.textMuted, fontSize: '13px', marginBottom: '26px' }}>
        Before you sign up, tell us who you are.
      </p>

      <div style={{ marginBottom: '16px', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <AccountTypeCard
          icon="👤"
          color={COLORS.primary}
          title="Personal Account"
          description="For individuals. Book your bus, track your trips, and manage your waybills."
          buttonLabel="Select Personal"
          onClick={() => navigate('/register?type=personal')}
        />
      </div>

      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <AccountTypeCard
          icon="💼"
          color={COLORS.secondary}
          title="Company/Agency Account"
          description="For transportation companies and cargo agencies. List your vehicles, manage operations, and track deliveries."
          buttonLabel="Select Company/Agency"
          onClick={() => navigate('/register?type=company')}
        />
      </div>

      <p style={{ color: COLORS.textMuted, fontSize: '12.5px', marginTop: '22px' }}>
        Already have an account?{' '}
        <span onClick={() => navigate('/login')} style={{ color: COLORS.primary, fontWeight: 700, cursor: 'pointer' }}>
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
