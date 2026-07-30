import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  primary: '#0EA5E9',
  secondary: '#F97316',
  purple: '#6B21A8',
  text: '#0F172A',
  textMuted: '#64748B',
  gold: '#F59E0B',
  green: '#16A34A',
}

const CATEGORY_ROUTE: Record<string, (id: string) => string> = {
  hotel: (id) => `/hotels/${id}`,
}

type Company = {
  id: string
  business_name: string
  approval_status: string
  plan: string
  description: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  business_type: string | null
}

type ServiceRow = {
  id: string
  title: string
  price: number
  photo_url: string | null
  category: string
}

export default function CompanyStorefront() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState<Company | null>(null)
  const [services, setServices] = useState<ServiceRow[]>([])
  const [serviceRatings, setServiceRatings] = useState<Record<string, { avg: number; count: number }>>({})
  const [totalRating, setTotalRating] = useState({ avg: 0, count: 0 })
  const [guestsServed, setGuestsServed] = useState(0)
  const [tab, setTab] = useState<'listings' | 'gallery' | 'reviews' | 'about'>('listings')
  const [reviews, setReviews] = useState<{ id: string; rating: number | null; comment: string | null; profiles: { full_name: string | null } | null }[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: comp } = await supabase
        .from('companies')
        .select('id, business_name, approval_status, plan, description, phone, email, address, city, business_type')
        .eq('id', id)
        .maybeSingle()

      setCompany(comp as any)
      if (!comp) { setLoading(false); return }

      const { data: serviceRows } = await supabase
        .from('services')
        .select('id, title, price, photo_url, category')
        .eq('company_id', comp.id)
        .eq('status', 'active')

      setServices(serviceRows || [])

      const { count } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', comp.id)
        .eq('checked_in', true)

      setGuestsServed(count || 0)

      const { data: reviewRows } = await supabase
        .from('reviews')
        .select('id, rating, comment, service_id, profiles(full_name)')
        .eq('company_id', comp.id)
        .order('created_at', { ascending: false })

      setReviews((reviewRows || []) as any)

      const rated = (reviewRows || []).filter((r: any) => r.rating != null)
      setTotalRating({
        avg: rated.length > 0 ? rated.reduce((s: number, r: any) => s + Number(r.rating), 0) / rated.length : 0,
        count: rated.length,
      })

      const perService: Record<string, number[]> = {}
      rated.forEach((r: any) => {
        if (!r.service_id) return
        if (!perService[r.service_id]) perService[r.service_id] = []
        perService[r.service_id].push(Number(r.rating))
      })
      const serviceAvg: Record<string, { avg: number; count: number }> = {}
      Object.entries(perService).forEach(([sid, ratings]) => {
        serviceAvg[sid] = { avg: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length }
      })
      setServiceRatings(serviceAvg)

      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, color: COLORS.textMuted }}>
        Loading...
      </div>
    )
  }

  if (!company) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, color: COLORS.textMuted }}>
        Company not found.
      </div>
    )
  }

  const goToListing = (s: ServiceRow) => {
    if (s.category === 'hotel') navigate(`/hotels/${s.id}`)
    else navigate(`/services/${s.category}/${s.id}`)
  }

  const galleryPhotos = services.filter((s) => s.photo_url)

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>

      <div style={{ position: 'relative', height: '160px', background: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})` }}>
        <div
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute', top: '16px', left: '16px', width: '34px', height: '34px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}>
          <Icon name="arrowLeft" size={18} color="white" />
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', marginTop: '-36px', marginBottom: '12px' }}>
          <div style={{
            width: '76px', height: '76px', borderRadius: '18px', background: COLORS.secondary,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 800, color: 'white',
            border: `3px solid ${COLORS.bg}`, flexShrink: 0
          }}>
            {company.business_name.charAt(0).toUpperCase()}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <p style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text }}>{company.business_name}</p>
          {company.approval_status === 'approved' && <Icon name="checkCircle" size={17} color={COLORS.primary} />}
        </div>
        {company.plan === 'business_suite' && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F5F3FF', color: COLORS.purple,
            fontSize: '10.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '8px', marginTop: '4px'
          }}>
            <Icon name="crown" size={11} color={COLORS.purple} /> Business Suite
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
          {totalRating.count > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Icon name="star" size={14} color={COLORS.gold} />
              <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{totalRating.avg.toFixed(1)}</p>
              <p style={{ fontSize: '12px', color: COLORS.textMuted }}>({totalRating.count} Reviews)</p>
            </div>
          )}
          {company.city && (
            <p style={{ fontSize: '12px', color: COLORS.textMuted }}>· {company.city}</p>
          )}
        </div>

        {company.description && (
          <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.5, marginTop: '10px' }}>{company.description}</p>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', marginBottom: '16px' }}>
          {company.phone && (
            <a href={`tel:${company.phone}`} style={{ flex: 1, textDecoration: 'none' }}>
              <div style={{ background: COLORS.card, borderRadius: '12px', padding: '10px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <Icon name="bell" size={16} color={COLORS.purple} />
                <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.text, marginTop: '4px' }}>Call</p>
              </div>
            </a>
          )}
          {(company.city || company.address) && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((company.address ? company.address + ', ' : '') + (company.city || ''))}`}
              target="_blank" rel="noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
              <div style={{ background: COLORS.card, borderRadius: '12px', padding: '10px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <Icon name="clipboard" size={16} color={COLORS.purple} />
                <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.text, marginTop: '4px' }}>Directions</p>
              </div>
            </a>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${totalRating.count > 0 ? 3 : 2}, 1fr)`, gap: '8px', marginBottom: '18px' }}>
          <StatBox label="Listings" value={services.length} />
          {totalRating.count > 0 && <StatBox label="Rating" value={totalRating.avg.toFixed(1)} />}
          <StatBox label="Guests Served" value={guestsServed} />
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto' }}>
          <TabButton label="Listings" active={tab === 'listings'} onClick={() => setTab('listings')} />
          <TabButton label="Gallery" active={tab === 'gallery'} onClick={() => setTab('gallery')} />
          <TabButton label="Reviews" active={tab === 'reviews'} onClick={() => setTab('reviews')} />
          <TabButton label="About" active={tab === 'about'} onClick={() => setTab('about')} />
        </div>

        {tab === 'listings' && (
          services.length === 0 ? (
            <EmptyBox text="No active listings yet." />
          ) : (
            services.map((s) => {
              const r = serviceRatings[s.id]
              return (
                <div key={s.id} style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden', marginBottom: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex' }}>
                  <div style={{ width: '96px', height: '96px', flexShrink: 0, background: s.photo_url ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {s.photo_url ? <img src={s.photo_url} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '26px' }}>🏨</span>}
                  </div>
                  <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{s.title}</p>
                      {r && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                          <Icon name="star" size={11} color={COLORS.gold} />
                          <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{r.avg.toFixed(1)} ({r.count})</p>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.primary }}>₦{Number(s.price).toLocaleString()}</p>
                      <div onClick={() => goToListing(s)} style={{ background: COLORS.purple, color: 'white', fontSize: '11px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                        View
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )
        )}

        {tab === 'gallery' && (
          galleryPhotos.length === 0 ? (
            <EmptyBox text="No photos added yet." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              {galleryPhotos.map((s) => (
                <img key={s.id} src={s.photo_url!} alt={s.title} style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: '10px' }} />
              ))}
            </div>
          )
        )}

        {tab === 'reviews' && (
          reviews.length === 0 ? (
            <EmptyBox text="No reviews yet." />
          ) : (
            reviews.map((r) => (
              <div key={r.id} style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '4px' }}>{r.profiles?.full_name || 'Traveler'}</p>
                {r.rating != null && (
                  <div style={{ display: 'flex', gap: '1px', marginBottom: '6px' }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Icon key={i} name="star" size={12} color={i <= Number(r.rating) ? COLORS.gold : '#E2E8F0'} />
                    ))}
                  </div>
                )}
                {r.comment && <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>{r.comment}</p>}
              </div>
            ))
          )
        )}

        {tab === 'about' && (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '4px' }}>Business Type</p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.text, marginBottom: '12px' }}>{company.business_type || 'Not set'}</p>
            {company.address && (
              <>
                <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '4px' }}>Address</p>
                <p style={{ fontSize: '13px', color: COLORS.text, marginBottom: '12px' }}>{company.address}, {company.city}</p>
              </>
            )}
            {company.email && (
              <>
                <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '4px' }}>Email</p>
                <p style={{ fontSize: '13px', color: COLORS.text }}>{company.email}</p>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: '480px', margin: '0 auto',
        background: COLORS.card, padding: '12px 16px', display: 'flex', gap: '10px',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.06)'
      }}>
        {company.phone && (
          <a href={`tel:${company.phone}`} style={{ flex: 1, textDecoration: 'none' }}>
            <div style={{ border: `1.5px solid ${COLORS.border}`, borderRadius: '10px', padding: '12px', textAlign: 'center', fontWeight: 700, fontSize: '13px', color: COLORS.text }}>
              Call
            </div>
          </a>
        )}
        <div
          onClick={() => setTab('listings')}
          style={{ flex: 2, background: COLORS.purple, color: 'white', borderRadius: '10px', padding: '12px', textAlign: 'center', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
          Book Now
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '12px', padding: '12px 6px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{value}</p>
      <p style={{ fontSize: '9.5px', color: COLORS.textMuted }}>{label}</p>
    </div>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, textAlign: 'center', padding: '9px 4px', borderRadius: '10px', cursor: 'pointer', whiteSpace: 'nowrap',
        background: active ? COLORS.purple : COLORS.card, color: active ? 'white' : COLORS.textMuted,
        fontWeight: 700, fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
      {label}
    </div>
  )
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div style={{ background: COLORS.card, padding: '28px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
      {text}
    </div>
  )
}
