import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import UserLayout from './UserLayout'
import HomeInviteCard from './HomeInviteCard'

// Desktop version of the personal Home page (900px and wider).
// Phones keep using Home.tsx unchanged; App.tsx picks which one to show.

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  title: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
}

// Category listing pages vs individual detail pages use different route bases.
const CATEGORY_LIST_ROUTES: Record<string, string> = {
  hotel: '/hotels', bus: '/bus', train: '/train', flight: '/flights', tour: '/tours', event_center: '/event-centers',
}
const CATEGORY_DETAIL_BASE: Record<string, string> = {
  hotel: '/hotels', bus: '/bus', train: '/train', flight: '/flight', tour: '/tour', event_center: '/event-center',
}

type HomeBanner = {
  id: string; title: string; message: string; image_url: string | null; link_url: string | null;
  banner_type: 'promo' | 'discount' | 'featured' | 'announcement';
  link_type: 'listing' | 'category' | 'external';
  target_listing_id: string | null;
  target_category: string | null;
  cta_text: string | null;
  promotion_id: string | null;
}

type HotelCardData = {
  id: string; title: string; destination: string | null; photo_url: string | null;
  price: number; avgRating: number | null
}

type TripData = {
  id: string; origin: string | null; destination: string; departure_time: string | null;
  price: number; photo_url: string | null; companyName: string
}

type Destination = { city: string; photo: string | null; rating: number; count: number; color?: string }

function getBannerHref(b: HomeBanner, listingMeta: Record<string, { category: string }>): string | null {
  if (b.link_type === 'category' && b.target_category) {
    return CATEGORY_LIST_ROUTES[b.target_category] || null
  }
  if (b.link_type === 'listing' && b.target_listing_id) {
    const meta = listingMeta[b.target_listing_id]
    if (!meta) return null
    const base = CATEGORY_DETAIL_BASE[meta.category]
    return base ? `${base}/${b.target_listing_id}` : null
  }
  // external, or legacy banners saved before link_type existed
  return b.link_url || null
}

function bannerGradient(bannerType?: string) {
  switch (bannerType) {
    case 'discount': return 'linear-gradient(135deg, #F97316, #c2410c)'
    case 'promo': return 'linear-gradient(135deg, #1e293b, #0f172a)'
    case 'featured': return 'linear-gradient(135deg, #0d9488, #115e59)'
    default: return 'linear-gradient(135deg, #0EA5E9, #0369a1)'
  }
}

const SERVICES = [
  { icon: 'hotel', label: 'Hotels & Stays', desc: 'Find your comfort', path: '/hotels' },
  { icon: 'bus', label: 'Bus Stations', desc: 'Travel by road', path: '/bus' },
  { icon: 'train', label: 'Railway', desc: 'Travel by train', path: '/train' },
  { icon: 'plane', label: 'Domestic Flights', desc: 'Fly across Nigeria', path: '/flights' },
  { icon: 'map', label: 'Tours & Attractions', desc: 'Explore places', path: '/tours' },
  { icon: 'tent', label: 'Event Centers', desc: 'Book a venue', path: '/event-centers' },
  { icon: 'car', label: 'Vehicle Rentals', desc: 'Rent a ride', path: '/vehicle-rentals' },
]

const FALLBACK_DESTINATIONS: Destination[] = [
  { city: 'Lagos', photo: null, rating: 0, count: 0, color: '#0369a1' },
  { city: 'Abuja', photo: null, rating: 0, count: 0, color: '#0EA5E9' },
  { city: 'Kaduna', photo: null, rating: 0, count: 0, color: '#F97316' },
  { city: 'Kano', photo: null, rating: 0, count: 0, color: '#0369a1' },
  { city: 'Port Harcourt', photo: null, rating: 0, count: 0, color: '#0EA5E9' },
]

