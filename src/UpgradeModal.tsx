import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Shown when a Free-plan company taps a Business Suite feature.
// The upgrade destination is the same one the rest of the app already uses
// for "Upgrade" buttons, so the existing plan flow is not duplicated here.
const UPGRADE_ROUTE = '/support'

const BENEFITS = [
  { title: 'Manage all activities', text: 'Control bookings, inventory and pricing in one place.' },
  { title: 'Advanced analytics', text: 'Deep insights and reports to grow your business.' },
  { title: 'Staff access', text: 'Give your team the right access, with full control.' },
  { title: 'Promotions and visibility', text: 'Run offers and feature your property to more travelers.' },
]

export default function UpgradeModal({ feature, onClose }: { feature: string; onClose: () => void }) {
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(15,23,42,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Upgrade to Business Suite"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto',
          background: '#FFFFFF', borderRadius: '18px', boxShadow: '0 24px 60px rgba(15,23,42,0.3)',
        }}>
        <div style={{
          background: 'linear-gradient(135deg, #2E1065, #4C1D95)', color: 'white',
          padding: '28px 28px 24px', borderRadius: '18px 18px 0 0',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#F59E0B', color: '#2E1065',
            fontSize: '12px', fontWeight: 800, padding: '5px 12px', borderRadius: '8px', marginBottom: '14px',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 8l5 4 5-8 5 8 5-4-2 12H4z" />
            </svg>
            BUSINESS SUITE
          </span>
          <p style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px', lineHeight: 1.25 }}>
            Unlock {feature}
          </p>
          <p style={{ fontSize: '14.5px', color: '#DDD6FE', margin: 0, lineHeight: 1.5 }}>
            {feature} is part of the Business Suite plan. Upgrade to start using it.
          </p>
        </div>

        <div style={{ padding: '24px 28px 8px' }}>
          {BENEFITS.map((b) => (
            <div key={b.title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '16px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }}>
                <circle cx="12" cy="12" r="9" />
                <path d="M8 12.5l3 3 5-6" />
              </svg>
              <div>
                <p style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A', margin: 0 }}>{b.title}</p>
                <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0', lineHeight: 1.5 }}>{b.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '8px 28px 28px', display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1, padding: '13px', background: '#FFFFFF', color: '#334155', border: '1px solid #E2E8F0',
              borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            Maybe later
          </button>
          <button
            type="button"
            onClick={() => { onClose(); navigate(UPGRADE_ROUTE) }}
            style={{
              flex: 1.4, padding: '13px', background: '#F59E0B', color: '#2E1065', border: 'none',
              borderRadius: '10px', fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            Upgrade to Business Suite
          </button>
        </div>
      </div>
    </div>
  )
}
