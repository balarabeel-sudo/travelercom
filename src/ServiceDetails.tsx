import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'

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

const CATEGORY_META: Record<string, { label: string; icon: string; unitLabel: string; isTransport: boolean; prefix: string }> = {
  bus: { label: 'Bus', icon: '🚌', unitLabel: 'Seats', isTransport: true, prefix: 'BUS' },
  train: { label: 'Railway', icon: '🚆', unitLabel: 'Seats', isTransport: true, prefix: 'TRN' },
  flight: { label: 'Flight', icon: '✈️', unitLabel: 'Seats', isTransport: true, prefix: 'ALN' },
  tour: { label: 'Tour', icon: '🗺️', unitLabel: 'Slots', isTransport: false, prefix: 'TUR' },
  event_center: { label: 'Event Center', icon: '🎪', unitLabel: 'Capacity', isTransport: false, prefix: 'EVT' },
}

type ServiceDetail = {
  id: string
  title: string
  description: string | null
  origin: string | null
  destination: string
  departure_time: string | null
  price: number
  seats_available: number | null
  company_id: string
  companies: { business_name: string } | null
}

function generateTicketCode(prefix: string) {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}-${new Date().getFullYear()}-${rand}`
}

function ServiceDetails() {
  const navigate = useNavigate()
  const { category, id } = useParams()
  const meta = CATEGORY_META[category || 'bus'] || CATEGORY_META.bus

  const [loading, setLoading] = useState(true)
  const [service, setService] = useState<ServiceDetail | null>(null)
  const [userId, setUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)

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
        .select('id, title, description, origin, destination, departure_time, price, seats_available, company_id, companies(business_name)')
        .eq('id', id)
        .maybeSingle()

      setService(svc as any)
      setLoading(false)
    }
    load()
  }, [id, navigate])

  const handleBookNow = async () => {
    if (!service) return
    setMessage(null)

    if (walletBalance < service.price) {
      setMessage({ type: 'error', text: 'Insufficient wallet balance. Please top up your wallet first.' })
      return
    }

    setBooking(true)
    const code = generateTicketCode(meta.prefix)

    const { error: bookingErr } = await supabase.from('bookings').insert({
      user_id: userId,
      service_id: service.id,
      company_id: service.company_id,
      quantity: 1,
      amount_paid: service.price,
      commission_amount: 0,
      booking_status: 'confirmed',
      ticket_code: code,
      customer_name: displayName || null,
    })

    if (bookingErr) {
      setBooking(false)
      setMessage({ type: 'error', text: 'Booking failed: ' + bookingErr.message })
      return
    }

    const newBalance = walletBalance - service.price
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
      amount: service.price,
      status: 'successful',
    })

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
        <p style={{ color: COLORS.textMuted, fontSize: '14px', marginTop: '40px' }}>Listing not found.</p>
        <button onClick={() => navigate(`/services/${category}`)} style={{ marginTop: '16px', padding: '10px 20px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '10px' }}>
          Back to {meta.label}
        </button>
      </div>
    )
  }

  if (ticketCode) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: COLORS.card, borderRadius: '20px', padding: '30px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '100%' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
          <p style={{ fontSize: '17px', fontWeight: 800, color: COLORS.green, marginBottom: '6px' }}>Booking Confirmed!</p>
          <p style={{ fontSize: '13px', color: COLORS.textMuted, marginBottom: '20px' }}>{service.title}</p>

          <div style={{ background: COLORS.bg, borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>YOUR TICKET CODE</p>
            <p style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text, letterSpacing: '1px' }}>{ticketCode}</p>
          </div>

          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '20px' }}>
            Show this code to the {meta.label.toLowerCase()} staff. You can cancel within 15 minutes from "My Bookings".
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

      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <span onClick={() => navigate(`/services/${category}`)} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>{meta.label} Details</h1>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{
          height: '180px', borderRadius: '16px',
          background: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '56px', marginBottom: '16px'
        }}>
          {meta.icon}
        </div>

        <h2 style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>{service.title}</h2>
        <p style={{ fontSize: '13px', color: COLORS.textMuted, marginBottom: '2px' }}>
          {meta.isTransport && service.origin ? `${service.origin} → ${service.destination}` : service.destination}
        </p>
        <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '16px' }}>
          {service.companies?.business_name || 'Traveler.com Partner'}
        </p>

        {service.description && (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>Details</p>
            <p style={{ fontSize: '13px', color: COLORS.textMuted, lineHeight: 1.5 }}>{service.description}</p>
          </div>
        )}

        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: COLORS.textMuted }}>Price</span>
            <span style={{ fontSize: '16px', fontWeight: 800, color: COLORS.primary }}>₦{Number(service.price).toLocaleString()}</span>
          </div>
          {service.departure_time && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: COLORS.textMuted }}>Departure</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{new Date(service.departure_time).toLocaleString()}</span>
            </div>
          )}
          {service.seats_available !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: COLORS.textMuted }}>{meta.unitLabel} available</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{service.seats_available}</span>
            </div>
          )}
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
            borderRadius: '10px', padding: '12px', marginBottom: '16px'
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
          disabled={booking}
          style={{
            width: '100%', padding: '15px', background: booking ? '#94a3b8' : COLORS.secondary,
            color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px',
            cursor: booking ? 'not-allowed' : 'pointer'
          }}>
          {booking ? 'Processing...' : `Book Now — ₦${Number(service.price).toLocaleString()}`}
        </button>
      </div>
    </div>
  )
}

export default ServiceDetails
