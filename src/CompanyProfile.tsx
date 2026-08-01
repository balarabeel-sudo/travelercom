import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

type Company = {
  id: string
  business_name: string
  business_type: string | null
  approval_status: string
  plan: string
  description: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  cover_photo_url: string | null
}

type ServiceRow = { id: string; title: string; price: number; photo_url: string | null; category: string }

export default function CompanyProfile() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState<Company | null>(null)
  const [services, setServices] = useState<ServiceRow[]>([])
  const [totalBookings, setTotalBookings] = useState(0)
  const [avgRating, setAvgRating] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [tab, setTab] = useState<'listings' | 'reviews' | 'about'>('listings')
  const [reviews, setReviews] = useState<{ id: string; rating: number | null; comment: string | null; profiles: { full_name: string | null } | null }[]>([])

  const [editing, setEditing] = useState(false)
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)

  const load = async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { navigate('/login'); return }

    const { data: comp } = await supabase
      .from('companies')
      .select('id, business_name, business_type, approval_status, plan, description, phone, email, address, city, cover_photo_url')
      .eq('owner_id', userData.user.id)
      .maybeSingle()

    if (!comp) { setLoading(false); return }
    setCompany(comp as any)
    setDescription(comp.description || '')
    setPhone(comp.phone || '')
    setEmail(comp.email || '')
    setAddress(comp.address || '')
    setCity(comp.city || '')

    const { data: serviceRows } = await supabase
      .from('services')
      .select('id, title, price, photo_url, category')
      .eq('company_id', comp.id)

    setServices(serviceRows || [])

    const { count: bookingCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', comp.id)

    setTotalBookings(bookingCount || 0)

    const { data: reviewRows } = await supabase
      .from('reviews')
      .select('id, rating, comment, profiles(full_name)')
      .eq('company_id', comp.id)
      .order('created_at', { ascending: false })

    setReviews((reviewRows || []) as any)
    const rated = (reviewRows || []).filter((r: any) => r.rating != null)
    setReviewCount(rated.length)
    setAvgRating(rated.length > 0 ? rated.reduce((s: number, r: any) => s + Number(r.rating), 0) / rated.length : 0)

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !company) return
    setUploadingCover(true)
    const fileExt = file.name.split('.').pop()
    const filePath = `covers/${company.id}-${Date.now()}.${fileExt}`
    const { error: uploadError } = await supabase.storage.from('listing-photos').upload(filePath, file)
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('listing-photos').getPublicUrl(filePath)
      await supabase.from('companies').update({ cover_photo_url: urlData.publicUrl }).eq('id', company.id)
      load()
    }
    setUploadingCover(false)
  }

  const saveProfile = async () => {
    if (!company) return
    setSaving(true)
    await supabase.from('companies').update({
      description: description.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
    }).eq('id', company.id)
    setSaving(false)
    setEditing(false)
    load()
  }

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
        No company profile found.
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>

      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="arrowLeft" size={22} color={COLORS.text} />
          </div>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Company Profile</h1>
        </div>
        <div onClick={() => setEditing(!editing)} style={{ cursor: 'pointer' }}>
          <Icon name="edit" size={19} color={COLORS.primary} />
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        <div style={{
          height: '140px', borderRadius: '16px', marginBottom: '16px', position: 'relative', overflow: 'hidden',
          background: company.cover_photo_url ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`
        }}>
          {company.cover_photo_url && (
            <img src={company.cover_photo_url} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          <label style={{
            position: 'absolute', bottom: '10px', right: '10px', width: '36px', height: '36px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}>
            <Icon name="edit" size={16} color="white" />
            <input type="file" accept="image/*" onChange={handleCoverUpload} style={{ display: 'none' }} disabled={uploadingCover} />
          </label>
          {uploadingCover && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', fontWeight: 700 }}>
              Uploading...
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px', background: COLORS.secondary,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 800, color: 'white', flexShrink: 0
          }}>
            {company.business_name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>{company.business_name}</p>
              {company.approval_status === 'approved' && <Icon name="checkCircle" size={16} color={COLORS.primary} />}
            </div>
            {company.plan === 'business_suite' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F5F3FF', color: COLORS.purple,
                fontSize: '10.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '8px', marginTop: '4px'
              }}>
                <Icon name="crown" size={11} color={COLORS.purple} /> Business Suite
              </span>
            )}
            {reviewCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
                <Icon name="star" size={13} color={COLORS.gold} />
                <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{avgRating.toFixed(1)}</p>
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>({reviewCount} reviews)</p>
              </div>
            )}
          </div>
        </div>

        {editing ? (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>About / Description</p>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Tell customers about your business" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'none' }} />

            <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Phone</p>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="080..." style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box' }} />

            <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Email</p>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@yourbusiness.com" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box' }} />

            <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>City</p>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Kaduna" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box' }} />

            <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Address</p>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '14px', fontSize: '13px', boxSizing: 'border-box' }} />

            <div onClick={saving ? undefined : saveProfile} style={{ background: COLORS.primary, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Save Profile'}
            </div>
          </div>
        ) : (
          (company.description || company.phone || company.email || company.address || company.city) && (
            <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              {company.description && (
                <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.5, marginBottom: '12px' }}>{company.description}</p>
              )}
              {company.city && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Icon name="clipboard" size={14} color={COLORS.textMuted} />
                  <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>{company.address ? `${company.address}, ` : ''}{company.city}</p>
                </div>
              )}
              {company.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Icon name="bell" size={14} color={COLORS.textMuted} />
                  <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>{company.phone}</p>
                </div>
              )}
              {company.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="fileText" size={14} color={COLORS.textMuted} />
                  <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>{company.email}</p>
                </div>
              )}
            </div>
          )
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '18px' }}>
          <StatBox label="Listings" value={services.length} />
          <StatBox label="Bookings" value={totalBookings} />
          <StatBox label="Rating" value={reviewCount > 0 ? avgRating.toFixed(1) : '—'} />
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          <TabButton label="Listings" active={tab === 'listings'} onClick={() => setTab('listings')} />
          <TabButton label="Reviews" active={tab === 'reviews'} onClick={() => setTab('reviews')} />
          <TabButton label="About" active={tab === 'about'} onClick={() => setTab('about')} />
        </div>

        {tab === 'listings' && (
          services.length === 0 ? (
            <div style={{ background: COLORS.card, padding: '28px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted }}>
              No listings yet.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {services.map((s) => (
                <div key={s.id} style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                  <div style={{ height: '80px', background: s.photo_url ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {s.photo_url ? <img src={s.photo_url} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '24px' }}>🏨</span>}
                  </div>
                  <div style={{ padding: '10px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{s.title}</p>
                    <p style={{ fontSize: '11.5px', color: COLORS.primary, fontWeight: 700, marginTop: '3px' }}>₦{Number(s.price).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'reviews' && (
          reviews.length === 0 ? (
            <div style={{ background: COLORS.card, padding: '28px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted }}>
              No reviews yet.
            </div>
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
            <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '4px' }}>Description</p>
            <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.5 }}>{company.description || 'No description added yet. Tap the pencil icon above to add one.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '12px', padding: '12px 6px', textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{value}</p>
      <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{label}</p>
    </div>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, textAlign: 'center', padding: '9px 4px', borderRadius: '10px', cursor: 'pointer',
        background: active ? COLORS.primary : COLORS.card, color: active ? 'white' : COLORS.textMuted,
        fontWeight: 700, fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
      {label}
    </div>
  )
}
