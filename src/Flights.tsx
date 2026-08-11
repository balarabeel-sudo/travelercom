import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import { ListCardSkeleton } from './LoadingSkeleton'
import NetworkError from './NetworkError'

const COLORS = {
  primary: '#0EA5E9',
  navy: '#0B1E3D',
  secondary: '#F97316',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16A34A',
  gold: '#D4A017',
}

const TRAVEL_AMENITY_ICON: Record<string, string> = {
  WiFi: 'wifi', AC: 'snowflake', 'Charging Port': 'plug', Meals: 'food', 'Reclining Seats': 'seat', Toilet: 'toilet', Refundable: 'refresh', 'Baggage Allowance': 'luggage',
}

type Flight = {
  id: string
  title: string
  description: string | null
  origin: string | null
  destination: string
  departure_time: string | null
  arrival_time: string | null
  duration_minutes: number | null
  price: number
  seats_available: number | null
  photo_url: string | null
  amenities: string[] | null
  companies: { business_name: string } | null
  avgRating: number | null
  reviewCount: number
}

type SortKey = 'recommended' | 'price_low' | 'price_high' | 'rating'
type TripType = 'oneway' | 'roundtrip' | 'multicity'

function Flights() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [flights, setFlights] = useState<Flight[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())

  const [tripType, setTripType] = useState<TripType>('oneway')
  const [comingSoonMsg, setComingSoonMsg] = useState('')

  const [destination, setDestination] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  const [sortBy, setSortBy] = useState<SortKey>('recommended')
  const [showSort, setShowSort] = useState(false)

  const fetchFlights = async () => {
    setLoading(true)
    setNetError(false)
    let query = supabase
      .from('services')
      .select('id, title, description, origin, destination, departure_time, arrival_time, duration_minutes, price, seats_available, photo_url, amenities, companies(business_name)')
      .eq('category', 'flight')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (destination.trim()) query = query.ilike('destination', `%${destination.trim()}%`)
    if (minPrice) query = query.gte('price', parseFloat(minPrice))
    if (maxPrice) query = query.lte('price', parseFloat(maxPrice))

    const { data, error } = await query
    if (error) {
      setNetError(true)
      setLoading(false)
      return
    }
    const rows = (data as any[]) || []

    let ratingMap: Record<string, number[]> = {}
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id)
      const { data: reviewRows } = await supabase.from('reviews').select('service_id, rating').in('service_id', ids)
      ;(reviewRows || []).forEach((r: any) => {
        if (r.rating == null) return
        if (!ratingMap[r.service_id]) ratingMap[r.service_id] = []
        ratingMap[r.service_id].push(Number(r.rating))
      })
    }

    setFlights(rows.map((h) => {
      const ratings = ratingMap[h.id] || []
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
      return { ...h, avgRating, reviewCount: ratings.length }
    }))
    setLoading(false)
  }

  useEffect(() => {
    fetchFlights()
    const loadFavorites = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return
      const { data: favRows } = await supabase.from('favorites').select('service_id').eq('user_id', userData.user.id)
      setFavoriteIds(new Set((favRows || []).map((f: any) => f.service_id)))
    }
    loadFavorites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!comingSoonMsg) return
    const t = setTimeout(() => setComingSoonMsg(''), 2200)
    return () => clearTimeout(t)
  }, [comingSoonMsg])

  const toggleFavorite = async (e: React.MouseEvent, serviceId: string) => {
    e.stopPropagation()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const isFav = favoriteIds.has(serviceId)
    const next = new Set(favoriteIds)
    if (isFav) {
      next.delete(serviceId)
      setFavoriteIds(next)
      await supabase.from('favorites').delete().eq('user_id', userData.user.id).eq('service_id', serviceId)
    } else {
      next.add(serviceId)
      setFavoriteIds(next)
      await supabase.from('favorites').insert({ user_id: userData.user.id, service_id: serviceId })
    }
  }

  const visible = [...flights].sort((a, b) => {
    if (sortBy === 'price_low') return a.price - b.price
    if (sortBy === 'price_high') return b.price - a.price
    if (sortBy === 'rating') return (b.avgRating ?? -1) - (a.avgRating ?? -1)
    return 0
  })

  const bestDealId = flights.length > 1 ? [...flights].sort((a, b) => a.price - b.price)[0].id : null
  const popularId = (() => {
    const withReviews = flights.filter((f) => f.reviewCount > 0)
    if (withReviews.length < 2) return null
    return [...withReviews].sort((a, b) => b.reviewCount - a.reviewCount)[0].id
  })()

  const SORT_LABELS: Record<SortKey, string> = {
    recommended: 'Recommended', price_low: 'Price: Low to High', price_high: 'Price: High to Low', rating: 'Top Rated',
  }

  const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'
  const fmtDuration = (mins: number | null) => mins ? `${Math.floor(mins / 60)}h ${mins % 60}m` : ''

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      {comingSoonMsg && (
        <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', background: COLORS.navy, color: 'white', fontSize: '12.5px', fontWeight: 600, padding: '10px 18px', borderRadius: '10px', zIndex: 50, boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
          {comingSoonMsg}
        </div>
      )}

      <div style={{ padding: '16px 20px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span onClick={() => navigate('/home')} style={{ fontSize: '20px', cursor: 'pointer', marginTop: '6px' }}>←</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="plane" size={18} color={COLORS.primary} /></div>
            <div>
              <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Domestic Flights</h1>
              <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Book affordable flights across Nigeria</p>
            </div>
          </div>
          <span style={{ color: COLORS.textMuted, marginTop: '6px', display: 'flex' }}><Icon name="heart" size={18} color={COLORS.textMuted} /></span>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Trip type + search — navy card */}
        <div style={{ background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.primary})`, borderRadius: '18px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '4px', marginBottom: '12px' }}>
            {([
              ['oneway', '➤ One-way'],
              ['roundtrip', '⇄ Round-trip'],
              ['multicity', '⚬ Multi-city'],
            ] as [TripType, string][]).map(([key, label]) => (
              <div
                key={key}
                onClick={() => key === 'oneway' ? setTripType('oneway') : setComingSoonMsg(`${label.replace(/^[^ ]+ /, '')} is coming soon`)}
                style={{
                  flex: 1, textAlign: 'center' as const, padding: '9px 4px', borderRadius: '9px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                  background: tripType === key ? 'white' : 'transparent',
                  color: tripType === key ? COLORS.navy : 'rgba(255,255,255,0.85)',
                }}>
                {label}
              </div>
            ))}
          </div>

          <input type="text" placeholder="Destination (e.g. Abuja)" value={destination} onChange={(e) => setDestination(e.target.value)}
            style={{ ...inputStyle, background: 'white', marginBottom: '8px' }} />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input type="number" placeholder="Min price (₦)" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={{ ...inputStyle, background: 'white', flex: 1 }} />
            <input type="number" placeholder="Max price (₦)" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={{ ...inputStyle, background: 'white', flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={fetchFlights} style={{ flex: 1, padding: '12px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Icon name="search" size={15} color="white" /> Search
            </button>
            <button onClick={() => { setDestination(''); setMinPrice(''); setMaxPrice(''); fetchFlights() }} style={{ padding: '12px 16px', background: 'white', color: COLORS.navy, border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        </div>

        {/* Trust row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', background: COLORS.card, borderRadius: '14px', padding: '14px 8px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          {[
            ['checkCircle', 'Best Fares'],
            ['luggage', 'Safe Booking'],
            ['headphones', '24/7 Support'],
            ['shield', 'Secure Payment'],
          ].map(([icon, label]) => (
            <div key={label} style={{ flex: 1, textAlign: 'center' as const }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}><Icon name={icon} size={18} color={COLORS.primary} /></div>
              <p style={{ fontSize: '9.5px', fontWeight: 700, color: COLORS.text, marginTop: '4px' }}>{label}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>
            {loading ? 'Searching...' : `${visible.length} flight${visible.length !== 1 ? 's' : ''} found`}
          </p>
          <div style={{ position: 'relative' }}>
            <span onClick={() => setShowSort(!showSort)} style={{ fontSize: '12px', color: COLORS.primary, fontWeight: 700, cursor: 'pointer' }}>
              Sort: {SORT_LABELS[sortBy]} ⌄
            </span>
            {showSort && (
              <div style={{ position: 'absolute', right: 0, top: '22px', background: COLORS.card, borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 20, overflow: 'hidden', width: '170px' }}>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <div key={k} onClick={() => { setSortBy(k); setShowSort(false) }} style={{ padding: '10px 14px', fontSize: '12.5px', color: sortBy === k ? COLORS.primary : COLORS.text, fontWeight: sortBy === k ? 700 : 500, cursor: 'pointer' }}>
                    {SORT_LABELS[k]}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {netError ? (
          <NetworkError onRetry={fetchFlights} />
        ) : loading ? (
          <ListCardSkeleton count={4} />
        ) : visible.length === 0 ? (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '30px', textAlign: 'center', color: COLORS.textMuted, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '13px' }}>No flights found</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Try a different destination or clear your filters.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {visible.map((f) => (
              <div key={f.id} onClick={() => navigate(`/flight/${f.id}`)} style={{ background: COLORS.card, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
                <div style={{ position: 'relative', height: '110px' }}>
                  <div style={{ width: '100%', height: '100%', background: f.photo_url ? undefined : `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px' }}>
                    {f.photo_url ? <img src={f.photo_url} alt={f.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="plane" size={30} color="white" />}
                  </div>
                  <div onClick={(e) => toggleFavorite(e, f.id)} style={{ position: 'absolute', top: '10px', right: '10px', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: favoriteIds.has(f.id) ? COLORS.secondary : '#94a3b8' }}>
                    <Icon name="heart" size={15} color={favoriteIds.has(f.id) ? COLORS.secondary : '#94a3b8'} filled={favoriteIds.has(f.id)} />
                  </div>
                  {f.id === bestDealId && (
                    <span style={{ position: 'absolute', top: '10px', left: '10px', background: COLORS.green, color: 'white', fontSize: '10.5px', fontWeight: 700, padding: '5px 10px', borderRadius: '20px' }}>Best Deal</span>
                  )}
                  {f.id === popularId && f.id !== bestDealId && (
                    <span style={{ position: 'absolute', top: '10px', left: '10px', background: COLORS.secondary, color: 'white', fontSize: '10.5px', fontWeight: 700, padding: '5px 10px', borderRadius: '20px' }}>Popular</span>
                  )}
                </div>

                <div style={{ padding: '14px' }}>
                  <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{f.companies?.business_name || 'Traveler.com Partner'}</p>
                  {f.avgRating !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                      <span style={{ background: '#FEF3C7', color: COLORS.gold, fontSize: '11.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Icon name="star" size={11} color={COLORS.gold} filled /> {f.avgRating.toFixed(1)}</span>
                      <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>({f.reviewCount} review{f.reviewCount !== 1 ? 's' : ''})</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', marginTop: '12px' }}>
                    <div style={{ textAlign: 'center' as const }}>
                      <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtTime(f.departure_time)}</p>
                      <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>{f.origin || '—'}</p>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' as const, padding: '0 8px' }}>
                      <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{fmtDuration(f.duration_minutes)}</p>
                      <div style={{ height: '1px', background: COLORS.border, margin: '4px 0', position: 'relative' }}>
                        <span style={{ position: 'absolute', right: 0, top: '-9px', display: 'flex' }}><Icon name="plane" size={14} color={COLORS.textMuted} /></span>
                      </div>
                      <p style={{ fontSize: '9.5px', color: COLORS.green, fontWeight: 700 }}>Direct</p>
                    </div>
                    <div style={{ textAlign: 'center' as const }}>
                      <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtTime(f.arrival_time)}</p>
                      <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>{f.destination}</p>
                    </div>
                  </div>

                  {f.amenities && f.amenities.length > 0 && (
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      {f.amenities.slice(0, 3).map((a) => (
                        <span key={a} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', color: COLORS.textMuted, fontWeight: 600 }}>
                          <Icon name={TRAVEL_AMENITY_ICON[a] || 'check'} size={12} color={COLORS.textMuted} /> {a}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${COLORS.border}` }}>
                    <div>
                      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.primary }}>₦{Number(f.price).toLocaleString()}</p>
                      {f.seats_available !== null && (
                        <p style={{ fontSize: '11px', fontWeight: 700, color: f.seats_available === 0 ? '#DC2626' : f.seats_available <= 5 ? '#DC2626' : COLORS.green }}>
                          {f.seats_available === 0 ? 'Fully booked' : `${f.seats_available} seats left`}
                        </p>
                      )}
                    </div>
                    <span style={{ padding: '9px 18px', background: COLORS.secondary, color: 'white', borderRadius: '9px', fontWeight: 700, fontSize: '12.5px' }}>View Details</span>
                  </div>
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
  width: '100%', padding: '11px', border: 'none', borderRadius: '9px', fontSize: '13.5px', boxSizing: 'border-box' as const,
}

export default Flights
