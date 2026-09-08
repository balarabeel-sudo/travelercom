import { useState } from 'react'
import logo from './assets/logo.png'
import Icon from './Icons'

export const COLORS = {
  primary: '#0ea5e9',
  primaryDark: '#0284c7',
  secondary: '#f97316',
  bg: '#f8fafc',
  card: '#ffffff',
  text: '#1a1a1a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  green: '#16a34a',
  red: '#dc2626',
}

export function Logo({ size = 64 }: { size?: number }) {
  return <img src={logo} alt="Traveler.com" style={{ width: size, height: size, objectFit: 'contain' }} />
}

export function PrimaryButton({ children, onClick, color = COLORS.primary, disabled, loading }: {
  children: React.ReactNode; onClick?: () => void; color?: string; disabled?: boolean; loading?: boolean
}) {
  const isDisabled = disabled || loading
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      style={{
        width: '100%',
        padding: '15px',
        background: isDisabled ? '#94a3b8' : color,
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontSize: '15.5px',
        fontWeight: 700,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      }}>
      {loading ? 'Please wait...' : children}
    </button>
  )
}

export function InputField({ label, type = 'text', value, onChange, placeholder, valid }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; valid?: boolean | null
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '5px', display: 'block' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', padding: '13px', border: `1.5px solid ${valid === false ? COLORS.red : valid === true ? COLORS.green : COLORS.border}`,
            borderRadius: '10px', fontSize: '14.5px', boxSizing: 'border-box' as const, outline: 'none',
          }}
        />
        {valid === true && <span style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', color: COLORS.green, display: 'flex' }}><Icon name="check" size={16} color={COLORS.green} strokeWidth={2.5} /></span>}
        {valid === false && <span style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', color: COLORS.red, display: 'flex' }}><Icon name="x" size={16} color={COLORS.red} strokeWidth={2.5} /></span>}
      </div>
    </div>
  )
}

export function PhoneField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '5px', display: 'block' }}>Phone Number</label>
      <div style={{ display: 'flex', border: `1.5px solid ${COLORS.border}`, borderRadius: '10px', overflow: 'hidden' }}>
        <span style={{ padding: '13px 12px', background: COLORS.bg, fontSize: '14px', fontWeight: 700, color: COLORS.text, borderRight: `1px solid ${COLORS.border}` }}>+234</span>
        <input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="810 123 4567"
          style={{ flex: 1, padding: '13px', border: 'none', fontSize: '14.5px', outline: 'none' }}
        />
      </div>
    </div>
  )
}

export function PasswordField({ label, value, onChange, valid }: { label: string; value: string; onChange: (v: string) => void; valid?: boolean | null }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '5px', display: 'block' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your password"
          style={{
            width: '100%', padding: '13px', paddingRight: '40px', border: `1.5px solid ${valid === false ? COLORS.red : valid === true ? COLORS.green : COLORS.border}`,
            borderRadius: '10px', fontSize: '14.5px', boxSizing: 'border-box' as const, outline: 'none',
          }}
        />
        <span onClick={() => setShow(!show)} style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', display: 'flex', color: COLORS.textMuted }}>
          <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
        </span>
      </div>
    </div>
  )
}

export function FormError({ message }: { message: string }) {
  if (!message) return null
  return (
    <p style={{ color: COLORS.red, fontSize: '13px', marginBottom: '14px', textAlign: 'center', background: '#fef2f2', padding: '10px', borderRadius: '8px' }}>
      {message}
    </p>
  )
}

export function LoadingIndicator({ color = 'white', size = 18 }: { color?: string; size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, border: `2.5px solid ${color}`,
      borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  )
}

function GoogleMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

function AppleMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size * (512 / 384)} viewBox="0 0 384 512" fill="#000000">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  )
}

export function SocialLoginButtons({ onProviderClick }: { onProviderClick: (provider: string) => void }) {
  const providers = [
    { key: 'google', render: () => <GoogleMark size={20} /> },
    { key: 'facebook', render: () => <span style={{ fontSize: '18px', fontWeight: 700, color: '#1877F2' }}>f</span> },
    { key: 'apple', render: () => <AppleMark size={18} /> },
  ]
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '4px' }}>
      {providers.map((p) => (
        <div
          key={p.key}
          onClick={() => onProviderClick(p.key)}
          style={{
            width: '46px', height: '46px', borderRadius: '50%', background: 'white', border: `1.5px solid ${COLORS.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
          {p.render()}
        </div>
      ))}
    </div>
  )
}

export function AccountTypeCard({ icon, color, title, description, buttonLabel, selected, onClick }: {
  icon: string; color: string; title: string; description: string; buttonLabel: string; selected?: boolean; onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'white', borderRadius: '18px', padding: '22px', width: '100%', maxWidth: '340px',
        cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: `1.5px solid ${selected ? color : COLORS.border}`,
        position: 'relative', textAlign: 'center' as const,
      }}>
      {selected && (
        <div style={{ position: 'absolute', top: '12px', left: '12px', width: '22px', height: '22px', borderRadius: '50%', background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={13} color="white" strokeWidth={3} />
        </div>
      )}
      <div style={{
        width: '52px', height: '52px', borderRadius: '50%', background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
        margin: '0 auto 12px', color: 'white',
      }}>
        {icon}
      </div>
      <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px', color: COLORS.text }}>{title}</h2>
      <p style={{ color: COLORS.textMuted, fontSize: '12.5px', marginBottom: '16px', lineHeight: 1.5 }}>{description}</p>
      <button style={{
        width: '100%', padding: '12px', border: 'none', borderRadius: '10px',
        background: color, color: 'white', fontSize: '14.5px', fontWeight: 700, cursor: 'pointer',
      }}>
        {buttonLabel} →
      </button>
    </div>
  )
}
