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
  gold: '#D4A017',
}

const AMENITY_ICON: Record<string, string> = {
  WiFi: 'wifi', Parking: 'parking', Restaurant: 'restaurant', Pool: 'pool', Gym: 'gym',
  'Airport Pickup': 'plane', 'Conference Hall': 'building', Laundry: 'laundry', AC: 'snowflake', Breakfast: 'coffee',
}

type Hotel = {
  id: string
  title: string
  description: string | null
  destination: string
  price: number
  seats_available: number | null
  photo_url: string | null
  amenities: string[] | null
  companies: { business_name: string } | null
  avgRating: number | null
  reviewCount: number
}

type SortKey = 'recommended' | 'price_low' | 'price_high' | 'rating'

function Hotels() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())

  const [destination, setDestination] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  const [sortBy, setSortBy] = useState<SortKey>('recommended')
  const [showSort, setShowSort] = useState(false)
  const [amenityFilter, setAmenityFilter] = useState<string | null>(null)
  const [showAmenityPicker, setShowAmenityPicker] = useState(false)

  const fetchHotels = async () => {
    setLoading(true)
    let query = supabase
      .from('services')
      .select('id, title, description, destination, price, seats_available, photo_url, amenities, companies(business_name)')
      .eq('category', 'hotel')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (destination.trim()) query = query.ilike('destination', `%${destination.trim()}%`)
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

    setHotels(rows.map((h) => {
      const ratings = ratingMap[h.id] || []
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
      return { ...h, avgRating, reviewCount: ratings.length }
    }))
    setLoading(false)
  }

  useEffect(() => {
    fetchHotels()
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

  const allAmenities = Array.from(new Set(hotels.flatMap((h) => h.amenities || [])))

  let visible = amenityFilter ? hotels.filter((h) => (h.amenities || []).includes(amenityFilter)) : hotels
  visible = [...visible].sort((a, b) => {
    if (sortBy === 'price_low') return a.price - b.price
    if (sortBy === 'price_high') return b.price - a.price
    if (sortBy === 'rating') return (b.avgRating ?? -1) - (a.avgRating ?? -1)
    return 0
  })

  const lowestPriceId = hotels.length > 1 ? [...hotels].sort((a, b) => a.price - b.price)[0].id : null
  const topRatedId = (() => {
    const rated = hotels.filter((h) => h.avgRating !== null)
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
              <h1 style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text }}>Hotels & Stays</h1>
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>Find the best places to stay</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <span style={{ color: COLORS.textMuted, display: 'flex' }}><Icon name="heart" size={18} color={COLORS.textMuted} /></span>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: '14px' }}>
          <input type="text" placeholder="Destination (e.g. Kano, Nigeria)" value={destination} onChange={(e) => setDestination(e.target.value)} style={inputStyle} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <input type="number" placeholder="Min price (₦)" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <input type="number" placeholder="Max price (₦)" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button onClick={fetchHotels} style={{ flex: 1, padding: '12px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Icon name="search" size={15} color="white" /> Search Hotels
            </button>
            <button onClick={() => { setDestination(''); setMinPrice(''); setMaxPrice(''); setAmenityFilter(null); fetchHotels() }} style={{ padding: '12px 16px', background: COLORS.bg, color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px' }}>
          <FilterChip icon="star" label="Top Rated" active={sortBy === 'rating'} onClick={() => setSortBy(sortBy === 'rating' ? 'recommended' : 'rating')} />
          <FilterChip icon="cash" label={sortBy === 'price_low' ? 'Price ↑' : sortBy === 'price_high' ? 'Price ↓' : 'Price'} active={sortBy === 'price_low' || sortBy === 'price_high'} onClick={() => setSortBy(sortBy === 'price_low' ? 'price_high' : sortBy === 'price_high' ? 'recommended' : 'price_low')} />
          {allAmenities.length > 0 && (
            <FilterChip icon="tag" label={amenityFilter || 'Amenities'} active={!!amenityFilter} onClick={() => setShowAmenityPicker(!showAmenityPicker)} />
          )}
        </div>

        {showAmenityPicker && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {allAmenities.map((a) => (
              <span key={a} onClick={() => { setAmenityFilter(amenityFilter === a ? null : a); setShowAmenityPicker(false) }}
                style={{ fontSize: '11px', fontWeight: 700, padding: '6px 11px', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                  background: amenityFilter === a ? COLORS.primary : COLORS.bg, color: amenityFilter === a ? 'white' : COLORS.textMuted,
                  border: `1px solid ${COLORS.border}` }}>
                <Icon name={AMENITY_ICON[a] || 'check'} size={11} color={amenityFilter === a ? 'white' : COLORS.textMuted} /> {a}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>
            {loading ? 'Searching...' : `${visible.length} hotel${visible.length !== 1 ? 's' : ''} found${destination.trim() ? ` in ${destination.trim()}` : ''}`}
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
            <p style={{ fontSize: '13px' }}>No hotels found</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Try a different destination or clear your filters.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {visible.map((h) => (
              <div key={h.id} onClick={() => navigate(`/hotels/${h.id}`)} style={{ background: COLORS.card, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
                <div style={{ position: 'relative', height: '160px' }}>
                  <div style={{ width: '100%', height: '100%', background: h.photo_url ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '34px' }}>
                    {h.photo_url ? <img src={h.photo_url} alt={h.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="hotel" size={34} color="white" />}
                  </div>
                  <div onClick={(e) => toggleFavorite(e, h.id)} style={{ position: 'absolute', top: '10px', right: '10px', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: favoriteIds.has(h.id) ? COLORS.secondary : '#94a3b8' }}>
                    <Icon name="heart" size={15} color={favoriteIds.has(h.id) ? COLORS.secondary : '#94a3b8'} filled={favoriteIds.has(h.id)} />
                  </div>
                  {h.id === lowestPriceId && (
                    <span style={{ position: 'absolute', top: '10px', left: '10px', background: COLORS.secondary, color: 'white', fontSize: '10.5px', fontWeight: 700, padding: '5px 10px', borderRadius: '20px' }}>Best Value</span>
                  )}
                  {h.id === topRatedId && h.id !== lowestPriceId && (
                    <span style={{ position: 'absolute', top: '10px', left: '10px', background: COLORS.primary, color: 'white', fontSize: '10.5px', fontWeight: 700, padding: '5px 10px', borderRadius: '20px' }}>Top Rated</span>
                  )}
                </div>

                <div style={{ padding: '14px' }}>
                  <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{h.title}</p>
                  <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}><Icon name="mapPin" size={11} color={COLORS.textMuted} /> {h.destination}</p>

                  {h.avgRating !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                      <span style={{ background: '#DCFCE7', color: COLORS.green, fontSize: '11.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '6px' }}>{h.avgRating.toFixed(1)}</span>
                      <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>({h.reviewCount} review{h.reviewCount !== 1 ? 's' : ''})</span>
                    </div>
                  )}

                  {h.amenities && h.amenities.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                      {h.amenities.slice(0, 4).map((a) => (
                        <span key={a} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, padding: '4px 9px', borderRadius: '20px' }}>
                          <Icon name={AMENITY_ICON[a] || 'check'} size={11} color={COLORS.textMuted} /> {a}
                        </span>
                      ))}
                      {h.amenities.length > 4 && (
                        <span style={{ fontSize: '10px', color: COLORS.textMuted, alignSelf: 'center' }}>+{h.amenities.length - 4} more</span>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '12px' }}>
                    <div>
                      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.primary }}>₦{Number(h.price).toLocaleString()} <span style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 400 }}>/night</span></p>
                      {h.seats_available !== null && (
                        <p style={{ fontSize: '11px', fontWeight: 700, color: h.seats_available === 0 ? '#DC2626' : COLORS.green }}>
                          {h.seats_available === 0 ? 'Fully booked' : `${h.seats_available} rooms available`}
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

export default Hotels
