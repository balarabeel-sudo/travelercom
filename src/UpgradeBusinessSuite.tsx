import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  purple: '#6B21A8',
  purpleDark: '#4C1D95',
}

const FEATURES: { icon: string; title: string; description: string }[] = [
  {
    icon: 'box',
    title: 'Manage Inventory',
    description: 'Track rooms, seats, vehicles and every listing your company sells, all in one place.',
  },
  {
    icon: 'users',
    title: 'Manage Staff Access',
    description: 'Add staff, assign roles, and control exactly what each person can see and do.',
  },
  {
    icon: 'calendar',
    title: 'Manage Bookings',
    description: 'A dedicated view of every booking, its status, customer and payment.',
  },
  {
    icon: 'contacts',
    title: 'Manage Customers',
    description: 'View customer details and booking history to serve them better.',
  },
  {
    icon: 'wallet',
    title: 'Payments & Finance',
    description: 'Track earnings, settlements and your full transaction history in real time.',
  },
  {
    icon: 'barChart',
    title: 'Business Analytics & Reports',
    description: 'Understand performance trends across bookings, revenue and inventory.',
  },
]

type ViewState = 'loading' | 'ready' | 'already_business_suite' | 'request_pending' | 'submitting' | 'submitted' | 'error'

function UpgradeBusinessSuite() {
  const navigate = useNavigate()
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

      {/* Feature list */}
      <div style={{ margin: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {FEATURES.map((f) => (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{f.title}</p>
                <Icon name="check" size={13} color="#16A34A" />
              </div>
              <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.4 }}>{f.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA / status area */}
      <div style={{ margin: '20px 16px 0' }}>
        {state === 'loading' && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p>
          </div>
        )}

        {state === 'ready' && (
          <button
            onClick={handleRequestUpgrade}
            style={{
              width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
              background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.purpleDark})`,
              color: 'white', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(107,33,168,0.3)',
            }}>
            Request Upgrade
          </button>
        )}

        {state === 'submitting' && (
          <button disabled style={{
            width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
            background: COLORS.border, color: COLORS.textMuted, fontSize: '15px', fontWeight: 800,
          }}>
            Sending request...
          </button>
        )}

        {state === 'submitted' && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '14px', padding: '16px',
            display: 'flex', alignItems: 'flex-start', gap: '10px',
          }}>
            <Icon name="checkCircle" size={18} color="#16A34A" />
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#166534', marginBottom: '2px' }}>Request sent</p>
              <p style={{ fontSize: '12px', color: '#15803d', lineHeight: 1.4 }}>
                Our team will review your request and reach out to you soon.
              </p>
            </div>
          </div>
        )}

        {state === 'request_pending' && (
          <div style={{
            background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '14px', padding: '16px',
            display: 'flex', alignItems: 'flex-start', gap: '10px',
          }}>
            <Icon name="clock" size={18} color="#c2410c" />
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#c2410c', marginBottom: '2px' }}>Request pending</p>
              <p style={{ fontSize: '12px', color: '#9a3412', lineHeight: 1.4 }}>
                You've already requested an upgrade. Our team is reviewing it.
              </p>
            </div>
          </div>
        )}

        {state === 'already_business_suite' && (
          <div style={{
            background: '#f3e8ff', border: '1px solid #d8b4fe', borderRadius: '14px', padding: '16px',
            display: 'flex', alignItems: 'flex-start', gap: '10px',
          }}>
            <Icon name="star" size={18} color={COLORS.purple} filled />
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.purple, marginBottom: '2px' }}>You're on Business Suite</p>
              <p style={{ fontSize: '12px', color: '#6b21a8', lineHeight: 1.4 }}>
                All Business Suite features are already active on your account.
              </p>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '14px', padding: '16px',
            display: 'flex', alignItems: 'flex-start', gap: '10px',
          }}>
            <Icon name="alertCircle" size={18} color="#b91c1c" />
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#b91c1c', marginBottom: '2px' }}>Something went wrong</p>
              <p style={{ fontSize: '12px', color: '#991b1b', lineHeight: 1.4 }}>{errorMsg}</p>
            </div>
          </div>
        )}

        <p style={{ fontSize: '10.5px', color: COLORS.textMuted, textAlign: 'center', marginTop: '14px', lineHeight: 1.5 }}>
          No payment is required to send a request. Our team will contact you with next steps.
        </p>
      </div>
    </div>
  )
}

export default UpgradeBusinessSuite
