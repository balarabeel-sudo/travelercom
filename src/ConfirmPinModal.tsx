import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const COLORS = {
  primary: '#0EA5E9',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  red: '#dc2626',
}

type Props = {
  open: boolean
  onSuccess: () => void
  onCancel: () => void
  title?: string
  subtitle?: string
}

// Drop this anywhere a payment or withdrawal is about to be submitted:
//
//   const [confirmingPin, setConfirmingPin] = useState(false)
//   <button onClick={() => setConfirmingPin(true)}>Confirm & Pay</button>
//   <ConfirmPinModal
//     open={confirmingPin}
//     onCancel={() => setConfirmingPin(false)}
//     onSuccess={() => { setConfirmingPin(false); handleBookNow() }}
//   />
//
// If the user never turned on PIN app-lock in Settings, this calls
// onSuccess() immediately with no UI shown at all — callers never need to
// check has_user_pin() themselves.
function ConfirmPinModal({ open, onSuccess, onCancel, title, subtitle }: Props) {
  const [checking, setChecking] = useState(true)
  const [pinRequired, setPinRequired] = useState(false)
  const [pin, setPin] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setChecking(true)
    setPin('')
    setError('')

    const check = async () => {
      const { data } = await supabase.rpc('has_user_pin')
      if (cancelled) return
      if (!data) {
        // No PIN set — this is opt-in, so don't block the action.
        onSuccess()
        return
      }
      setPinRequired(true)
      setChecking(false)
    }
    check()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleDigit = (d: string) => {
    if (verifying || pin.length >= 6) return
    const next = pin + d
    setPin(next)
    if (next.length === 6) submit(next)
  }

  const handleBackspace = () => {
    if (verifying) return
    setError('')
    setPin((p) => p.slice(0, -1))
  }

  const submit = async (p: string) => {
    setVerifying(true)
    setError('')
    const { data: ok, error: err } = await supabase.rpc('verify_user_pin', { p_pin: p })
    setVerifying(false)

    if (err) {
      setError(err.message || 'Something went wrong. Try again.')
      setPin('')
      triggerShake()
      return
    }
    if (!ok) {
      setError('Incorrect PIN. Try again.')
      setPin('')
      triggerShake()
      return
    }
    onSuccess()
  }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  if (!open || checking || !pinRequired) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <style>{`
        @keyframes tcConfirmPinShake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-8px); }
          40%, 60% { transform: translateX(8px); }
        }
        .tc-confirm-pin-shake { animation: tcConfirmPinShake 0.4s; }
      `}</style>

      <div style={{
        background: COLORS.card, borderRadius: '20px 20px 0 0', padding: '24px 20px 30px',
        width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
      }}>
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: COLORS.border, marginBottom: '18px' }} />

        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginBottom: '4px', textAlign: 'center' }}>
          {title || 'Confirm with your PIN'}
        </p>
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: '22px', textAlign: 'center', maxWidth: '280px' }}>
          {subtitle || 'Enter your 6-digit PIN to continue.'}
        </p>

        <div className={shake ? 'tc-confirm-pin-shake' : ''} style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{
              width: '14px', height: '14px', borderRadius: '50%',
              border: `2px solid ${error ? COLORS.red : COLORS.border}`,
              background: i < pin.length ? (error ? COLORS.red : COLORS.primary) : 'transparent',
            }} />
          ))}
        </div>

        <div style={{ height: '18px', marginBottom: '14px' }}>
          {error && <p style={{ fontSize: '12px', color: COLORS.red, textAlign: 'center' }}>{error}</p>}
          {verifying && !error && <p style={{ fontSize: '12px', color: COLORS.textMuted, textAlign: 'center' }}>Verifying...</p>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 60px)', gap: '12px', marginBottom: '18px' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              disabled={verifying}
              style={{
                width: '60px', height: '60px', borderRadius: '50%', border: `1px solid ${COLORS.border}`,
                background: COLORS.card, color: COLORS.text, fontSize: '20px', fontWeight: 700,
                cursor: verifying ? 'not-allowed' : 'pointer',
              }}>
              {d}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleDigit('0')}
            disabled={verifying}
            style={{
              width: '60px', height: '60px', borderRadius: '50%', border: `1px solid ${COLORS.border}`,
              background: COLORS.card, color: COLORS.text, fontSize: '20px', fontWeight: 700,
              cursor: verifying ? 'not-allowed' : 'pointer',
            }}>
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={verifying}
            style={{
              width: '60px', height: '60px', borderRadius: '50%', border: 'none',
              background: 'transparent', color: COLORS.textMuted, fontSize: '12px', fontWeight: 700,
              cursor: verifying ? 'not-allowed' : 'pointer',
            }}>
            Delete
          </button>
        </div>

        <span onClick={verifying ? undefined : onCancel} style={{ fontSize: '13px', color: COLORS.textMuted, textDecoration: 'underline', cursor: verifying ? 'not-allowed' : 'pointer' }}>
          Cancel
        </span>
      </div>
    </div>
  )
}

export default ConfirmPinModal
