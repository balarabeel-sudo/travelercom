import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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

const CATEGORY_META: Record<string, { label: string; icon: string; detailPath: (id: string) => string; unit: string }> = {
  hotel: { label: 'Hotel', icon: 'hotel', detailPath: (id) => `/hotels/${id}`, unit: '/night' },
  bus: { label: 'Bus', icon: 'bus', detailPath: (id) => `/bus/${id}`, unit: '/seat' },
  train: { label: 'Train', icon: 'train', detailPath: (id) => `/train/${id}`, unit: '/seat' },
  flight: { label: 'Flight', icon: 'plane', detailPath: (id) => `/flight/${id}`, unit: '/seat' },
  tour: { label: 'Tour', icon: 'tent', detailPath: (id) => `/tour/${id}`, unit: '/person' },
  event_center: { label: 'Event Center', icon: 'party', detailPath: (id) => `/event-center/${id}`, unit: '/day' },
}

const CATEGORY_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'hotel', label: 'Hotels' },
  { key: 'bus', label: 'Bus' },
  { key: 'train', label: 'Train' },
  { key: 'flight', label: 'Flights' },
  { key: 'tour', label: 'Tours' },
  { key: 'event_center', label: 'Event Centers' },
]

type Result = {
  id: string
  title: string
  destination: string | null
  price: number
  photo_url: string | null
  category: string
  business_name: string | null
  rating: number
  reviewCount: number
}

function Search() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [cityInput, setCityInput] = useState(params.get('city') || '')
  const [category, setCategory] = useState(params.get('category') || 'all')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)

  const city = params.get('city') || ''

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let query = supabase
        .from('services')
        .select('id, title, destination, price, photo_url, category, companies(business_name)')
        .eq('status', 'active')

      if (city.trim()) query = query.ilike('destination', `%${city.trim()}%`)
      if (category !== 'all') query = query.eq('category', category)

      const { data: svcs } = await query.order('created_at', { ascending: false })

      if (!svcs || svcs.length === 0) {
        setResults([])
        setLoading(false)
        return
      }

      const ids = svcs.map((s: any) => s.id)
      const { data: reviewRows } = await supabase.from('reviews').select('service_id, rating').in('service_id', ids)
      const stats: Record<string, { sum: number; count: number }> = {}
      for (const r of reviewRows || []) {
        if (!stats[r.service_id]) stats[r.service_id] = { sum: 0, count: 0 }
        stats[r.service_id].sum += r.rating
        stats[r.service_id].count += 1
      }

      setResults((svcs as any[]).map((s) => ({
        id: s.id,
        title: s.title,
        destination: s.destination,
        price: s.price,
        photo_url: s.photo_url,
        category: s.category,
        business_name: s.companies?.business_name || null,
        rating: stats[s.id] ? stats[s.id].sum / stats[s.id].count : 0,
        reviewCount: stats[s.id]?.count || 0,
      })))
      setLoading(false)
    }
    load()
  }, [city, category])

  const runSearch = () => {
    const next = new URLSearchParams(params)
    if (cityInput.trim()) next.set('city', cityInput.trim())
    else next.delete('city')
    setParams(next)
  }

  const changeCategory = (key: string) => {
    setCategory(key)
    const next = new URLSearchParams(params)
    if (key !== 'all') next.set('category', key)
    else next.delete('category')
    setParams(next)
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>
      <div style={{ padding: '18px 20px 12px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="arrowLeft" size={20} color={COLORS.text} />
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '9px 12px' }}>
            <Icon name="search" size={15} color={COLORS.textMuted} />
            <input
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Search by city..."
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', background: 'transparent', color: COLORS.text }}
            />
          </div>
          <span onClick={runSearch} style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', background: COLORS.primary, borderRadius: '8px', padding: '9px 14px', cursor: 'pointer' }}>Go</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginTop: '12px', paddingBottom: '2px' }}>
          {CATEGORY_FILTERS.map((c) => (
            <span key={c.key} onClick={() => changeCategory(c.key)} style={{
              flexShrink: 0, padding: '7px 13px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              background: category === c.key ? COLORS.primary : COLORS.bg,
              color: category === c.key ? 'white' : COLORS.textMuted,
              border: `1px solid ${category === c.key ? COLORS.primary : COLORS.border}`,
            }}>{c.label}</span>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {city && (
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: '12px' }}>
            Showing results for <span style={{ fontWeight: 700, color: COLORS.text }}>{city}</span>
          </p>
        )}

        {loading && <p style={{ fontSize: '13px', color: COLORS.textMuted, textAlign: 'center', padding: '40px 0' }}>Searching...</p>}

        {!loading && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Icon name="search" size={26} color={COLORS.textMuted} />
            <p style={{ fontSize: '13px', color: COLORS.textMuted, marginTop: '10px' }}>
              {city ? `No results found for "${city}".` : 'Enter a city to search.'}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {results.map((r) => {
            const meta = CATEGORY_META[r.category] || CATEGORY_META.hotel
            return (
              <div key={r.id} onClick={() => navigate(meta.detailPath(r.id))}
                style={{ display: 'flex', gap: '12px', background: COLORS.card, borderRadius: '14px', padding: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
                <div style={{ position: 'relative', width: '96px', height: '96px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0 }}>
                  {r.photo_url ? (
                    <img src={r.photo_url} alt={r.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={meta.icon} size={26} color="white" />
                    </div>
                  )}
                  <span style={{ position: 'absolute', top: '6px', left: '6px', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '9.5px', fontWeight: 700, padding: '3px 7px', borderRadius: '6px' }}>{meta.label}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</p>
                    <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{r.business_name}{r.destination ? ` · ${r.destination}` : ''}</p>
                    {r.reviewCount > 0 && (
                      <p style={{ fontSize: '11px', color: COLORS.textMuted, display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px' }}>
                        <Icon name="star" size={11} color="#D4A017" filled /> {r.rating.toFixed(1)} ({r.reviewCount})
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.primary }}>
                      ₦{Number(r.price).toLocaleString()} <span style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: 400 }}>{meta.unit}</span>
                    </p>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'white', background: COLORS.secondary, padding: '5px 10px', borderRadius: '7px' }}>View Details</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Search