const CSS = `
.tch-card { transition: box-shadow 0.15s ease, transform 0.15s ease; }
.tch-card:hover { box-shadow: 0 10px 28px rgba(15,23,42,0.12); transform: translateY(-2px); }
.tch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; }
.tch-services { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; }
.tch-dest { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; }
.tch-search-input:focus { outline: none; }
`

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '30px 0 14px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 800, color: COLORS.title, margin: 0 }}>{title}</h2>
      {onSeeAll && (
        <button
          type="button"
          onClick={onSeeAll}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', background: 'transparent',
            color: COLORS.primary, fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
          See all <Icon name="chevronRight" size={15} color={COLORS.primary} />
        </button>
      )}
    </div>
  )
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div style={{
      background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px',
      padding: '36px 24px', textAlign: 'center', color: COLORS.textMuted, fontSize: '14px',
    }}>
      {text}
    </div>
  )
}

function FavoriteButton({ active, onClick }: { active: boolean; onClick: (e: MouseEvent) => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute', top: '12px', right: '12px', width: '34px', height: '34px', borderRadius: '50%',
        background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}>
      <Icon name="heart" size={17} color={active ? COLORS.secondary : '#94a3b8'} filled={active} />
    </div>
  )
}

function SearchBar() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const go = () => {
    const city = q.trim()
    navigate(city ? `/search?city=${encodeURIComponent(city)}` : '/search')
  }
  return (
    <div style={{
      background: COLORS.card, borderRadius: '14px', padding: '10px', display: 'flex', alignItems: 'center', gap: '10px',
      boxShadow: '0 12px 32px rgba(15,23,42,0.14)', border: `1px solid ${COLORS.border}`,
    }}>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: '12px', padding: '0 14px', height: '44px',
        background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '12px',
      }}>
        <Icon name="mapPin" size={20} color={COLORS.textMuted} />
        <input
          className="tch-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') go() }}
          placeholder="Where are you going? Search by city..."
          style={{
            flex: 1, border: 'none', background: 'transparent', fontSize: '14.5px', color: COLORS.text, fontFamily: 'inherit',
          }}
        />
      </div>
      <button
        type="button"
        onClick={go}
        style={{
          height: '44px', padding: '0 26px', border: 'none', borderRadius: '10px', background: COLORS.primary,
          color: 'white', fontSize: '14.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: '8px',
        }}>
        <Icon name="search" size={18} color="white" />
        Search
      </button>
    </div>
  )
}

