import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  primary: '#0EA5E9',
  purple: '#6B21A8',
  text: '#0F172A',
  textMuted: '#64748B',
  green: '#16A34A',
  red: '#DC2626',
  amber: '#D97706',
}

type ServiceOption = { id: string; title: string }

type Promotion = {
  id: string
  service_id: string
  title: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  start_date: string | null
  end_date: string | null
  active: boolean
  services: { title: string } | null
}

export default function Promotions() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [services, setServices] = useState<ServiceOption[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])

  const [showForm, setShowForm] = useState(false)
  const [serviceId, setServiceId] = useState('')
  const [title, setTitle] = useState('')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { navigate('/login'); return }

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', userData.user.id)
      .maybeSingle()

    if (!company) { setLoading(false); return }
    setCompanyId(company.id)

    const { data: serviceRows } = await supabase
      .from('services')
      .select('id, title')
      .eq('company_id', company.id)

    setServices(serviceRows || [])
    if (serviceRows && serviceRows.length > 0 && !serviceId) setServiceId(serviceRows[0].id)

    const { data: promoRows } = await supabase
      .from('promotions')
      .select('id, service_id, title, discount_type, discount_value, start_date, end_date, active, services(title)')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })

    setPromotions((promoRows || []) as any)
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
      discount_type: discountType,
      discount_value: parseFloat(discountValue),
      start_date: startDate || null,
      end_date: endDate || null,
      active: true,
    })
    setTitle('')
    setDiscountValue('')
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

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="arrowLeft" size={22} color={COLORS.text} />
          </div>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Promotions</h1>
        </div>
        <div
          onClick={() => setShowForm(!showForm)}
          style={{
            width: '34px', height: '34px', borderRadius: '10px', background: COLORS.purple,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}>
          <Icon name="plus" size={18} color="white" />
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        {services.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted }}>
            You need at least one listing before creating a promotion.
          </div>
        ) : (
          <>
            {showForm && (
              <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: COLORS.text }}>New Promotion</p>

                <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Listing</p>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px' }}>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>

                <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Promotion Title</p>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sallah Special, Weekend Offer"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box' }}
                />

                <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Discount Type</p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <div
                    onClick={() => setDiscountType('percentage')}
                    style={{
                      flex: 1, textAlign: 'center', padding: '9px', borderRadius: '10px', cursor: 'pointer',
                      background: discountType === 'percentage' ? COLORS.purple : '#f1f5f9',
                      color: discountType === 'percentage' ? 'white' : COLORS.textMuted, fontWeight: 700, fontSize: '12.5px'
                    }}>
                    Percentage (%)
                  </div>
                  <div
                    onClick={() => setDiscountType('fixed')}
                    style={{
                      flex: 1, textAlign: 'center', padding: '9px', borderRadius: '10px', cursor: 'pointer',
                      background: discountType === 'fixed' ? COLORS.purple : '#f1f5f9',
                      color: discountType === 'fixed' ? 'white' : COLORS.textMuted, fontWeight: 700, fontSize: '12.5px'
                    }}>
                    Fixed Amount (₦)
                  </div>
                </div>

                <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>
                  {discountType === 'percentage' ? 'Discount Percentage' : 'Discount Amount (₦)'}
                </p>
                <input
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder={discountType === 'percentage' ? 'e.g. 15' : 'e.g. 5000'}
                  inputMode="decimal"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box' }}
                />

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

                <div
                  onClick={saving ? undefined : handleAdd}
                  style={{
                    background: COLORS.purple, color: 'white', textAlign: 'center', padding: '11px',
                    borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.6 : 1
                  }}>
                  {saving ? 'Saving...' : 'Create Promotion'}
                </div>
              </div>
            )}

            {promotions.length === 0 ? (
              <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted }}>
                No promotions yet. Tap + to create your first one.
              </div>
            ) : (
              promotions.map((promo) => {
                const now = new Date().toISOString().split('T')[0]
                const isExpired = promo.end_date ? promo.end_date < now : false
                return (
                  <div key={promo.id} style={{
                    background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>{promo.title}</p>
                        <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>{promo.services?.title}</p>
                      </div>
                      <div onClick={() => deletePromotion(promo.id)} style={{ cursor: 'pointer' }}>
                        <Icon name="trash" size={16} color={COLORS.red} />
                      </div>
                    </div>

                    <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.purple, marginBottom: '8px' }}>
                      {promo.discount_type === 'percentage' ? `${promo.discount_value}% OFF` : `₦${promo.discount_value.toLocaleString()} OFF`}
                    </p>

                    {(promo.start_date || promo.end_date) && (
                      <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '10px' }}>
                        {promo.start_date ? new Date(promo.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Anytime'}
                        {' → '}
                        {promo.end_date ? new Date(promo.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'No end date'}
                      </p>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px',
                        background: isExpired ? '#fef2f2' : promo.active ? '#f0fdf4' : '#f1f5f9',
                        color: isExpired ? COLORS.red : promo.active ? COLORS.green : COLORS.textMuted
                      }}>
                        {isExpired ? 'Expired' : promo.active ? 'Active' : 'Paused'}
                      </span>
                      {!isExpired && (
                        <div onClick={() => toggleActive(promo)} style={{ color: COLORS.purple, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                          {promo.active ? 'Pause' : 'Activate'}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}
      </div>
    </div>
  )
}
