import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from './supabaseClient'

function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const accountType = searchParams.get('type') || 'personal'

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)

  // Personal fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Company fields
  const [companyName, setCompanyName] = useState('')
  const [businessType, setBusinessType] = useState('')

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match!')
      return
    }
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: accountType === 'personal' ? fullName : companyName,
          phone,
          account_type: accountType,
          business_type: accountType === 'company' ? businessType : null
        }
      }
    })

    if (error) {
      console.error("Supabase Error:", error);

      let errorMsg = 'An error occurred. Please try again.';

      if (error.message) {
        errorMsg = error.message;
      } else if ((error as any).error_description) {
        errorMsg = (error as any).error_description;
      } else {
        errorMsg = JSON.stringify(error);
      }

      setError(errorMsg);
      setLoading(false);
    } else {
      setLoading(false)
      setRegistered(true)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '13px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    fontSize: '15px',
    marginBottom: '14px',
    boxSizing: 'border-box' as const,
    outline: 'none'
  }

  const isPersonal = accountType === 'personal'
  const color = isPersonal ? '#0ea5e9' : '#f97316'

  // Bayan signup ya yi nasara: nuna sakon "duba email ɗinka" maimakon zuwa OTP page
  if (registered) {
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
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', color, marginBottom: '12px' }}>
            Check Your Email
          </h1>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '8px' }}>
            Mun aika maka link na tabbatarwa zuwa:
          </p>
          <p style={{ color: '#1a1a1a', fontWeight: 'bold', fontSize: '15px', marginBottom: '24px' }}>
            {email}
          </p>
          <p style={{ color: '#666', fontSize: '13px', marginBottom: '24px' }}>
            Danna link ɗin da ke cikin email ɗin domin ka tabbatar da account ɗinka, sannan ka koma nan don Login.
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{
              width: '100%',
              padding: '14px',
              background: color,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}>
            Go to Login
          </button>
        </div>
      </div>
    )
  }

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
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>
            {isPersonal ? 'Personal' : 'Company'}
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', color }}>
            {isPersonal ? 'Personal Account' : 'Company Account'}
          </h1>
          <p style={{ color: '#666', fontSize: '13px', marginTop: '4px' }}>
            Create your Traveler.com account
          </p>
        </div>

        {error && (
          <p style={{ color: 'red', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>
            {typeof error === 'string' ? error : JSON.stringify(error)}
          </p>
        )}

        {/* Personal Fields */}
        {isPersonal ? (
          <>
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={inputStyle}
            />
          </>
        ) : (
          <>
            <input
              type="text"
              placeholder="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              style={inputStyle}
            />
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
           >
              <option value="">Select Business Type</option>
              <option value="hotel">🏨 Hotel</option>
              <option value="bus">🚌 Bus Company</option>
              <option value="train">🚆 Railway / Train</option>
              <option value="flight">✈️ Airline</option>
              <option value="event_center">🎪 Event Center</option>
              <option value="tour">🗺️ Tour Company</option>
            </select>
          </>
        )}

        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="tel"
          placeholder="Phone Number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={inputStyle}
        />

        <button
          onClick={handleRegister}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            background: loading ? '#94a3b8' : color,
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '16px',
            marginTop: '8px'
          }}
        >
          {loading ? 'Creating account...' : isPersonal ? '✅ Create Account' : '✅ Register Company'}
        </button>

        <p style={{ textAlign: 'center', color: '#666', fontSize: '13px' }}>
          Already have an account?{' '}
          <span
            onClick={() => navigate('/login')}
            style={{ color, cursor: 'pointer', fontWeight: 'bold' }}
          >
            Login
          </span>
        </p>
      </div>
    </div>
  )
}

export default Register
