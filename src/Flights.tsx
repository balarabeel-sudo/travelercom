import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import NotificationBell from './NotificationBell'
import { ListCardSkeleton } from './LoadingSkeleton'
import NetworkError from './NetworkError'

const COLORS = {
  primary: '#0EA5E9',
  blue: '#1D4ED8',
  navy: '#0B1E3D',
  secondary: '#F97316',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  gold: '#D4A017',
}

const TRAVEL_AMENITY_ICON: Record<string, string> = {
  WiFi: 'wifi', AC: 'snowflake', 'Charging Port': 'plug', Meals: 'food', 'Reclining Seats': 'seat', Toilet: 'toilet', Refundable: 'shield', 'Baggage Allowance': 'luggage',
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

type SearchParams = { origin: string; destination: string; minPrice: string; maxPrice: string }

// Small local SVG set for icons this page needs that Icons.tsx may not have.
// Kept inside this file on purpose so the page never renders an empty fallback icon.
type LocalIconName = 'tag' | 'locate' | 'headset' | 'sliders' | 'chevronDown' | 'badgeCheck' | 'planeRight'

function LocalIcon({ name, size = 16, color = '#000' }: { name: LocalIconName; size?: number; color?: string }) {
  const stroke = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'tag':
      return (
        <svg {...stroke}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      )
    case 'locate':
      return (
        <svg {...stroke}>
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="7.5" />
          <line x1="12" y1="1.5" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22.5" />
          <line x1="1.5" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22.5" y2="12" />
        </svg>
      )
    case 'headset':
      return (
        <svg {...stroke}>
          <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
          <path d="M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z" />
          <path d="M3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z" />
          <path d="M18 17v1a3 3 0 0 1-3 3h-2" />
        </svg>
      )
    case 'sliders':
      return (
        <svg {...stroke}>
          <path d="M4 6h3M11 6h9" />
          <circle cx="9" cy="6" r="2" />
          <path d="M4 12h9M17 12h3" />
          <circle cx="15" cy="12" r="2" />
          <path d="M4 18h3M11 18h9" />
          <circle cx="9" cy="18" r="2" />
        </svg>
      )
    case 'chevronDown':
      return (
        <svg {...stroke}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      )
    case 'badgeCheck':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
          <path d="m9 12 2 2 4-4" stroke="white" strokeWidth={2.2} fill="none" />
        </svg>
      )
    case 'planeRight':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <g transform="rotate(90 12 12)">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
          </g>
        </svg>
      )
  }
}

