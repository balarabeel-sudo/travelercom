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

type Hotel = {
  photo_url: string | null
  id: string
  title: string
  description: string | null
  destination: string
  price: number
  seats_available: number | null
  companies: { business_name: string } | null
}

function Hotels() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [hotels, setHotels] = useState<Hotel[]>([])

  const [city, setCity] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  const fetchHotels = async () => {
    setLoading(true)
    let query = supabase
      .from('services')
      .select('id, title, description, destination, price, seats_available, photo_url, companies(business_name)')
      .eq('category', 'hotel')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (city.trim()) {
      query = query.ilike('destination', `%${city.trim()}%`)
    }
    if (minPrice) {
      query = query.gte('price', parseFloat(minPrice))
    }
    if (maxPrice) {
      query = query.lte('price', parseFloat(maxPrice))
    }

    const { data } = await query
    setHotels((data as any) || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchHotels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClearFilters = () => {
    setCity('')
    setMinPrice('')
    setMaxPrice('')
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: COLORS.card,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <span onClick={() => navigate('/home')} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Hotels & Stays</h1>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{
          background: COLORS.card,
          borderRadius: '14px',
          padding: '14px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
          marginBottom: '16px'
        }}>
          <input
            type="text"
            placeholder="City (e.g. Lagos, Abuja)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <input
              type="number"
              placeholder="Min price"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              type="number"
              placeholder="Max price"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              onClick={fetchHotels}
              style={{
                flex: 1,
                padding: '11px',
                background: COLORS.secondary,
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer'
              }}>
              🔍 Search
            </button>
            <button
              onClick={() => { handleClearFilters(); fetchHotels() }}
              style={{
                padding: '11px 14px',
                background: COLORS.bg,
                color: COLORS.textMuted,
                border: `1px solid ${COLORS.border}`,
                borderRadius: '10px',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer'
              }}>
              Clear
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: COLORS.textMuted, fontSize: '13px', padding: '30px 0' }}>Loading...</p>
        ) : hotels.length === 0 ? (
          <div style={{
            background: COLORS.card,
            borderRadius: '16px',
            padding: '30px',
            textAlign: 'center',
            color: COLORS.textMuted,
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
          }}>
            <p style={{ fontSize: '13px' }}>No hotels found</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Try adjusting your filters.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {hotels.map((h) => (
              <div
                key={h.id}
                style={{
                  background: COLORS.card,
                  borderRadius: '16px',
                  padding: '14px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
                }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
<div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '12px',
                    background: h.photo_url ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '26px',
                    flexShrink: 0,
                    overflow: 'hidden'
                  }}>
                    {h.photo_url ? <img src={h.photo_url} alt={h.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🏨'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14.5px', fontWeight: 700, color: COLORS.text }}>{h.title}</p>
                    <p style={{ fontSize: '12px', color: COLORS.textMuted }}>{h.destination}</p>
                    <p style={{ fontSize: '11px', color: COLORS.textMuted }}>
                      {h.companies?.business_name || 'Traveler.com Partner'}
                    </p>
                  </div>
                </div>

                {h.description && (
                  <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '10px' }}>
                    {h.description}
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.primary }}>
                      ₦{h.price.toLocaleString()}<span style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 400 }}> /night</span>
                    </p>
                    {h.seats_available !== null && (
                      <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{h.seats_available} rooms available</p>
                    )}
                  </div>
                  <button
                    onClick={() => navigate(`/hotels/${h.id}`)}
                    style={{
                      padding: '9px 16px',
                      background: COLORS.secondary,
                      color: 'white',
                      border: 'none',
                      borderRadius: '9px',
                      fontWeight: 'bold',
                      fontSize: '12.5px',
                      cursor: 'pointer'
                    }}>
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '11px',
  border: `1px solid ${COLORS.border}`,
  borderRadius: '9px',
  fontSize: '13.5px',
  boxSizing: 'border-box' as const,
}

export default Hotels
