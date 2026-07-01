function PendingApproval() {

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f97316 0%, #ea580c 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '80px', marginBottom: '24px' }}>⏳</div>

      <h1 style={{
        color: 'white',
        fontSize: '26px',
        fontWeight: 'bold',
        marginBottom: '16px'
      }}>
        Application Submitted!
      </h1>

      <p style={{
        color: 'rgba(255,255,255,0.9)',
        fontSize: '15px',
        lineHeight: '1.6',
        marginBottom: '32px',
        maxWidth: '300px'
      }}>
        Your company documents are under review. We will notify you via email within 24-48 hours.
      </p>

      <div style={{
        background: 'rgba(255,255,255,0.2)',
        borderRadius: '16px',
        padding: '20px',
        maxWidth: '300px',
        width: '100%',
        marginBottom: '32px'
      }}>
        <p style={{ color: 'white', fontSize: '14px', lineHeight: '1.6' }}>
          ✅ Documents received
        </p>
        <p style={{ color: 'white', fontSize: '14px', lineHeight: '1.6' }}>
          🔍 Under verification
        </p>
        <p style={{ color: 'white', fontSize: '14px', lineHeight: '1.6' }}>
          📧 Email notification pending
        </p>
      </div>

      <a href="/login" style={{
        padding: '14px 48px',
        background: 'white',
        color: '#f97316',
        border: 'none',
        borderRadius: '30px',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: 'pointer',
        textDecoration: 'none'
      }}>
        Back to Login
      </a>
    </div>
  )
}

export default PendingApproval