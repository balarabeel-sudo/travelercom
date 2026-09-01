import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import { DetailsSkeleton } from './LoadingSkeleton'
import NetworkError from './NetworkError'
import { downloadReceiptImage } from './receiptGenerator'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  navy: '#0B1E3D',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16A34A',
  red: '#DC2626',
  gold: '#D4A017',
}

// Flat platform fees — no per-listing pricing exists for these yet, adjust here if needed.
const ADDON_PRICES = { baggage: 5000, insurance: 2000, pickup: 3500 }
const SERVICE_FEE = 500

const ID_TYPES = ['NIN', 'International Passport', "Driver's License"] as const

function isIdFormatValid(idType: string, idNumber: string): boolean {
  const v = idNumber.trim()
  if (!v) return false
  switch (idType) {
    case 'NIN':
      return /^\d{11}$/.test(v)
    case 'International Passport':
      return /^[A-Za-z][0-9]{7,8}$/.test(v)
    case "Driver's License":
      return /^[A-Za-z0-9]{8,12}$/.test(v)
    default:
      return false
  }
}

function generateTicketCode() {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ALN-${new Date().getFullYear()}-${rand}`
}

type FlightService = {
  id: string
  title: string
  photo_url: string | null
  origin: string | null
  destination: string
  departure_time: string | null
  price: number
  seats_available: number | null
  company_id: string
  companies: { business_name: string; allow_unit_selection: boolean | null } | null
}

type SeatType = { id: string; name: string; price: number; available: number }

const STEPS = ['Flight', 'Passenger', 'Extras', 'Payment', 'Review']

function FlightDetails() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [step, setStep] = useState(1)
  const [service, setService] = useState<FlightService | null>(null)
  const [userId, setUserId] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)
  const [activePromo, setActivePromo] = useState<{ id: string; title: string; discount_type: string; discount_value: number } | null>(null)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [booking, setBooking] = useState(false)

  const [seatTypes, setSeatTypes] = useState<SeatType[]>([])
  const [selectedSeatTypeId, setSelectedSeatTypeId] = useState<string | null>(null)
  const [unitOptions, setUnitOptions] = useState<{ id: string; unit_number: string }[]>([])
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('Male')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [nationality, setNationality] = useState('Nigerian')
  const [idType, setIdType] = useState<string>(ID_TYPES[0])
  const [idNumber, setIdNumber] = useState('')

  const [extraBaggage, setExtraBaggage] = useState(false)
  const [travelInsurance, setTravelInsurance] = useState(false)
  const [airportPickup, setAirportPickup] = useState(false)

  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'card' | 'bank'>('wallet')
  const [agreedTerms, setAgreedTerms] = useState(false)

  const [reservationId, setReservationId] = useState('')
  const [pnr, setPnr] = useState('')
  const [transactionId, setTransactionId] = useState('')

  const load = async () => {
      setLoading(true)
      setNetError(false)
      const { data: userData, error } = await supabase.auth.getUser()
      if (error || !userData.user) { navigate('/login'); return }
      setUserId(userData.user.id)
      setFullName(userData.user.user_metadata?.full_name || '')
      setEmail(userData.user.email || '')

      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userData.user.id)
        .maybeSingle()
      setWalletBalance(wallet ? Number(wallet.balance) : 0)

      const { data: svc, error: svcErr } = await supabase
        .from('services')
        .select('id, title, origin, destination, departure_time, price, seats_available, company_id, photo_url, companies(business_name, allow_unit_selection)')
        .eq('id', id)
        .maybeSingle()
      if (svcErr) {
        setNetError(true)
        setLoading(false)
        return
      }
      setService(svc as any)

      const today = new Date().toISOString().split('T')[0]
      const { data: promoRows } = await supabase
        .from('promotions')
        .select('id, title, discount_type, discount_value, start_date, end_date, usage_limit')
        .eq('service_id', id)
        .eq('active', true)
      const validPromo = (promoRows || []).find((p: any) =>
        (!p.start_date || p.start_date <= today) && (!p.end_date || p.end_date >= today)
      )
      if (validPromo) {
        if (validPromo.usage_limit) {
          const { count } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('promotion_id', validPromo.id)
          if ((count || 0) < validPromo.usage_limit) setActivePromo(validPromo as any)
        } else {
          setActivePromo(validPromo as any)
        }
      }

      const { data: items } = await supabase
        .from('inventory_items')
        .select('id, name, price')
        .eq('service_id', id)

      if (items && items.length > 0) {
        const itemIds = items.map((i) => i.id)
        const { data: unitRows } = await supabase
          .from('inventory_units')
          .select('inventory_item_id, status')
          .in('inventory_item_id', itemIds)
        const availCounts: Record<string, number> = {}
        ;(unitRows || []).forEach((u: any) => {
          if (u.status === 'available') availCounts[u.inventory_item_id] = (availCounts[u.inventory_item_id] || 0) + 1
        })
        setSeatTypes(items.map((i: any) => ({ id: i.id, name: i.name, price: Number(i.price) || 0, available: availCounts[i.id] || 0 })))
      }
      setLoading(false)
  }

  useEffect(() => {
    load()
  }, [id, navigate])

  useEffect(() => {
    const fetchUnits = async () => {
      if (!selectedSeatTypeId) { setUnitOptions([]); setSelectedUnitId(null); return }
      const { data } = await supabase
        .from('inventory_units')
        .select('id, unit_number')
        .eq('inventory_item_id', selectedSeatTypeId)
        .eq('status', 'available')
        .order('unit_number', { ascending: true })
      setUnitOptions(data || [])
      setSelectedUnitId(data && data.length > 0 ? data[0].id : null)
    }
    fetchUnits()
  }, [selectedSeatTypeId])

  const usingSeatTypes = seatTypes.length > 0
  const selectedSeat = seatTypes.find((s) => s.id === selectedSeatTypeId)
  const baseFare = usingSeatTypes ? (selectedSeat?.price ?? 0) : Number(service?.price ?? 0)
  const fareAfterDiscount = (() => {
    if (!activePromo || baseFare <= 0) return baseFare
    if (activePromo.discount_type === 'percentage') return Math.max(0, baseFare * (1 - activePromo.discount_value / 100))
    return Math.max(0, baseFare - activePromo.discount_value)
  })()
  const discountAmount = baseFare - fareAfterDiscount
  const addonsTotal = (extraBaggage ? ADDON_PRICES.baggage : 0) + (travelInsurance ? ADDON_PRICES.insurance : 0) + (airportPickup ? ADDON_PRICES.pickup : 0)
  const total = fareAfterDiscount + addonsTotal + SERVICE_FEE

  const passengerValid = fullName.trim() && dob && phone.trim() && email.trim() && nationality.trim() && isIdFormatValid(idType, idNumber)

  const handleConfirmBooking = async () => {
    if (!service || !agreedTerms) return
    setMessage(null)

    if (usingSeatTypes && !selectedUnitId) {
      setMessage({ type: 'error', text: 'That seat just sold out. Please go back and pick another.' })
      return
    }
    if (walletBalance < total) {
      setMessage({ type: 'error', text: 'Insufficient wallet balance. Please top up your wallet first.' })
      return
    }

    setBooking(true)
    const code = generateTicketCode()
    let assignedUnitId: string | null = null
    let assignedNumber = ''

    if (selectedSeat && selectedUnitId) {
      const chosen = unitOptions.find((u) => u.id === selectedUnitId)
      const { data: claimedRows } = await supabase.rpc('claim_inventory_unit', { p_unit_id: selectedUnitId })
      const claimed = claimedRows && claimedRows.length > 0 ? claimedRows[0] : null

      if (!claimed) {
        setBooking(false)
        setMessage({ type: 'error', text: `Seat ${chosen?.unit_number || ''} was just taken. Please go back and pick another.` })
        return
      }
      assignedUnitId = claimed.id
      assignedNumber = claimed.unit_number
    }

    const { data: newBooking, error: bookingErr } = await supabase.from('bookings').insert({
      user_id: userId,
      service_id: service.id,
      company_id: service.company_id,
      inventory_item_id: selectedSeat?.id || null,
      quantity: 1,
      amount_paid: total,
      commission_amount: 0,
      booking_status: 'confirmed',
      ticket_code: code,
      customer_name: fullName || null,
      assigned_unit_number: assignedNumber || null,
      promotion_id: activePromo?.id || null,
      id_type: idType,
      id_number: idNumber.trim(),
    }).select('id').single()

    if (bookingErr) {
      if (assignedUnitId) await supabase.from('inventory_units').update({ status: 'available' }).eq('id', assignedUnitId)
      setBooking(false)
      setMessage({ type: 'error', text: 'Booking failed: ' + bookingErr.message })
      return
    }

    if (assignedUnitId) {
      await supabase.from('inventory_units').update({ booking_id: newBooking?.id || null }).eq('id', assignedUnitId)
    } else if (!usingSeatTypes && service.seats_available !== null && service.seats_available > 0) {
      const { data: newCount, error: decErr } = await supabase.rpc('decrement_seats', { p_service_id: service.id })
      if (!decErr && newCount !== null) {
        setService({ ...service, seats_available: newCount })
      }
    }

    const newBalance = walletBalance - total
    const { error: walletErr } = await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', userId)
    if (walletErr) {
      setBooking(false)
      setMessage({ type: 'error', text: 'Payment failed: ' + walletErr.message })
      return
    }

    const { data: walletRow } = await supabase.from('wallets').select('id').eq('user_id', userId).maybeSingle()
    const { data: txnRow } = await supabase.from('transactions').insert({
      user_id: userId, wallet_id: walletRow?.id, transaction_type: 'payment', amount: total, status: 'successful',
    }).select('id').single()

    setBooking(false)
    setWalletBalance(newBalance)
    setReservationId(newBooking?.id || '')
    setPnr(code)
    setTransactionId(txnRow?.id || '')
    setStep(6)
  }

  // Branded receipt image — built only from real confirmed booking data.
  const downloadReceipt = () => {
    if (!service) return
    downloadReceiptImage({
      category: 'flight',
      serviceName: service.title,
      serviceTypeLabel: selectedSeat?.name || 'Economy',
      location: `${service.origin || '—'} \u2192 ${service.destination}`,
      bookingReference: pnr,
      amountPaid: total,
      paymentDate: new Date().toLocaleString(),
      transactionId: transactionId || undefined,
      filenamePrefix: 'Flight',
      rows: [
        { label: 'Passenger Name', value: fullName },
        { label: 'Email', value: email },
        { label: 'Phone', value: phone },
        { label: 'Route', value: `${service.origin || '—'} \u2192 ${service.destination}` },
        { label: 'Departure', value: service.departure_time ? new Date(service.departure_time).toLocaleString() : 'TBA' },
        { label: 'Airline', value: service.companies?.business_name || 'Traveler.com Partner' },
      ],
    })
  }

  if (netError) {
    return <NetworkError onRetry={load} />
  }

  if (loading) {
    return <DetailsSkeleton />
  }
  if (!service) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted }}>Flight not found.</div>
  }

  const inputStyle = { width: '100%', padding: '12px', border: `1px solid ${COLORS.border}`, borderRadius: '10px', fontSize: '13.5px', marginBottom: '12px', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '5px', display: 'block' as const }
  const cardStyle = { background: COLORS.card, borderRadius: '16px', padding: '18px', marginBottom: '16px', boxShadow: '0 2px 14px rgba(15,23,42,0.06)' }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, paddingBottom: '110px' }}>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>

      {/* Header */}
      <div className="no-print" style={{ background: COLORS.navy, padding: '18px 20px 22px', color: 'white' }}>
        <span onClick={() => (step === 1 ? navigate(-1) : setStep(step - 1))} style={{ cursor: 'pointer', display: 'inline-flex' }}><Icon name="arrowLeft" size={20} color="white" /></span>
        <p style={{ fontSize: '17px', fontWeight: 800, marginTop: '10px' }}>Book Your Flight</p>
        {step <= 5 && (
          <div style={{ display: 'flex', gap: '4px', marginTop: '14px' }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ flex: 1 }}>
                <div style={{ height: '4px', borderRadius: '2px', background: i + 1 <= step ? COLORS.secondary : 'rgba(255,255,255,0.25)', marginBottom: '4px' }} />
                <p style={{ fontSize: '9.5px', color: i + 1 <= step ? 'white' : 'rgba(255,255,255,0.5)', fontWeight: i + 1 === step ? 800 : 500 }}>{s}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px' }}>
        {message && (
          <div style={{ padding: '12px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', fontWeight: 600, background: message.type === 'error' ? '#FEE2E2' : '#DCFCE7', color: message.type === 'error' ? COLORS.red : COLORS.green }}>
            {message.text}
          </div>
        )}

        {/* STEP 1 — FLIGHT SUMMARY */}
        {step === 1 && (
          <>
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              <div style={{ height: '150px', background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.primary})`, position: 'relative' }}>
                {service.photo_url && <img src={service.photo_url} alt={service.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }} />}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '16px' }}>
                  <p style={{ color: 'white', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '5px' }}><Icon name="plane" size={12} color="white" /> {service.companies?.business_name || 'Traveler.com Partner'}</p>
                  <p style={{ color: 'white', fontSize: '19px', fontWeight: 800, marginTop: '4px' }}>{service.title}</p>
                </div>
              </div>
              <div style={{ padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                  <div style={{ textAlign: 'center' as const }}>
                    <p style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text }}>{service.origin || '—'}</p>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' as const, padding: '0 10px' }}>
                    <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Non-stop</p>
                    <div style={{ height: '1px', background: COLORS.border, margin: '6px 0', position: 'relative' }}>
                      <span style={{ position: 'absolute', right: 0, top: '-9px', display: 'flex' }}><Icon name="plane" size={14} color={COLORS.textMuted} /></span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' as const }}>
                    <p style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text }}>{service.destination}</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '14px', borderTop: `1px solid ${COLORS.border}` }}>
                  <div>
                    <p style={labelStyle}>Departure</p>
                    <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{service.departure_time ? new Date(service.departure_time).toLocaleString() : 'TBA'}</p>
                  </div>
                  <div>
                    <p style={labelStyle}>Cabin Class</p>
                    <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>Economy</p>
                  </div>
                  <div>
                    <p style={labelStyle}>Flight Type</p>
                    <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>Non-stop</p>
                  </div>
                  <div>
                    <p style={labelStyle}>Seats Left</p>
                    <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{usingSeatTypes ? seatTypes.reduce((a, s) => a + s.available, 0) : service.seats_available ?? '—'}</p>
                  </div>
                </div>
              </div>
            </div>
            <p style={{ fontSize: '10.5px', color: COLORS.textMuted, textAlign: 'center' as const, marginBottom: '10px' }}>
              Arrival time and flight duration will show here once your airline partner adds them.
            </p>
          </>
        )}

        {/* STEP 2 — PASSENGER INFORMATION */}
        {step === 2 && (
          <div style={cardStyle}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '14px' }}>Passenger Information</p>
            <label style={labelStyle}>Full Name</label>
            <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="As it appears on your ID" />
            <label style={labelStyle}>Date of Birth</label>
            <input style={inputStyle} type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            <label style={labelStyle}>Gender</label>
            <select style={inputStyle} value={gender} onChange={(e) => setGender(e.target.value)}>
              <option>Male</option><option>Female</option>
            </select>
            <label style={labelStyle}>Phone Number</label>
            <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="080..." />
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label style={labelStyle}>Nationality</label>
            <input style={inputStyle} value={nationality} onChange={(e) => setNationality(e.target.value)} />

            <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, marginTop: '6px', marginBottom: '10px' }}>Identity Verification</p>
            <select style={inputStyle} value={idType} onChange={(e) => { setIdType(e.target.value); setIdNumber('') }}>
              {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input style={{ ...inputStyle, marginBottom: '4px' }} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder={`Enter your ${idType} number`} />
            {idNumber.trim().length > 0 && (
              <p style={{ fontSize: '11px', fontWeight: 700, marginBottom: '10px', color: isIdFormatValid(idType, idNumber) ? COLORS.green : COLORS.red, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Icon name={isIdFormatValid(idType, idNumber) ? 'check' : 'x'} size={13} color={isIdFormatValid(idType, idNumber) ? COLORS.green : COLORS.red} strokeWidth={2.5} />
                {isIdFormatValid(idType, idNumber) ? 'Format valid' : 'Format invalid — check the number'}
              </p>
            )}
            <p style={{ fontSize: '10.5px', color: COLORS.textMuted, fontStyle: 'italic' as const }}>
              Identity information is required by airlines for passenger verification.
            </p>
          </div>
        )}

        {/* STEP 3 — OPTIONAL SERVICES */}
        {step === 3 && (
          <div style={cardStyle}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '14px' }}>Optional Services</p>

            {usingSeatTypes && (
              <div style={{ marginBottom: '16px' }}>
                <p style={labelStyle}>Preferred Seat</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const, marginBottom: '10px' }}>
                  {seatTypes.map((s) => (
                    <span key={s.id} onClick={() => setSelectedSeatTypeId(s.id)}
                      style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                        border: `1.5px solid ${selectedSeatTypeId === s.id ? COLORS.primary : COLORS.border}`,
                        background: selectedSeatTypeId === s.id ? COLORS.primary : COLORS.bg,
                        color: selectedSeatTypeId === s.id ? 'white' : COLORS.text }}>
                      {s.name} · ₦{s.price.toLocaleString()} ({s.available} left)
                    </span>
                  ))}
                </div>
                {selectedSeatTypeId && (() => {
                  const allowPicking = service.companies?.allow_unit_selection ?? true
                  if (!allowPicking) {
                    return (
                      <p style={{ fontSize: '12px', color: COLORS.textMuted, fontStyle: 'italic' as const }}>
                        {unitOptions.length === 0 ? 'No seats available in this class.' : 'A seat will be assigned automatically at booking.'}
                      </p>
                    )
                  }
                  return (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                    {unitOptions.map((u) => (
                      <span key={u.id} onClick={() => setSelectedUnitId(u.id)}
                        style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', minWidth: '38px', textAlign: 'center' as const,
                          border: `1.5px solid ${selectedUnitId === u.id ? COLORS.secondary : COLORS.border}`,
                          background: selectedUnitId === u.id ? COLORS.secondary : COLORS.bg,
                          color: selectedUnitId === u.id ? 'white' : COLORS.text }}>
                        {u.unit_number}
                      </span>
                    ))}
                    {unitOptions.length === 0 && <p style={{ fontSize: '12px', color: COLORS.textMuted }}>No seats available in this class.</p>}
                  </div>
                  )
                })()}
              </div>
            )}

            {[
              { key: 'baggage', label: 'Extra Baggage', price: ADDON_PRICES.baggage, val: extraBaggage, set: setExtraBaggage },
              { key: 'insurance', label: 'Travel Insurance', price: ADDON_PRICES.insurance, val: travelInsurance, set: setTravelInsurance },
              { key: 'pickup', label: 'Airport Pickup', price: ADDON_PRICES.pickup, val: airportPickup, set: setAirportPickup },
            ].map((a) => (
              <div key={a.key} onClick={() => a.set(!a.val)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px', borderRadius: '10px', border: `1.5px solid ${a.val ? COLORS.primary : COLORS.border}`, background: a.val ? '#EFF9FF' : COLORS.bg, marginBottom: '10px', cursor: 'pointer' }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{a.label}</p>
                  <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>+₦{a.price.toLocaleString()}</p>
                </div>
                <div style={{ width: '20px', height: '20px', borderRadius: '6px', border: `2px solid ${a.val ? COLORS.primary : COLORS.border}`, background: a.val ? COLORS.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  {a.val ? <Icon name="check" size={13} color="white" strokeWidth={3} /> : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STEP 4 — PAYMENT SUMMARY */}
        {step === 4 && (
          <div style={cardStyle}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '14px' }}>Payment Summary</p>
            {[
              ['Flight Fare', baseFare],
              ['Taxes', 0],
              ['Service Fee', SERVICE_FEE],
              ['Discount', -discountAmount],
              ['Add-ons', addonsTotal],
            ].map(([label, val]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0' }}>
                <span style={{ fontSize: '13px', color: COLORS.textMuted }}>{label}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: (val as number) < 0 ? COLORS.green : COLORS.text }}>
                  {(val as number) < 0 ? '-' : ''}₦{Math.abs(val as number).toLocaleString()}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', marginTop: '6px', borderTop: `1.5px solid ${COLORS.border}` }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>Total</span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: COLORS.secondary }}>₦{total.toLocaleString()}</span>
            </div>

            <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, marginTop: '18px', marginBottom: '10px' }}>Payment Method</p>
            {[
              { key: 'wallet', label: `Traveler Wallet · ₦${walletBalance.toLocaleString()} available`, enabled: true },
              { key: 'card', label: 'Debit / Credit Card', enabled: false },
              { key: 'bank', label: 'Bank Transfer', enabled: false },
            ].map((m) => (
              <div key={m.key} onClick={() => m.enabled && setPaymentMethod(m.key as any)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px', borderRadius: '10px', marginBottom: '8px',
                  border: `1.5px solid ${paymentMethod === m.key ? COLORS.primary : COLORS.border}`,
                  background: !m.enabled ? '#F1F5F9' : paymentMethod === m.key ? '#EFF9FF' : COLORS.bg,
                  cursor: m.enabled ? 'pointer' : 'not-allowed', opacity: m.enabled ? 1 : 0.6 }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: COLORS.text }}>{m.label}</span>
                {!m.enabled && <span style={{ fontSize: '10px', fontWeight: 700, color: COLORS.textMuted }}>Coming soon</span>}
              </div>
            ))}
            {walletBalance < total && (
              <p style={{ fontSize: '11.5px', color: COLORS.red, marginTop: '6px' }}>Your wallet balance is insufficient. Please top up before continuing.</p>
            )}
          </div>
        )}

        {/* STEP 5 — REVIEW & CONFIRM */}
        {step === 5 && (
          <div style={cardStyle}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '14px' }}>Review & Confirm</p>
            {[
              ['Passenger', fullName],
              ['Flight', service.title],
              ['Route', `${service.origin || '—'} → ${service.destination}`],
              ['Date', service.departure_time ? new Date(service.departure_time).toLocaleString() : 'TBA'],
              ['Airline', service.companies?.business_name || 'Traveler.com Partner'],
              ['Payment Method', 'Traveler Wallet'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>{label}</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, textAlign: 'right' as const }}>{val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 4px' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>Total to Pay</span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: COLORS.secondary }}>₦{total.toLocaleString()}</span>
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '14px', cursor: 'pointer' }}>
              <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} style={{ marginTop: '3px' }} />
              <span style={{ fontSize: '12px', color: COLORS.textMuted }}>I agree to the Terms &amp; Conditions.</span>
            </label>
          </div>
        )}

        {/* STEP 6 — CONFIRMATION */}
        {step === 6 && (
          <div style={{ textAlign: 'center' as const }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: COLORS.green, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '20px auto' }}><Icon name="check" size={30} color="white" strokeWidth={3} /></div>
            <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text }}>Booking Successful</p>
            <p style={{ fontSize: '13px', color: COLORS.green, fontWeight: 700, marginBottom: '20px' }}>Reservation Confirmed</p>

            <div style={{ ...cardStyle, textAlign: 'left' as const }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Reservation ID</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{reservationId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Booking Reference (PNR)</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.gold }}>{pnr}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Passenger</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{fullName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Route</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{service.origin || '—'} → {service.destination}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Total Paid</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>₦{total.toLocaleString()}</span>
              </div>
            </div>

            <div className="no-print" style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginTop: '10px' }}>
              <button onClick={downloadReceipt} style={{ padding: '14px', borderRadius: '12px', border: `1.5px solid ${COLORS.primary}`, background: 'white', color: COLORS.primary, fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Icon name="clipboard" size={15} color={COLORS.primary} /> Download Receipt</button>
              <button onClick={() => navigate('/my-bookings')} style={{ padding: '14px', borderRadius: '12px', border: `1.5px solid ${COLORS.border}`, background: 'white', color: COLORS.text, fontWeight: 700, fontSize: '14px' }}>View Booking</button>
              <button onClick={() => navigate('/home')} style={{ padding: '14px', borderRadius: '12px', border: 'none', background: COLORS.secondary, color: 'white', fontWeight: 700, fontSize: '14px' }}>Return Home</button>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER NAV */}
      {step <= 5 && (
        <div className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: `1px solid ${COLORS.border}`, padding: '14px 20px', boxShadow: '0 -4px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', gap: '10px' }}>
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: `1.5px solid ${COLORS.border}`, background: 'white', color: COLORS.text, fontWeight: 700, fontSize: '14px' }}>Back</button>
            )}
            {step < 5 && (
              <button
                disabled={step === 2 && !passengerValid}
                onClick={() => setStep(step + 1)}
                style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: step === 2 && !passengerValid ? '#94a3b8' : COLORS.secondary, color: 'white', fontWeight: 700, fontSize: '14px' }}>
                Continue
              </button>
            )}
            {step === 5 && (
              <button
                disabled={booking || !agreedTerms}
                onClick={handleConfirmBooking}
                style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: booking || !agreedTerms ? '#94a3b8' : COLORS.secondary, color: 'white', fontWeight: 700, fontSize: '14px' }}>
                {booking ? 'Processing...' : 'Confirm Booking'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default FlightDetails
