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
  photo_url: string | null
  description: string | null
  origin: string | null
  destination: string
  departure_time: string | null
  price: number
  seats_available: number | null
  company_id: string
  companies: { business_name: string } | null
}

type SeatType = {
  id: string
  name: string
  price: number
  available: number
  occupiedQuantity: number
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

  const [seatTypes, setSeatTypes] = useState<SeatType[]>([])
  const [selectedSeatTypeId, setSelectedSeatTypeId] = useState<string | null>(null)

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
        .select('id, title, description, origin, destination, departure_time, price, seats_available, company_id, photo_url, companies(business_name)')
        .eq('id', id)
        .maybeSingle()

      setService(svc as any)

      // Check if this listing has Inventory seat/ticket types set up (Premium companies only)
      const { data: items } = await supabase
        .from('inventory_items')
        .select('id, name, price, total_quantity, occupied_quantity, reserved_quantity')
        .eq('service_id', id)

      if (items && items.length > 0) {
        const itemIds = items.map((i) => i.id)
        const { data: unitRows } = await supabase
          .from('inventory_units')
          .select('inventory_item_id')
          .in('inventory_item_id', itemIds)

        const maintCounts: Record<string, number> = {}
        ;(unitRows || []).forEach((u: any) => {
          maintCounts[u.inventory_item_id] = (maintCounts[u.inventory_item_id] || 0) + 1
        })

        const mapped: SeatType[] = items.map((i: any) => ({
          id: i.id,
          name: i.name,
          price: Number(i.price) || 0,
          available: i.total_quantity - i.occupied_quantity - i.reserved_quantity - (maintCounts[i.id] || 0),
          occupiedQuantity: i.occupied_quantity,
        }))
        setSeatTypes(mapped)
      }

      setLoading(false)
    }
    load()
  }, [id, navigate])

  const usingSeatTypes = seatTypes.length > 0
  const selectedSeat = seatTypes.find((s) => s.id === selectedSeatTypeId)
  const activePrice = usingSeatTypes ? (selectedSeat?.price ?? 0) : Number(service?.price ?? 0)

  const handleBookNow = async () => {
    if (!service) return
    setMessage(null)

    if (usingSeatTypes && !selectedSeat) {
      setMessage({ type: 'error', text: `Please select a ${meta.unitLabel.toLowerCase().slice(0, -1)} type first.` })
      return
    }

    if (walletBalance < activePrice) {
      setMessage({ type: 'error', text: 'Insufficient wallet balance. Please top up your wallet first.' })
      return
    }

    setBooking(true)
    const code = generateTicketCode(meta.prefix)

    const { error: bookingErr } = await supabase.from('bookings').insert({
      user_id: userId,
      service_id: service.id,
      company_id: service.company_id,
      inventory_item_id: selectedSeat?.id || null,
      quantity: 1,
      amount_paid: activePrice,
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

    if (selectedSeat) {
      await supabase
        .from('inventory_items')
        .update({ occupied_quantity: selectedSeat.occupiedQuantity + 1 })
        .eq('id', selectedSeat.id)
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
          background: service.photo_url ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '56px', marginBottom: '16px', overflow: 'hidden'
        }}>
          {service.photo_url ? <img src={service.photo_url} alt={service.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : meta.icon}
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

        {service.departure_time && (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: COLORS.textMuted }}>Departure</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{new Date(service.departure_time).toLocaleString()}</span>
            </div>
          </div>
        )}

        {usingSeatTypes ? (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '10px' }}>Select a {meta.unitLabel.slice(0, -1)} Type</p>
            {seatTypes.map((seat) => {
              const isAvailable = seat.available > 0
              const isSelected = selectedSeatTypeId === seat.id
              return (
                <div
                  key={seat.id}
                  onClick={() => isAvailable && setSelectedSeatTypeId(seat.id)}
                  style={{
                    background: COLORS.card,
                    borderRadius: '14px',
                    padding: '14px',
                    marginBottom: '10px',
                    border: isSelected ? `2px solid ${COLORS.primary}` : '2px solid transparent',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                    cursor: isAvailable ? 'pointer' : 'not-allowed',
                    opacity: isAvailable ? 1 : 0.5,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>{seat.name}</p>
                    <p style={{ fontSize: '13px', color: COLORS.primary, fontWeight: 700, marginTop: '2px' }}>₦{seat.price.toLocaleString()}</p>
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '5px 10px', borderRadius: '8px',
                    background: isAvailable ? '#f0fdf4' : '#fef2f2',
                    color: isAvailable ? COLORS.green : COLORS.red
                  }}>
                    {isAvailable ? 'Available' : 'Not Available'}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: COLORS.textMuted }}>Price</span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: COLORS.primary }}>₦{Number(service.price).toLocaleString()}</span>
            </div>
            {service.seats_available !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: COLORS.textMuted }}>{meta.unitLabel} available</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{service.seats_available}</span>
              </div>
            )}
          </div>
        )}

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
          disabled={booking || (usingSeatTypes && !selectedSeat)}
          style={{
            width: '100%', padding: '15px', background: booking || (usingSeatTypes && !selectedSeat) ? '#94a3b8' : COLORS.secondary,
            color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px',
            cursor: booking ? 'not-allowed' : 'pointer'
          }}>
          {booking ? 'Processing...' : `Book Now — ₦${activePrice.toLocaleString()}`}
        </button>
      </div>
    </div>
  )
}

export default ServiceDetails
