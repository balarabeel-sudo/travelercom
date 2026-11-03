import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import useIsDesktop from './useIsDesktop'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  title: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  purple: '#6B21A8',
  purpleDark: '#4C1D95',
  amber: '#F59E0B',
}

// Every item below is a feature that is locked (PRO) for Free-plan companies in the company
// dashboard, plus the verified badge that Business Suite profiles show.
const BENEFITS: { icon: string; title: string; description: string }[] = [
  {
    icon: 'box',
    title: 'Inventory management',
    description: 'Create room, seat and vehicle types with individual units, and see which ones are booked.',
  },
  {
    icon: 'barChart',
    title: 'Analytics and reports',
    description: 'Follow how your bookings and revenue perform across each of your listing categories.',
  },
  {
    icon: 'users',
    title: 'Staff access',
    description: 'Invite your team, assign roles, and control exactly what each person can see and do.',
  },
  {
    icon: 'ticket',
    title: 'Promotions',
    description: 'Create and manage promotions and discounts for your listings.',
  },
  {
    icon: 'star',
    title: 'Ratings and reviews',
    description: 'See what customers say about your listings through their ratings and reviews.',
  },
  {
    icon: 'userPlus',
    title: 'Guest records',
    description: 'Keep a record of your guests and add guests manually.',
  },
  {
    icon: 'shield',
    title: 'Verified badge',
    description: 'A blue verified badge on your company profile, so customers can trust your business.',
  },
]

// Free vs Business Suite. "Included" means the feature is open to Free-plan companies today.
const COMPARISON: { label: string; free: boolean }[] = [
  { label: 'Create listings and receive bookings', free: true },
  { label: 'Bookings management', free: true },
  { label: 'Wallet and withdrawals', free: true },
  { label: 'Inventory management', free: false },
  { label: 'Analytics and reports', free: false },
  { label: 'Staff access', free: false },
  { label: 'Promotions', free: false },
  { label: 'Ratings and reviews', free: false },
  { label: 'Guest records', free: false },
  { label: 'Verified badge on your profile', free: false },
]

type ViewState = 'loading' | 'ready' | 'already_business_suite' | 'request_pending' | 'submitting' | 'submitted' | 'error'

