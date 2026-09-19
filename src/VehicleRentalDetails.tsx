import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
const ADDON_PRICES = { additionalDriver: 5000, fullInsurance: 4000 }
const SERVICE_FEE = 300

const ID_TYPES = ['NIN', "Voter's Card (PVC)", "Driver's License", 'School ID'] as const

function isIdFormatValid(idType: string, idNumber: string): boolean {
  const v = idNumber.trim()
  if (!v) return false
  switch (idType) {
    case 'NIN':
      return /^\d{11}$/.test(v)
    case "Voter's Card (PVC)":
      return /^[A-Za-z0-9]{19}$/.test(v)
    case "Driver's License":
      return /^[A-Za-z0-9]{8,12}$/.test(v)
    case 'School ID':
      return v.length >= 4
    default:
      return false
  }
}

function generateBookingCode() {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `VR-${new Date().getFullYear()}-${rand}`
}

const FEATURE_ICON: Record<string, string> = {
  'Air Conditioning': 'snowflake', GPS: 'compass', Bluetooth: 'bluetooth', USB: 'plug', 'Wi-Fi': 'wifi', 'Child Seat': 'seat',
}
const RENTAL_MODE_LABEL: Record<string, string> = { self_drive: 'Self-Drive', with_driver: 'With Driver', both: 'Self-Drive or With Driver' }

type VehicleService = {
  id: string
  title: string
  photo_url: string | null
  destination: string
  brand: string | null
  model: string | null
  year: number | null
  transmission: string | null
  fuel_type: string | null
  capacity: number | null
  rental_mode: string | null
  deposit: number | null
  min_rental_days: number | null
  max_rental_days: number | null
  pickup_location: string | null
  drop_off_location: string | null
  price: number
  seats_available: number | null
  amenities: string[] | null
  company_id: string
  companies: { business_name: string } | null
}

const STEPS = ['Vehicle', 'Renter', 'Extras', 'Payment', 'Review']

