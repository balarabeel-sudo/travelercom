import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  primary: '#0EA5E9',
  text: '#0F172A',
  textMuted: '#64748B',
  purple: '#6B21A8',
  green: '#16A34A',
}

const PREFIX_MAP: Record<string, string> = {
  hotel: 'HTL', bus: 'BUS', train: 'TRN', flight: 'ALN', tour: 'TUR', event_center: 'EVT',
}

const DETAIL_PLACEHOLDER: Record<string, string> = {
  hotel: 'Room type, check-in/check-out dates, no. of nights',
  bus: 'Route (e.g. Lagos → Abuja), travel date, seat no.',
  train: 'Route, travel date, coach/seat no.',
  flight: 'Route, flight date, class (Economy/Business)',
  tour: 'Tour package, date, no. of participants',
  event_center: 'Event name, date, ticket tier (VIP/Regular)',
}

type ServiceOption = { id: string; title: string; category: string; commission_rate: number | null }

export default function AddGuest() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [services, setServices] = useState<ServiceOption[]>([])
  const [serviceId, setServiceId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [amountPaid, setAmountPaid] = useState('')
  const [bookingDetails, setBookingDetails] = useState('')
  const [saving, setSaving] = useState(false)
  const [successCode, setSuccessCode] = useState<string | null>(null)

  useEffect(() => {
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
        .select('id, title, category, commission_rate')
        .eq('company_id', company.id)

      setServices(serviceRows || [])
      if (serviceRows && serviceRows.length > 0) setServiceId(serviceRows[0].id)
      setLoading(false)
    }
    load()
  }, [navigate])

  const selectedService = services.find((s) => s.id === serviceId)

  const handleSave = async () => {
    if (!companyId || !serviceId || !customerName.trim() || !amountPaid) return
    setSaving(true)

    const category = selectedService?.category || 'hotel'
    const prefix = PREFIX_MAP[category] || 'TRV'
    const year = new Date().getFullYear()
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    const ticketCode = `${prefix}-${year}-${random}`

    const rate = Number(selectedService?.commission_rate ?? 3)
    const amount = parseFloat(amountPaid)
    const commission = amount * (rate / 100)

    const { error } = await supabase.from('bookings').insert({
      service_id: serviceId,
      company_id: companyId,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim() || null,
      quantity: parseInt(quantity, 10) || 1,
      amount_paid: amount,
      commission_amount: commission,
      booking_status: 'confirmed',
      booking_source: 'offline',
      booking_details: bookingDetails.trim() || null,
      ticket_code: ticketCode,
      checked_in: true,
      checked_in_at: new Date().toISOString(),
    })

    setSaving(false)
    if (!error) {
      setSuccessCode(ticketCode)
      setCustomerName('')
      setCustomerPhone('')
      setQuantity('1')
      setAmountPaid('')
      setBookingDetails('')
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, color: COLORS.textMuted }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Guest</h1>
      </div>

      <div style={{ padding: '16px' }}>
        {successCode && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px',
            padding: '16px', marginBottom: '16px', textAlign: 'center'
          }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.green, marginBottom: '4px' }}>✅ Guest booking saved</p>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{successCode}</p>
            <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px' }}>Now visible in booking history alongside online bookings</p>
          </div>
        )}

        {services.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted }}>
            You need at least one listing before adding a guest booking.
          </div>
        ) : (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>

            <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Listing</p>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '14px', fontSize: '13px' }}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>

            <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Customer Name</p>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Full name"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '14px', fontSize: '13px', boxSizing: 'border-box' }}
            />

            <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Phone Number</p>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="080..."
              inputMode="tel"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '14px', fontSize: '13px', boxSizing: 'border-box' }}
            />

            <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Booking Details</p>
            <textarea
              value={bookingDetails}
              onChange={(e) => setBookingDetails(e.target.value)}
              placeholder={DETAIL_PLACEHOLDER[selectedService?.category || 'hotel']}
              rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '14px', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'none' }}
            />

            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Quantity</p>
                <input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ''))}
                  inputMode="numeric"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 2 }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Amount Paid (₦)</p>
                <input
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="18000"
                  inputMode="decimal"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div
              onClick={saving ? undefined : handleSave}
              style={{
                background: COLORS.purple, color: 'white', textAlign: 'center', padding: '12px',
                borderRadius: '10px', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer',
                opacity: saving ? 0.6 : 1
              }}>
              {saving ? 'Saving...' : 'Save Guest Booking'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
