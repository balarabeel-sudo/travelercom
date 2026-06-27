import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const accountType = searchParams.get('type') || 'personal'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

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
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#0ea5e9',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          Create Account
        </h1>
        <p style={{
          textAlign: 'center',
          color: accountType === 'personal' ? '#0ea5e9' : '#f97316',
          marginBottom: '24px',
          fontWeight: 'bold'
        }}>
          {accountType === 'personal' ? '🎒 Personal Account' : '🏢 Company Account'}
        </p>

        <input
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '16px',
            marginBottom: '16px',
            boxSizing: 'border-box'
          }}
        />

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '16px',
            marginBottom: '16px',
            boxSizing: 'border-box'
          }}
        />

        <input
          type="tel"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '16px',
            marginBottom: '16px',
            boxSizing: 'border-box'
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '16px',
            marginBottom: '24px',
            boxSizing: 'border-box'
          }}
        />

        <button
          onClick={() => navigate('/home')}
          style={{
            width: '100%',
            padding: '14px',
            background: accountType === 'personal' ? '#0ea5e9' : '#f97316',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: '16px'
          }}>
          Create Account
        </button>

        <p style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
          Already have an account?{' '}
          <span
            onClick={() => navigate('/login')}
            style={{ color: '#0ea5e9', cursor: 'pointer' }}>
            Login
          </span>
        </p>
      </div>
    </div>
  )
}

export default Register