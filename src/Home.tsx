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
  const [companyApproval, setCompanyApproval] = useState<'pending' | 'approved' | 'rejected'>('pending')

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        navigate('/login')
        return
      }
      const meta = data.user.user_metadata || {}
      const isCompany = meta.account_type === 'company'
      setAccountType(isCompany ? 'company' : 'personal')
      setDisplayName(meta.full_name || '')

      // Ensure a profiles row exists for this user (required for companies/wallets/bookings FK)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!existingProfile) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: meta.full_name || null,
          phone_number: meta.phone || null,
          account_type: isCompany ? 'company' : 'personal',
          company_name: isCompany ? (meta.full_name || null) : null,
          status: 'pending',
        })
      }
      
      if (isCompany) {
        const { data: existing } = await supabase
          .from('companies')
          .select('approval_status')
          .eq('owner_id', data.user.id)
          .maybeSingle()

        if (existing) {
          setCompanyApproval(existing.approval_status)
        } else {
          const { data: created } = await supabase
            .from('companies')
            .insert({
              owner_id: data.user.id,
              business_name: meta.full_name || 'My Company',
              business_type: meta.business_type || null,
              approval_status: 'pending'
            })
            .select('approval_status')
            .single()
          setCompanyApproval(created?.approval_status || 'pending')
        }
      }

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

  if (accountType === 'company') {
    const analytics = [
      { label: 'Total Bookings', value: 0, icon: '📦' },
      { label: 'Revenue', value: '₦0', icon: '💰' },
      { label: 'Pending Bookings', value: 0, icon: '⏳' },
      { label: 'Completed', value: 0, icon: '✅' },
      { label: 'Active Listings', value: 0, icon: '📋' },
    ]

    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>

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
          <div>
            <h1 style={{ fontSize: '19px', fontWeight: 800, color: COLORS.secondary, letterSpacing: '0.5px' }}>
              TRAVELER<span style={{ color: COLORS.primary }}>.COM</span>
            </h1>
            <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Company: {displayName}</p>
          </div>
          <div
            onClick={handleLogout}
            title="Logout"
            style={{
              width: '34px', height: '34px', borderRadius: '50%', background: COLORS.secondary,
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', cursor: 'pointer'
            }}>
            🚪
          </div>
        </div>

        {companyApproval !== 'approved' && (
          <div style={{
            background: companyApproval === 'rejected' ? '#fef2f2' : '#fff7ed',
            border: `1px solid ${companyApproval === 'rejected' ? '#fca5a5' : '#fdba74'}`,
            margin: '16px',
            borderRadius: '14px',
            padding: '14px'
          }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: companyApproval === 'rejected' ? '#b91c1c' : '#c2410c', marginBottom: '4px' }}>
              {companyApproval === 'rejected' ? '❌ Application Rejected' : '⏳ Account Pending Approval'}
            </p>
            <p style={{ fontSize: '12px', color: companyApproval === 'rejected' ? '#991b1b' : '#9a3412' }}>
              {companyApproval === 'rejected'
                ? 'Please contact support for more information.'
                : 'Upload your CAC document to get approved and start listing your services.'}
            </p>
          </div>
        )}

        <div style={{ padding: '0 16px' }}>

          <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>
            Overview
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            {analytics.map((a) => (
              <div key={a.label} style={{
                background: COLORS.card,
                borderRadius: '14px',
                padding: '16px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
              }}>
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>{a.icon}</div>
                <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text }}>{a.value}</p>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{a.label}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            <div
              onClick={() => navigate('/upload-docs')}
              style={{ background: COLORS.card, borderRadius: '14px', padding: '18px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '26px', marginBottom: '6px' }}>📄</div>
              <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>Upload CAC</p>
            </div>
            <div
              onClick={() => navigate('/add-listing')}
              style={{ background: COLORS.card, borderRadius: '14px', padding: '18px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '26px', marginBottom: '6px' }}>➕</div>
              <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>Add Listing</p>
            </div>
            <div
              onClick={() => navigate('/verify-booking')}
              style={{ background: COLORS.card, borderRadius: '14px', padding: '18px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '26px', marginBottom: '6px' }}>📷</div>
              <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>Verify Booking</p>
            </div>
            <div
              onClick={() => navigate('/wallet')}
              style={{ background: COLORS.card, borderRadius: '14px', padding: '18px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '26px', marginBottom: '6px' }}>💳</div>
              <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>Wallet</p>
            </div>
          </div>

          <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>
            My Listings
          </h3>
          <div style={{
            background: COLORS.card, borderRadius: '14px', padding: '20px', marginBottom: '24px',
            textAlign: 'center', color: COLORS.textMuted, boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
          }}>
            <p style={{ fontSize: '13px' }}>No listings yet</p>
          </div>

          <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>
            Bookings Received
          </h3>
          <div style={{
            background: COLORS.card, borderRadius: '14px', padding: '20px',
            textAlign: 'center', color: COLORS.textMuted, boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
          }}>
            <p style={{ fontSize: '13px' }}>No bookings yet</p>
          </div>
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

  const destinations = [
    { city: 'Lagos', emoji: '🌆', color: '#0369a1' },
    { city: 'Abuja', emoji: '🏛️', color: '#0EA5E9' },
    { city: 'Kaduna', emoji: '🕌', color: '#F97316' },
    { city: 'Kano', emoji: '🏺', color: '#0369a1' },
    { city: 'Port Harcourt', emoji: '🌊', color: '#0EA5E9' },
  ]

  // No real listings yet — will be populated once companies start adding services
  const hotels: { name: string; city: string; rating: number; price: number; rooms: number }[] = []
  const busRoutes: { route: string; company: string; time: string; price: number }[] = []
  const flights: { route: string; company: string; time: string; price: number }[] = []

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
        <p style={{ fontSize: '13px', opacity: 0.9 }}>
          Hotels, Transport, Flights & Tours in One Platform
        </p>
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

      {/* ---------- FEATURED DESTINATIONS ---------- */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginBottom: '12px', padding: '0 16px' }}>
          Featured Destinations
        </h3>
        <div style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          padding: '0 16px 4px 16px',
        }}>
          {destinations.map((d) => (
            <div
              key={d.city}
              onClick={() => navigate(`/search?city=${d.city}`)}
              style={{
                minWidth: '140px',borderRadius: '16px',
                overflow: 'hidden',
                background: COLORS.card,
                boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                cursor: 'pointer',
                flexShrink: 0
              }}>
              <div style={{
                height: '90px',
                background: `linear-gradient(135deg, ${d.color}, ${COLORS.primary})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px'
              }}>
                {d.emoji}
              </div>
              <div style={{ padding: '10px' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '2px' }}>
                  {d.city}
                </p>
                <p style={{ fontSize: '11px', color: COLORS.primary, fontWeight: 600 }}>
                  Explore →
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- RECOMMENDED HOTELS ---------- */}
      <div style={{ padding: '0 16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>
            Recommended Hotels
          </h3>
          <span
            onClick={() => navigate('/hotels')}
            style={{ fontSize: '12px', color: COLORS.primary, fontWeight: 700, cursor: 'pointer' }}>
            See all →
          </span>
        </div>

        {hotels.length === 0 ? (
          <div style={{
            background: COLORS.card,
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            color: COLORS.textMuted,
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
          }}>
            <p style={{ fontSize: '13px' }}>No hotels available yet</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Check back soon!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {hotels.map((h) => (
              <div
                key={h.name}
                onClick={() => navigate('/hotels')}
                style={{
                  display: 'flex',
                  gap: '12px',
                  background: COLORS.card,
                  borderRadius: '16px',
                  padding: '10px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                  cursor: 'pointer'
                }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '12px',
                  background: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  flexShrink: 0
                }}>
                  🏨
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>{h.name}</p>
                    <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>{h.city} • ⭐ {h.rating}</p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.primary }}>₦{h.price.toLocaleString()}<span style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: 400 }}> /night</span></p>
                      <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>{h.rooms} rooms left</p>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'white',
                      background: COLORS.secondary,
                      padding: '5px 10px',
                      borderRadius: '8px'
                    }}>
                      View
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- POPULAR BUS ROUTES ---------- */}
      <div style={{ padding: '0 16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>
            Popular Bus Routes
          </h3>
          <span onClick={() => navigate('/buses')} style={{ fontSize: '12px', color: COLORS.primary, fontWeight: 700, cursor: 'pointer' }}>
            See all →
          </span>
        </div>
        {busRoutes.length === 0 ? (
          <EmptyCard text="No bus routes available yet" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {busRoutes.map((r) => (
              <RouteCard key={r.route} {...r} navigate={navigate} path="/buses" />
            ))}
          </div>
        )}
      </div>

      {/* ---------- DOMESTIC FLIGHTS ---------- */}
      <div style={{ padding: '0 16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>
            Domestic Flights
          </h3>
          <span onClick={() => navigate('/flights')} style={{ fontSize: '12px', color: COLORS.primary, fontWeight: 700, cursor: 'pointer' }}>
            See all →
          </span>
        </div>
        {flights.length === 0 ? (
          <EmptyCard text="No flights available yet" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {flights.map((f) => (
              <RouteCard key={f.route} {...f} navigate={navigate} path="/flights" />
            ))}
          </div>
        )}
      </div>

      {/* ---------- PROMO BANNER ---------- */}
      <div style={{ padding: '0 16px', marginBottom: '24px' }}>
        <div style={{
          background: `linear-gradient(135deg, ${COLORS.secondary}, #ea580c)`,
          borderRadius: '18px',
          padding: '20px',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 8px 20px rgba(249,115,22,0.25)'
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>
              Travel Nigeria with Traveler.com
            </p>
            <p style={{ fontSize: '12px', opacity: 0.95 }}>
              One platform for hotels, buses, trains & flights.
            </p>
          </div>
          <div style={{ fontSize: '36px', marginLeft: '12px' }}>🧳</div>
        </div>
      </div>

      {/* ---------- RECENT BOOKINGS ---------- */}
      <div style={{ padding: '0 16px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>
          Recent Bookings
        </h3>
        <EmptyCard text="No bookings yet" subtext="Book your first trip!" />
      </div>

      {/* ---------- BOTTOM NAVIGATION ---------- */}
      <BottomNav active="home" navigate={navigate} />

    </div>
  )
}

function EmptyCard({ text, subtext }: { text: string; subtext?: string }) {
  return (
    <div style={{
      background: COLORS.card,
      borderRadius: '16px',
      padding: '20px',
      textAlign: 'center',
      color: COLORS.textMuted,
      boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
    }}>
      <p style={{ fontSize: '13px' }}>{text}</p>
      {subtext && <p style={{ fontSize: '12px', marginTop: '4px' }}>{subtext}</p>}
    </div>
  )
}

function RouteCard({ route, company, time, price, navigate, path }: {
  route: string; company: string; time: string; price: number;
  navigate: (p: string) => void; path: string
}) {
  return (
    <div
      onClick={() => navigate(path)}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: COLORS.card,
        borderRadius: '14px',
        padding: '14px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        cursor: 'pointer'
      }}>
      <div>
        <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{route}</p>
        <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>{company} • {time}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.primary, marginBottom: '4px' }}>₦{price.toLocaleString()}</p>
        <span style={{
          fontSize: '10.5px',
          fontWeight: 700,
          color: 'white',
          background: COLORS.secondary,
          padding: '4px 10px',
          borderRadius: '8px'
        }}>
          Book
        </span>
      </div>
    </div>
  )
}

function BottomNav({ active, navigate }: { active: string; navigate: (p: string) => void }) {
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
                
