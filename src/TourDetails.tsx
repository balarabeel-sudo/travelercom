import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  green: '#16a34a',
  red: '#dc2626',
}

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

  useEffect(() => {
    const load = async () => {
      const { data: userData, error } = await supabase.auth.getUser()
      if (error || !userData.user) {
        navigate('/login')
        return
      }
      setUserId(userData.user.id)
      setDisplayName(userData.user.user_metadata?.full_name || '')

      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userData.user.id)
        .maybeSingle()
      setWalletBalance(wallet ? Number(wallet.balance) : 0)

      const { data: svc } = await supabase
        .from('services')
        .select('id, title, description, destination, price, seats_available, company_id, photo_url, tour_type, gate_fee, vehicle_fee, companies(business_name)')
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

    await supabase.from('transactions').insert({
      user_id: userId,
      wallet_id: walletRow?.id,
      transaction_type: 'payment',
      amount: activePrice,
      status: 'successful',
    })

    void newBooking
    setBooking(false)
    setWalletBalance(newBalance)
    setTicketCode(code)
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

          <div style={{ background: COLORS.bg, borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>YOUR TICKET CODE</p>
            <p style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text, letterSpacing: '1px' }}>{ticketCode}</p>
            <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '12px', marginBottom: '4px' }}>TRAVELERS</p>
            <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.primary }}>{travelers}</p>
          </div>

          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '20px' }}>
            Show this code to the tour guide on arrival. You can cancel within 15 minutes from "My Bookings".
          </p>

          <button
            onClick={() => navigate('/home')}
            style={{ width: '100%', padding: '13px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
            Back to Home
          </button>
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
        <span onClick={() => navigate('/tours')} style={{ display: 'flex', cursor: 'pointer' }}><Icon name="arrowLeft" size={20} color={COLORS.text} /></span>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Tour Details</h1>
      </div>

      <div style={{ padding: '16px' }}>
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

        {service.tour_type && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '16px', fontSize: '10px', fontWeight: 700, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, padding: '4px 9px', borderRadius: '20px' }}>
            <Icon name={TOUR_TYPE_ICON[service.tour_type] || 'map'} size={11} color={COLORS.textMuted} /> {service.tour_type}
          </span>
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

        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '10px' }}>Tour Date & Travelers</p>
          <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>Date</p>
          <input
            type="date"
            value={tourDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setTourDate(e.target.value)}
            style={{ width: '100%', padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', boxSizing: 'border-box', marginBottom: '12px' }}
          />
          <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '6px' }}>Number of travelers</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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

        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Your wallet balance</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>₦{walletBalance.toLocaleString()}</span>
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
                Top Up Wallet
              </span>
            )}
          </div>
        )}

        <button
          onClick={handleBookNow}
          disabled={booking || !tourDate || (seatsLeft !== null && seatsLeft === 0)}
          style={{
            width: '100%',
            padding: '15px',
            background: booking || !tourDate || (seatsLeft !== null && seatsLeft === 0) ? '#94a3b8' : COLORS.secondary,
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontWeight: 'bold',
            fontSize: '15px',
            cursor: booking ? 'not-allowed' : 'pointer'
          }}>
          {booking ? 'Processing...' : `Book Now — ₦${activePrice.toLocaleString()}`}
        </button>
      </div>
    </div>
  )
}

export default TourDetails