function TripCardDesktop({ icon, route, company, date, price, photoUrl, isFavorite, onToggleFavorite, onClick }: {
  icon: string; route: string; company: string; date: string; price: number;
  photoUrl: string | null; isFavorite: boolean; onToggleFavorite: (e: MouseEvent) => void; onClick: () => void
}) {
  return (
    <div
      className="tch-card"
      onClick={onClick}
      style={{
        background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px', overflow: 'hidden',
        cursor: 'pointer',
      }}>
      <div style={{ position: 'relative', height: '120px' }}>
        <div style={{
          width: '100%', height: '100%',
          background: photoUrl ? '#E2E8F0' : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {photoUrl ? (
            <img src={photoUrl} alt={route} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Icon name={icon} size={38} color="white" />
          )}
        </div>
        <FavoriteButton active={isFavorite} onClick={onToggleFavorite} />
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <p style={{ fontSize: '15px', fontWeight: 700, color: COLORS.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{route}</p>
        <p style={{ fontSize: '13px', color: COLORS.textMuted, margin: '4px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{company} &bull; {date}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
          <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.primary, margin: 0 }}>&#8358;{price.toLocaleString()}</p>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'white', background: COLORS.secondary, padding: '6px 14px', borderRadius: '9px' }}>Book</span>
        </div>
      </div>
    </div>
  )
}

function UserHomeDesktop() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [banners, setBanners] = useState<HomeBanner[]>([])
  const [listingMeta, setListingMeta] = useState<Record<string, { category: string }>>({})
  const [promoPercents, setPromoPercents] = useState<Record<string, number>>({})
  const [heroSlide, setHeroSlide] = useState(0)
  const [popularHotels, setPopularHotels] = useState<HotelCardData[]>([])
  const [popularBus, setPopularBus] = useState<TripData[]>([])
  const [popularFlights, setPopularFlights] = useState<TripData[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [topDestinations, setTopDestinations] = useState<Destination[]>([])

  useEffect(() => {
    const loadAll = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error || !data.user) {
          navigate('/login')
          return
        }
        const user = data.user
        const meta = user.user_metadata || {}

        // Banners for personal accounts.
        const { data: bannerRows } = await supabase
          .from('platform_banners')
          .select('id, title, message, image_url, link_url, banner_type, link_type, target_listing_id, target_category, cta_text, promotion_id')
          .eq('active', true)
          .in('target_audience', ['all', 'personal'])
          .order('created_at', { ascending: false })
        const bRows = (bannerRows || []) as HomeBanner[]
        setBanners(bRows)

        // Category (for routing to the right details page) for banners linked to a listing.
        const linkedListingIds = Array.from(new Set(
          bRows.filter((b) => b.link_type === 'listing' && b.target_listing_id).map((b) => b.target_listing_id as string)
        ))
        if (linkedListingIds.length > 0) {
          const { data: svcRows } = await supabase.from('services').select('id, category').in('id', linkedListingIds)
          const map: Record<string, { category: string }> = {}
          ;(svcRows || []).forEach((s: any) => { map[s.id] = { category: s.category } })
          setListingMeta(map)
        }

        // Real discount % for the "X% OFF" badge, from the promotions table.
        const today = new Date().toISOString().slice(0, 10)
        const promoIds = Array.from(new Set(
          bRows.filter((b) => b.banner_type === 'discount' && b.promotion_id).map((b) => b.promotion_id as string)
        ))
        if (promoIds.length > 0) {
          const { data: promoRows } = await supabase.from('promotions').select('id, discount_value, active, end_date').in('id', promoIds)
          const pmap: Record<string, number> = {}
          ;(promoRows || []).forEach((p: any) => {
            if (p.active && (!p.end_date || p.end_date >= today)) pmap[p.id] = p.discount_value
          })
          setPromoPercents(pmap)
        }

        // Ensure a profiles row exists for this user (same safeguard as the phone Home page).
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()
        if (!existingProfile) {
          await supabase.from('profiles').insert({
            id: user.id,
            full_name: meta.full_name || null,
            phone_number: meta.phone || null,
            account_type: 'personal',
            company_name: null,
            status: 'pending',
          })
        }

        const { data: hotelRows } = await supabase
          .from('services')
          .select('id, title, destination, photo_url, price, seats_available')
          .eq('category', 'hotel')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(6)

        if (hotelRows && hotelRows.length > 0) {
          const ids = hotelRows.map((h: any) => h.id)
          const { data: reviewRows } = await supabase
            .from('reviews')
            .select('service_id, rating')
            .in('service_id', ids)

          const ratingMap: Record<string, number[]> = {}
          ;(reviewRows || []).forEach((r: any) => {
            if (r.rating == null) return
            if (!ratingMap[r.service_id]) ratingMap[r.service_id] = []
            ratingMap[r.service_id].push(Number(r.rating))
          })

          setPopularHotels(hotelRows.map((h: any) => {
            const ratings = ratingMap[h.id] || []
            const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
            return {
              id: h.id, title: h.title, destination: h.destination, photo_url: h.photo_url,
              price: Number(h.price), avgRating,
            }
          }))
        }

        const { data: busRows } = await supabase
          .from('services')
          .select('id, origin, destination, departure_time, price, photo_url, companies(business_name)')
          .eq('category', 'bus')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(6)
        setPopularBus((busRows || []).map((r: any) => ({
          id: r.id, origin: r.origin, destination: r.destination, departure_time: r.departure_time,
          price: Number(r.price), photo_url: r.photo_url,
          companyName: r.companies?.business_name || 'Traveler.com Partner',
        })))

        const { data: flightRows } = await supabase
          .from('services')
          .select('id, origin, destination, departure_time, price, photo_url, companies(business_name)')
          .eq('category', 'flight')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(6)
        setPopularFlights((flightRows || []).map((r: any) => ({
          id: r.id, origin: r.origin, destination: r.destination, departure_time: r.departure_time,
          price: Number(r.price), photo_url: r.photo_url,
          companyName: r.companies?.business_name || 'Traveler.com Partner',
        })))

        const { data: favRows } = await supabase
          .from('favorites')
          .select('service_id')
          .eq('user_id', user.id)
        setFavoriteIds(new Set((favRows || []).map((f: any) => f.service_id)))
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [navigate])

  // Top destinations ranked by real reviews (same logic as the phone Home page).
  useEffect(() => {
    const loadDestinations = async () => {
      const { data: svcs } = await supabase
        .from('services')
        .select('id, destination, photo_url, category')
        .in('category', ['tour', 'event_center'])
        .eq('status', 'active')
        .not('destination', 'is', null)

      if (!svcs || svcs.length === 0) return

      const ids = svcs.map((s: any) => s.id)
      const { data: reviewRows } = await supabase.from('reviews').select('service_id, rating').in('service_id', ids)

      const stats: Record<string, { sum: number; count: number }> = {}
      for (const r of reviewRows || []) {
        if (!stats[r.service_id]) stats[r.service_id] = { sum: 0, count: 0 }
        stats[r.service_id].sum += r.rating
        stats[r.service_id].count += 1
      }

      const byCity: Record<string, { photo: string | null; rating: number; count: number }> = {}
      for (const s of svcs as any[]) {
        const city = (s.destination || '').trim()
        if (!city) continue
        const st = stats[s.id]
        const rating = st ? st.sum / st.count : 0
        const count = st ? st.count : 0
        const current = byCity[city]
        if (!current || rating > current.rating || (rating === current.rating && count > current.count)) {
          byCity[city] = { photo: s.photo_url, rating, count }
        }
      }

      const ranked = Object.entries(byCity)
        .map(([city, v]) => ({ city, ...v }))
        .sort((a, b) => (b.count > 0 ? b.rating : -1) - (a.count > 0 ? a.rating : -1) || b.count - a.count)
        .slice(0, 5)

      setTopDestinations(ranked)
    }
    loadDestinations()
  }, [])

  // Hero rotates between the welcome slide and any active banners.
  useEffect(() => {
    const total = 1 + banners.length
    if (total <= 1) return
    const timer = setInterval(() => setHeroSlide((prev) => (prev + 1) % total), 5000)
    return () => clearInterval(timer)
  }, [banners.length])

  const toggleFavorite = async (e: MouseEvent, serviceId: string) => {
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

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted, fontSize: '14px' }}>
        Loading...
      </div>
    )
  }

  const heroSlides: ({ type: 'default' } | { type: 'banner'; banner: HomeBanner })[] = [
    { type: 'default' },
    ...banners.map((b) => ({ type: 'banner' as const, banner: b })),
  ]
  const currentSlide = heroSlides[heroSlide] || heroSlides[0]
  const heroHref = currentSlide.type === 'banner' ? getBannerHref(currentSlide.banner, listingMeta) : null
  // A banner with a photo is shown as the photo only (it carries its own message); clicking opens its link.
  const heroIsImage = currentSlide.type === 'banner' && !!currentSlide.banner.image_url
  const heroDiscountPct = currentSlide.type === 'banner' && currentSlide.banner.banner_type === 'discount' && currentSlide.banner.promotion_id
    ? promoPercents[currentSlide.banner.promotion_id] ?? null
    : null

  const openHero = () => {
    if (!heroHref) return
    if (heroHref.startsWith('http')) window.location.href = heroHref
    else navigate(heroHref)
  }

  const destinations: Destination[] = topDestinations.length ? topDestinations : FALLBACK_DESTINATIONS

  return (
    <UserLayout>
      <div>
        <style>{CSS}</style>

        <HomeInviteCard />

        {/* ---------- HERO ---------- */}
        <div style={{ position: 'relative' }}>
          <div
            onClick={openHero}
            style={{
              height: '300px', borderRadius: '20px', position: 'relative', overflow: 'hidden', boxSizing: 'border-box',
              padding: heroIsImage ? 0 : '40px 48px',
              background: currentSlide.type === 'default' ? bannerGradient() : bannerGradient(currentSlide.banner.banner_type),
              color: 'white', cursor: heroHref ? 'pointer' : 'default',
            }}>
            {currentSlide.type === 'banner' && currentSlide.banner.image_url && (
              <img
                src={currentSlide.banner.image_url}
                alt=""
                draggable={false}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
            {!heroIsImage && heroDiscountPct != null && (
              <div style={{
                position: 'absolute', top: '26px', right: '40px', width: '92px', height: '92px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', textAlign: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#c2410c', lineHeight: 1 }}>Up to</span>
                <span style={{ fontSize: '30px', fontWeight: 900, color: '#c2410c', lineHeight: 1.15 }}>{heroDiscountPct}%</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#c2410c', lineHeight: 1 }}>OFF</span>
              </div>
            )}
            {!heroIsImage && (
              <div style={{ position: 'relative', maxWidth: '680px' }}>
                {currentSlide.type === 'default' ? (
                  <>
                    <h1 style={{ fontSize: '34px', fontWeight: 800, lineHeight: 1.15, margin: '0 0 10px' }}>Explore Nigeria With Confidence</h1>
                    <p style={{ fontSize: '16px', opacity: 0.92, margin: 0 }}>Hotels, Transport, Flights &amp; Tours in One Platform</p>
                  </>
                ) : (
                  <>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.2, margin: '0 0 10px', maxWidth: heroDiscountPct != null ? '75%' : '100%' }}>
                      {currentSlide.banner.title}
                    </h1>
                    <p style={{ fontSize: '15px', opacity: 0.95, margin: 0, maxWidth: heroDiscountPct != null ? '75%' : '100%' }}>
                      {currentSlide.banner.message}
                    </p>
                    {currentSlide.banner.cta_text && (
                      <div style={{
                        marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px',
                        background: 'rgba(255,255,255,0.95)', color: '#1A1A1A', padding: '9px 18px',
                        borderRadius: '10px', fontSize: '13.5px', fontWeight: 800,
                      }}>
                        {currentSlide.banner.cta_text} <span>&rarr;</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {heroSlides.length > 1 && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: '46px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {heroSlides.map((_, i) => (
                <div
                  key={i}
                  onClick={() => setHeroSlide(i)}
                  style={{
                    width: i === heroSlide ? '26px' : '8px', height: '8px', borderRadius: '4px',
                    background: i === heroSlide ? 'white' : 'rgba(255,255,255,0.55)',
                    cursor: 'pointer', transition: 'width 0.2s',
                  }}
                />
              ))}
            </div>
          )}

          <div style={{ position: 'relative', zIndex: 2, margin: '-30px 36px 0' }}>
            <SearchBar />
          </div>
        </div>

        {/* ---------- SERVICES ---------- */}
        <SectionHeader title="Our Services" onSeeAll={() => navigate('/search')} />
        <div className="tch-services">
          {SERVICES.map((s) => (
            <div
              key={s.label}
              className="tch-card"
              onClick={() => navigate(s.path)}
              style={{
                background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px',
                padding: '14px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '11px', background: '#E0F2FE',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px',
              }}>
                <Icon name={s.icon} size={19} color={COLORS.primary} />
              </div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text, margin: 0 }}>{s.label}</p>
              <p style={{ fontSize: '12px', color: COLORS.textMuted, margin: '3px 0 0' }}>{s.desc}</p>
            </div>
          ))}
        </div>

        {/* ---------- FEATURED DESTINATIONS ---------- */}
        <SectionHeader title="Featured Destinations" />
        <div className="tch-dest">
          {destinations.map((d) => (
            <div
              key={d.city}
              className="tch-card"
              onClick={() => navigate(`/search?city=${encodeURIComponent(d.city)}`)}
              style={{
                position: 'relative', height: '165px', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer',
                background: d.photo ? '#E2E8F0' : `linear-gradient(135deg, ${d.color || COLORS.primary}, ${COLORS.primary})`,
              }}>
              {d.photo ? (
                <img src={d.photo} alt={d.city} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="mapPin" size={42} color="white" />
                </div>
              )}
              <div style={{
                position: 'absolute', left: 0, right: 0, bottom: 0, padding: '40px 16px 14px',
                background: 'linear-gradient(to top, rgba(15,23,42,0.75), rgba(15,23,42,0))', color: 'white',
              }}>
                <p style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>{d.city}</p>
                {d.count > 0 ? (
                  <p style={{ fontSize: '12.5px', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.95 }}>
                    <Icon name="star" size={12} color="#FBBF24" filled /> {d.rating.toFixed(1)} &middot; {d.count} reviews
                  </p>
                ) : (
                  <p style={{ fontSize: '12.5px', margin: '4px 0 0', fontWeight: 600, opacity: 0.95 }}>Explore</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ---------- RECOMMENDED HOTELS ---------- */}
        <SectionHeader title="Recommended Hotels" onSeeAll={() => navigate('/hotels')} />
        {popularHotels.length === 0 ? (
          <EmptyBlock text="No hotels available yet. Check back soon!" />
        ) : (
          <div className="tch-grid">
            {popularHotels.map((h) => (
              <div
                key={h.id}
                className="tch-card"
                onClick={() => navigate(`/hotels/${h.id}`)}
                style={{
                  background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px',
                  overflow: 'hidden', cursor: 'pointer',
                }}>
                <div style={{ position: 'relative', height: '140px' }}>
                  <div style={{
                    width: '100%', height: '100%',
                    background: h.photo_url ? '#E2E8F0' : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {h.photo_url ? (
                      <img src={h.photo_url} alt={h.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Icon name="hotel" size={40} color="white" />
                    )}
                  </div>
                  <FavoriteButton active={favoriteIds.has(h.id)} onClick={(e) => toggleFavorite(e, h.id)} />
                </div>
                <div style={{ padding: '12px 14px 14px' }}>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: COLORS.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.title}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '13px', color: COLORS.textMuted }}>
                    <span>{h.destination || ''}</span>
                    {h.avgRating !== null && (
                      <>
                        <span>&bull;</span>
                        <Icon name="star" size={12} color="#D4A017" filled />
                        <span>{h.avgRating.toFixed(1)}</span>
                      </>
                    )}
                  </div>
                  <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.primary, margin: '10px 0 0' }}>
                    &#8358;{h.price.toLocaleString()}
                    <span style={{ fontSize: '12.5px', color: COLORS.textMuted, fontWeight: 400 }}> /night</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---------- POPULAR BUS ROUTES ---------- */}
        <SectionHeader title="Popular Bus Routes" onSeeAll={() => navigate('/bus')} />
        {popularBus.length === 0 ? (
          <EmptyBlock text="No bus routes available yet" />
        ) : (
          <div className="tch-grid">
            {popularBus.map((r) => (
              <TripCardDesktop
                key={r.id}
                icon="bus"
                route={r.origin ? `${r.origin} → ${r.destination}` : r.destination}
                company={r.companyName}
                date={r.departure_time ? new Date(r.departure_time).toLocaleDateString() : 'Schedule TBA'}
                price={r.price}
                photoUrl={r.photo_url}
                isFavorite={favoriteIds.has(r.id)}
                onToggleFavorite={(e) => toggleFavorite(e, r.id)}
                onClick={() => navigate(`/bus/${r.id}`)}
              />
            ))}
          </div>
        )}

        {/* ---------- DOMESTIC FLIGHTS ---------- */}
        <SectionHeader title="Domestic Flights" onSeeAll={() => navigate('/flights')} />
        {popularFlights.length === 0 ? (
          <EmptyBlock text="No flights available yet" />
        ) : (
          <div className="tch-grid">
            {popularFlights.map((f) => (
              <TripCardDesktop
                key={f.id}
                icon="plane"
                route={f.origin ? `${f.origin} → ${f.destination}` : f.destination}
                company={f.companyName}
                date={f.departure_time ? new Date(f.departure_time).toLocaleDateString() : 'Schedule TBA'}
                price={f.price}
                photoUrl={f.photo_url}
                isFavorite={favoriteIds.has(f.id)}
                onToggleFavorite={(e) => toggleFavorite(e, f.id)}
                onClick={() => navigate(`/flight/${f.id}`)}
              />
            ))}
          </div>
        )}

        {/* ---------- MY BOOKINGS LINK ---------- */}
        <div
          className="tch-card"
          onClick={() => navigate('/bookings')}
          style={{
            marginTop: '30px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px',
            padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '11px', background: '#E0F2FE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="ticket" size={19} color={COLORS.primary} />
            </div>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.title, margin: 0 }}>My Bookings</p>
              <p style={{ fontSize: '12.5px', color: COLORS.textMuted, margin: '3px 0 0' }}>View your tickets and manage your trips</p>
            </div>
          </div>
          <Icon name="chevronRight" size={22} color={COLORS.textMuted} />
        </div>
      </div>
    </UserLayout>
  )
}

export default UserHomeDesktop
