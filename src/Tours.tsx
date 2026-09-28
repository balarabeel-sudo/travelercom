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
  secondary: '#F97316',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16A34A',
  gold: '#F5A623',
  chip: '#F1F5F9',
}

const TOUR_TYPES = ['Nature', 'History', 'Adventure', 'Water', 'Culture']

// Pastel tile colours for the type row (icon colour + soft background)
const TYPE_STYLE: Record<string, { icon: string; tint: string; color: string }> = {
  All: { icon: 'grid', tint: '#FFF1E6', color: '#F97316' },
  Nature: { icon: 'mountain', tint: '#E8F7EC', color: '#16A34A' },
  History: { icon: 'landmark', tint: '#EEF0FF', color: '#6366F1' },
  Adventure: { icon: 'person', tint: '#E6F0FF', color: '#2563EB' },
  Water: { icon: 'waves', tint: '#E0F7F7', color: '#0D9488' },
  Culture: { icon: 'masks', tint: '#FDE8EE', color: '#E11D48' },
}

// Fallback icon for the tour_type chip (only shown when a tour has no amenities)
const TOUR_TYPE_ICON: Record<string, string> = { Nature: 'sun', History: 'building', Adventure: 'compass', Water: 'pool', Culture: 'party' }

// Same amenities column used by Hotels/Bus — just fetched and shown here too.
const TOUR_AMENITY_ICON: Record<string, string> = {
  'Guided Tour': 'userPlus', 'Easy Access': 'checkCircle', Parking: 'parking', 'Beach Access': 'pool',
  'Food & Drinks': 'food', Lifeguard: 'shield', Indoor: 'building', 'Air Conditioned': 'snowflake', WiFi: 'wifi',
}

// Nigeria's 36 states + FCT, mapped to the primary city used in destination text.
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

type Tour = {
  id: string
  title: string
  description: string | null
  destination: string
  price: number
  seats_available: number | null
  photo_url: string | null
  photo_urls: string[] | null
  tour_type: string | null
  amenities: string[] | null
  duration_minutes: number | null
  companies: { business_name: string } | null
  avgRating: number | null
  reviewCount: number
}

type SortKey = 'recommended' | 'price_low' | 'price_high' | 'rating'
type SearchParams = { location: string; minPrice: string; maxPrice: string }

// Small local SVG set for icons this page needs that Icons.tsx may not have.
// Kept inside this file on purpose so the page never renders an empty fallback icon.
type LocalIconName = 'locate' | 'sliders' | 'chevronDown' | 'mountain' | 'landmark' | 'person' | 'waves' | 'masks' | 'list' | 'image'

function LocalIcon({ name, size = 16, color = '#000' }: { name: LocalIconName; size?: number; color?: string }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'locate':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="7.5" />
          <line x1="12" y1="1.5" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22.5" />
          <line x1="1.5" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22.5" y2="12" />
        </svg>
      )
    case 'sliders':
      return (
        <svg {...p}>
          <path d="M4 6h3M11 6h9" /><circle cx="9" cy="6" r="2" />
          <path d="M4 12h9M17 12h3" /><circle cx="15" cy="12" r="2" />
          <path d="M4 18h3M11 18h9" /><circle cx="9" cy="18" r="2" />
        </svg>
      )
    case 'chevronDown':
      return <svg {...p}><polyline points="6 9 12 15 18 9" /></svg>
    case 'mountain':
      return <svg {...p}><path d="m8 3 4 8 5-5 5 15H2L8 3z" /></svg>
    case 'landmark':
      return (
        <svg {...p}>
          <line x1="3" y1="22" x2="21" y2="22" />
          <line x1="6" y1="18" x2="6" y2="11" /><line x1="10" y1="18" x2="10" y2="11" />
          <line x1="14" y1="18" x2="14" y2="11" /><line x1="18" y1="18" x2="18" y2="11" />
          <polygon points="12 2 20 7 4 7" />
        </svg>
      )
    case 'person':
      return (
        <svg {...p}>
          <circle cx="12" cy="5" r="1.5" />
          <path d="m9 21 3-7 3 7" />
          <path d="m6 9 6 2 6-2" />
          <path d="M12 11v3" />
        </svg>
      )
    case 'waves':
      return (
        <svg {...p}>
          <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
          <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
          <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
        </svg>
      )
    case 'masks':
      return (
        <svg {...p}>
          <path d="M10 11h.01M14 6h.01M18 6h.01M6.5 13.1h.01" />
          <path d="M22 5c0 9-4 12-6 12s-6-3-6-12c0-2 2-3 6-3s6 1 6 3" />
          <path d="M17.4 9.9c-.8.8-2 .8-2.8 0" />
          <path d="M10.1 7.1C9 7.2 7.7 7.7 6 8.6c-3.5 2-4.7 3.9-3.7 5.6 4.5 7.8 9.5 8.4 11.2 7.4.9-.5 1.9-2.1 1.9-4.7" />
          <path d="M9.1 16.5c.3-1.1 1.4-1.7 2.4-1.4" />
        </svg>
      )
    case 'list':
      return (
        <svg {...p}>
          <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      )
    case 'image':
      return (
        <svg {...p}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      )
  }
}

