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
  companies: { business_name: string; allow_unit_selection: boolean | null } | null
}

type SeatType = {
  id: string
  name: string
  price: number
  available: number
}

function generateTicketCode(prefix: string) {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}-${new Date().getFullYear()}-${rand}`
}

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
  const [unitOptions, setUnitOptions] = useState<{ id: string; unit_number: string }[]>([])
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [loadingUnits, setLoadingUnits] = useState(false)

  const [booking, setBooking] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [ticketCode, setTicketCode] = useState('')
  const [assignedUnitNumber, setAssignedUnitNumber] = useState('')
  const [activePromo, setActivePromo] = useState<{ id: string; title: string; discount_type: string; discount_value: number } | null>(null)
  const [idType, setIdType] = useState<string>(ID_TYPES[0])
  const [idNumber, setIdNumber] = useState('')

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
        .select('id, title, description, origin, destination, departure_time, price, seats_available, company_id, photo_url, companies(business_name, allow_unit_selection)')
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

      // Check if this listing has Inventory seat/ticket types set up (Premium companies only)
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
          if (u.status === 'available') {
            availCounts[u.inventory_item_id] = (availCounts[u.inventory_item_id] || 0) + 1
          }
        })

        const mapped: SeatType[] = items.map((i: any) => ({
          id: i.id,
          name: i.name,
          price: Number(i.price) || 0,
          available: availCounts[i.id] || 0,
        }))
        setSeatTypes(mapped)
      }

      setLoading(false)
    }
    load()
  }, [id, navigate])

  const usingSeatTypes = seatTypes.length > 0
  const selectedSeat = seatTypes.find((s) => s.id === selectedSeatTypeId)
  const baseSeatPrice = usingSeatTypes ? (selectedSeat?.price ?? 0) : Number(service?.price ?? 0)

  useEffect(() => {
    const fetchUnits = async () => {
      if (!selectedSeatTypeId) { setUnitOptions([]); setSelectedUnitId(null); return }
      setLoadingUnits(true)
      const { data } = await supabase
        .from('inventory_units')
        .select('id, unit_number')
        .eq('inventory_item_id', selectedSeatTypeId)
        .eq('status', 'available')
        .order('unit_number', { ascending: true })
      setUnitOptions(data || [])
      setSelectedUnitId(data && data.length > 0 ? data[0].id : null)
      setLoadingUnits(false)
    }
    fetchUnits()
  }, [selectedSeatTypeId])
  const activePrice = (() => {
    if (!activePromo || baseSeatPrice <= 0) return baseSeatPrice
    if (activePromo.discount_type === 'percentage') {
      return Math.max(0, baseSeatPrice * (1 - activePromo.discount_value / 100))
    }
    return Math.max(0, baseSeatPrice - activePromo.discount_value)
  })()

  const handleBookNow = async () => {
    if (!service) return
    setMessage(null)

    if (usingSeatTypes && !selectedUnitId) {
      setMessage({ type: 'error', text: `This ${meta.unitLabel.toLowerCase().slice(0, -1)} type just sold out. Please pick another.` })
      return
    }

    if (meta.isTransport && !isIdFormatValid(idType, idNumber)) {
      setMessage({ type: 'error', text: `Please enter a valid ${idType} number before booking.` })
      return
    }

    if (walletBalance < activePrice) {
      setMessage({ type: 'error', text: 'Insufficient wallet balance. Please top up your wallet first.' })
      return
    }

    setBooking(true)
    const code = generateTicketCode(meta.prefix)

    let assignedUnitId: string | null = null
    let assignedNumber = ''

    if (selectedSeat && selectedUnitId) {
      const chosen = unitOptions.find((u) => u.id === selectedUnitId)
      const { data: claimedRows } = await supabase.rpc('claim_inventory_unit', { p_unit_id: selectedUnitId })
      const claimed = claimedRows && claimedRows.length > 0 ? claimedRows[0] : null

      if (!claimed) {
        setBooking(false)
        const { data: refreshed } = await supabase
          .from('inventory_units')
          .select('id, unit_number')
          .eq('inventory_item_id', selectedSeat.id)
          .eq('status', 'available')
          .order('unit_number', { ascending: true })
        setUnitOptions(refreshed || [])
        setSelectedUnitId(refreshed && refreshed.length > 0 ? refreshed[0].id : null)
        setMessage({ type: 'error', text: `${meta.unitLabel.slice(0, -1)} ${chosen?.unit_number || ''} was just taken. Please pick another available option.` })
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
      amount_paid: activePrice,
      commission_amount: 0,
      booking_status: 'confirmed',
      ticket_code: code,
      customer_name: displayName || null,
      assigned_unit_number: assignedNumber || null,
      promotion_id: activePromo?.id || null,
      id_type: meta.isTransport ? idType : null,
      id_number: meta.isTransport ? idNumber.trim() : null,
    }).select('id').single()

    if (bookingErr) {
      if (assignedUnitId) {
        await supabase.from('inventory_units').update({ status: 'available' }).eq('id', assignedUnitId)
      }
      setBooking(false)
      setMessage({ type: 'error', text: 'Booking failed: ' + bookingErr.message })
      return
    }

    if (assignedUnitId) {
      await supabase
        .from('inventory_units')
        .update({ booking_id: newBooking?.id || null })
        .eq('id', assignedUnitId)
    } else if (!usingSeatTypes && service.seats_available !== null && service.seats_available > 0) {
      const { data: newCount, error: decErr } = await supabase.rpc('decrement_seats', { p_service_id: service.id })
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

    setBooking(false)
    setWalletBalance(newBalance)
    setAssignedUnitNumber(assignedNumber)
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
            {assignedUnitNumber && (
              <>
                <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '12px', marginBottom: '4px' }}>YOUR {meta.unitLabel.slice(0, -1).toUpperCase()}</p>
                <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.primary }}>{meta.unitLabel.slice(0, -1)} {assignedUnitNumber}</p>
              </>
            )}
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
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '56px', marginBottom: '16px', overflow: 'hidden',
          position: 'relative'
        }}>
          {service.photo_url ? <img src={service.photo_url} alt={service.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : meta.icon}
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
        <p style={{ fontSize: '13px', color: COLORS.textMuted, marginBottom: '2px' }}>
          {meta.isTransport && service.origin ? `${service.origin} → ${service.destination}` : service.destination}
        </p>
        <p
          onClick={() => navigate(`/company/${service.company_id}`)}
          style={{ fontSize: '12px', color: COLORS.primary, fontWeight: 700, marginBottom: '16px', cursor: 'pointer' }}>
          {service.companies?.business_name || 'Traveler.com Partner'} →
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

        {activePromo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px', background: '#F5F3FF',
            border: '1px solid #DDD6FE', borderRadius: '8px', padding: '8px 10px', marginBottom: '16px'
          }}>
            <span style={{ fontSize: '13px' }}>🏷️</span>
            <p style={{ fontSize: '11.5px', fontWeight: 700, color: '#6B21A8' }}>
              {activePromo.title} — {activePromo.discount_type === 'percentage' ? `${activePromo.discount_value}% OFF` : `₦${activePromo.discount_value.toLocaleString()} OFF`}
            </p>
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

            {selectedSeat && (() => {
              const allowPicking = service.companies?.allow_unit_selection ?? true
              return (
              <div style={{ marginTop: '4px' }}>
                {allowPicking ? (
                  <>
                    <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, marginBottom: '8px' }}>Pick a {meta.unitLabel.slice(0, -1)} Number</p>
                    {loadingUnits ? (
                      <p style={{ fontSize: '12px', color: COLORS.textMuted }}>Loading available options...</p>
                    ) : unitOptions.length === 0 ? (
                      <p style={{ fontSize: '12px', color: COLORS.red }}>None available for this type right now.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {unitOptions.map((u) => (
                          <div
                            key={u.id}
                            onClick={() => setSelectedUnitId(u.id)}
                            style={{
                              minWidth: '44px', padding: '9px 6px', textAlign: 'center', borderRadius: '9px', cursor: 'pointer',
                              background: selectedUnitId === u.id ? COLORS.primary : COLORS.card,
                              color: selectedUnitId === u.id ? 'white' : COLORS.text,
                              border: `1.5px solid ${selectedUnitId === u.id ? COLORS.primary : COLORS.border}`,
                              fontWeight: 700, fontSize: '13px'
                            }}>
                            {u.unit_number}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: '12px', color: COLORS.textMuted, fontStyle: 'italic' as const }}>
                    {loadingUnits ? 'Checking availability...' : unitOptions.length === 0 ? 'None available for this type right now.' : `A ${meta.unitLabel.slice(0, -1).toLowerCase()} will be assigned automatically at booking.`}
                  </p>
                )}
              </div>
              )
            })()}
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

        {meta.isTransport && (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '10px' }}>Identity Verification</p>
            <select
              value={idType}
              onChange={(e) => { setIdType(e.target.value); setIdNumber('') }}
              style={{ width: '100%', padding: '11px', border: `1px solid ${COLORS.border}`, borderRadius: '9px', fontSize: '13.5px', marginBottom: '8px', boxSizing: 'border-box' as const }}>
              {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              type="text"
              placeholder={`Enter your ${idType} number`}
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              style={{ width: '100%', padding: '11px', border: `1px solid ${COLORS.border}`, borderRadius: '9px', fontSize: '13.5px', boxSizing: 'border-box' as const }}
            />
            {idNumber.trim().length > 0 && (
              <p style={{ fontSize: '11.5px', fontWeight: 700, marginTop: '6px', color: isIdFormatValid(idType, idNumber) ? COLORS.green : COLORS.red }}>
                {isIdFormatValid(idType, idNumber) ? '✅ Format valid' : '❌ Format invalid — check the number'}
              </p>
            )}
            <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '6px' }}>
              This checks the number format only — it does not confirm the ID with a government database.
            </p>
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
          disabled={booking || (usingSeatTypes && !selectedUnitId) || (meta.isTransport && !isIdFormatValid(idType, idNumber))}
          style={{
            width: '100%', padding: '15px',
            background: booking || (usingSeatTypes && !selectedUnitId) || (meta.isTransport && !isIdFormatValid(idType, idNumber)) ? '#94a3b8' : COLORS.secondary,
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
