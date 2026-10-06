import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import { Logo, PrimaryButton, InputField, PasswordField, FormError, COLORS } from './AuthComponents'

// Password reset with a one-time code sent by email:
// 1) enter email  2) enter the code from the email  3) choose a new password.
// Uses Supabase's built-in recovery flow (resetPasswordForEmail -> verifyOtp -> updateUser),
// so no link/redirect handling is needed inside the HashRouter app.

type Step = 'email' | 'code' | 'password' | 'done'

const RESEND_SECONDS = 60
const MIN_PASSWORD_LENGTH = 8

function ForgotPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const prefill = (location.state as { email?: string } | null)?.email || ''

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState(prefill)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [cooldown, setCooldown] = useState(0)

  const color = COLORS.primary

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const sendCode = async () => {
    setErrorMsg('')
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      setErrorMsg('Please enter a valid email address.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed)
    setLoading(false)
    if (error) {
      setErrorMsg(
        error.status === 429
          ? 'Too many requests. Please wait a few minutes and try again.'
          : 'Could not send the code. Please try again.'
      )
      return
    }
    setEmail(trimmed)
    setCode('')
    setStep('code')
    setCooldown(RESEND_SECONDS)
  }

  const verifyCode = async () => {
    setErrorMsg('')
    if (code.length < 6) {
      setErrorMsg('Please enter the code from your email.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' })
    setLoading(false)
    if (error) {
      setErrorMsg('That code is incorrect or has expired. Check it, or request a new one.')
      return
    }
    setStep('password')
  }

  const savePassword = async () => {
    setErrorMsg('')
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMsg(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setErrorMsg('The two passwords do not match.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setLoading(false)
      setErrorMsg(error.message || 'Could not update your password. Please try again.')
      return
    }
    await supabase.auth.signOut()
    setLoading(false)
    setStep('done')
  }

  const resend = async () => {
    if (cooldown > 0) return
    await sendCode()
  }

  const heading =
    step === 'email' ? 'Forgot Password?' :
    step === 'code' ? 'Check Your Email' :
    step === 'password' ? 'New Password' :
    'Password Updated'

  const subheading =
    step === 'email' ? "Enter your account email and we'll send you a code." :
    step === 'code' ? `We sent a code to ${email}. Enter it below.` :
    step === 'password' ? 'Choose a new password for your account.' :
    'You can now log in with your new password.'

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: 'white', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>

        {(step === 'email' || step === 'code') && (
          <span
            onClick={() => (step === 'code' ? (setErrorMsg(''), setStep('email')) : navigate(-1))}
            style={{ cursor: 'pointer', display: 'inline-flex', marginBottom: '14px' }}>
            <Icon name="arrowLeft" size={20} color={COLORS.text} />
          </span>
        )}

        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          {step === 'done' ? (
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <Icon name="check" size={26} color="#16a34a" />
            </div>
          ) : (
            <Logo size={48} />
          )}
          <h1 style={{ fontSize: '21px', fontWeight: 800, color: COLORS.text, marginTop: '12px' }}>{heading}</h1>
          <p style={{ color: COLORS.textMuted, fontSize: '13px', marginTop: '4px', lineHeight: 1.5 }}>{subheading}</p>
        </div>

        {step !== 'done' && <FormError message={errorMsg} />}

        {step === 'email' && (
          <>
            <InputField label="Email Address" type="email" value={email} onChange={setEmail} placeholder="Enter your email" />
            <div style={{ marginTop: '6px' }}>
              <PrimaryButton onClick={sendCode} color={color} loading={loading}>Send Code</PrimaryButton>
            </div>
          </>
        )}

        {step === 'code' && (
          <>
            <InputField
              label="Verification Code"
              type="text"
              value={code}
              onChange={(v: string) => setCode(v.replace(/\D/g, '').slice(0, 8))}
              placeholder="Enter the code"
            />
            <div style={{ marginTop: '6px' }}>
              <PrimaryButton onClick={verifyCode} color={color} loading={loading}>Verify Code</PrimaryButton>
            </div>
            <p style={{ textAlign: 'center', fontSize: '12.5px', color: COLORS.textMuted, marginTop: '16px' }}>
              Didn't get it?{' '}
              {cooldown > 0 ? (
                <span>Resend in {cooldown}s</span>
              ) : (
                <span onClick={resend} style={{ color, fontWeight: 700, cursor: 'pointer' }}>Send a new code</span>
              )}
            </p>
          </>
        )}

        {step === 'password' && (
          <>
            <PasswordField label="New Password" value={password} onChange={setPassword} />
            <PasswordField label="Confirm New Password" value={confirm} onChange={setConfirm} />
            <div style={{ marginTop: '6px' }}>
              <PrimaryButton onClick={savePassword} color={color} loading={loading}>Update Password</PrimaryButton>
            </div>
          </>
        )}

        {step === 'done' && (
          <PrimaryButton onClick={() => navigate('/login', { replace: true })} color={color} loading={false}>Back to Login</PrimaryButton>
        )}
      </div>
    </div>
  )
}

export default ForgotPassword
