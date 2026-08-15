import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import { Logo, PrimaryButton, InputField, PasswordField, FormError, SocialLoginButtons, COLORS } from './AuthComponents'

function Login() {
  const navigate = useNavigate()
  const [toggle, setToggle] = useState<'personal' | 'company'>('personal')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const handleLogin = async () => {
    setErrorMsg('')
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.')
      return
    }
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setLoading(false)
      setErrorMsg('Incorrect email or password. Please try again.')
      return
    }

    if (data.user) {
      try {
        await supabase.rpc('accept_staff_invite')
      } catch {
        // no pending invite for this user, or claim failed silently -- not fatal to login
      }
      setLoading(false)
      navigate('/home')
    }
  }

  const color = toggle === 'personal' ? COLORS.primary : COLORS.secondary

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      {toast && (
        <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', background: '#0B1E3D', color: 'white', fontSize: '12.5px', fontWeight: 600, padding: '10px 18px', borderRadius: '10px', zIndex: 50 }}>
          {toast}
        </div>
      )}

      <div style={{ width: '100%', maxWidth: '400px', background: 'white', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <span onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'inline-flex', marginBottom: '14px' }}><Icon name="arrowLeft" size={20} color={COLORS.text} /></span>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <Logo size={48} />
          <h1 style={{ fontSize: '21px', fontWeight: 800, color: COLORS.text, marginTop: '12px' }}>Welcome Back</h1>
          <p style={{ color: COLORS.textMuted, fontSize: '13px', marginTop: '4px' }}>Login to your account</p>
        </div>

        <div style={{ display: 'flex', background: COLORS.bg, borderRadius: '11px', padding: '4px', marginBottom: '20px' }}>
          {(['personal', 'company'] as const).map((t) => (
            <div key={t} onClick={() => setToggle(t)} style={{
              flex: 1, textAlign: 'center', padding: '10px 4px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              background: toggle === t ? (t === 'personal' ? COLORS.primary : COLORS.secondary) : 'transparent',
              color: toggle === t ? 'white' : COLORS.textMuted,
            }}>
              {t === 'personal' ? 'Personal' : 'Company'}
            </div>
          ))}
        </div>

        <FormError message={errorMsg} />

        <InputField label="Email Address" type="email" value={email} onChange={setEmail} placeholder="Enter your email" />
        <PasswordField label="Password" value={password} onChange={setPassword} />

        <p onClick={() => setToast('Password reset is coming soon')} style={{ textAlign: 'right', fontSize: '12.5px', color, fontWeight: 700, cursor: 'pointer', marginBottom: '18px' }}>
          Forgot Password?
        </p>

        <div style={{ marginBottom: '20px' }}>
          <PrimaryButton onClick={handleLogin} color={color} loading={loading}>Login</PrimaryButton>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: COLORS.border }} />
          <span style={{ fontSize: '12px', color: COLORS.textMuted }}>or continue with</span>
          <div style={{ flex: 1, height: '1px', background: COLORS.border }} />
        </div>

        <SocialLoginButtons onProviderClick={(p) => setToast(`${p.charAt(0).toUpperCase() + p.slice(1)} login is coming soon`)} />

        <p style={{ textAlign: 'center', color: COLORS.textMuted, fontSize: '13px', marginTop: '22px' }}>
          Don't have an account?{' '}
          <span onClick={() => navigate('/account-type')} style={{ color: COLORS.primary, fontWeight: 700, cursor: 'pointer' }}>
            Sign Up
          </span>
        </p>
      </div>
    </div>
  )
}

export default Login
