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
  green: '#16A34A',
}

const EVENT_TYPES = ['Conference', 'Wedding', 'Party', 'Seminar', 'Exhibition']
const EVENT_TYPE_ICON: Record<string, string> = { Conference: 'mic', Wedding: 'rings', Party: 'party', Seminar: 'clipboard', Exhibition: 'image' }

type EventCenter = {
  id: string
  title: string
  description: string | null
  destination: string
  price: number
  seats_available: number | null
  photo_url: string | null
  event_type: string | null
  companies: { business_name: string } | null
  avgRating: number | null
  reviewCount: number
}

type SortKey = 'recommended' | 'price_low' | 'price_high' | 'rating'

function EventCenters() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<EventCenter[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())

  const [location, setLocation] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const [sortBy, setSortBy] = useState<SortKey>('recommended')
  const [showSort, setShowSort] = useState(false)

  const fetchEvents = async () => {
    setLoading(true)
    let query = supabase
      .from('services')
      .select('id, title, description, destination, price, seats_available, photo_url, event_type, companies(business_name)')
      .eq('category', 'event_center')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (location.trim()) query = query.ilike('destination', `%${location.trim()}%`)
    if (minPrice) query = query.gte('price', parseFloat(minPrice))
    if (maxPrice) query = query.lte('price', parseFloat(maxPrice))

    const { data } = await query
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

    setEvents(rows.map((t) => {
      const ratings = ratingMap[t.id] || []
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
      return { ...t, avgRating, reviewCount: ratings.length }
    }))
    setLoading(false)
  }

  useEffect(() => {
    fetchEvents()
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

  let visible = typeFilter ? events.filter((t) => t.event_type === typeFilter) : events
  visible = [...visible].sort((a, b) => {
    if (sortBy === 'price_low') return a.price - b.price
    if (sortBy === 'price_high') return b.price - a.price
    if (sortBy === 'rating') return (b.avgRating ?? -1) - (a.avgRating ?? -1)
    return 0
  })

  const lowestPriceId = events.length > 1 ? [...events].sort((a, b) => a.price - b.price)[0].id : null
  const topRatedId = (() => {
    const rated = events.filter((h) => h.avgRating !== null)
    if (rated.length < 2) return null
    return [...rated].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))[0].id
  })()

  const SORT_LABELS: Record<SortKey, string> = {
    recommended: 'Recommended', price_low: 'Price: Low to High', price_high: 'Price: High to Low', rating: 'Top Rated',
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{ padding: '16px 20px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span onClick={() => navigate('/home')} style={{ fontSize: '20px', cursor: 'pointer', marginTop: '2px' }}>←</span>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text, display: 'flex', alignItems: 'center', gap: '6px' }}><Icon name="tent" size={18} color={COLORS.text} /> Event Centers</h1>
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>Book the perfect venue for your event</p>
            </div>
          </div>
          <span style={{ color: COLORS.textMuted, display: 'flex' }}><Icon name="heart" size={18} color={COLORS.textMuted} /></span>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: '14px' }}>
          <input type="text" placeholder="City / Location" value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <input type="number" placeholder="Min price (₦)" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <input type="number" placeholder="Max price (₦)" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button onClick={fetchEvents} style={{ flex: 1, padding: '12px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Icon name="search" size={15} color="white" /> Search
            </button>
            <button onClick={() => { setLocation(''); setMinPrice(''); setMaxPrice(''); setTypeFilter(null); fetchEvents() }} style={{ padding: '12px 16px', background: COLORS.bg, color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px' }}>
          <FilterChip icon="square" label="All" active={typeFilter === null} onClick={() => setTypeFilter(null)} />
          {EVENT_TYPES.map((t) => (
            <FilterChip key={t} icon={EVENT_TYPE_ICON[t]} label={t} active={typeFilter === t} onClick={() => setTypeFilter(typeFilter === t ? null : t)} />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>
            {loading ? 'Searching...' : `${visible.length} event center${visible.length !== 1 ? 's' : ''} found`}
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

        {loading ? (
          <p style={{ textAlign: 'center', color: COLORS.textMuted, fontSize: '13px', padding: '30px 0' }}>Loading...</p>
        ) : visible.length === 0 ? (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '30px', textAlign: 'center', color: COLORS.textMuted, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '13px' }}>No event centers found</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Try a different location or clear your filters.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {visible.map((e) => (
              <div key={e.id} onClick={() => navigate(`/event-center/${e.id}`)} style={{ background: COLORS.card, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
                <div style={{ position: 'relative', height: '150px' }}>
                  <div style={{ width: '100%', height: '100%', background: e.photo_url ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '34px' }}>
                    {e.photo_url ? <img src={e.photo_url} alt={e.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="tent" size={32} color="white" />}
                  </div>
                  <div onClick={(e) => toggleFavorite(e, e.id)} style={{ position: 'absolute', top: '10px', right: '10px', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: favoriteIds.has(e.id) ? COLORS.secondary : '#94a3b8' }}>
                    <Icon name="heart" size={15} color={favoriteIds.has(e.id) ? COLORS.secondary : '#94a3b8'} filled={favoriteIds.has(e.id)} />
                  </div>
                  {e.id === lowestPriceId && (
                    <span style={{ position: 'absolute', top: '10px', left: '10px', background: COLORS.secondary, color: 'white', fontSize: '10.5px', fontWeight: 700, padding: '5px 10px', borderRadius: '20px' }}>Best Value</span>
                  )}
                  {e.id === topRatedId && e.id !== lowestPriceId && (
                    <span style={{ position: 'absolute', top: '10px', left: '10px', background: COLORS.primary, color: 'white', fontSize: '10.5px', fontWeight: 700, padding: '5px 10px', borderRadius: '20px' }}>Top Rated</span>
                  )}
                </div>

                <div style={{ padding: '14px' }}>
                  <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{e.title}</p>
                  <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}><Icon name="mapPin" size={11} color={COLORS.textMuted} /> {e.destination}</p>
                  {e.description && (
                    <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '6px' }}>{e.description}</p>
                  )}

                  {e.avgRating !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                      <span style={{ background: '#DCFCE7', color: COLORS.green, fontSize: '11.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '6px' }}>{e.avgRating.toFixed(1)}</span>
                      <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>({e.reviewCount} review{e.reviewCount !== 1 ? 's' : ''})</span>
                    </div>
                  )}

                  {e.event_type && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '10px', fontWeight: 700, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, padding: '4px 9px', borderRadius: '20px' }}>
                      <Icon name={EVENT_TYPE_ICON[e.event_type] || 'tent'} size={11} color={COLORS.textMuted} /> {e.event_type}
                    </span>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px' }}>
                    <div>
                      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.primary }}>₦{Number(e.price).toLocaleString()} <span style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 400 }}>/day</span></p>
                      {e.seats_available !== null && (
                        <p style={{ fontSize: '11px', fontWeight: 700, color: e.seats_available === 0 ? '#DC2626' : COLORS.green }}>
                          {e.seats_available === 0 ? 'Fully booked' : `${e.seats_available} slots available`}
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

function FilterChip({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <span onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0,
      fontSize: '12px', fontWeight: 700, padding: '9px 14px', borderRadius: '20px', cursor: 'pointer',
      background: active ? COLORS.primary : COLORS.card,
      color: active ? 'white' : COLORS.text,
      border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
    }}>
      <Icon name={icon} size={13} color={active ? 'white' : COLORS.text} /> {label}
    </span>
  )
}

const inputStyle = {
  width: '100%', padding: '11px', border: `1px solid ${COLORS.border}`, borderRadius: '9px', fontSize: '13.5px', boxSizing: 'border-box' as const,
}

export default EventCenters
