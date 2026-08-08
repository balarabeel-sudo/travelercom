import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { Logo, PrimaryButton, InputField, PhoneField, PasswordField, FormError, COLORS } from './AuthComponents'

const BUSINESS_TYPES = [
  { value: '', label: 'Select Business Type' },
  { value: 'bus', label: 'Bus Operator' },
  { value: 'train', label: 'Railway / Train' },
  { value: 'flight', label: 'Airline' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'tour', label: 'Travel Agency / Tours' },
  { value: 'event_center', label: 'Event Center' },
]

function isEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const accountType = searchParams.get('type') || 'personal'
  const isPersonal = accountType === 'personal'
  const color = isPersonal ? COLORS.primary : COLORS.secondary

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [agreedTerms, setAgreedTerms] = useState(false)

  const emailValid = email.length === 0 ? null : isEmailValid(email)
  const passwordValid = password.length === 0 ? null : password.length >= 6
  const confirmValid = confirmPassword.length === 0 ? null : confirmPassword === password

  const canSubmit = (isPersonal ? fullName.trim().length > 0 : companyName.trim().length > 0 && businessType) &&
    isEmailValid(email) && phone.trim().length >= 7 && password.length >= 6 && confirmPassword === password && agreedTerms

  const handleRegister = async () => {
    if (!agreedTerms) { setError('Please agree to the Terms & Conditions to continue.'); return }
    if (!isEmailValid(email)) { setError('Please enter a valid email address.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }

    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: isPersonal ? fullName : companyName,
          phone: `+234${phone}`,
          account_type: accountType,
          business_type: !isPersonal ? businessType : null,
        },
      },
    })

    if (error) {
      let errorMsg = 'An error occurred. Please try again.'
      if (error.message) errorMsg = error.message
      setError(errorMsg)
      setLoading(false)
    } else {
      setLoading(false)
      setRegistered(true)
    }
  }

  if (registered) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: '400px', background: 'white', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>📧</div>
          <h1 style={{ fontSize: '21px', fontWeight: 800, color, marginBottom: '10px' }}>Check Your Email</h1>
          <p style={{ color: COLORS.textMuted, fontSize: '14px', marginBottom: '6px' }}>We sent a verification link to:</p>
          <p style={{ color: COLORS.text, fontWeight: 700, fontSize: '15px', marginBottom: '22px' }}>{email}</p>
          <p style={{ color: COLORS.textMuted, fontSize: '13px', marginBottom: '22px' }}>
            Tap the link in the email to verify your account, then come back here to log in.
          </p>
          <PrimaryButton onClick={() => navigate('/login')} color={color}>Go to Login</PrimaryButton>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: 'white', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <span onClick={() => navigate(-1)} style={{ fontSize: '20px', cursor: 'pointer', display: 'inline-block', marginBottom: '14px' }}>←</span>

        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{
            width: '54px', height: '54px', borderRadius: '50%', background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
            margin: '0 auto 12px', color: 'white',
          }}>
            {isPersonal ? '👤' : '💼'}
          </div>
          <h1 style={{ fontSize: '21px', fontWeight: 800, color: COLORS.text }}>
            {isPersonal ? 'Create Personal Account' : 'Create Company Account'}
          </h1>
          <p style={{ color: COLORS.textMuted, fontSize: '13px', marginTop: '4px' }}>
            {isPersonal ? 'Create your account to get started' : 'Register your company on Traveler.com'}
          </p>
        </div>

        <FormError message={error} />

        {isPersonal ? (
          <InputField label="Full Name" value={fullName} onChange={setFullName} placeholder="e.g. Rabeel Bala" />
        ) : (
          <>
            <InputField label="Company Name" value={companyName} onChange={setCompanyName} placeholder="e.g. Rabeel Agro Transport Ltd." />
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '5px', display: 'block' }}>Business Type</label>
              <select value={businessType} onChange={(e) => setBusinessType(e.target.value)}
                style={{ width: '100%', padding: '13px', border: `1.5px solid ${COLORS.border}`, borderRadius: '10px', fontSize: '14.5px', boxSizing: 'border-box' as const, background: 'white' }}>
                {BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </>
        )}

        <InputField label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" valid={emailValid} />
        <PhoneField value={phone} onChange={setPhone} />
        <PasswordField label="Password" value={password} onChange={setPassword} valid={passwordValid} />
        <PasswordField label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} valid={confirmValid} />

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '18px', cursor: 'pointer' }}>
          <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} style={{ marginTop: '3px' }} />
          <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>
            I agree to the{' '}
            <span onClick={(e) => { e.stopPropagation(); navigate('/terms') }} style={{ color, fontWeight: 700, cursor: 'pointer' }}>
              Terms &amp; Conditions
            </span>
          </span>
        </label>

        <div style={{ marginBottom: '16px' }}>
          <PrimaryButton onClick={handleRegister} color={color} disabled={!canSubmit} loading={loading}>
            {isPersonal ? 'Create Account' : 'Register Company'}
          </PrimaryButton>
        </div>

        <p style={{ textAlign: 'center', color: COLORS.textMuted, fontSize: '13px' }}>
          Already have an account?{' '}
          <span onClick={() => navigate('/login')} style={{ color, cursor: 'pointer', fontWeight: 700 }}>Login</span>
        </p>
      </div>
    </div>
  )
}

export default Register