function VehicleRentalDetails() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [step, setStep] = useState(1)
  const [service, setService] = useState<VehicleService | null>(null)
  const [userId, setUserId] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)
  const [activePromo, setActivePromo] = useState<{ id: string; title: string; discount_type: string; discount_value: number } | null>(null)
  const [reviews, setReviews] = useState<{ id: string; rating: number; comment: string | null; created_at: string; full_name: string | null }[]>([])
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [booking, setBooking] = useState(false)

  const [inventoryItemId, setInventoryItemId] = useState<string | null>(null)

  const [pickupDate, setPickupDate] = useState(searchParams.get('pickup') || '')
  const [returnDate, setReturnDate] = useState(searchParams.get('return') || '')

  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('Male')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [nationality, setNationality] = useState('Nigerian')
  const [idType, setIdType] = useState<string>(ID_TYPES[0])
  const [idNumber, setIdNumber] = useState('')

  const [additionalDriver, setAdditionalDriver] = useState(false)
  const [fullInsurance, setFullInsurance] = useState(false)

  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'card' | 'bank'>('wallet')
  const [agreedTerms, setAgreedTerms] = useState(false)

  const [reservationId, setReservationId] = useState('')
  const [bookingRef, setBookingRef] = useState('')
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
      .select('id, title, photo_url, destination, brand, model, year, transmission, fuel_type, capacity, rental_mode, deposit, min_rental_days, max_rental_days, pickup_location, drop_off_location, price, seats_available, amenities, company_id, companies(business_name)')
      .eq('id', id)
      .maybeSingle()
    if (svcErr) {
      setNetError(true)
      setLoading(false)
      return
    }
    setService(svc as any)

    const { data: reviewRows } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, user_id')
      .eq('service_id', id)
      .order('created_at', { ascending: false })

    if (reviewRows && reviewRows.length > 0) {
      const userIds = reviewRows.map((r: any) => r.user_id)
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', userIds)
      const nameMap: Record<string, string | null> = {}
      for (const p of profs || []) nameMap[p.id] = p.full_name
      setReviews(reviewRows.map((r: any) => ({
        id: r.id, rating: r.rating, comment: r.comment, created_at: r.created_at,
        full_name: nameMap[r.user_id] || null,
      })))
    }

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
      .select('id')
      .eq('service_id', id)
      .limit(1)
    if (items && items.length > 0) setInventoryItemId(items[0].id)

    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate])

  const days = (() => {
    if (!pickupDate || !returnDate) return 0
    const ms = new Date(returnDate).getTime() - new Date(pickupDate).getTime()
    return ms > 0 ? Math.ceil(ms / 86400000) : 0
  })()

  const datesValid = days > 0
    && (!service?.min_rental_days || days >= service.min_rental_days)
    && (!service?.max_rental_days || days <= service.max_rental_days)

  const baseFareTotal = Number(service?.price ?? 0) * Math.max(days, 0)
  const fareAfterDiscount = (() => {
    if (!activePromo || baseFareTotal <= 0) return baseFareTotal
    if (activePromo.discount_type === 'percentage') return Math.max(0, baseFareTotal * (1 - activePromo.discount_value / 100))
    return Math.max(0, baseFareTotal - activePromo.discount_value)
  })()
  const discountAmount = baseFareTotal - fareAfterDiscount
  const addonsTotal = (additionalDriver ? ADDON_PRICES.additionalDriver : 0) + (fullInsurance ? ADDON_PRICES.fullInsurance : 0)
  const depositAmount = Number(service?.deposit ?? 0)
  const total = fareAfterDiscount + addonsTotal + SERVICE_FEE + depositAmount

  const renterValid = fullName.trim() && dob && phone.trim() && email.trim() && nationality.trim() && isIdFormatValid(idType, idNumber)

  const handleConfirmBooking = async () => {
    if (!service || !agreedTerms) return
    setMessage(null)

    if (!datesValid) {
      setMessage({ type: 'error', text: 'Please choose valid pickup and return dates.' })
      return
    }
    if (walletBalance < total) {
      setMessage({ type: 'error', text: 'Insufficient wallet balance. Please top up your wallet first.' })
      return
    }

    setBooking(true)
    const code = generateBookingCode()
    let assignedNumber = ''

    if (inventoryItemId) {
      const { data: claimedRows } = await supabase.rpc('claim_inventory_unit_for_dates', {
        p_item_id: inventoryItemId, p_check_in: pickupDate, p_check_out: returnDate,
      })
      const claimed = claimedRows && claimedRows.length > 0 ? claimedRows[0] : null
      if (!claimed) {
        setBooking(false)
        setMessage({ type: 'error', text: 'No vehicle is available for those dates. Please try different dates.' })
        return
      }
      assignedNumber = claimed.unit_number
    }

    const { data: newBooking, error: bookingErr } = await supabase.from('bookings').insert({
      user_id: userId,
      service_id: service.id,
      company_id: service.company_id,
      inventory_item_id: inventoryItemId,
      quantity: 1,
      amount_paid: total,
      commission_amount: 0,
      booking_status: 'confirmed',
      ticket_code: code,
      customer_name: fullName || null,
      assigned_unit_number: assignedNumber || null,
      check_in_date: pickupDate,
      check_out_date: returnDate,
      promotion_id: activePromo?.id || null,
      id_type: idType,
      id_number: idNumber.trim(),
    }).select('id').single()

    if (bookingErr) {
      setBooking(false)
      setMessage({ type: 'error', text: 'Booking failed: ' + bookingErr.message })
      return
    }

    if (!inventoryItemId && service.seats_available !== null && service.seats_available > 0) {
      const { data: newCount, error: decErr } = await supabase.rpc('decrement_seats', { p_service_id: service.id, p_quantity: 1 })
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
    setBookingRef(code)
    setTransactionId(txnRow?.id || '')
    setStep(6)
  }

  // Branded receipt image — built only from real confirmed booking data.
  const downloadReceipt = () => {
    if (!service) return
    downloadReceiptImage({
      category: 'vehicle_rental',
      serviceName: service.title,
      serviceTypeLabel: service.title,
      location: service.destination,
      bookingReference: bookingRef,
      amountPaid: total,
      paymentDate: new Date().toLocaleString(),
      transactionId: transactionId || undefined,
      filenamePrefix: 'VehicleRental',
      rows: [
        { label: 'Renter Name', value: fullName },
        { label: 'Email', value: email },
        { label: 'Phone', value: phone },
        { label: 'Vehicle', value: service.title },
        { label: 'City', value: service.destination },
        { label: 'Pickup Date', value: new Date(pickupDate).toLocaleDateString() },
        { label: 'Return Date', value: new Date(returnDate).toLocaleDateString() },
        { label: 'Rental Company', value: service.companies?.business_name || 'Traveler.com Partner' },
      ],
    })
  }

  if (netError) return <NetworkError onRetry={load} />
  if (loading) return <DetailsSkeleton />
  if (!service) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted }}>Vehicle not found.</div>
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
        <p style={{ fontSize: '17px', fontWeight: 800, marginTop: '10px' }}>Book Your Vehicle</p>
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

        {/* STEP 1 — VEHICLE SUMMARY + DATES */}
        {step === 1 && (
          <>
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              <div style={{ height: '150px', background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.primary})`, position: 'relative' }}>
                {service.photo_url && <img src={service.photo_url} alt={service.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }} />}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '16px' }}>
                  <p style={{ color: 'white', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '5px' }}><Icon name="car" size={12} color="white" /> {service.companies?.business_name || 'Traveler.com Partner'}</p>
                  <p style={{ color: 'white', fontSize: '19px', fontWeight: 800, marginTop: '4px' }}>{service.title}</p>
                </div>
              </div>
              <div style={{ padding: '18px' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const, marginBottom: '14px' }}>
                  {service.transmission && <Badge text={service.transmission} />}
                  {service.fuel_type && <Badge text={service.fuel_type} />}
                  {service.capacity != null && <Badge text={`${service.capacity} seats`} />}
                  {service.rental_mode && <Badge text={RENTAL_MODE_LABEL[service.rental_mode] || service.rental_mode} highlight />}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={labelStyle}>Pickup Date</label>
                    <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Return Date</label>
                    <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
                  </div>
                </div>
                {days > 0 && !datesValid && (
                  <p style={{ fontSize: '11.5px', color: COLORS.red, marginBottom: '10px' }}>
                    {service.min_rental_days && days < service.min_rental_days ? `Minimum rental is ${service.min_rental_days} day${service.min_rental_days !== 1 ? 's' : ''}.` : ''}
                    {service.max_rental_days && days > service.max_rental_days ? `Maximum rental is ${service.max_rental_days} day${service.max_rental_days !== 1 ? 's' : ''}.` : ''}
                  </p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '14px', borderTop: `1px solid ${COLORS.border}` }}>
                  <div>
                    <p style={labelStyle}>Pickup Location</p>
                    <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{service.pickup_location || service.destination}</p>
                  </div>
                  <div>
                    <p style={labelStyle}>Drop-off Location</p>
                    <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{service.drop_off_location || service.pickup_location || service.destination}</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '14px' }}>
                  <div>
                    <p style={labelStyle}>Price</p>
                    <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>₦{Number(service.price).toLocaleString()}/day</p>
                  </div>
                  <div>
                    <p style={labelStyle}>Available</p>
                    <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{service.seats_available ?? '—'} vehicle{service.seats_available !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                {service.amenities && service.amenities.length > 0 && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const, marginTop: '14px', paddingTop: '14px', borderTop: `1px solid ${COLORS.border}` }}>
                    {service.amenities.map((a) => (
                      <span key={a} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: COLORS.textMuted, fontWeight: 600 }}>
                        <Icon name={FEATURE_ICON[a] || 'check'} size={12} color={COLORS.textMuted} /> {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: reviews.length ? '12px' : 0 }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>Reviews</p>
                {reviews.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="star" size={14} color="#D4A017" filled />
                    <span style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>
                      {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}
                    </span>
                    <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>({reviews.length.toLocaleString()})</span>
                  </div>
                )}
              </div>
              {reviews.length === 0 ? (
                <p style={{ fontSize: '12px', color: COLORS.textMuted }}>No reviews yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '12px' }}>
                  {reviews.slice(0, 5).map((r) => (
                    <div key={r.id} style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{r.full_name || 'Traveler.com user'}</span>
                        <span style={{ fontSize: '10.5px', color: COLORS.textMuted }}>{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '2px', marginBottom: r.comment ? '4px' : 0 }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Icon key={n} name="star" size={12} color={n <= r.rating ? '#D4A017' : COLORS.border} filled={n <= r.rating} />
                        ))}
                      </div>
                      {r.comment && <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.4 }}>{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* STEP 2 — RENTER DETAILS */}
        {step === 2 && (
          <div style={cardStyle}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '14px' }}>Renter Details</p>
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
            {(service.rental_mode === 'self_drive' || service.rental_mode === 'both') && (
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '8px' }}>
                Self-drive rentals require a valid Driver's License at pickup.
              </p>
            )}
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
              Identity information is required by the rental company for renter verification.
            </p>
          </div>
        )}

        {/* STEP 3 — OPTIONAL SERVICES */}
        {step === 3 && (
          <div style={cardStyle}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '14px' }}>Optional Services</p>
            {[
              { key: 'additionalDriver', label: 'Additional Driver', price: ADDON_PRICES.additionalDriver, val: additionalDriver, set: setAdditionalDriver },
              { key: 'fullInsurance', label: 'Full Insurance Cover', price: ADDON_PRICES.fullInsurance, val: fullInsurance, set: setFullInsurance },
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
            {depositAmount > 0 && (
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '4px' }}>
                A refundable deposit of ₦{depositAmount.toLocaleString()} is required and included in your total below.
              </p>
            )}
          </div>
        )}

        {/* STEP 4 — PAYMENT SUMMARY */}
        {step === 4 && (
          <div style={cardStyle}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '14px' }}>Payment Summary</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0' }}>
              <span style={{ fontSize: '13px', color: COLORS.textMuted }}>Rental Days</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: COLORS.text }}>{days}</span>
            </div>
            {[
              ['Vehicle Rental', baseFareTotal],
              ['Taxes', 0],
              ['Service Fee', SERVICE_FEE],
              ['Discount', -discountAmount],
              ['Add-ons', addonsTotal],
              ['Refundable Deposit', depositAmount],
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
              ['Renter', fullName],
              ['Vehicle', service.title],
              ['City', service.destination],
              ['Pickup Date', pickupDate ? new Date(pickupDate).toLocaleDateString() : '—'],
              ['Return Date', returnDate ? new Date(returnDate).toLocaleDateString() : '—'],
              ['Rental Company', service.companies?.business_name || 'Traveler.com Partner'],
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
              <span style={{ fontSize: '12px', color: COLORS.textMuted }}>
                I agree to the{' '}
                <span onClick={(e) => { e.stopPropagation(); window.open('#/payment-terms', '_blank') }} style={{ color: COLORS.primary, textDecoration: 'underline', fontWeight: 700 }}>
                  Terms &amp; Conditions
                </span>.
              </span>
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
                <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Booking Reference</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.gold }}>{bookingRef}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Renter</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{fullName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Vehicle</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{service.title}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Rental Period</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{new Date(pickupDate).toLocaleDateString()} → {new Date(returnDate).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Total Paid</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>₦{total.toLocaleString()}</span>
              </div>
            </div>

            <div className="no-print" style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginTop: '10px' }}>
              <button onClick={downloadReceipt} style={{ padding: '14px', borderRadius: '12px', border: `1.5px solid ${COLORS.primary}`, background: 'white', color: COLORS.primary, fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Icon name="clipboard" size={15} color={COLORS.primary} /> Download Receipt</button>
              <button onClick={() => navigate('/bookings')} style={{ padding: '14px', borderRadius: '12px', border: `1.5px solid ${COLORS.border}`, background: 'white', color: COLORS.text, fontWeight: 700, fontSize: '14px' }}>View Booking</button>
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
                disabled={(step === 1 && !datesValid) || (step === 2 && !renterValid)}
                onClick={() => setStep(step + 1)}
                style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: ((step === 1 && !datesValid) || (step === 2 && !renterValid)) ? '#94a3b8' : COLORS.secondary, color: 'white', fontWeight: 700, fontSize: '14px' }}>
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

function Badge({ text, highlight }: { text: string; highlight?: boolean }) {
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, padding: '5px 11px', borderRadius: '20px',
      background: highlight ? COLORS.primary : COLORS.bg,
      color: highlight ? 'white' : COLORS.textMuted,
      border: `1px solid ${highlight ? COLORS.primary : COLORS.border}`,
    }}>{text}</span>
  )
}

export default VehicleRentalDetails
