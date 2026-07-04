import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async () => {
    setErrorMsg('')

    if (!email || !password) {
      setErrorMsg('Da fatan za a cika email da password')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    setLoading(false)

    if (error) {
      setErrorMsg('Email ko password ba daidai ba ne. Ka sake gwadawa.')
      return
    }

    if (data.user) {
      navigate('/home')
    }
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
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#0ea5e9',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          TRAVELER.COM
        </h1>
        <p style={{
          textAlign: 'center',
          color: '#666',
          marginBottom: '32px'
        }}>
          Login to your account
        </p>

        {errorMsg && (
          <div style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: '10px',
            borderRadius: '8px',
            fontSize: '14px',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            {errorMsg}
          </div>
        )}

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
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            background: loading ? '#94d3f0' : '#0ea5e9',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '16px'
          }}>
          {loading ? 'Ana shiga...' : 'Login'}
        </button>

        <p style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
          Don't have an account?{' '}
          <span
            onClick={() => navigate('/account-type')}
            style={{ color: '#0ea5e9', cursor: 'pointer' }}>
            Sign Up
          </span>
        </p>
      </div>
    </div>
  )
}

export default Login
