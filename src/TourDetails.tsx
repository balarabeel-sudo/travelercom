import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import { downloadReceiptImage } from './receiptGenerator'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  red: '#dc2626',
}

type Step = 'details' | 'guest' | 'dates' | 'participants' | 'summary' | 'payment'
const STEP_ORDER: Step[] = ['details', 'guest', 'dates', 'participants', 'summary', 'payment']

type TourDetail = {
  id: string
  photo_url: string | null
  title: string
  description: string | null
  destination: string
  price: number
  seats_available: number | null
  gate_fee: number | null
  vehicle_fee: number | null
  company_id: string
  tour_type: string | null
  duration_minutes: number | null
  companies: { business_name: string } | null
}

const TOUR_TYPE_ICON: Record<string, string> = { Nature: 'sun', History: 'building', Adventure: 'compass', Water: 'pool', Culture: 'party' }

function generateTicketCode() {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `TUR-${new Date().getFullYear()}-${rand}`
}

function TourDetails() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [service, setService] = useState<TourDetail | null>(null)
  const [userId, setUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)

  const [tourDate, setTourDate] = useState('')
  const [travelers, setTravelers] = useState(1)
  const [addGateFee, setAddGateFee] = useState(false)
  const [addVehicleFee, setAddVehicleFee] = useState(false)
  const [activePromo, setActivePromo] = useState<{ id: string; title: string; discount_type: string; discount_value: number } | null>(null)

  const [booking, setBooking] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [ticketCode, setTicketCode] = useState('')
  const [transactionId, setTransactionId] = useState('')

  // --- Booking wizard ---
  const [step, setStep] = useState<Step>('details')
  // Guest info is prefilled from the account and shown for confirmation/receipt only —
  // it is not written to the database (bookings table has no email/phone columns).
  const [gName, setGName] = useState('')
  const [gEmail, setGEmail] = useState('')
  const [gPhone, setGPhone] = useState('')
  const [guestErrors, setGuestErrors] = useState<{ name?: string; email?: string; phone?: string }>({})
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'paystack'>('wallet')

  useEffect(() => {
    const load = async () => {
      const { data: userData, error } = await supabase.auth.getUser()
      if (error || !userData.user) {
        navigate('/login')
        return
      }
      setUserId(userData.user.id)
      setDisplayName(userData.user.user_metadata?.full_name || '')
      setGName(userData.user.user_metadata?.full_name || '')
      setGEmail(userData.user.email || '')
      setGPhone(userData.user.phone || userData.user.user_metadata?.phone || '')

      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userData.user.id)
        .maybeSingle()
      setWalletBalance(wallet ? Number(wallet.balance) : 0)

      const { data: svc } = await supabase
        .from('services')
        .select('id, title, description, destination, price, seats_available, company_id, photo_url, tour_type, gate_fee, vehicle_fee, duration_minutes, companies(business_name)')
        .eq('id', id)
        .maybeSingle()
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

      setLoading(false)
    }
    load()
  }, [id, navigate])

  const calculatedTotal = (service?.price ?? 0) * travelers

  const discountedTotal = (() => {
    if (!activePromo || calculatedTotal <= 0) return calculatedTotal
    if (activePromo.discount_type === 'percentage') {
      return Math.max(0, calculatedTotal * (1 - activePromo.discount_value / 100))
    }
    return Math.max(0, calculatedTotal - activePromo.discount_value)
  })()

  const addOnsTotal = (addGateFee ? (service?.gate_fee ?? 0) : 0) + (addVehicleFee ? (service?.vehicle_fee ?? 0) : 0)

  const activePrice = discountedTotal + addOnsTotal
  const seatsLeft = service?.seats_available ?? null

  const validateGuest = () => {
    const errors: { name?: string; email?: string; phone?: string } = {}
    if (!gName.trim()) errors.name = 'Name cannot be empty.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gEmail.trim())) errors.email = 'Enter a valid email address.'
    if (gPhone.replace(/\D/g, '').length < 7) errors.phone = 'Enter a valid phone number.'
    setGuestErrors(errors)
    return Object.keys(errors).length === 0
  }

  const goBack = () => {
    const idx = STEP_ORDER.indexOf(step)
    if (idx <= 0) navigate('/tours')
    else setStep(STEP_ORDER[idx - 1])
  }

  // Branded receipt image — built only from real confirmed booking data.
  const downloadReceipt = () => {
    if (!service) return
    downloadReceiptImage({
      category: 'tour',
      serviceName: service.title,
      serviceTypeLabel: service.tour_type || 'Tour',
      location: service.destination,
      bookingReference: ticketCode,
      amountPaid: activePrice,
      paymentDate: new Date().toLocaleString(),
      transactionId: transactionId || undefined,
      filenamePrefix: 'Tour',
      rows: [
        { label: 'Tour Date', value: tourDate },
        { label: 'Participants', value: String(travelers) },
        { label: 'Customer Name', value: gName },
        { label: 'Email', value: gEmail },
        { label: 'Phone', value: gPhone },
      ],
    })
  }

  const handleBookNow = async () => {
    if (!service) return
    setMessage(null)

    if (!tourDate) {
      setMessage({ type: 'error', text: 'Please select a tour date.' })
      return
    }

    if (travelers < 1) {
      setMessage({ type: 'error', text: 'Please select at least 1 traveler.' })
      return
    }

    if (seatsLeft !== null && travelers > seatsLeft) {
      setMessage({ type: 'error', text: `Only ${seatsLeft} slot${seatsLeft !== 1 ? 's' : ''} left for this tour.` })
      return
    }

    if (walletBalance < activePrice) {
      setMessage({ type: 'error', text: 'Insufficient wallet balance. Please top up your wallet first.' })
      return
    }

    setBooking(true)
    const code = generateTicketCode()

    const { data: newBooking, error: bookingErr } = await supabase.from('bookings').insert({
      user_id: userId,
      service_id: service.id,
      company_id: service.company_id,
      quantity: travelers,
      amount_paid: activePrice,
      commission_amount: 0,
      booking_status: 'confirmed',
      ticket_code: code,
      customer_name: displayName || null,
      check_in_date: tourDate,
      promotion_id: activePromo?.id || null,
      booking_details: [addGateFee ? 'Gate Fee add-on' : null, addVehicleFee ? 'Vehicle Fee add-on' : null].filter(Boolean).join(', ') || null,
    }).select('id').single()

    if (bookingErr) {
      setBooking(false)
      setMessage({ type: 'error', text: 'Booking failed: ' + bookingErr.message })
      return
    }

    if (seatsLeft !== null) {
      const { data: newCount, error: decErr } = await supabase.rpc('decrement_seats', { p_service_id: service.id, p_quantity: travelers })
      if (!decErr && newCount !== null) {
        setService({ ...service, seats_available: newCount })
      }
    }

    const newBalance = walletBalance - activePrice
    const { error: walletErr } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', userId)

    if (walletErr) {
      setBooking(false)
      setMessage({ type: 'error', text: 'Payment failed: ' + walletErr.message })
      return
    }

    const { data: walletRow } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    const { data: txnRow } = await supabase.from('transactions').insert({
      user_id: userId,
      wallet_id: walletRow?.id,
      transaction_type: 'payment',
      amount: activePrice,
      status: 'successful',
    }).select('id').single()

    void newBooking
    setBooking(false)
    setWalletBalance(newBalance)
    setTicketCode(code)
    setTransactionId(txnRow?.id || '')
    setMessage({ type: 'success', text: 'Booking confirmed!' })
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted }}>
        Loading...
      </div>
    )
  }

  if (!service) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', padding: '20px', textAlign: 'center' }}>
        <p style={{ color: COLORS.textMuted, fontSize: '14px', marginTop: '40px' }}>Tour not found.</p>
        <button onClick={() => navigate('/tours')} style={{ marginTop: '16px', padding: '10px 20px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '10px' }}>
          Back to Tours
        </button>
      </div>
    )
  }

  if (ticketCode) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: COLORS.card, borderRadius: '20px', padding: '30px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '100%' }}>
          <div style={{ width: '48px', height: '48px', marginBottom: '12px', color: COLORS.green, display: 'flex', justifyContent: 'center' }}><Icon name="checkCircle" size={44} color={COLORS.green} /></div>
          <p style={{ fontSize: '17px', fontWeight: 800, color: COLORS.green, marginBottom: '6px' }}>Booking Confirmed!</p>
          <p style={{ fontSize: '13px', color: COLORS.textMuted, marginBottom: '20px' }}>{service.title}</p>

          <div style={{ background: COLORS.bg, borderRadius: '12px', padding: '16px', marginBottom: '20px', textAlign: 'left' as const }}>
            <div style={{ textAlign: 'center' as const, marginBottom: '12px' }}>
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>YOUR TICKET CODE</p>
              <p style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text, letterSpacing: '1px' }}>{ticketCode}</p>
            </div>
            <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: '10px', display: 'flex', flexDirection: 'column' as const, gap: '6px' }}>
              <SummaryRow label="Customer" value={gName} />
              <SummaryRow label="Tour date" value={tourDate} />
              <SummaryRow label="Participants" value={String(travelers)} />
              <SummaryRow label="Total paid" value={`₦${activePrice.toLocaleString()}`} bold />
              <SummaryRow label="Status" value="Confirmed" valueColor={COLORS.green} />
            </div>
          </div>

          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '14px' }}>
            Show this code to the tour guide on arrival. You can cancel within 15 minutes from "My Bookings".
          </p>

          <button
            onClick={() => navigate('/bookings')}
            style={{ width: '100%', padding: '13px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' }}>
            View Booking
          </button>
          <button
            onClick={downloadReceipt}
            style={{ width: '100%', padding: '13px', background: COLORS.card, color: COLORS.primary, border: `1px solid ${COLORS.primary}`, borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Icon name="clipboard" size={15} color={COLORS.primary} /> Download Receipt
          </button>

          <span
            onClick={() => navigate('/home')}
            style={{ display: 'block', textAlign: 'center' as const, fontSize: '12.5px', color: COLORS.textMuted, fontWeight: 700, cursor: 'pointer' }}>
            Back to Home
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: COLORS.card,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <span onClick={goBack} style={{ display: 'flex', cursor: 'pointer' }}><Icon name="arrowLeft" size={20} color={COLORS.text} /></span>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>
          {step === 'details' && 'Tour Details'}
          {step === 'guest' && 'Your Information'}
          {step === 'dates' && 'Select Tour Date'}
          {step === 'participants' && 'Participants'}
          {step === 'summary' && 'Review Booking'}
          {step === 'payment' && 'Payment'}
        </h1>
      </div>

      {step !== 'details' && <ProgressBar step={step} />}

      <div style={{ padding: '16px' }}>
      {step === 'details' && (<>
        <div style={{
          height: '180px',
          borderRadius: '16px',
          background: service.photo_url ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          {service.photo_url ? <img src={service.photo_url} alt={service.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="map" size={56} color="white" />}
          {activePromo && (
            <div style={{
              position: 'absolute', top: '12px', left: '12px', background: '#6B21A8', color: 'white',
              fontSize: '11.5px', fontWeight: 800, padding: '5px 11px', borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
            }}>
              {activePromo.discount_type === 'percentage' ? `${activePromo.discount_value}% OFF` : `₦${activePromo.discount_value.toLocaleString()} OFF`}
            </div>
          )}
        </div>

        <h2 style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>{service.title}</h2>
        <p style={{ fontSize: '13px', color: COLORS.textMuted, marginBottom: '2px' }}>{service.destination}</p>
        <p
          onClick={() => navigate(`/company/${service.company_id}`)}
          style={{ fontSize: '12px', color: COLORS.primary, fontWeight: 700, marginBottom: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {service.companies?.business_name || 'Traveler.com Partner'} <Icon name="chevronRight" size={12} color={COLORS.primary} />
        </p>

        {(service.tour_type || service.duration_minutes) && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const, marginBottom: '16px' }}>
            {service.tour_type && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, padding: '4px 9px', borderRadius: '20px' }}>
                <Icon name={TOUR_TYPE_ICON[service.tour_type] || 'map'} size={11} color={COLORS.textMuted} /> {service.tour_type}
              </span>
            )}
            {service.duration_minutes && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, padding: '4px 9px', borderRadius: '20px' }}>
                <Icon name="clock" size={11} color={COLORS.textMuted} />
                {service.duration_minutes >= 60 ? `${Math.floor(service.duration_minutes / 60)}h ${service.duration_minutes % 60 ? `${service.duration_minutes % 60}m` : ''}`.trim() : `${service.duration_minutes}m`}
              </span>
            )}
          </div>
        )}

        {service.description && (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>About this tour</p>
            <p style={{ fontSize: '13px', color: COLORS.textMuted, lineHeight: 1.5 }}>{service.description}</p>
          </div>
        )}

        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: COLORS.textMuted }}>Price per person</span>
            <span style={{ fontSize: '16px', fontWeight: 800, color: COLORS.primary }}>₦{service.price.toLocaleString()}</span>
          </div>
          {seatsLeft !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: COLORS.textMuted }}>Slots available</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: seatsLeft === 0 ? COLORS.red : COLORS.text }}>{seatsLeft === 0 ? 'Fully booked' : seatsLeft}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => setStep('guest')}
          disabled={seatsLeft !== null && seatsLeft === 0}
          style={{
            width: '100%', padding: '15px',
            background: seatsLeft !== null && seatsLeft === 0 ? '#94a3b8' : COLORS.secondary,
            color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px',
            cursor: seatsLeft !== null && seatsLeft === 0 ? 'not-allowed' : 'pointer',
          }}>
          {seatsLeft !== null && seatsLeft === 0 ? 'Fully Booked' : 'Book Now'}
        </button>
      </>)}

      {step === 'guest' && (
        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '16px' }}>
            We've filled this in from your account — please confirm it's correct.
          </p>

          <FormField label="Full Name" value={gName} onChange={setGName} error={guestErrors.name} placeholder="Enter your full name" />
          <FormField label="Email Address" value={gEmail} onChange={setGEmail} error={guestErrors.email} placeholder="Enter your email" type="email" />
          <FormField label="Phone Number" value={gPhone} onChange={setGPhone} error={guestErrors.phone} placeholder="Enter your phone number" type="tel" last />

          <button
            onClick={() => { if (validateGuest()) setStep('dates') }}
            style={{ width: '100%', padding: '15px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>
            Continue
          </button>
        </div>
      )}

      {step === 'dates' && (<>
        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>Tour Date</p>
          <input
            type="date"
            value={tourDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setTourDate(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '13px', boxSizing: 'border-box' }}
          />
          {seatsLeft === 0 && (
            <p style={{ fontSize: '11.5px', color: COLORS.red, marginTop: '8px' }}>This tour is fully booked — no dates are available right now.</p>
          )}
        </div>

        <button
          onClick={() => setStep('participants')}
          disabled={!tourDate || seatsLeft === 0}
          style={{ width: '100%', padding: '15px', background: !tourDate || seatsLeft === 0 ? '#94a3b8' : COLORS.secondary, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: !tourDate || seatsLeft === 0 ? 'not-allowed' : 'pointer' }}>
          Continue
        </button>
      </>)}

      {step === 'participants' && (<>
        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '6px' }}>Number of travelers</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' }}>
            <span
              onClick={() => setTravelers(Math.max(1, travelers - 1))}
              style={{ width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="minus" size={14} color={COLORS.text} />
            </span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: COLORS.text, minWidth: '20px', textAlign: 'center' as const }}>{travelers}</span>
            <span
              onClick={() => setTravelers(seatsLeft !== null ? Math.min(seatsLeft, travelers + 1) : travelers + 1)}
              style={{ width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="plus" size={14} color={COLORS.text} />
            </span>
          </div>
          {seatsLeft !== null && (
            <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{seatsLeft} slot{seatsLeft !== 1 ? 's' : ''} available</p>
          )}

          {(service.gate_fee || service.vehicle_fee) && (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', marginTop: '14px' }}>
              {service.gate_fee != null && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={addGateFee} onChange={(e) => setAddGateFee(e.target.checked)} />
                  <span style={{ fontSize: '12.5px', color: COLORS.text, flex: 1 }}>Add Gate Fee</span>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>₦{Number(service.gate_fee).toLocaleString()}</span>
                </label>
              )}
              {service.vehicle_fee != null && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={addVehicleFee} onChange={(e) => setAddVehicleFee(e.target.checked)} />
                  <span style={{ fontSize: '12.5px', color: COLORS.text, flex: 1 }}>Add Vehicle Fee</span>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>₦{Number(service.vehicle_fee).toLocaleString()}</span>
                </label>
              )}
            </div>
          )}

          {activePromo && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px', background: '#F5F3FF',
              border: '1px solid #DDD6FE', borderRadius: '8px', padding: '8px 10px', marginTop: '12px'
            }}>
              <span style={{ display: 'flex' }}><Icon name="tag" size={13} color="#6B21A8" /></span>
              <p style={{ fontSize: '11.5px', fontWeight: 700, color: '#6B21A8' }}>
                {activePromo.title} — {activePromo.discount_type === 'percentage' ? `${activePromo.discount_value}% OFF` : `₦${activePromo.discount_value.toLocaleString()} OFF`}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', marginTop: '12px', borderTop: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>{travelers} traveler{travelers > 1 ? 's' : ''} × ₦{service.price.toLocaleString()}{addOnsTotal > 0 ? ' + add-ons' : ''}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {activePromo && (
                <span style={{ fontSize: '11.5px', color: COLORS.textMuted, textDecoration: 'line-through' }}>₦{calculatedTotal.toLocaleString()}</span>
              )}
              <span style={{ fontSize: '14px', fontWeight: 800, color: COLORS.primary }}>₦{activePrice.toLocaleString()}</span>
            </span>
          </div>
        </div>

        <button
          onClick={() => setStep('summary')}
          style={{ width: '100%', padding: '15px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>
          Continue
        </button>
      </>)}

      {step === 'summary' && (<>
        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' as const, gap: '14px' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase' as const, marginBottom: '6px' }}>Tour</p>
            <SummaryRow label="Name" value={service.title} />
            <SummaryRow label="Destination" value={service.destination} />
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase' as const, marginBottom: '6px' }}>Customer</p>
            <SummaryRow label="Full Name" value={gName} />
            <SummaryRow label="Email" value={gEmail} />
            <SummaryRow label="Phone" value={gPhone} />
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase' as const, marginBottom: '6px' }}>Tour Details</p>
            <SummaryRow label="Tour date" value={tourDate} />
            <SummaryRow label="Participants" value={String(travelers)} />
            {service.duration_minutes && (
              <SummaryRow label="Duration" value={service.duration_minutes >= 60 ? `${Math.floor(service.duration_minutes / 60)}h ${service.duration_minutes % 60 ? `${service.duration_minutes % 60}m` : ''}`.trim() : `${service.duration_minutes}m`} />
            )}
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase' as const, marginBottom: '6px' }}>Price</p>
            <SummaryRow label={`Adult × ${travelers}`} value={`₦${calculatedTotal.toLocaleString()}`} />
            {addGateFee && service.gate_fee != null && <SummaryRow label="Gate Fee" value={`₦${Number(service.gate_fee).toLocaleString()}`} />}
            {addVehicleFee && service.vehicle_fee != null && <SummaryRow label="Vehicle Fee" value={`₦${Number(service.vehicle_fee).toLocaleString()}`} />}
            {activePromo && (
              <SummaryRow label={activePromo.title} value={`− ₦${(calculatedTotal - discountedTotal).toLocaleString()}`} valueColor={COLORS.green} />
            )}
            <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: '4px', paddingTop: '8px' }}>
              <SummaryRow label="Total Amount" value={`₦${activePrice.toLocaleString()}`} bold />
            </div>
          </div>
        </div>

        <button
          onClick={() => setStep('payment')}
          style={{ width: '100%', padding: '15px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>
          Confirm & Continue
        </button>
      </>)}

      {step === 'payment' && (<>
        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', color: COLORS.textMuted }}>Amount to Pay</span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: COLORS.primary }}>₦{activePrice.toLocaleString()}</span>
          </div>

          <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase' as const, marginBottom: '8px' }}>Payment Method</p>

          <div
            onClick={() => setPaymentMethod('wallet')}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px',
              borderRadius: '10px', border: `2px solid ${paymentMethod === 'wallet' ? COLORS.primary : COLORS.border}`,
              marginBottom: '8px', cursor: 'pointer',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Icon name="wallet" size={18} color={COLORS.primary} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>Wallet</p>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Balance: ₦{walletBalance.toLocaleString()}</p>
              </div>
            </div>
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${paymentMethod === 'wallet' ? COLORS.primary : COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {paymentMethod === 'wallet' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS.primary }} />}
            </div>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px',
            borderRadius: '10px', border: `2px solid ${COLORS.border}`, opacity: 0.5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Icon name="cash" size={18} color={COLORS.textMuted} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>Paystack (Card/Bank Transfer)</p>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Coming soon</p>
              </div>
            </div>
          </div>
        </div>

        {message && (
          <div style={{
            background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <p style={{ fontSize: '12.5px', color: message.type === 'success' ? COLORS.green : COLORS.red }}>{message.text}</p>
            {message.type === 'error' && message.text.includes('Insufficient') && (
              <span onClick={() => navigate('/wallet')} style={{ fontSize: '12px', color: COLORS.primary, fontWeight: 700, cursor: 'pointer' }}>
                Top Up Wallet →
              </span>
            )}
          </div>
        )}

        <button
          onClick={handleBookNow}
          disabled={booking || paymentMethod !== 'wallet'}
          style={{
            width: '100%',
            padding: '15px',
            background: booking || paymentMethod !== 'wallet' ? '#94a3b8' : COLORS.secondary,
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontWeight: 'bold',
            fontSize: '15px',
            cursor: booking ? 'not-allowed' : 'pointer'
          }}>
          {booking ? 'Processing...' : `Pay Now — ₦${activePrice.toLocaleString()}`}
        </button>
      </>)}
      </div>
    </div>
  )
}

