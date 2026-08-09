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

export function SocialLoginButtons({ onProviderClick }: { onProviderClick: (provider: string) => void }) {
  const providers = [
    { key: 'google', icon: 'G', color: '#EA4335' },
    { key: 'facebook', icon: 'f', color: '#1877F2' },
    { key: 'apple', icon: '', color: '#000000' },
  ]
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '4px' }}>
      {providers.map((p) => (
        <div
          key={p.key}
          onClick={() => onProviderClick(p.key)}
          style={{
            width: '46px', height: '46px', borderRadius: '50%', background: 'white', border: `1.5px solid ${COLORS.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '18px', fontWeight: 700, color: p.color,
          }}>
          {p.key === 'apple' ? '' : p.icon}
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
