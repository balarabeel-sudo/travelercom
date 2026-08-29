import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import NotificationBell from './NotificationBell'
import { ListCardSkeleton } from './LoadingSkeleton'
import NetworkError from './NetworkError'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16A34A',
}

const TOUR_TYPES = ['Nature', 'History', 'Adventure', 'Water', 'Culture']
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
  tour_type: string | null
  amenities: string[] | null
  companies: { business_name: string } | null
  avgRating: number | null
  reviewCount: number
}

type SortKey = 'recommended' | 'price_low' | 'price_high' | 'rating'

function Tours() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [tours, setTours] = useState<Tour[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())

  const [location, setLocation] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const [stateFilter, setStateFilter] = useState('all')
  const [showStateFilter, setShowStateFilter] = useState(false)

  const [sortBy, setSortBy] = useState<SortKey>('recommended')
  const [showSort, setShowSort] = useState(false)

  const fetchTours = async () => {
    setLoading(true)
    setNetError(false)
    let query = supabase
      .from('services')
      .select('id, title, description, destination, price, seats_available, photo_url, tour_type, amenities, companies(business_name)')
      .eq('category', 'tour')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (location.trim()) query = query.ilike('destination', `%${location.trim()}%`)
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
    fetchTours()
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

  const lowestPriceId = filteredTours.length > 1 ? [...filteredTours].sort((a, b) => a.price - b.price)[0].id : null
  const topRatedId = (() => {
    const rated = filteredTours.filter((h) => h.avgRating !== null)
    if (rated.length < 2) return null
    return [...rated].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))[0].id
  })()

  const SORT_LABELS: Record<SortKey, string> = {
    recommended: 'Recommended', price_low: 'Price: Low to High', price_high: 'Price: High to Low', rating: 'Top Rated',
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

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
        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: '14px' }}>
          <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '11px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Icon name="mapPin" size={16} color={COLORS.primary} />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City / Location" style={{ border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: COLORS.text, width: '100%', padding: 0 }} />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <div style={{ flex: 1, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '11px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="tag" size={15} color={COLORS.primary} />
              <input type="number" placeholder="Min price (₦)" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '13px', fontWeight: 600, color: COLORS.text, width: '100%', padding: 0 }} />
            </div>
            <div style={{ flex: 1, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '11px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="tag" size={15} color={COLORS.primary} />
              <input type="number" placeholder="Max price (₦)" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '13px', fontWeight: 600, color: COLORS.text, width: '100%', padding: 0 }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button onClick={fetchTours} style={{ flex: 1, padding: '13px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Icon name="search" size={15} color="white" /> Search
            </button>
            <button onClick={clearFilters} style={{ padding: '13px 16px', background: COLORS.bg, color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        </div>

        {/* ---------- TYPE CARDS + STATE FILTER ---------- */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '20px' }}>
          <TypeCard icon="grid" label="All" active={typeFilter === null} onClick={() => setTypeFilter(null)} />
          {TOUR_TYPES.map((t) => (
            <TypeCard key={t} icon={TOUR_TYPE_ICON[t]} label={t} active={typeFilter === t} onClick={() => setTypeFilter(typeFilter === t ? null : t)} />
          ))}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <TypeCard icon="barChart" label="Filters" active={stateFilter !== 'all'} onClick={() => setShowStateFilter(!showStateFilter)} />
            {showStateFilter && (
              <div style={{ position: 'absolute', right: 0, top: '68px', background: COLORS.card, borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 30, width: '220px', maxHeight: '280px', overflowY: 'auto' }}>
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
        </div>

        {stateFilter !== 'all' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', marginTop: '-12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: 700, padding: '6px 12px', borderRadius: '20px', background: COLORS.primary, color: 'white' }}>
              <Icon name="mapPin" size={11} color="white" /> {stateFilter}
              <span onClick={() => setStateFilter('all')} style={{ cursor: 'pointer', marginLeft: '2px' }}>✕</span>
            </span>
          </div>
        )}

        {/* ---------- RESULT COUNT + SORT ---------- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>Popular Tours & Attractions</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>
            {loading ? 'Searching...' : `${visible.length} tour${visible.length !== 1 ? 's' : ''} found`}
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
          <NetworkError onRetry={fetchTours} />
        ) : loading ? (
          <ListCardSkeleton count={4} />
        ) : visible.length === 0 ? (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '30px', textAlign: 'center', color: COLORS.textMuted, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '13px' }}>No tours found</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Try a different location, state, or clear your filters.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {visible.map((t) => (
              <div key={t.id} onClick={() => navigate(`/tour/${t.id}`)} style={{ background: COLORS.card, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
                <div style={{ position: 'relative', height: '190px' }}>
                  <div style={{ width: '100%', height: '100%', background: t.photo_url ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.photo_url ? <img src={t.photo_url} alt={t.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="map" size={30} color="white" />}
                  </div>
                  <div onClick={(e) => toggleFavorite(e, t.id)} style={{ position: 'absolute', top: '10px', right: '10px', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: favoriteIds.has(t.id) ? COLORS.secondary : '#94a3b8' }}>
                    <Icon name="heart" size={15} color={favoriteIds.has(t.id) ? COLORS.secondary : '#94a3b8'} filled={favoriteIds.has(t.id)} />
                  </div>
                  {t.id === lowestPriceId && (
                    <span style={{ position: 'absolute', top: '10px', left: '10px', background: COLORS.secondary, color: 'white', fontSize: '10.5px', fontWeight: 700, padding: '5px 10px', borderRadius: '20px' }}>Best Value</span>
                  )}
                  {t.id === topRatedId && t.id !== lowestPriceId && (
                    <span style={{ position: 'absolute', top: '10px', left: '10px', background: COLORS.primary, color: 'white', fontSize: '10.5px', fontWeight: 700, padding: '5px 10px', borderRadius: '20px' }}>Top Rated</span>
                  )}
                </div>

                <div style={{ padding: '14px' }}>
                  <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{t.title}</p>
                  <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}><Icon name="mapPin" size={11} color={COLORS.textMuted} /> {t.destination}</p>

                  {t.avgRating !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                      <Icon name="star" size={12} color="#D4A017" />
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{t.avgRating.toFixed(1)}</span>
                      <span style={{ fontSize: '11.5px', color: COLORS.primary, fontWeight: 600 }}>({t.reviewCount.toLocaleString()} review{t.reviewCount !== 1 ? 's' : ''})</span>
                    </div>
                  )}

                  {t.description && (
                    <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '6px' }}>{t.description}</p>
                  )}

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {t.tour_type && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, padding: '4px 9px', borderRadius: '20px' }}>
                        <Icon name={TOUR_TYPE_ICON[t.tour_type] || 'map'} size={11} color={COLORS.textMuted} /> {t.tour_type}
                      </span>
                    )}
                    {t.amenities && t.amenities.slice(0, 3).map((a) => (
                      <span key={a} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, padding: '4px 9px', borderRadius: '20px' }}>
                        <Icon name={TOUR_AMENITY_ICON[a] || 'check'} size={11} color={COLORS.textMuted} /> {a}
                      </span>
                    ))}
                    {t.amenities && t.amenities.length > 3 && (
                      <span style={{ fontSize: '10px', color: COLORS.textMuted, alignSelf: 'center' }}>+{t.amenities.length - 3} more</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px' }}>
                    <div>
                      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.primary }}>₦{Number(t.price).toLocaleString()} <span style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 400 }}>/person</span></p>
                      {t.seats_available !== null && (
                        <p style={{ fontSize: '11px', fontWeight: 700, color: t.seats_available === 0 ? '#DC2626' : COLORS.green }}>
                          {t.seats_available === 0 ? 'Fully booked' : `${t.seats_available} slots available`}
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

function TypeCard({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ flexShrink: 0, width: '64px', textAlign: 'center', cursor: 'pointer' }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px', margin: '0 auto 6px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? COLORS.primary : COLORS.card,
        border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
        boxShadow: active ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <Icon name={icon} size={18} color={active ? 'white' : COLORS.text} />
      </div>
      <p style={{ fontSize: '10.5px', fontWeight: 700, color: active ? COLORS.primary : COLORS.text, lineHeight: 1.2 }}>{label}</p>
    </div>
  )
}

export default Tours