function ProgressBar({ step }: { step: Step }) {
  const COLORS_LOCAL = { primary: '#0EA5E9', border: '#E2E8F0', textMuted: '#64748B', text: '#1A1A1A' }
  const labels: { key: Step; label: string }[] = [
    { key: 'guest', label: 'Information' },
    { key: 'dates', label: 'Date' },
    { key: 'participants', label: 'Participants' },
    { key: 'summary', label: 'Review' },
    { key: 'payment', label: 'Payment' },
  ]
  const currentIdx = labels.findIndex((l) => l.key === step)
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: '#FFFFFF', gap: '2px', overflowX: 'auto' as const }}>
      {labels.map((l, i) => (
        <div key={l.key} style={{ display: 'flex', alignItems: 'center', flex: i < labels.length - 1 ? 1 : 'none', minWidth: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: i <= currentIdx ? COLORS_LOCAL.primary : COLORS_LOCAL.border,
              color: i <= currentIdx ? 'white' : COLORS_LOCAL.textMuted,
              fontSize: '9.5px', fontWeight: 700, flexShrink: 0,
            }}>
              {i + 1}
            </div>
            <span style={{ fontSize: '9.5px', fontWeight: 700, color: i <= currentIdx ? COLORS_LOCAL.text : COLORS_LOCAL.textMuted, whiteSpace: 'nowrap' as const }}>{l.label}</span>
          </div>
          {i < labels.length - 1 && <div style={{ flex: 1, height: '1px', background: i < currentIdx ? COLORS_LOCAL.primary : COLORS_LOCAL.border, margin: '0 4px', minWidth: '8px' }} />}
        </div>
      ))}
    </div>
  )
}

