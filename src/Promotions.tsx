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
  green: '#16A34A',
  red: '#DC2626',
  amber: '#D97706',
}

type ServiceOption = { id: string; title: string; photo_url: string | null }

type Promotion = {
  id: string
  service_id: string
  title: string
  description: string | null
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  start_date: string | null
  end_date: string | null
  usage_limit: number | null
  active: boolean
  services: { title: string; photo_url: string | null } | null
}

type FilterTab = 'all' | 'active' | 'paused' | 'completed'

export default function Promotions() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [services, setServices] = useState<ServiceOption[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<FilterTab>('all')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'used'>('newest')

  const [showForm, setShowForm] = useState(false)
  const [serviceId, setServiceId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [usageLimit, setUsageLimit] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { navigate('/login'); return }

    const { data: company } = await supabase
      .from('companies')
      .select('id, business_name')
      .eq('owner_id', userData.user.id)
      .maybeSingle()

    if (!company) { setLoading(false); return }
    setCompanyId(company.id)
    setCompanyName(company.business_name)

    const { data: serviceRows } = await supabase
      .from('services')
      .select('id, title, photo_url')
      .eq('company_id', company.id)

    setServices(serviceRows || [])
    if (serviceRows && serviceRows.length > 0 && !serviceId) setServiceId(serviceRows[0].id)

    const { data: promoRows } = await supabase
      .from('promotions')
      .select('id, service_id, title, description, discount_type, discount_value, start_date, end_date, usage_limit, active, services(title, photo_url)')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })

    setPromotions((promoRows || []) as any)

    const { data: bookingRows } = await supabase
      .from('bookings')
      .select('promotion_id')
      .eq('company_id', company.id)
      .not('promotion_id', 'is', null)

    const counts: Record<string, number> = {}
    ;(bookingRows || []).forEach((b: any) => {
      if (b.promotion_id) counts[b.promotion_id] = (counts[b.promotion_id] || 0) + 1
    })
    setUsageCounts(counts)

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!companyId || !serviceId || !title.trim() || !discountValue) return
    setSaving(true)
    await supabase.from('promotions').insert({
      company_id: companyId,
      service_id: serviceId,
      title: title.trim(),
      description: description.trim() || null,
      discount_type: discountType,
      discount_value: parseFloat(discountValue),
      usage_limit: usageLimit ? parseInt(usageLimit, 10) : null,
      start_date: startDate || null,
      end_date: endDate || null,
      active: true,
    })
    setTitle('')
    setDescription('')
    setDiscountValue('')
    setUsageLimit('')
    setStartDate('')
    setEndDate('')
    setShowForm(false)
    setSaving(false)
    load()
  }

  const toggleActive = async (promo: Promotion) => {
    await supabase.from('promotions').update({ active: !promo.active }).eq('id', promo.id)
    load()
  }

  const deletePromotion = async (id: string) => {
    await supabase.from('promotions').delete().eq('id', id)
    load()
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, color: COLORS.textMuted }}>
        Loading Promotions...
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const getStatus = (p: Promotion): 'active' | 'paused' | 'completed' => {
    if (p.end_date && p.end_date < today) return 'completed'
    return p.active ? 'active' : 'paused'
  }

  const activeCount = promotions.filter((p) => getStatus(p) === 'active').length
  const pausedCount = promotions.filter((p) => getStatus(p) === 'paused').length
  const completedCount = promotions.filter((p) => getStatus(p) === 'completed').length
  const pctPromos = promotions.filter((p) => p.discount_type === 'percentage')
  const avgDiscount = pctPromos.length > 0 ? Math.round(pctPromos.reduce((s, p) => s + Number(p.discount_value), 0) / pctPromos.length) : null

  let filtered = filter === 'all' ? promotions : promotions.filter((p) => getStatus(p) === filter)
  filtered = [...filtered].sort((a, b) => {
    if (sort === 'used') return (usageCounts[b.id] || 0) - (usageCounts[a.id] || 0)
    const aT = new Date(a.start_date || 0).getTime()
    const bT = new Date(b.start_date || 0).getTime()
    return sort === 'newest' ? bT - aT : aT - bT
  })

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
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Promotions</h1>
            <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{companyName}</p>
          </div>
        </div>
        <div
          onClick={() => setShowForm(!showForm)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: COLORS.purple, color: 'white', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer' }}>
          <Icon name="plus" size={15} color="white" />
          <span style={{ fontSize: '12px', fontWeight: 700 }}>Create</span>
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          <StatBox icon="megaphone" color={COLORS.purple} value={activeCount} label="Active" />
          <StatBox icon="clock" color={COLORS.amber} value={pausedCount} label="Paused" />
          <StatBox icon="checkCircle" color={COLORS.green} value={completedCount} label="Completed" />
          <StatBox icon="star" color={COLORS.primary} value={avgDiscount != null ? `${avgDiscount}%` : '—'} label="Avg Discount" />
        </div>

        {showForm && (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: COLORS.text }}>New Promotion</p>

            <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Listing</p>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px' }}>
              {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>

            <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Promotion Title</p>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sallah Break" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box' }} />

            <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Description (optional)</p>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="e.g. Enjoy amazing discount on all rooms this Sallah season." style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'none' }} />

            <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Discount Type</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <div onClick={() => setDiscountType('percentage')} style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: '10px', cursor: 'pointer', background: discountType === 'percentage' ? COLORS.purple : '#f1f5f9', color: discountType === 'percentage' ? 'white' : COLORS.textMuted, fontWeight: 700, fontSize: '12.5px' }}>Percentage (%)</div>
              <div onClick={() => setDiscountType('fixed')} style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: '10px', cursor: 'pointer', background: discountType === 'fixed' ? COLORS.purple : '#f1f5f9', color: discountType === 'fixed' ? 'white' : COLORS.textMuted, fontWeight: 700, fontSize: '12.5px' }}>Fixed (₦)</div>
            </div>

            <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>{discountType === 'percentage' ? 'Discount Percentage' : 'Discount Amount (₦)'}</p>
            <input value={discountValue} onChange={(e) => setDiscountValue(e.target.value.replace(/[^0-9.]/g, ''))} placeholder={discountType === 'percentage' ? 'e.g. 15' : 'e.g. 5000'} inputMode="decimal" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box' }} />

            <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Usage Limit (optional)</p>
            <input value={usageLimit} onChange={(e) => setUsageLimit(e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 300" inputMode="numeric" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box' }} />

            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '6px' }}>Start Date</p>
                <input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" style={{ width: '100%', padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '6px' }}>End Date</p>
                <input value={endDate} onChange={(e) => setEndDate(e.target.value)} type="date" style={{ width: '100%', padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div onClick={saving ? undefined : handleAdd} style={{ background: COLORS.purple, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Create Promotion'}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
          <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
          <FilterChip label="Active" active={filter === 'active'} onClick={() => setFilter('active')} />
          <FilterChip label="Paused" active={filter === 'paused'} onClick={() => setFilter('paused')} />
          <FilterChip label="Completed" active={filter === 'completed'} onClick={() => setFilter('completed')} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
          <select value={sort} onChange={(e) => setSort(e.target.value as any)} style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '9px', padding: '7px 10px' }}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="used">Most Used</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted }}>
            {promotions.length === 0 ? 'No promotions yet. Tap Create to add your first one.' : 'No promotions match this filter.'}
          </div>
        ) : (
          filtered.map((promo) => {
            const status = getStatus(promo)
            const used = usageCounts[promo.id] || 0
            const photo = promo.services?.photo_url

            return (
              <div key={promo.id} style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', marginBottom: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ width: '78px', height: '78px', borderRadius: '12px', flexShrink: 0, position: 'relative', overflow: 'hidden', background: photo ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})` }}>
                    {photo ? <img src={photo} alt={promo.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🏨</div>
                    )}
                    <div style={{ position: 'absolute', top: '5px', left: '5px', background: COLORS.purple, color: 'white', fontSize: '9.5px', fontWeight: 800, padding: '3px 6px', borderRadius: '6px' }}>
                      {promo.discount_type === 'percentage' ? `${promo.discount_value}% OFF` : `₦${promo.discount_value.toLocaleString()} OFF`}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{promo.title}</p>
                      <div onClick={() => deletePromotion(promo.id)} style={{ cursor: 'pointer', flexShrink: 0 }}>
                        <Icon name="trash" size={15} color={COLORS.red} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Icon name="crown" size={11} color={COLORS.purple} />
                      <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>{promo.services?.title}</p>
                    </div>
                    {promo.description && (
                      <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '5px', lineHeight: 1.4 }}>{promo.description}</p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '14px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  {(promo.start_date || promo.end_date) && (
                    <MetaItem icon="calendar" text={`${promo.start_date ? new Date(promo.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'} → ${promo.end_date ? new Date(promo.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}`} />
                  )}
                  <MetaItem icon="users" text={`${used} used`} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: promo.usage_limit ? '10px' : 0 }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px',
                    background: status === 'completed' ? '#fef2f2' : status === 'active' ? '#f0fdf4' : '#fffbeb',
                    color: status === 'completed' ? COLORS.red : status === 'active' ? COLORS.green : COLORS.amber
                  }}>
                    {status === 'completed' ? 'Completed' : status === 'active' ? 'Active' : 'Paused'}
                  </span>
                  {status !== 'completed' && (
                    <div onClick={() => toggleActive(promo)} style={{ background: '#f1f5f9', color: COLORS.purple, fontSize: '11.5px', fontWeight: 700, padding: '6px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                      {promo.active ? 'Pause' : 'Activate'}
                    </div>
                  )}
                </div>

                {promo.usage_limit && (
                  <div>
                    <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px', marginBottom: '6px' }}>
                      <div style={{ width: `${Math.min(100, (used / promo.usage_limit) * 100)}%`, height: '100%', background: `linear-gradient(to right, ${COLORS.purple}, #A855F7)`, borderRadius: '3px' }} />
                    </div>
                    <p style={{ fontSize: '11px', color: COLORS.textMuted, textAlign: 'right' }}>{used} / {promo.usage_limit} used</p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function StatBox({ icon, color, value, label }: { icon: string; color: string; value: number | string; label: string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '12px', padding: '10px 6px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
        <Icon name={icon} size={16} color={color} />
      </div>
      <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{value}</p>
      <p style={{ fontSize: '8.5px', color: COLORS.textMuted }}>{label}</p>
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: '9px', cursor: 'pointer',
        background: active ? COLORS.purple : COLORS.card, color: active ? 'white' : COLORS.textMuted,
        fontWeight: 700, fontSize: '11.5px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
      {label}
    </div>
  )
}

function MetaItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <Icon name={icon} size={12} color={COLORS.textMuted} />
      <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{text}</p>
    </div>
  )
}
