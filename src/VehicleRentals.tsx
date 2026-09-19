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

const FEATURE_ICON: Record<string, string> = {
  'Air Conditioning': 'snowflake', GPS: 'compass', Bluetooth: 'bluetooth', USB: 'plug', 'Wi-Fi': 'wifi', 'Child Seat': 'seat',
}

const RENTAL_MODE_LABEL: Record<string, string> = { self_drive: 'Self-Drive', with_driver: 'With Driver', both: 'Self-Drive or Driver' }

// Nigeria's 36 states + FCT, mapped to the primary city used in the listing's city text.
// Used only to filter existing real listings by state — no booking data is invented here.
const NIGERIA_STATES: { name: string; city: string }[] = [
  { name: 'Abia', city: 'Umuahia' }, { name: 'Adamawa', city: 'Yola' }, { name: 'Akwa Ibom', city: 'Uyo' },
  { name: 'Anambra', city: 'Awka' }, { name: 'Bauchi', city: 'Bauchi' }, { name: 'Bayelsa', city: 'Yenagoa' },
  { name: 'Benue', city: 'Makurdi' }, { name: 'Borno', city: 'Maiduguri' }, { name: 'Cross River', city: 'Calabar' },
  { name: 'Delta', city: 'Asaba' }, { name: 'Ebonyi', city: 'Abakaliki' }, { name: 'Edo', city: 'Benin' },
  { name: 'Ekiti', city: 'Ado Ekiti' }, { name: 'Enugu', city: 'Enugu' }, { name: 'FCT (Abuja)', city: 'Abuja' },
  { name: 'Gombe', city: 'Gombe' }, { name: 'Imo', city: 'Owerri' }, { name: 'Jigawa', city: 'Dutse' },
  { name: 'Kaduna', city: 'Kaduna' }, { name: 'Kano', city: 'Kano' }, { name: 'Katsina', city: 'Katsina' },
  { name: 'Kebbi', city: 'Birnin Kebbi' }, { name: 'Kogi', city: 'Lokoja' }, { name: 'Kwara', city: 'Ilorin' },
  { name: 'Lagos', city: 'Lagos' }, { name: 'Nasarawa', city: 'Lafia' }, { name: 'Niger', city: 'Minna' },
  { name: 'Ogun', city: 'Abeokuta' }, { name: 'Ondo', city: 'Akure' }, { name: 'Osun', city: 'Osogbo' },
  { name: 'Oyo', city: 'Ibadan' }, { name: 'Plateau', city: 'Jos' }, { name: 'Rivers', city: 'Port Harcourt' },
  { name: 'Sokoto', city: 'Sokoto' }, { name: 'Taraba', city: 'Jalingo' }, { name: 'Yobe', city: 'Damaturu' },
  { name: 'Zamfara', city: 'Gusau' },
]

const TRUST_BADGES: { icon: string; label: string; sub: string }[] = [
  { icon: 'user', label: 'Verified Partners', sub: 'Trusted brands' },
  { icon: 'checkCircle', label: 'Easy Booking', sub: 'Fast & Simple' },
  { icon: 'shield', label: 'Secure Payment', sub: '100% Safe' },
  { icon: 'clock', label: '24/7 Support', sub: "We're here" },
]

type VehicleItem = {
  id: string
  title: string
  destination: string
  brand: string | null
  model: string | null
  year: number | null
  transmission: string | null
  fuel_type: string | null
  capacity: number | null
  rental_mode: string | null
  price: number
  seats_available: number | null
  photo_url: string | null
  amenities: string[] | null
  companies: { business_name: string } | null
  avgRating: number | null
  reviewCount: number
}

type SortKey = 'recommended' | 'price_low' | 'price_high' | 'rating'