const LOCAL_NAMES: string[] = ['mountain', 'landmark', 'person', 'waves', 'masks']

function TileIcon({ name, size, color }: { name: string; size: number; color: string }) {
  return LOCAL_NAMES.includes(name)
    ? <LocalIcon name={name as LocalIconName} size={size} color={color} />
    : <Icon name={name} size={size} color={color} />
}

function Tours() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [tours, setTours] = useState<Tour[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [comingSoonMsg, setComingSoonMsg] = useState('')

  const [location, setLocation] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const [stateFilter, setStateFilter] = useState('all')
  const [showStateFilter, setShowStateFilter] = useState(false)

  const [sortBy, setSortBy] = useState<SortKey>('recommended')
  const [showSort, setShowSort] = useState(false)

  const fetchTours = async (override?: SearchParams) => {
    const p: SearchParams = override || { location, minPrice, maxPrice }
    setLoading(true)
    setNetError(false)
    let query = supabase
      .from('services')
      .select('id, title, description, destination, price, seats_available, photo_url, photo_urls, tour_type, amenities, duration_minutes, companies(business_name)')
      .eq('category', 'tour')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (p.location.trim()) query = query.ilike('destination', `%${p.location.trim()}%`)
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

    setTours(rows.map((t) => {
      const ratings = ratingMap[t.id] || []
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
      return { ...t, avgRating, reviewCount: ratings.length }
    }))
    setLoading(false)
  }

  useEffect(() => {
    fetchTours()
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
    setLocation('')
    setMinPrice('')
    setMaxPrice('')
    setTypeFilter(null)
    setStateFilter('all')
    // Pass cleared values directly — state updates are async, so fetchTours() alone would re-use the old ones.
    fetchTours({ location: '', minPrice: '', maxPrice: '' })
  }

  const selectedCity = stateFilter === 'all' ? null : (NIGERIA_STATES.find((s) => s.name === stateFilter)?.city || null)
  let filteredTours = selectedCity ? tours.filter((t) => t.destination.toLowerCase().includes(selectedCity.toLowerCase())) : tours
  filteredTours = typeFilter ? filteredTours.filter((t) => t.tour_type === typeFilter) : filteredTours

  const visible = [...filteredTours].sort((a, b) => {
    if (sortBy === 'price_low') return a.price - b.price
    if (sortBy === 'price_high') return b.price - a.price
    if (sortBy === 'rating') return (b.avgRating ?? -1) - (a.avgRating ?? -1)
    return 0
  })

  const SORT_LABELS: Record<SortKey, string> = {
    recommended: 'Recommended', price_low: 'Price: Low to High', price_high: 'Price: High to Low', rating: 'Top Rated',
  }

  const fmtDuration = (mins: number) =>
    mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      <style>{`
        @keyframes tcFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .tc-tour-card { transition: transform 0.15s ease; }
        .tc-tour-card:active { transform: scale(0.99); }
        @media (prefers-reduced-motion: no-preference) {
          .tc-tour-card { animation: tcFadeUp 0.4s ease both; }
        }
      `}</style>

      {comingSoonMsg && (
        <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', background: '#0B1E3D', color: 'white', fontSize: '12.5px', fontWeight: 600, padding: '10px 18px', borderRadius: '10px', zIndex: 50, boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
          {comingSoonMsg}
        </div>
      )}

      {/* ---------- HEADER ---------- */}
      <div style={{ padding: '16px 20px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="arrowLeft" size={20} color={COLORS.text} />
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="map" size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text }}>Tours & Attractions</h1>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>Discover amazing places and experiences</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Icon name="heart" size={20} color={COLORS.text} />
          <NotificationBell iconColor={COLORS.text} />
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        {/* ---------- SEARCH CARD ---------- */}
        <div style={{ background: COLORS.card, borderRadius: '18px', padding: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
          <div style={fieldBox}>
            <Icon name="mapPin" size={16} color="#475569" />
            <input
              value={location} onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchTours() }}
              placeholder="City / Location" style={fieldInput}
            />
            <span onClick={() => setComingSoonMsg('Use my location is coming soon')} style={{ display: 'flex', cursor: 'pointer' }}>
              <LocalIcon name="locate" size={18} color="#94a3b8" />
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <div style={{ ...fieldBox, flex: 1, minWidth: 0 }}>
              <Icon name="tag" size={15} color="#475569" />
              <input type="number" placeholder="Min price (₦)" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={fieldInput} />
            </div>
            <div style={{ ...fieldBox, flex: 1, minWidth: 0 }}>
              <Icon name="tag" size={15} color="#475569" />
              <input type="number" placeholder="Max price (₦)" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={fieldInput} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button onClick={() => fetchTours()} style={{ flex: 1, height: '40px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
              <Icon name="search" size={15} color="white" /> Search
            </button>
            <button onClick={clearFilters} style={{ height: '40px', padding: '0 24px', background: COLORS.card, color: COLORS.text, border: '1px solid #CBD5E1', borderRadius: '12px', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        </div>

        {/* ---------- TYPE TILES + FILTERS ---------- */}
        <div style={{ position: 'relative', marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '2px 2px 6px' }}>
            {['All', ...TOUR_TYPES].map((label) => {
              const s = TYPE_STYLE[label]
              const active = label === 'All' ? typeFilter === null : typeFilter === label
              return (
                <div key={label}
                  onClick={() => label === 'All' ? setTypeFilter(null) : setTypeFilter(typeFilter === label ? null : label)}
                  style={{
                    flex: '1 0 50px', textAlign: 'center', cursor: 'pointer', background: COLORS.card, borderRadius: '12px',
                    padding: '7px 2px 6px', boxShadow: '0 1px 5px rgba(0,0,0,0.06)',
                    border: `1.5px solid ${active ? s.color : 'transparent'}`,
                  }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '9px', background: s.tint, margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TileIcon name={s.icon} size={16} color={s.color} />
                  </div>
                  <p style={{ fontSize: '10px', fontWeight: active ? 800 : 600, color: active ? s.color : '#475569', lineHeight: 1.2 }}>{label}</p>
                </div>
              )
            })}
            <div onClick={() => setShowStateFilter(!showStateFilter)}
              style={{
                flex: '1.2 0 58px', textAlign: 'center', cursor: 'pointer', background: '#EEF2F7', borderRadius: '12px',
                padding: '7px 2px 6px', border: `1.5px solid ${stateFilter !== 'all' ? COLORS.primary : 'transparent'}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
              }}>
              <LocalIcon name="sliders" size={18} color="#64748B" />
              <p style={{ fontSize: '10px', fontWeight: 800, color: COLORS.text, lineHeight: 1.2 }}>Filters</p>
            </div>
          </div>
          {showStateFilter && (
            <div style={{ position: 'absolute', right: 0, top: '66px', background: COLORS.card, borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 30, width: '220px', maxHeight: '280px', overflowY: 'auto' }}>
              <p style={{ padding: '10px 14px', fontSize: '10.5px', fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase' }}>Filter by State</p>
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

        {stateFilter !== 'all' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', marginTop: '-8px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: 700, padding: '6px 12px', borderRadius: '20px', background: COLORS.primary, color: 'white' }}>
              <Icon name="mapPin" size={11} color="white" /> {stateFilter}
              <span onClick={() => setStateFilter('all')} style={{ cursor: 'pointer', marginLeft: '2px' }}>✕</span>
            </span>
          </div>
        )}

        {/* ---------- HEADING + SORT ---------- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
          <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>Popular Tours & Attractions</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <span onClick={() => setShowSort(!showSort)} style={{ fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                <span style={{ color: COLORS.textMuted }}>Sort by:</span>
                <span style={{ color: COLORS.blue, fontWeight: 700 }}>{SORT_LABELS[sortBy]}</span>
                <LocalIcon name="chevronDown" size={12} color={COLORS.blue} />
              </span>
              {showSort && (
                <div style={{ position: 'absolute', right: 0, top: '22px', background: COLORS.card, borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 20, overflow: 'hidden', width: '170px' }}>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                    <div key={k} onClick={() => { setSortBy(k); setShowSort(false) }} style={{ padding: '10px 14px', fontSize: '12.5px', color: sortBy === k ? COLORS.blue : COLORS.text, fontWeight: sortBy === k ? 700 : 500, cursor: 'pointer' }}>
                      {SORT_LABELS[k]}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span onClick={() => setComingSoonMsg('Grid view is coming soon')} style={{ width: '38px', height: '30px', borderRadius: '10px', background: '#EEF2F7', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <LocalIcon name="list" size={17} color="#334155" />
            </span>
          </div>
        </div>

        {/* ---------- RESULTS ---------- */}
        {netError ? (
          <NetworkError onRetry={() => fetchTours()} />
        ) : loading ? (
          <ListCardSkeleton count={4} />
        ) : visible.length === 0 ? (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '30px', textAlign: 'center', color: COLORS.textMuted, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '13px' }}>No tours found</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Try a different location, state, or clear your filters.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {visible.map((t, idx) => {
              const isFav = favoriteIds.has(t.id)
              const photoCount = t.photo_urls ? t.photo_urls.length : 0
              const amenityList = t.amenities || []
              const shownAmenities = amenityList.slice(0, 3)
              const extraAmenities = amenityList.length - shownAmenities.length
              const available = !!t.seats_available && t.seats_available > 0
              return (
                <div key={t.id} className="tc-tour-card" onClick={() => navigate(`/tour/${t.id}`)}
                  style={{ background: COLORS.card, borderRadius: '16px', padding: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', cursor: 'pointer', display: 'flex', gap: '14px', alignItems: 'stretch', animationDelay: `${Math.min(idx, 8) * 60}ms` }}>

                  {/* photo */}
                  <div style={{ position: 'relative', width: '124px', minHeight: '152px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', inset: 0, background: t.photo_url ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {t.photo_url ? <img src={t.photo_url} alt={t.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="map" size={26} color="white" />}
                    </div>
                    <div onClick={(e) => toggleFavorite(e, t.id)} style={{ position: 'absolute', top: '8px', right: '8px', width: '27px', height: '27px', borderRadius: '50%', background: 'rgba(255,255,255,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="heart" size={14} color={isFav ? COLORS.secondary : '#64748B'} filled={isFav} />
                    </div>
                    {photoCount >= 2 && (
                      <div style={{ position: 'absolute', left: '8px', bottom: '8px', background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '10px', fontWeight: 600, padding: '4px 8px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <LocalIcon name="image" size={11} color="white" /> 1 / {photoCount}
                      </div>
                    )}
                  </div>

                  {/* info */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '2px 2px 0 0' }}>
                    <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</p>
                    <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ display: 'flex', flexShrink: 0 }}><Icon name="mapPin" size={11} color="#94a3b8" /></span> {t.destination}
                    </p>

                    {(t.avgRating !== null || t.duration_minutes) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px', flexWrap: 'wrap' as const }}>
                        {t.avgRating !== null && (
                          <>
                            <span style={{ display: 'flex' }}><Icon name="star" size={12} color={COLORS.gold} filled /></span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{t.avgRating.toFixed(1)}</span>
                            <span style={{ fontSize: '11.5px', color: COLORS.blue }}>({t.reviewCount.toLocaleString()} review{t.reviewCount !== 1 ? 's' : ''})</span>
                          </>
                        )}
                        {t.duration_minutes ? (
                          <span style={{ fontSize: '10.5px', color: COLORS.textMuted, fontWeight: 600 }}>· {fmtDuration(t.duration_minutes)}</span>
                        ) : null}
                      </div>
                    )}

                    {t.description && (
                      <p style={{ fontSize: '11.5px', lineHeight: '15px', color: COLORS.textMuted, marginTop: '6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{t.description}</p>
                    )}

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {shownAmenities.map((a) => (
                        <span key={a} style={chipStyle}>
                          <Icon name={TOUR_AMENITY_ICON[a] || 'check'} size={11} color="#475569" /> {a}
                        </span>
                      ))}
                      {extraAmenities > 0 && (
                        <span style={{ ...chipStyle, color: '#94a3b8', fontWeight: 600 }}>+{extraAmenities} more</span>
                      )}
                      {shownAmenities.length === 0 && t.tour_type && (
                        <span style={chipStyle}>
                          <Icon name={TOUR_TYPE_ICON[t.tour_type] || 'map'} size={11} color="#475569" /> {t.tour_type}
                        </span>
                      )}
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.blue, whiteSpace: 'nowrap' }}>₦{Number(t.price).toLocaleString()} <span style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 500 }}>/person</span></p>
                        <p style={{ fontSize: '11.5px', fontWeight: 700, color: available ? COLORS.green : '#DC2626', marginTop: '2px' }}>
                          {available ? 'Available' : 'Not available'}
                        </p>
                      </div>
                      <span style={{ flexShrink: 0, padding: '9px 16px', background: COLORS.secondary, color: 'white', borderRadius: '10px', fontWeight: 800, fontSize: '12px' }}>View Details</span>
                    </div>
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

const fieldBox = {
  display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #E2E8F0', borderRadius: '12px',
  padding: '0 12px', height: '40px', boxSizing: 'border-box' as const, background: 'white',
}

const fieldInput = {
  flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: '13.5px',
  fontWeight: 500, color: '#1A1A1A', padding: 0, fontFamily: 'inherit', width: '100%',
}

const chipStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 600,
  background: '#F1F5F9', color: '#334155', padding: '4px 9px', borderRadius: '20px', whiteSpace: 'nowrap' as const,
}

export default Tours