function UpgradeBusinessSuite() {
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const [state, setState] = useState<ViewState>('loading')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userData.user) {
        navigate('/login')
        return
      }

      const { data: company, error: companyErr } = await supabase
        .from('companies')
        .select('id, plan')
        .eq('owner_id', userData.user.id)
        .maybeSingle()

      if (companyErr || !company) {
        setErrorMsg('We could not load your company profile. Please try again.')
        setState('error')
        return
      }

      setCompanyId(company.id)

      if (company.plan === 'business_suite') {
        setState('already_business_suite')
        return
      }

      const { data: pendingRequest } = await supabase
        .from('business_suite_requests')
        .select('id')
        .eq('company_id', company.id)
        .eq('status', 'pending')
        .maybeSingle()

      setState(pendingRequest ? 'request_pending' : 'ready')
    }
    load()
  }, [navigate])

  const handleRequestUpgrade = async () => {
    if (!companyId) return
    setState('submitting')
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      navigate('/login')
      return
    }
    const { error } = await supabase.from('business_suite_requests').insert({
      company_id: companyId,
      requested_by: userData.user.id,
    })
    if (error) {
      setErrorMsg('Something went wrong sending your request. Please try again.')
      setState('error')
      return
    }
    setState('submitted')
  }

  // The request button or status message. Used on both phone and desktop.
  const actionArea = (
    <div>
      {state === 'loading' && (
        <div style={{ textAlign: 'center', padding: '16px' }}>
          <p style={{ fontSize: '13px', color: COLORS.textMuted, margin: 0 }}>Loading...</p>
        </div>
      )}

      {state === 'ready' && (
        <button
          type="button"
          onClick={handleRequestUpgrade}
          style={{
            width: '100%', padding: '15px 28px', borderRadius: '12px', border: 'none',
            background: COLORS.amber, color: '#2E1065', fontSize: '15px', fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          Request Upgrade
        </button>
      )}

      {state === 'submitting' && (
        <button type="button" disabled style={{
          width: '100%', padding: '15px 28px', borderRadius: '12px', border: 'none',
          background: COLORS.border, color: COLORS.textMuted, fontSize: '15px', fontWeight: 800, fontFamily: 'inherit',
        }}>
          Sending request...
        </button>
      )}

      {state === 'submitted' && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', padding: '14px 16px',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
        }}>
          <Icon name="checkCircle" size={18} color="#16A34A" />
          <div>
            <p style={{ fontSize: '13.5px', fontWeight: 700, color: '#166534', margin: '0 0 2px' }}>Request sent</p>
            <p style={{ fontSize: '12.5px', color: '#15803d', lineHeight: 1.4, margin: 0 }}>
              Our team will review your request and reach out to you soon.
            </p>
          </div>
        </div>
      )}

      {state === 'request_pending' && (
        <div style={{
          background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '12px', padding: '14px 16px',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
        }}>
          <Icon name="clock" size={18} color="#c2410c" />
          <div>
            <p style={{ fontSize: '13.5px', fontWeight: 700, color: '#c2410c', margin: '0 0 2px' }}>Request pending</p>
            <p style={{ fontSize: '12.5px', color: '#9a3412', lineHeight: 1.4, margin: 0 }}>
              You have already requested an upgrade. Our team is reviewing it.
            </p>
          </div>
        </div>
      )}

      {state === 'already_business_suite' && (
        <div style={{
          background: '#f3e8ff', border: '1px solid #d8b4fe', borderRadius: '12px', padding: '14px 16px',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
        }}>
          <Icon name="star" size={18} color={COLORS.purple} filled />
          <div>
            <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.purple, margin: '0 0 2px' }}>You are on Business Suite</p>
            <p style={{ fontSize: '12.5px', color: '#6b21a8', lineHeight: 1.4, margin: 0 }}>
              All Business Suite features are already active on your account.
            </p>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '14px 16px',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
        }}>
          <Icon name="alertTriangle" size={18} color="#b91c1c" />
          <div>
            <p style={{ fontSize: '13.5px', fontWeight: 700, color: '#b91c1c', margin: '0 0 2px' }}>Something went wrong</p>
            <p style={{ fontSize: '12.5px', color: '#991b1b', lineHeight: 1.4, margin: 0 }}>{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  )

  // ------------------------------------------------------------------
  // Desktop layout
  // ------------------------------------------------------------------
  if (isDesktop) {
    return (
      <div>
        {/* Hero */}
        <div style={{
          background: 'linear-gradient(135deg, #2E1065, #4C1D95 60%, #6D28D9)', borderRadius: '18px',
          padding: '34px 38px', color: 'white', display: 'flex', alignItems: 'center', gap: '40px', flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1 1 420px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', background: COLORS.amber, color: '#2E1065',
              fontSize: '12px', fontWeight: 800, padding: '5px 12px', borderRadius: '8px', marginBottom: '14px',
            }}>
              <Icon name="crown" size={13} color="#2E1065" /> BUSINESS SUITE
            </span>
            <h1 style={{ fontSize: '30px', fontWeight: 800, margin: '0 0 8px', lineHeight: 1.2 }}>
              Upgrade to <span style={{ color: COLORS.amber }}>Business Suite</span>
            </h1>
            <p style={{ fontSize: '15px', color: '#DDD6FE', margin: 0, lineHeight: 1.55, maxWidth: '560px' }}>
              Powerful tools to manage, operate and grow your business with Traveler.com.
            </p>
          </div>
          <div style={{ flex: '0 1 320px', minWidth: '260px' }}>
            {actionArea}
            <p style={{ fontSize: '11.5px', color: '#C4B5FD', textAlign: 'center', margin: '12px 0 0', lineHeight: 1.5 }}>
              No payment is required to send a request. Our team will contact you with next steps.
            </p>
          </div>
        </div>

        {/* Benefits */}
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: COLORS.title, margin: '30px 0 14px' }}>What you get with Business Suite</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {BENEFITS.map((b) => (
            <div key={b.title} style={{
              background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '18px',
              display: 'flex', alignItems: 'flex-start', gap: '14px',
            }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px', background: '#F3E8FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name={b.icon} size={20} color={COLORS.purple} />
              </div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 700, color: COLORS.title, margin: '0 0 4px' }}>{b.title}</p>
                <p style={{ fontSize: '13px', color: COLORS.textMuted, lineHeight: 1.5, margin: 0 }}>{b.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Comparison */}
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: COLORS.title, margin: '30px 0 14px' }}>Free plan and Business Suite</h2>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 140px 170px', padding: '14px 20px',
            background: '#F8FAFC', borderBottom: `1px solid ${COLORS.border}`,
            fontSize: '12.5px', fontWeight: 800, color: COLORS.textMuted,
          }}>
            <span>FEATURE</span>
            <span style={{ textAlign: 'center' }}>FREE</span>
            <span style={{ textAlign: 'center', color: COLORS.purple }}>BUSINESS SUITE</span>
          </div>
          {COMPARISON.map((row, i) => (
            <div key={row.label} style={{
              display: 'grid', gridTemplateColumns: '1fr 140px 170px', padding: '13px 20px', alignItems: 'center',
              borderBottom: i < COMPARISON.length - 1 ? `1px solid ${COLORS.border}` : 'none',
            }}>
              <span style={{ fontSize: '14px', color: COLORS.title }}>{row.label}</span>
              <span style={{ display: 'flex', justifyContent: 'center' }}>
                {row.free ? <Icon name="check" size={17} color="#16A34A" /> : <span style={{ color: '#CBD5E1', fontWeight: 700 }}>&mdash;</span>}
              </span>
              <span style={{ display: 'flex', justifyContent: 'center' }}>
                <Icon name="check" size={17} color="#16A34A" />
              </span>
            </div>
          ))}
        </div>

        {/* Bottom call to action (same request, so it is reachable after reading everything) */}
        {(state === 'ready' || state === 'submitting') && (
          <div style={{
            marginTop: '26px', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '14px',
            padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap',
          }}>
            <div>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.purpleDark, margin: 0 }}>Ready to unlock these features?</p>
              <p style={{ fontSize: '13px', color: COLORS.textMuted, margin: '4px 0 0' }}>
                Send a request and our team will contact you with next steps.
              </p>
            </div>
            <div style={{ width: '260px' }}>{actionArea}</div>
          </div>
        )}
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Phone layout
  // ------------------------------------------------------------------
  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        background: COLORS.card,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={20} color={COLORS.text} />
        </div>
        <h1 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Business Suite</h1>
      </div>

      {/* Hero */}
      <div style={{
        margin: '16px',
        padding: '28px 22px',
        borderRadius: '20px',
        background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.purpleDark})`,
        color: 'white',
        textAlign: 'center',
        boxShadow: '0 8px 24px rgba(107,33,168,0.3)',
      }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
        }}>
          <Icon name="crown" size={26} color="#FBBF24" />
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, lineHeight: 1.3, marginBottom: '8px' }}>
          Upgrade to Business Suite
        </h2>
        <p style={{ fontSize: '13.5px', opacity: 0.9, lineHeight: 1.5 }}>
          Powerful tools to manage, operate and grow your business with Traveler.com.
        </p>
      </div>

      {/* Benefits */}
      <div style={{ margin: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {BENEFITS.map((f) => (
          <div key={f.title} style={{
            background: COLORS.card, borderRadius: '14px', padding: '14px',
            display: 'flex', alignItems: 'flex-start', gap: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
          }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px', background: '#f3e8ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon name={f.icon} size={18} color={COLORS.purple} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text, marginBottom: '3px' }}>{f.title}</p>
              <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.4 }}>{f.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Request / status */}
      <div style={{ margin: '20px 16px 0' }}>
        {actionArea}
        <p style={{ fontSize: '10.5px', color: COLORS.textMuted, textAlign: 'center', marginTop: '14px', lineHeight: 1.5 }}>
          No payment is required to send a request. Our team will contact you with next steps.
        </p>
      </div>
    </div>
  )
}

export default UpgradeBusinessSuite
