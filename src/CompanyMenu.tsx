import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  primary: '#0EA5E9',
  purple: '#6B21A8',
  text: '#0F172A',
  textMuted: '#64748B',
  red: '#DC2626',
  amber: '#D97706',
  green: '#16A34A',
}

export default function CompanyMenu() {
  const navigate = useNavigate()
  const [businessName, setBusinessName] = useState('')
  const [companyPlan, setCompanyPlan] = useState<'free' | 'business_suite'>('free')

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return
      const { data: company } = await supabase
        .from('companies')
        .select('business_name, plan')
        .eq('owner_id', userData.user.id)
        .maybeSingle()
      if (company) {
        setBusinessName(company.business_name)
        setCompanyPlan(company.plan || 'free')
      }
    }
    load()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const items = [
    { icon: 'user', iconBg: '#F3E8FF', iconColor: COLORS.purple, label: 'Company Profile', sub: 'View and manage your company information', action: () => navigate('/company-profile') },
    { icon: 'bell', iconBg: '#DBEAFE', iconColor: COLORS.primary, label: 'Notifications', sub: 'View your notifications and alerts', action: () => navigate('/notifications') },
    { icon: 'helpCircle', iconBg: '#DCFCE7', iconColor: COLORS.green, label: 'Help & Support', sub: 'Get help and contact our support team', action: () => navigate('/support') },
    { icon: 'settings', iconBg: '#FFEDD5', iconColor: COLORS.amber, label: 'Settings', sub: 'Manage your account and preferences', action: () => navigate('/settings') },
    { icon: 'shield', iconBg: '#DBEAFE', iconColor: COLORS.primary, label: 'Privacy Policy', sub: 'Read our privacy policy', action: () => navigate('/privacy') },
    { icon: 'fileText', iconBg: '#F3E8FF', iconColor: COLORS.purple, label: 'Terms & Conditions', sub: 'Read our terms and conditions', action: () => navigate('/terms') },
    { icon: 'info', iconBg: '#DBEAFE', iconColor: COLORS.primary, label: 'About Traveler.com', sub: 'Learn more about us', action: () => navigate('/about') },
  ]

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>

      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text }}>Menu</h1>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>Manage your company account</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        <div style={{ background: COLORS.card, borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: '14px' }}>
          {items.map((item, i) => (
            <div
              key={item.label}
              onClick={item.action}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px', padding: '15px 16px',
                borderBottom: i < items.length - 1 ? `1px solid ${COLORS.border}` : 'none', cursor: 'pointer'
              }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: item.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={item.icon} size={18} color={item.iconColor} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>{item.label}</p>
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '1px' }}>{item.sub}</p>
              </div>
              <Icon name="chevronRight" size={17} color={COLORS.purple} />
            </div>
          ))}
        </div>

        <div
          onClick={handleLogout}
          style={{
            background: COLORS.card, borderRadius: '16px', padding: '15px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', marginBottom: '18px'
          }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="logOut" size={18} color={COLORS.red} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.red }}>Logout</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '1px' }}>Sign out of your account</p>
          </div>
          <Icon name="chevronRight" size={17} color={COLORS.red} />
        </div>

        {companyPlan === 'free' && (
          <div style={{
            background: `linear-gradient(135deg, #2E1065, #4C1D95)`, borderRadius: '18px', padding: '22px',
            color: 'white', marginBottom: '16px'
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F59E0B', color: '#2E1065', fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '7px', marginBottom: '12px' }}>
              <Icon name="crown" size={11} color="#2E1065" /> PREMIUM
            </span>
            <p style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px' }}>
              Upgrade to <span style={{ color: '#F59E0B' }}>Business Suite</span>
            </p>
            <p style={{ fontSize: '12.5px', color: '#DDD6FE', marginBottom: '16px' }}>Unlock more power. Manage better. Grow faster.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <FeatureItem title="Manage all activities" text="Control bookings, inventory & pricing in one place." />
              <FeatureItem title="Advanced analytics" text="Deep insights and reports to grow your business." />
              <FeatureItem title="Priority support" text="Get faster help from our dedicated team." />
              <FeatureItem title="More visibility" text="Feature your property to more customers." />
            </div>

            <div
              onClick={() => navigate('/support')}
              style={{
                background: '#F59E0B', color: '#2E1065', textAlign: 'center', padding: '13px',
                borderRadius: '12px', fontWeight: 800, fontSize: '14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '12px'
              }}>
              Upgrade Now <Icon name="chevronRight" size={16} color="#2E1065" />
            </div>
            <p style={{ fontSize: '11px', color: '#C4B5FD', textAlign: 'center' }}>🛡️ Secure · Reliable · Trusted</p>
          </div>
        )}

        <div style={{
          background: companyPlan === 'business_suite' ? '#F5F3FF' : '#F1F5F9', borderRadius: '16px', padding: '16px',
          display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: COLORS.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '17px' }}>
            👋
          </div>
          <div>
            <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.purple }}>Welcome back, {businessName || 'Company'}!</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>Here's what's happening with your business today.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureItem({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '13px', flexShrink: 0 }}>✅</span>
      <div>
        <p style={{ fontSize: '12px', fontWeight: 700, color: 'white' }}>{title}</p>
        <p style={{ fontSize: '10.5px', color: '#C4B5FD', marginTop: '2px', lineHeight: 1.4 }}>{text}</p>
      </div>
    </div>
  )
}