function FormField({ label, value, onChange, error, placeholder, type = 'text', last }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; type?: string; last?: boolean
}) {
  const COLORS_LOCAL = { border: '#E2E8F0', text: '#1A1A1A', textMuted: '#64748B', red: '#dc2626' }
  return (
    <div style={{ marginBottom: last ? '18px' : '14px' }}>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS_LOCAL.textMuted, marginBottom: '5px' }}>{label}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '11px', borderRadius: '9px', border: `1px solid ${error ? COLORS_LOCAL.red : COLORS_LOCAL.border}`, fontSize: '13.5px', boxSizing: 'border-box' as const }}
      />
      {error && <p style={{ fontSize: '11px', color: COLORS_LOCAL.red, marginTop: '4px' }}>{error}</p>}
    </div>
  )
}

function SummaryRow({ label, value, bold, valueColor }: { label: string; value: string; bold?: boolean; valueColor?: string }) {
  const COLORS_LOCAL = { text: '#1A1A1A', textMuted: '#64748B', primary: '#0EA5E9' }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
      <span style={{ fontSize: bold ? '13.5px' : '12.5px', color: COLORS_LOCAL.textMuted }}>{label}</span>
      <span style={{ fontSize: bold ? '15px' : '12.5px', fontWeight: bold ? 800 : 600, color: valueColor || (bold ? COLORS_LOCAL.primary : COLORS_LOCAL.text) }}>{value}</span>
    </div>
  )
}

export default TourDetails
