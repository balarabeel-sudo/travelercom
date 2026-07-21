import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  primary: '#0EA5E9',
  secondary: '#F97316',
  text: '#0F172A',
  textMuted: '#64748B',
}

export default function CompanyMenu() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const items = [
    { icon: 'user', label: 'Company Profile', action: () => navigate('/account') },
    { icon: 'bell', label: 'Notifications', action: () => navigate('/notifications') },
    { icon: 'helpCircle', label: 'Help & Support', action: () => navigate('/support') },
    { icon: 'settings', label: 'Settings', action: () => navigate('/settings') },
    { icon: 'shield', label: 'Privacy Policy', action: () => navigate('/privacy') },
    { icon: 'fileText', label: 'Terms & Conditions', action: () => navigate('/terms') },
    { icon: 'info', label: 'About Traveler.com', action: () => navigate('/about') },
  ]

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
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Menu</h1>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ background: COLORS.card, borderRadius: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {items.map((item, i) => (
            <div
              key={item.label}
              onClick={item.action}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '15px 16px',
                borderBottom: i < items.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                cursor: 'pointer'
              }}>
              <Icon name={item.icon} size={19} color={COLORS.primary} />
              <p style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: COLORS.text }}>{item.label}</p>
              <Icon name="chevronRight" size={16} color={COLORS.textMuted} />
            </div>
          ))}
        </div>

        <div
          onClick={handleLogout}
          style={{
            marginTop: '16px',
            display: 'flex', alignItems: 'center', gap: '14px',
            background: COLORS.card, borderRadius: '14px', padding: '15px 16px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)', cursor: 'pointer'
          }}>
          <Icon name="logOut" size={19} color="#DC2626" />
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#DC2626' }}>Logout</p>
        </div>
      </div>
    </div>
  )
}
