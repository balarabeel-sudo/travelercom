import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
}

function Home() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [accountType, setAccountType] = useState<'personal' | 'company'>('personal')
  const [displayName, setDisplayName] = useState('')
  const [destination, setDestination] = useState('')

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        navigate('/login')
        return
      }
      const meta = data.user.user_metadata || {}
      setAccountType(meta.account_type === 'company' ? 'company' : 'personal')
      setDisplayName(meta.full_name || '')
      setLoading(false)
    }
    loadUser()
  }, [navigate])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: COLORS.textMuted,
        fontSize: '14px'
      }}>
        Loading...
      </div>
    )
  }

  // Company users see a completely separate dashboard (built in a later step)
  if (accountType === 'company') {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
        <div>
          <p style={{ color: COLORS.textMuted, fontSize: '14px', marginBottom: '12px' }}>
            Company Dashboard coming in the next step.
          </p>
          <button onClick={handleLogout} style={{ padding: '10px 24px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>
            Logout
          </button>
        </div>
      </div>
    )
  }

  const services = [
    { icon: '🏨', label: 'Hotels & Stays', desc: 'Find your comfort', path: '/hotels' },
    { icon: '🚌', label: 'Bus Stations', desc: 'Travel by road', path: '/buses' },
    { icon: '🚆', label: 'Railway', desc: 'Travel by train', path: '/trains' },
    { icon: '✈️', label: 'Domestic Flights', desc: 'Fly across Nigeria', path: '/flights' },
    { icon: '🗺️', label: 'Tours & Attractions', desc: 'Explore places', path: '/tours' },
    { icon: '🎪', label: 'Event Centers', desc: 'Book a venue', path: '/events' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>

      {/* ---------- HEADER ---------- */}
      <div style={{
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: COLORS.card,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <h1 style={{ fontSize: '19px', fontWeight: 800, color: COLORS.primary, letterSpacing: '0.5px' }}>
          TRAVELER<span style={{ color: COLORS.secondary }}>.COM</span>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '19px', cursor: 'pointer' }}>🔔</div>
          <div
            onClick={handleLogout}
            title="Logout"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: COLORS.primary,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}>
            {displayName ? displayName.charAt(0).toUpperCase() : '👤'}
          </div>
        </div>
      </div>

      {/* ---------- HERO SECTION ---------- */}
      <div style={{
        margin: '16px',
        borderRadius: '20px',
        padding: '24px 20px',
        background: `linear-gradient(135deg, ${COLORS.primary}, #0369a1)`,
        color: 'white',
        boxShadow: '0 8px 24px rgba(14,165,233,0.25)'
      }}>
        <h2 style={{ fontSize: '21px', fontWeight: 800, lineHeight: 1.3, marginBottom: '6px' }}>
          Explore Nigeria With Confidence
        </h2>
        <p style={{ fontSize: '13px', opacity: 0.9, marginBottom: '18px' }}>
          Hotels, Transport, Flights & Tours in One Platform
        </p>

        {/* Search card */}
        <div style={{
          background: 'white',
          borderRadius: '14px',
          padding: '14px',
        }}>
          <input
            type="text"
            placeholder="Where are you going?"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '10px',
              fontSize: '14px',
              marginBottom: '10px',
              boxSizing: 'border-box',
              color: COLORS.text
            }}
          />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: 'bold' }}>CHECK-IN</label>
              <input type="date" style={{ width: '100%', padding: '8px', border: `1px solid ${COLORS.border}`, borderRadius: '8px', fontSize: '12px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: 'bold' }}>CHECK-OUT</label>
              <input type="date" style={{ width: '100%', padding: '8px', border: `1px solid ${COLORS.border}`, borderRadius: '8px', fontSize: '12px', boxSizing: 'border-box' }} />
            </div>
          </div>
          <button style={{
            width: '100%',
            padding: '12px',
            background: COLORS.secondary,
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer'
          }}>
            🔍 Search
          </button>
        </div>
      </div>

      {/* ---------- QUICK SERVICES GRID ---------- */}
      <div style={{ padding: '4px 16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>
          Our Services
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          {services.map((s) => (
            <ServiceCard key={s.label} {...s} navigate={navigate} />
          ))}
        </div>
      </div>

      {/* ---------- BOTTOM NAVIGATION ---------- */}
      <BottomNav active="home" navigate={navigate} />

    </div>
  )function BottomNav({ active, navigate }: { active: string; navigate: (p: string) => void }) {
  const items = [
    { key: 'home', icon: '🏠', label: 'Home', path: '/home' },
    { key: 'search', icon: '🔍', label: 'Search', path: '/search' },
    { key: 'bookings', icon: '🎫', label: 'Bookings', path: '/bookings' },
    { key: 'account', icon: '👤', label: 'Account', path: '/account' },
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
          <span style={{ fontSize: '20px', opacity: active === item.key ? 1 : 0.5 }}>
            {item.icon}
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

function ServiceCard({ icon, label, desc, path, navigate, wide }: {
  icon: string; label: string; desc: string; path: string;
  navigate: (p: string) => void; wide?: boolean
}) {
  return (
    <div
      onClick={() => navigate(path)}
      style={{
        background: COLORS.card,
        borderRadius: '16px',
        padding: '16px',
        cursor: 'pointer',
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: wide ? 'center' : 'flex-start',
        flexDirection: wide ? 'row' : 'column',
        gap: wide ? '12px' : '0',
      }}>
      <div style={{
        fontSize: '24px',
        marginBottom: wide ? 0 : '10px',
        width: '44px',
        height: '44px',
        background: COLORS.bg,
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text, marginBottom: '2px' }}>
          {label}
        </p>
        <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>
          {desc}
        </p>
      </div>
    </div>
  )
}

export default Home
}
