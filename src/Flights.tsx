import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import NotificationBell from './NotificationBell'
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

const TRIP_TABS: { key: TripType; label: string; icon: string }[] = [
  { key: 'oneway', label: 'One-way', icon: 'plane' },
  { key: 'roundtrip', label: 'Round-trip', icon: 'refresh' },
  { key: 'multicity', label: 'Multi-city', icon: 'map' },
]

// Nigeria's 36 states + FCT, mapped to the primary city used in origin/destination text.
// Used only to filter existing real listings by state — no data is invented here.
const NIGERIA_STATES: { name: string; city: string }[] = [
  { name: 'Abia', city: 'Umuahia' },
  { name: 'Adamawa', city: 'Yola' },
  { name: 'Akwa Ibom', city: 'Uyo' },
  { name: 'Anambra', city: 'Awka' },
  { name: 'Bauchi', city: 'Bauchi' },
  { name: 'Bayelsa', city: 'Yenagoa' },
  { name: 'Benue', city: 'Makurdi' },
  { name: 'Borno', city: 'Maiduguri' },
  { name: 'Cross River', city: 'Calabar' },
  { name: 'Delta', city: 'Asaba' },
  { name: 'Ebonyi', city: 'Abakaliki' },
  { name: 'Edo', city: 'Benin' },
  { name: 'Ekiti', city: 'Ado Ekiti' },
  { name: 'Enugu', city: 'Enugu' },
  { name: 'FCT (Abuja)', city: 'Abuja' },
  { name: 'Gombe', city: 'Gombe' },
  { name: 'Imo', city: 'Owerri' },
  { name: 'Jigawa', city: 'Dutse' },
  { name: 'Kaduna', city: 'Kaduna' },
  { name: 'Kano', city: 'Kano' },
  { name: 'Katsina', city: 'Katsina' },
  { name: 'Kebbi', city: 'Birnin Kebbi' },
  { name: 'Kogi', city: 'Lokoja' },
  { name: 'Kwara', city: 'Ilorin' },
  { name: 'Lagos', city: 'Lagos' },
  { name: 'Nasarawa', city: 'Lafia' },
  { name: 'Niger', city: 'Minna' },
  { name: 'Ogun', city: 'Abeokuta' },
  { name: 'Ondo', city: 'Akure' },
  { name: 'Osun', city: 'Osogbo' },
  { name: 'Oyo', city: 'Ibadan' },
  { name: 'Plateau', city: 'Jos' },
  { name: 'Rivers', city: 'Port Harcourt' },
  { name: 'Sokoto', city: 'Sokoto' },
  { name: 'Taraba', city: 'Jalingo' },
  { name: 'Yobe', city: 'Damaturu' },
  { name: 'Zamfara', city: 'Gusau' },
]

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

  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  const [stateFilter, setStateFilter] = useState('all')
  const [showStateFilter, setShowStateFilter] = useState(false)

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

    if (origin.trim()) query = query.ilike('origin', `%${origin.trim()}%`)
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

  const clearFilters = () => {
    setOrigin('')
    setDestination('')
    setMinPrice('')
    setMaxPrice('')
    setStateFilter('all')
    fetchFlights()
  }

  const selectedCity = stateFilter === 'all' ? null : (NIGERIA_STATES.find((s) => s.name === stateFilter)?.city || null)
  const filteredFlights = selectedCity
    ? flights.filter((f) => {
        const c = selectedCity.toLowerCase()
        return (f.origin || '').toLowerCase().includes(c) || f.destination.toLowerCase().includes(c)
      })
    : flights

  const visible = [...filteredFlights].sort((a, b) => {
    if (sortBy === 'price_low') return a.price - b.price
    if (sortBy === 'price_high') return b.price - a.price
    if (sortBy === 'rating') return (b.avgRating ?? -1) - (a.avgRating ?? -1)
    return 0
  })

  const bestDealId = filteredFlights.length > 1 ? [...filteredFlights].sort((a, b) => a.price - b.price)[0].id : null
  const popularId = (() => {
    const withReviews = filteredFlights.filter((f) => f.reviewCount > 0)
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

      {/* ---------- HEADER ---------- */}
      <div style={{ padding: '16px 20px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="arrowLeft" size={20} color={COLORS.text} />
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plane" size={20} color={COLORS.primary} />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text }}>Domestic Flights</h1>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>Book affordable flights across Nigeria</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Icon name="heart" size={20} color={COLORS.text} />
          <NotificationBell iconColor={COLORS.text} />
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* ---------- SEARCH HERO (navy card) ---------- */}
        <div style={{ background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.primary})`, borderRadius: '18px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '4px', marginBottom: '12px' }}>
            {TRIP_TABS.map(({ key, label, icon }) => (
              <div
                key={key}
                onClick={() => key === 'oneway' ? setTripType('oneway') : setComingSoonMsg(`${label} is coming soon`)}
                style={{
                  flex: 1, textAlign: 'center', padding: '9px 4px', borderRadius: '9px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  background: tripType === key ? 'white' : 'transparent',
                  color: tripType === key ? COLORS.navy : 'rgba(255,255,255,0.85)',
                }}>
                <Icon name={icon} size={13} color={tripType === key ? COLORS.navy : 'rgba(255,255,255,0.85)'} /> {label}
              </div>
            ))}
          </div>

          <input type="text" placeholder="From (e.g. Lagos)" value={origin} onChange={(e) => setOrigin(e.target.value)}
            style={{ ...inputStyle, background: 'white', marginBottom: '8px' }} />
          <input type="text" placeholder="To (e.g. Abuja)" value={destination} onChange={(e) => setDestination(e.target.value)}
            style={{ ...inputStyle, background: 'white', marginBottom: '8px' }} />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input type="number" placeholder="Min price (₦)" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={{ ...inputStyle, background: 'white', flex: 1 }} />
            <input type="number" placeholder="Max price (₦)" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={{ ...inputStyle, background: 'white', flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={fetchFlights} style={{ flex: 1, padding: '12px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Icon name="search" size={15} color="white" /> Search
            </button>
            <button onClick={clearFilters} style={{ padding: '12px 16px', background: 'white', color: COLORS.navy, border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        </div>

        {/* ---------- TRUST ROW ---------- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', background: COLORS.card, borderRadius: '14px', padding: '14px 8px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          {[
            ['checkCircle', 'Best Fares'],
            ['luggage', 'Safe Booking'],
            ['clock', '24/7 Support'],
            ['shield', 'Secure Payment'],
          ].map(([icon, label]) => (
            <div key={label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}><Icon name={icon} size={18} color={COLORS.primary} /></div>
              <p style={{ fontSize: '9.5px', fontWeight: 700, color: COLORS.text, marginTop: '4px' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* ---------- STATE FILTER ---------- */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <span onClick={() => setShowStateFilter(!showStateFilter)} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700, padding: '9px 14px', borderRadius: '20px', cursor: 'pointer', background: stateFilter === 'all' ? COLORS.card : COLORS.primary, color: stateFilter === 'all' ? COLORS.text : 'white', border: `1px solid ${stateFilter === 'all' ? COLORS.border : COLORS.primary}`, whiteSpace: 'nowrap' }}>
              <Icon name="mapPin" size={13} color={stateFilter === 'all' ? COLORS.text : 'white'} />
              {stateFilter === 'all' ? 'All States' : stateFilter} ⌄
            </span>
            {showStateFilter && (
              <div style={{ position: 'absolute', left: 0, top: '38px', background: COLORS.card, borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 30, width: '220px', maxHeight: '280px', overflowY: 'auto' }}>
                <div onClick={() => { setStateFilter('all'); setShowStateFilter(false) }} style={{ padding: '10px 14px', fontSize: '12.5px', fontWeight: stateFilter === 'all' ? 700 : 500, color: stateFilter === 'all' ? COLORS.primary : COLORS.text, cursor: 'pointer', borderBottom: `1px solid ${COLORS.border}` }}>
                  All States
                </div>
                {NIGERIA_STATES.map((s) => (
                  <div key={s.name} onClick={() => { setStateFilter(s.name); setShowStateFilter(false) }} style={{ padding: '10px 14px', fontSize: '12.5px', fontWeight: stateFilter === s.name ? 700 : 500, color: stateFilter === s.name ? COLORS.primary : COLORS.text, cursor: 'pointer' }}>
                    {s.name}
                  </div>
                ))}
              </div>
            )}
          </div>
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
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Try a different destination, state, or clear your filters.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {visible.map((f) => (
              <div key={f.id} onClick={() => navigate(`/flight/${f.id}`)} style={{ background: COLORS.card, borderRadius: '16px', padding: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', cursor: 'pointer', display: 'flex', gap: '12px' }}>
                <div style={{ position: 'relative', width: '125px', height: '150px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{ width: '100%', height: '100%', background: f.photo_url ? undefined : `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {f.photo_url ? <img src={f.photo_url} alt={f.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="plane" size={26} color="white" />}
                  </div>
                  <div onClick={(e) => toggleFavorite(e, f.id)} style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: favoriteIds.has(f.id) ? COLORS.secondary : '#94a3b8' }}>
                    <Icon name="heart" size={14} color={favoriteIds.has(f.id) ? COLORS.secondary : '#94a3b8'} filled={favoriteIds.has(f.id)} />
                  </div>
                  {f.id === bestDealId && (
                    <span style={{ position: 'absolute', top: '8px', left: '8px', background: COLORS.green, color: 'white', fontSize: '9.5px', fontWeight: 700, padding: '4px 8px', borderRadius: '20px' }}>Best Deal</span>
                  )}
                  {f.id === popularId && f.id !== bestDealId && (
                    <span style={{ position: 'absolute', top: '8px', left: '8px', background: COLORS.secondary, color: 'white', fontSize: '9.5px', fontWeight: 700, padding: '4px 8px', borderRadius: '20px' }}>Popular</span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14.5px', fontWeight: 800, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.companies?.business_name || 'Traveler.com Partner'}</p>
                  {f.avgRating !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                      <span style={{ background: '#FEF3C7', color: COLORS.gold, fontSize: '10.5px', fontWeight: 800, padding: '2px 6px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Icon name="star" size={10} color={COLORS.gold} filled /> {f.avgRating.toFixed(1)}</span>
                      <span style={{ fontSize: '10.5px', color: COLORS.textMuted }}>({f.reviewCount})</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>{fmtTime(f.departure_time)}</p>
                      <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{f.origin || '—'}</p>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center', padding: '0 6px' }}>
                      <p style={{ fontSize: '9px', color: COLORS.textMuted }}>{fmtDuration(f.duration_minutes)}</p>
                      <div style={{ height: '1px', background: COLORS.border, margin: '3px 0', position: 'relative' }}>
                        <span style={{ position: 'absolute', right: 0, top: '-8px', display: 'flex' }}><Icon name="plane" size={12} color={COLORS.textMuted} /></span>
                      </div>
                      <p style={{ fontSize: '9px', color: COLORS.green, fontWeight: 700 }}>Direct</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>{fmtTime(f.arrival_time)}</p>
                      <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{f.destination}</p>
                    </div>
                  </div>

                  {f.amenities && f.amenities.length > 0 && (
                    <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {f.amenities.slice(0, 3).map((a) => (
                        <span key={a} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9.5px', color: COLORS.textMuted, fontWeight: 600 }}>
                          <Icon name={TRAVEL_AMENITY_ICON[a] || 'check'} size={10} color={COLORS.textMuted} /> {a}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${COLORS.border}` }}>
                    <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.primary }}>₦{Number(f.price).toLocaleString()}</p>
                    {f.seats_available !== null && (
                      <p style={{ fontSize: '10.5px', fontWeight: 700, color: f.seats_available === 0 ? '#DC2626' : f.seats_available <= 5 ? '#DC2626' : COLORS.green }}>
                        {f.seats_available === 0 ? 'Fully booked' : `${f.seats_available} seats left`}
                      </p>
                    )}
                  </div>
                  <span style={{ display: 'inline-block', marginTop: '8px', padding: '8px 16px', background: COLORS.secondary, color: 'white', borderRadius: '9px', fontWeight: 700, fontSize: '12px' }}>View Details</span>
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