// "Abuja (ABV)" -> { primary: 'ABV', secondary: 'Abuja' }; plain "Abuja" -> { primary: 'Abuja', secondary: '' }
function splitPlace(text: string | null): { primary: string; secondary: string } {
  if (!text) return { primary: '—', secondary: '' }
  const m = text.match(/^(.*?)\s*\(([A-Za-z]{3})\)\s*$/)
  if (m && m[1].trim()) return { primary: m[2].toUpperCase(), secondary: m[1].trim() }
  return { primary: text.trim(), secondary: '' }
}

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
  const [showFilters, setShowFilters] = useState(false)

  const [sortBy, setSortBy] = useState<SortKey>('recommended')
  const [showSort, setShowSort] = useState(false)

  const fetchFlights = async (override?: SearchParams) => {
    const p: SearchParams = override || { origin, destination, minPrice, maxPrice }
    setLoading(true)
    setNetError(false)
    let query = supabase
      .from('services')
      .select('id, title, description, origin, destination, departure_time, arrival_time, duration_minutes, price, seats_available, photo_url, amenities, companies(business_name)')
      .eq('category', 'flight')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (p.origin.trim()) query = query.ilike('origin', `%${p.origin.trim()}%`)
    if (p.destination.trim()) query = query.ilike('destination', `%${p.destination.trim()}%`)
    if (p.minPrice) query = query.gte('price', parseFloat(p.minPrice))
    if (p.maxPrice) query = query.lte('price', parseFloat(p.maxPrice))

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
    // Pass the cleared values directly — state updates are async, so fetchFlights() alone would re-use the old ones.
    fetchFlights({ origin: '', destination: '', minPrice: '', maxPrice: '' })
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

  const fmtTime = (iso: string | null) => {
    if (!iso) return '--:--'
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const fmtDuration = (f: Flight) => {
    let mins = f.duration_minutes
    if (!mins && f.departure_time && f.arrival_time) {
      const diff = Math.round((new Date(f.arrival_time).getTime() - new Date(f.departure_time).getTime()) / 60000)
      if (diff > 0) mins = diff
    }
    return mins ? `${Math.floor(mins / 60)}h ${mins % 60}m` : ''
  }

  const filtersActive = origin.trim() !== '' || stateFilter !== 'all'

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      <style>{`
        @keyframes tcFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes tcFly { 0% { left: 0%; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { left: calc(100% - 14px); opacity: 0; } }
        .tc-flight-card { transition: transform 0.15s ease; }
        .tc-flight-card:active { transform: scale(0.99); }
        .tc-plane { left: 50%; transform: translateX(-50%); }
        @media (prefers-reduced-motion: no-preference) {
          .tc-flight-card { animation: tcFadeUp 0.4s ease both; }
          .tc-plane { transform: none; animation: tcFly 3.2s ease-in-out infinite; }
        }
      `}</style>

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
            <Icon name="plane" size={20} color={COLORS.blue} />
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
        {/* ---------- SEARCH HERO ---------- */}
        <div style={{ background: COLORS.blue, borderRadius: '20px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
            {TRIP_TABS.map(({ key, label, icon }) => (
              <div
                key={key}
                onClick={() => key === 'oneway' ? setTripType('oneway') : setComingSoonMsg(`${label} is coming soon`)}
                style={{
                  flex: 1, textAlign: 'center', padding: '11px 4px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  background: tripType === key ? 'white' : 'transparent',
                  color: tripType === key ? COLORS.blue : 'rgba(255,255,255,0.92)',
                }}>
                <Icon name={icon} size={14} color={tripType === key ? COLORS.blue : 'rgba(255,255,255,0.92)'} /> {label}
              </div>
            ))}
          </div>

          <div style={{ ...fieldWrap, marginBottom: '10px' }}>
            <Icon name="mapPin" size={17} color="#94a3b8" />
            <input
              type="text" placeholder="Destination (e.g. Abuja)" value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchFlights() }}
              style={fieldInput}
            />
            <span onClick={() => setComingSoonMsg('Use my location is coming soon')} style={{ display: 'flex', cursor: 'pointer' }}>
              <LocalIcon name="locate" size={19} color="#94a3b8" />
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <div style={{ ...fieldWrap, flex: 1, minWidth: 0 }}>
              <LocalIcon name="tag" size={16} color="#94a3b8" />
              <input type="number" placeholder="Min price (₦)" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={fieldInput} />
            </div>
            <div style={{ ...fieldWrap, flex: 1, minWidth: 0 }}>
              <LocalIcon name="tag" size={16} color="#94a3b8" />
              <input type="number" placeholder="Max price (₦)" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={fieldInput} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => fetchFlights()} style={{ flex: 1, padding: '14px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '14.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
              <Icon name="search" size={16} color="white" /> Search
            </button>
            <button onClick={clearFilters} style={{ padding: '14px 26px', background: '#EAF1FF', color: COLORS.blue, border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '14.5px', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        </div>

        {/* ---------- TRUST ROW ---------- */}
        <div style={{ display: 'flex', background: COLORS.card, borderRadius: '16px', padding: '14px 0', marginBottom: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          {([
            ['badgeCheck', 'Best Fares'],
            ['luggage', 'Safe Booking'],
            ['headset', '24/7 Support'],
            ['shield', 'Secure Payment'],
          ] as [string, string][]).map(([icon, label], i, arr) => (
            <div key={label} style={{ flex: 1, textAlign: 'center', borderRight: i === arr.length - 1 ? 'none' : `1px solid ${COLORS.border}`, padding: '0 2px' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {icon === 'badgeCheck' || icon === 'headset'
                  ? <LocalIcon name={icon as LocalIconName} size={22} color={COLORS.blue} />
                  : <Icon name={icon} size={22} color={COLORS.blue} />}
              </div>
              <p style={{ fontSize: '10px', fontWeight: 600, color: COLORS.text, marginTop: '5px', whiteSpace: 'nowrap' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* ---------- COUNT + SORT + FILTER ---------- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showFilters ? '10px' : '14px' }}>
          <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>
            {loading ? 'Searching...' : `${visible.length} flight${visible.length !== 1 ? 's' : ''} found`}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <span onClick={() => setShowSort(!showSort)} style={{ fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                <span style={{ color: COLORS.textMuted }}>Sort by:</span>
                <span style={{ color: COLORS.blue, fontWeight: 700 }}>{SORT_LABELS[sortBy]}</span>
                <LocalIcon name="chevronDown" size={13} color={COLORS.blue} />
              </span>
              {showSort && (
                <div style={{ position: 'absolute', right: 0, top: '24px', background: COLORS.card, borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 20, overflow: 'hidden', width: '170px' }}>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                    <div key={k} onClick={() => { setSortBy(k); setShowSort(false) }} style={{ padding: '10px 14px', fontSize: '12.5px', color: sortBy === k ? COLORS.blue : COLORS.text, fontWeight: sortBy === k ? 700 : 500, cursor: 'pointer' }}>
                      {SORT_LABELS[k]}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span onClick={() => setShowFilters(!showFilters)} style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '13px', background: showFilters ? '#DBE7FF' : '#EAF1FF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <LocalIcon name="sliders" size={19} color={COLORS.blue} />
              {filtersActive && <span style={{ position: 'absolute', top: '8px', right: '8px', width: '8px', height: '8px', borderRadius: '50%', background: COLORS.secondary }} />}
            </span>
          </div>
        </div>

        {/* ---------- FILTER PANEL (From + State) ---------- */}
        {showFilters && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', marginBottom: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '6px' }}>From</p>
            <div style={{ ...fieldWrap, background: COLORS.bg, border: `1px solid ${COLORS.border}`, marginBottom: '12px', height: '42px' }}>
              <Icon name="mapPin" size={16} color="#94a3b8" />
              <input type="text" placeholder="Origin (e.g. Kano)" value={origin} onChange={(e) => setOrigin(e.target.value)} style={fieldInput} />
            </div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '6px' }}>State</p>
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}
              style={{ width: '100%', padding: '11px', border: `1px solid ${COLORS.border}`, borderRadius: '12px', fontSize: '13.5px', background: COLORS.bg, marginBottom: '12px', boxSizing: 'border-box' }}>
              <option value="all">All States</option>
              {NIGERIA_STATES.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
            <button onClick={() => { fetchFlights(); setShowFilters(false) }} style={{ width: '100%', padding: '12px', background: COLORS.blue, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '13.5px', cursor: 'pointer' }}>
              Apply Filters
            </button>
          </div>
        )}

        {/* ---------- RESULTS ---------- */}
        {netError ? (
          <NetworkError onRetry={() => fetchFlights()} />
        ) : loading ? (
          <ListCardSkeleton count={4} />
        ) : visible.length === 0 ? (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '30px', textAlign: 'center', color: COLORS.textMuted, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '13px' }}>No flights found</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Try a different destination, state, or clear your filters.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {visible.map((f, idx) => {
              const dep = splitPlace(f.origin)
              const arr = splitPlace(f.destination)
              const duration = fmtDuration(f)
              const tagline = f.description ? f.description.split('\n')[0].trim() : ''
              const isFav = favoriteIds.has(f.id)
              return (
                <div key={f.id} className="tc-flight-card" onClick={() => navigate(`/flight/${f.id}`)}
                  style={{ background: COLORS.card, borderRadius: '18px', padding: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', cursor: 'pointer', animationDelay: `${Math.min(idx, 8) * 60}ms` }}>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
                    {/* photo */}
                    <div style={{ position: 'relative', width: '88px', minHeight: '112px', borderRadius: '14px', overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', inset: 0, background: f.photo_url ? undefined : `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {f.photo_url ? <img src={f.photo_url} alt={f.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="plane" size={26} color="white" />}
                      </div>
                      {f.id === bestDealId && (
                        <span style={{ position: 'absolute', top: '7px', left: '7px', background: COLORS.greenBg, color: COLORS.green, fontSize: '9.5px', fontWeight: 800, padding: '3px 8px', borderRadius: '8px' }}>Best Deal</span>
                      )}
                      {f.id === popularId && f.id !== bestDealId && (
                        <span style={{ position: 'absolute', top: '7px', left: '7px', background: COLORS.secondary, color: 'white', fontSize: '9.5px', fontWeight: 800, padding: '3px 8px', borderRadius: '8px' }}>Popular</span>
                      )}
                    </div>

                    {/* info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.companies?.business_name || 'Traveler.com Partner'}</p>
                        <span onClick={(e) => toggleFavorite(e, f.id)} style={{ display: 'flex', flexShrink: 0, padding: '2px' }}>
                          <Icon name="heart" size={19} color={isFav ? COLORS.secondary : '#94a3b8'} filled={isFav} />
                        </span>
                      </div>
                      {tagline && (
                        <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tagline}</p>
                      )}
                      {f.avgRating !== null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px' }}>
                          <span style={{ background: '#FEF3C7', color: COLORS.gold, fontSize: '10.5px', fontWeight: 800, padding: '2px 6px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Icon name="star" size={10} color={COLORS.gold} filled /> {f.avgRating.toFixed(1)}</span>
                          <span style={{ fontSize: '10.5px', color: COLORS.blue }}>({f.reviewCount.toLocaleString()} review{f.reviewCount !== 1 ? 's' : ''})</span>
                        </div>
                      )}

                      {/* times + route + price */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                        <div style={{ flexShrink: 0 }}>
                          <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, lineHeight: 1.1 }}>{fmtTime(f.departure_time)}</p>
                          <p style={{ fontSize: '10.5px', fontWeight: 700, color: COLORS.text, marginTop: '3px', maxWidth: '54px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dep.primary}</p>
                          {dep.secondary && <p style={{ fontSize: '9.5px', color: COLORS.textMuted, maxWidth: '54px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dep.secondary}</p>}
                        </div>

                        <div style={{ flex: 1, minWidth: '36px', textAlign: 'center' }}>
                          <p style={{ fontSize: '9.5px', color: COLORS.textMuted, minHeight: '12px' }}>{duration}</p>
                          <div style={{ position: 'relative', height: '16px', display: 'flex', alignItems: 'center' }}>
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#94a3b8', flexShrink: 0 }} />
                            <span style={{ flex: 1, borderTop: '1.5px dashed #CBD5E1', margin: '0 2px' }} />
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#94a3b8', flexShrink: 0 }} />
                            <span className="tc-plane" style={{ position: 'absolute', top: '1px', display: 'flex', background: COLORS.card, padding: '0 1px' }}>
                              <LocalIcon name="planeRight" size={14} color={COLORS.blue} />
                            </span>
                          </div>
                          <p style={{ fontSize: '9.5px', color: COLORS.green, fontWeight: 700, marginTop: '1px' }}>Direct</p>
                        </div>

                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                          <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, lineHeight: 1.1 }}>{fmtTime(f.arrival_time)}</p>
                          <p style={{ fontSize: '10.5px', fontWeight: 700, color: COLORS.text, marginTop: '3px', maxWidth: '54px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginLeft: 'auto' }}>{arr.primary}</p>
                          {arr.secondary && <p style={{ fontSize: '9.5px', color: COLORS.textMuted, maxWidth: '54px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginLeft: 'auto' }}>{arr.secondary}</p>}
                        </div>

                        <div style={{ flexShrink: 0, textAlign: 'right', paddingLeft: '4px' }}>
                          <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.blue, whiteSpace: 'nowrap' }}>₦{Number(f.price).toLocaleString()}</p>
                          {f.seats_available !== null && (
                            <p style={{ fontSize: '10px', fontWeight: 600, color: f.seats_available === 0 ? '#DC2626' : COLORS.blue, whiteSpace: 'nowrap' }}>
                              {f.seats_available === 0 ? 'Fully booked' : `${f.seats_available} seat${f.seats_available !== 1 ? 's' : ''} left`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* amenities + CTA */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '12px' }}>
                    <div style={{ display: 'flex', gap: '6px 12px', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                      {f.amenities && f.amenities.slice(0, 3).map((a) => (
                        <span key={a} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', color: COLORS.textMuted, fontWeight: 500 }}>
                          <Icon name={TRAVEL_AMENITY_ICON[a] || 'check'} size={13} color={COLORS.textMuted} /> {a}
                        </span>
                      ))}
                    </div>
                    <span style={{ flexShrink: 0, padding: '11px 20px', background: COLORS.secondary, color: 'white', borderRadius: '12px', fontWeight: 800, fontSize: '13px' }}>View Details</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const fieldWrap = {
  display: 'flex', alignItems: 'center', gap: '10px', background: 'white', borderRadius: '13px', padding: '0 14px', height: '48px', boxSizing: 'border-box' as const,
}

const fieldInput = {
  flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: '14px', color: '#1A1A1A', fontFamily: 'inherit',
}

export default Flights
