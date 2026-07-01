import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from './supabaseClient'

function VerifyOTP() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') || ''
  const accountType = searchParams.get('type') || 'personal'

  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleVerify = async () => {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'signup'
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      if (accountType === 'company') {
        navigate('/upload-docs')
      } else {
        navigate('/home')
      }
    }
  }

  const color = accountType === 'personal' ? '#0ea5e9' : '#f97316'

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'white',
        borderRadius: '20px',
        padding: '32px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>📧</div>

        <h1 style={{ fontSize: '22px', fontWeight: 'bold', color, marginBottom: '8px' }}>
          Verify Your Email
        </h1>

        <p style={{ color: '#666', fontSize: '14px', marginBottom: '8px' }}>
          We sent a verification code to:
        </p>
        <p style={{ color: '#1a1a1a', fontWeight: 'bold', fontSize: '15px', marginBottom: '24px' }}>
          {email}
        </p>

        {error && (
          <p style={{ color: 'red', fontSize: '13px', marginBottom: '12px' }}>
            {error}
          </p>
        )}

        <input
          type="number"
          placeholder="Enter 6-digit code"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          style={{
            width: '100%',
            padding: '16px',
            border: `2px solid ${color}`,
            borderRadius: '12px',
            fontSize: '24px',
            textAlign: 'center',
            letterSpacing: '8px',
            marginBottom: '20px',
            boxSizing: 'border-box' as const,
            outline: 'none'
          }}
          maxLength={6}
        />

        <button
          onClick={handleVerify}
          disabled={loading || otp.length < 6}
          style={{
            width: '100%',
            padding: '14px',
            background: loading || otp.length < 6 ? '#94a3b8' : color,
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading || otp.length < 6 ? 'not-allowed' : 'pointer',
            marginBottom: '16px'
          }}>
          {loading ? 'Verifying...' : '✅ Verify Email'}
        </button>

        <p style={{ color: '#666', fontSize: '13px' }}>
          Didn't receive code?{' '}
          <span
            onClick={() => supabase.auth.resend({ type: 'signup', email })}
            style={{ color, cursor: 'pointer', fontWeight: 'bold' }}>
            Resend
          </span>
        </p>
      </div>
    </div>
  )
}

export default VerifyOTP