function VehicleRentals() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [items, setItems] = useState<VehicleItem[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())

  const [city, setCity] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [showPriceFilter, setShowPriceFilter] = useState(false)

  const [stateFilter, setStateFilter] = useState('all')
  const [showStateFilter, setShowStateFilter] = useState(false)

  const [sortBy, setSortBy] = useState<SortKey>('recommended')
  const [showSort, setShowSort] = useState(false)

  const fetchItems = async () => {
    setLoading(true)
    setNetError(false)
    let query = supabase
      .from('services')
      .select('id, title, destination, brand, model, year, transmission, fuel_type, capacity, rental_mode, price, seats_available, photo_url, amenities, companies(business_name)')
      .eq('category', 'vehicle_rental')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (city.trim()) query = query.ilike('destination', `%${city.trim()}%`)
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

    setItems(rows.map((h) => {
      const ratings = ratingMap[h.id] || []
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
      return { ...h, avgRating, reviewCount: ratings.length }
    }))
    setLoading(false)
  }

  useEffect(() => {
    fetchItems()
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
    setCity('')
    setMinPrice('')
    setMaxPrice('')
    setPickupDate('')
    setReturnDate('')
    setStateFilter('all')
    fetchItems()
  }

  // State filter is applied client-side against the already-loaded real listings —
  // no extra data is invented, it just narrows by city text.
  const selectedCity = stateFilter === 'all' ? null : (NIGERIA_STATES.find((s) => s.name === stateFilter)?.city || null)
  const filteredItems = selectedCity
    ? items.filter((h) => h.destination.toLowerCase().includes(selectedCity.toLowerCase()))
    : items

  const visible = [...filteredItems].sort((a, b) => {
    if (sortBy === 'price_low') return a.price - b.price
    if (sortBy === 'price_high') return b.price - a.price
    if (sortBy === 'rating') return (b.avgRating ?? -1) - (a.avgRating ?? -1)
    return 0
  })

  const bestDealId = filteredItems.length > 1 ? [...filteredItems].sort((a, b) => a.price - b.price)[0].id : null
  const popularId = (() => {
    const rated = filteredItems.filter((h) => h.avgRating !== null)
    if (rated.length < 2) return null
    return [...rated].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))[0].id
  })()

  const SORT_LABELS: Record<SortKey, string> = {
    recommended: 'Recommended', price_low: 'Price: Low to High', price_high: 'Price: High to Low', rating: 'Top Rated',
  }

  const detailHref = (id: string) => {
    const params = new URLSearchParams()
    if (pickupDate) params.set('pickup', pickupDate)
    if (returnDate) params.set('return', returnDate)
    const qs = params.toString()
    return `/vehicle-rentals/${id}${qs ? `?${qs}` : ''}`
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      {/* ---------- HEADER ---------- */}
      <div style={{ padding: '16px 20px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="arrowLeft" size={20} color={COLORS.text} />
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="car" size={20} color={COLORS.primary} />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text }}>Vehicle Rental</h1>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>Self-drive or with a driver, your choice</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Icon name="heart" size={20} color={COLORS.text} />
          <NotificationBell iconColor={COLORS.text} />
        </div>
      </div>

      {/* ---------- SEARCH HERO ---------- */}
      <div style={{ margin: '16px', borderRadius: '20px', padding: '16px', background: `linear-gradient(135deg, ${COLORS.primary}, #1e40af)`, boxShadow: '0 8px 24px rgba(14,165,233,0.25)' }}>

        <div style={{ background: 'white', borderRadius: '16px', padding: '4px 16px' }}>
          <div style={{ padding: '12px 0', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Icon name="mapPin" size={16} color={COLORS.primary} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginBottom: '2px' }}>City</p>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Where do you need a vehicle?" style={{ border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: COLORS.text, width: '100%', padding: 0 }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${COLORS.border}`, gap: '14px' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="calendar" size={16} color={COLORS.primary} />
              <div>
                <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>Pickup</p>
                <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '13px', fontWeight: 700, color: COLORS.text, padding: 0, background: 'transparent' }} />
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="calendar" size={16} color={COLORS.secondary} />
              <div>
                <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>Return</p>
                <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '13px', fontWeight: 700, color: COLORS.text, padding: 0, background: 'transparent' }} />
              </div>
            </div>
          </div>
        </div>

        <button onClick={fetchItems} style={{ width: '100%', marginTop: '14px', padding: '14px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '14.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Icon name="search" size={16} color="white" /> Search Vehicles
        </button>

        <p onClick={clearFilters} style={{ textAlign: 'center', color: 'white', fontSize: '11.5px', marginTop: '10px', textDecoration: 'underline', cursor: 'pointer', opacity: 0.85 }}>
          Clear filters
        </p>
      </div>

      {/* ---------- TRUST BADGES ---------- */}
      <div style={{ margin: '0 16px 16px', background: COLORS.card, borderRadius: '16px', padding: '16px 6px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px' }}>
        {TRUST_BADGES.map((t) => (
          <div key={t.label} style={{ textAlign: 'center' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
              <Icon name={t.icon} size={16} color="white" />
            </div>
            <p style={{ fontSize: '10px', fontWeight: 700, color: COLORS.text, lineHeight: 1.2 }}>{t.label}</p>
            <p style={{ fontSize: '9px', color: COLORS.textMuted }}>{t.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 16px' }}>

        {/* ---------- STATE + QUICK FILTERS ---------- */}
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            <div style={{ flexShrink: 0 }}>
              <span onClick={() => setShowStateFilter(!showStateFilter)} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700, padding: '9px 14px', borderRadius: '20px', cursor: 'pointer', background: stateFilter === 'all' ? COLORS.card : COLORS.primary, color: stateFilter === 'all' ? COLORS.text : 'white', border: `1px solid ${stateFilter === 'all' ? COLORS.border : COLORS.primary}`, whiteSpace: 'nowrap' }}>
                <Icon name="mapPin" size={13} color={stateFilter === 'all' ? COLORS.text : 'white'} />
                {stateFilter === 'all' ? 'All States' : stateFilter} ⌄
              </span>
            </div>
            <FilterChip icon="star" label="Top Rated" active={sortBy === 'rating'} onClick={() => setSortBy(sortBy === 'rating' ? 'recommended' : 'rating')} />
            <FilterChip icon="cash" label={sortBy === 'price_low' ? 'Price ↑' : sortBy === 'price_high' ? 'Price ↓' : 'Price'} active={sortBy === 'price_low' || sortBy === 'price_high'} onClick={() => setSortBy(sortBy === 'price_low' ? 'price_high' : sortBy === 'price_high' ? 'recommended' : 'price_low')} />
            <span onClick={() => setShowPriceFilter(!showPriceFilter)} style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, fontSize: '12px', fontWeight: 700, padding: '9px 14px', borderRadius: '20px', cursor: 'pointer', background: showPriceFilter ? COLORS.primary : COLORS.card, color: showPriceFilter ? 'white' : COLORS.text, border: `1px solid ${showPriceFilter ? COLORS.primary : COLORS.border}` }}>
              <Icon name="barChart" size={13} color={showPriceFilter ? 'white' : COLORS.text} /> Range
            </span>
          </div>
          {showStateFilter && (
            <div style={{ position: 'absolute', left: 0, top: '42px', background: COLORS.card, borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 30, width: '220px', maxHeight: '280px', overflowY: 'auto' }}>
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

        {showPriceFilter && (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '8px' }}>Price Range (per day)</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="number" placeholder="Min ₦" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <input type="number" placeholder="Max ₦" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            </div>
            <button onClick={() => { fetchItems(); setShowPriceFilter(false) }} style={{ width: '100%', marginTop: '10px', padding: '10px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '9px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>
              Apply
            </button>
          </div>
        )}

        {/* ---------- RESULT COUNT + SORT ---------- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>
            {loading ? 'Searching...' : `${visible.length} vehicle${visible.length !== 1 ? 's' : ''} found${city.trim() ? ` in ${city.trim()}` : ''}`}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
        </div>

        {/* ---------- RESULTS ---------- */}
        {netError ? (
          <NetworkError onRetry={fetchItems} />
        ) : loading ? (
          <ListCardSkeleton count={4} />
        ) : visible.length === 0 ? (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '30px', textAlign: 'center', color: COLORS.textMuted, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '13px' }}>No rental vehicles available yet</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Try a different city, or clear your filters.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {visible.map((h) => (
              <div key={h.id} onClick={() => navigate(detailHref(h.id))} style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', cursor: 'pointer', display: 'flex', gap: '12px' }}>

                <div style={{ position: 'relative', width: '96px', height: '96px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{ width: '100%', height: '100%', background: h.photo_url ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {h.photo_url ? <img src={h.photo_url} alt={h.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="car" size={28} color="white" />}
                  </div>
                  {h.id === bestDealId && (
                    <span style={{ position: 'absolute', top: '6px', left: '6px', background: '#DCFCE7', color: COLORS.green, fontSize: '9.5px', fontWeight: 800, padding: '3px 7px', borderRadius: '6px' }}>Best Deal</span>
                  )}
                  {h.id === popularId && h.id !== bestDealId && (
                    <span style={{ position: 'absolute', top: '6px', left: '6px', background: COLORS.secondary, color: 'white', fontSize: '9.5px', fontWeight: 800, padding: '3px 7px', borderRadius: '6px' }}>Popular</span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                    <p style={{ fontSize: '14.5px', fontWeight: 800, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {h.title}
                    </p>
                    <div onClick={(e) => toggleFavorite(e, h.id)} style={{ flexShrink: 0 }}>
                      <Icon name="heart" size={16} color={favoriteIds.has(h.id) ? COLORS.secondary : '#94a3b8'} filled={favoriteIds.has(h.id)} />
                    </div>
                  </div>

                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '1px' }}>{h.companies?.business_name || 'Traveler.com Partner'} • {h.destination}</p>

                  {h.avgRating !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <Icon name="star" size={11} color="#D4A017" />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{h.avgRating.toFixed(1)}</span>
                      <span style={{ fontSize: '11px', color: COLORS.primary, fontWeight: 600 }}>({h.reviewCount.toLocaleString()} review{h.reviewCount !== 1 ? 's' : ''})</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {h.transmission && (
                      <span style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: 600 }}>{h.transmission}</span>
                    )}
                    {h.fuel_type && (
                      <span style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: 600 }}>{h.fuel_type}</span>
                    )}
                    {h.capacity != null && (
                      <span style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: 600 }}>{h.capacity} seats</span>
                    )}
                    {h.rental_mode && (
                      <span style={{ fontSize: '10px', color: COLORS.primary, fontWeight: 700 }}>{RENTAL_MODE_LABEL[h.rental_mode] || h.rental_mode}</span>
                    )}
                  </div>

                  {h.amenities && h.amenities.length > 0 && (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {h.amenities.slice(0, 4).map((a) => (
                        <span key={a} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: COLORS.textMuted, fontWeight: 600 }}>
                          <Icon name={FEATURE_ICON[a] || 'check'} size={11} color={COLORS.textMuted} /> {a}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px' }}>
                    <div>
                      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.primary }}>₦{Number(h.price).toLocaleString()}<span style={{ fontSize: '10.5px', fontWeight: 600, color: COLORS.textMuted }}>/day</span></p>
                      <p style={{ fontSize: '10.5px', fontWeight: 700, color: (!h.seats_available || h.seats_available === 0) ? '#DC2626' : COLORS.green }}>
                        {(!h.seats_available || h.seats_available === 0) ? 'Not available' : `${h.seats_available} vehicle${h.seats_available !== 1 ? 's' : ''} available`}
                      </p>
                    </div>
                    <span style={{ padding: '9px 16px', background: COLORS.secondary, color: 'white', borderRadius: '9px', fontWeight: 700, fontSize: '12px' }}>Rent Now</span>
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

export default VehicleRentals
