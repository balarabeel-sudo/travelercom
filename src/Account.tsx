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
  red: '#dc2626',
}

const SECTION_ITEM_DESC: Record<string, string> = {
  'My Profile': 'View and edit your personal information',
  'My Bookings': 'Your booking history and status',
  'Wallet': 'Manage your balance and top-ups',
  'Payment Methods': 'Cards and payment options',
  'Saved Favorites': 'Places and trips you\u2019ve saved',
  'Notifications': 'Manage alerts and preferences',
  'Help & Support': 'Get help or contact us',
  'About Traveler.com': 'Learn more about our platform',
  'Terms & Conditions': 'Review our terms of service',
  'Privacy Policy': 'How we handle your data',
  'Settings': 'App preferences and security',
}

function AccountSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '0 16px 22px 16px' }}>
      {title && (
        <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '8px', paddingLeft: '4px', letterSpacing: '0.4px' }}>
          {title.toUpperCase()}
        </p>
      )}
      <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}` }}>
        {children}
      </div>
    </div>
  )
}

function AccountRow({ icon, label, desc, onClick, isLast, danger }: {
  icon: string; label: string; desc?: string; onClick: () => void; isLast?: boolean; danger?: boolean
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '13px',
        padding: '13px 15px',
        cursor: 'pointer',
        borderBottom: isLast ? 'none' : `1px solid ${COLORS.border}`,
      }}>
      <div style={{
        width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
        background: danger ? '#FEF2F2' : '#F1F5F9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={16} color={danger ? COLORS.red : COLORS.text} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13.5px', fontWeight: 600, color: danger ? COLORS.red : COLORS.text }}>{label}</p>
        {desc && <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '1px' }}>{desc}</p>}
      </div>
      {!danger && <Icon name="chevronRight" size={16} color={COLORS.textMuted} />}
    </div>
  )
}

function Account() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        navigate('/login')
        return
      }
      setDisplayName(data.user.user_metadata?.full_name || '')
      setEmail(data.user.email || '')
    }
    loadUser()
  }, [navigate])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const sections = [
    {
      title: 'My Account',
      items: [
        { icon: 'user', label: 'My Profile', path: '/profile' },
        { icon: 'ticket', label: 'My Bookings', path: '/bookings' },
        { icon: 'wallet', label: 'Wallet', path: '/wallet' },
        { icon: 'creditCard', label: 'Payment Methods', path: '/payment-methods' },
      ]
    },
    {
      title: 'Saved',
      items: [
        { icon: 'star', label: 'Saved Favorites', path: '/favorites' },
        { icon: 'bell', label: 'Notifications', path: '/notifications' },
      ]
    },
    {
      title: 'Support',
      items: [
        { icon: 'chat', label: 'Help & Support', path: '/support' },
        { icon: 'info', label: 'About Traveler.com', path: '/about' },
        { icon: 'fileText', label: 'Terms & Conditions', path: '/customer-terms' },
        { icon: 'lock', label: 'Privacy Policy', path: '/customer-privacy' },
      ]
    },
    {
      title: 'Preferences',
      items: [
        { icon: 'settings', label: 'Settings', path: '/customer-settings' },
      ]
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>

      {/* Header */}
      <div style={{
        padding: '16px 20px',
        background: COLORS.card,
        borderBottom: `1px solid ${COLORS.border}`
      }}>
        <h1 style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text }}>Account</h1>
      </div>

      {/* Profile summary card */}
      <div style={{
        margin: '16px',
        background: COLORS.card,
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '13px',
        border: `1px solid ${COLORS.border}`,
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: COLORS.primary,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '19px',
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {displayName ? displayName.charAt(0).toUpperCase() : <Icon name="user" size={22} color="white" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '14.5px', fontWeight: 700, color: COLORS.text }}>{displayName || 'Traveler'}</p>
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '1px' }}>{email}</p>
        </div>
        <div
          onClick={() => navigate('/profile')}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0,
            border: `1px solid ${COLORS.border}`, borderRadius: '9px', padding: '7px 11px',
            cursor: 'pointer',
          }}>
          <Icon name="edit" size={13} color={COLORS.text} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>Edit</span>
        </div>
      </div>

      {/* Menu sections */}
      {sections.map((section) => (
        <AccountSection key={section.title} title={section.title}>
          {section.items.map((item, idx) => (
            <AccountRow
              key={item.label}
              icon={item.icon}
              label={item.label}
              desc={SECTION_ITEM_DESC[item.label]}
              onClick={() => navigate(item.path)}
              isLast={idx === section.items.length - 1}
            />
          ))}
        </AccountSection>
      ))}

      {/* Logout */}
      <AccountSection title="">
        <AccountRow icon="logOut" label="Logout" onClick={handleLogout} isLast danger />
      </AccountSection>

      {/* Bottom Navigation */}
      <BottomNav active="account" navigate={navigate} />
    </div>
  )
}

function BottomNav({ active, navigate }: { active: string; navigate: (p: string) => void }) {
  const items = [
    { key: 'home', icon: 'home', label: 'Home', path: '/home' },
    { key: 'search', icon: 'search', label: 'Search', path: '/search' },
    { key: 'bookings', icon: 'ticket', label: 'Bookings', path: '/bookings' },
    { key: 'account', icon: 'user', label: 'Account', path: '/account' },
  ]

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      maxWidth: '480px',
      margin: '0 auto',
      background: COLORS.card,
      borderTop: `1px solid ${COLORS.border}`,
      display: 'flex',
      justifyContent: 'space-around',
      padding: '10px 0 14px 0',
      boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
    }}>
      {items.map((item) => (
        <div
          key={item.key}
          onClick={() => navigate(item.path)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            gap: '2px'
          }}>
          <span style={{ display: 'flex', opacity: active === item.key ? 1 : 0.5 }}>
            <Icon name={item.icon} size={20} color={active === item.key ? COLORS.primary : COLORS.textMuted} />
          </span>
          <span style={{
            fontSize: '10.5px',
            fontWeight: active === item.key ? 700 : 500,
            color: active === item.key ? COLORS.primary : COLORS.textMuted
          }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export default Account
