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
        { icon: 'creditCard', label: 'Wallet', path: '/wallet' },
        { icon: 'cash', label: 'Payment Methods', path: '/payment-methods' },
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
        { icon: 'fileText', label: 'Terms & Conditions', path: '/terms' },
        { icon: 'lock', label: 'Privacy Policy', path: '/privacy' },
      ]
    },
    {
      title: 'Preferences',
      items: [
        { icon: 'settings', label: 'Settings', path: '/settings' },
      ]
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>

      {/* Header */}
      <div style={{
        padding: '18px 20px',
        background: COLORS.card,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <h1 style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text }}>Account</h1>
      </div>

      {/* Profile summary card */}
      <div style={{
        margin: '16px',
        background: COLORS.card,
        borderRadius: '16px',
        padding: '18px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        cursor: 'pointer'
      }}
        onClick={() => navigate('/profile')}>
        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          background: COLORS.primary,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          fontWeight: 'bold'
        }}>
          {displayName ? displayName.charAt(0).toUpperCase() : <Icon name="user" size={24} color="white" />}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: COLORS.text }}>{displayName || 'Traveler'}</p>
          <p style={{ fontSize: '12px', color: COLORS.textMuted }}>{email}</p>
        </div>
        <span style={{ fontSize: '18px', color: COLORS.textMuted }}>›</span>
      </div>

      {/* Menu sections */}
      {sections.map((section) => (
        <div key={section.title} style={{ margin: '0 16px 20px 16px' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '8px', paddingLeft: '4px' }}>
            {section.title.toUpperCase()}
          </p>
          <div style={{
            background: COLORS.card,
            borderRadius: '14px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            overflow: 'hidden'
          }}>
            {section.items.map((item, idx) => (
              <div
                key={item.label}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  borderBottom: idx < section.items.length - 1 ? `1px solid ${COLORS.border}` : 'none'
                }}>
                <span style={{ display: 'flex', color: COLORS.text }}><Icon name={item.icon} size={18} color={COLORS.text} /></span>
                <span style={{ flex: 1, fontSize: '14px', color: COLORS.text }}>{item.label}</span>
                <span style={{ fontSize: '16px', color: COLORS.textMuted }}>›</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Logout */}
      <div style={{ margin: '0 16px 20px 16px' }}>
        <div
          onClick={handleLogout}
          style={{
            background: COLORS.card,
            borderRadius: '14px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer'
          }}>
          <span style={{ display: 'flex' }}><Icon name="logOut" size={18} color={COLORS.red} /></span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: COLORS.red }}>Logout</span>
        </div>
      </div>

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
