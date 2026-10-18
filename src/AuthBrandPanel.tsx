// Blue brand panel shown on the left side of the auth pages on desktop
// (splash-to-login flow: Account Type, Login, and later Register / Forgot Password).

const SERVICES = ['Hotels', 'Flights', 'Buses', 'Trains', 'Tours', 'Event Centers', 'Vehicle Rentals']

function AuthBrandPanel() {
  return (
    <div style={{
      flex: 1,
      background: 'linear-gradient(135deg, #0B1E3D 0%, #0EA5E9 100%)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '64px'
    }}>
      <h2 style={{ fontSize: '38px', fontWeight: 800, margin: 0 }}>TravelerCom</h2>
      <p style={{ fontSize: '17px', marginTop: '12px', maxWidth: '420px', lineHeight: 1.5, opacity: 0.92 }}>
        Travel and booking across Nigeria, all in one place.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '28px', maxWidth: '460px' }}>
        {SERVICES.map((label) => (
          <span key={label} style={{
            background: 'rgba(255,255,255,0.16)',
            padding: '8px 14px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 600
          }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default AuthBrandPanel
