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

type ServiceDetail = {
  id: string
  photo_url: string | null
  title: string
  description: string | null
  destination: string
  price: number
  seats_available: number | null
  company_id: string
  companies: { business_name: string } | null
}

type RoomType = {
  id: string
  name: string
  price: number
  weekendPrice: number | null
  holidayPrice: number | null
  available: number
}

function generateTicketCode(prefix: string) {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}-${new Date().getFullYear()}-${rand}`
}

function HotelDetails() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [service, setService] = useState<ServiceDetail | null>(null)
  const [userId, setUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)

  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | null>(null)
  const [unitOptions, setUnitOptions] = useState<{ id: string; unit_number: string }[]>([])
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [holidayDates, setHolidayDates] = useState<string[]>([])
  const [checkInDate, setCheckInDate] = useState('')
  const [checkOutDate, setCheckOutDate] = useState('')
  const [activePromo, setActivePromo] = useState<{ title: string; discount_type: string; discount_value: number } | null>(null)

  const [booking, setBooking] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [ticketCode, setTicketCode] = useState('')
  const [assignedUnitNumber, setAssignedUnitNumber] = useState('')

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
        .select('id, title, description, destination, price, seats_available, company_id, photo_url, companies(business_name)')
        .eq('id', id)
        .maybeSingle()

      setService(svc as any)

      const today = new Date().toISOString().split('T')[0]
      const { data: promoRows } = await supabase
        .from('promotions')
        .select('title, discount_type, discount_value, start_date, end_date')
        .eq('service_id', id)
        .eq('active', true)

      const validPromo = (promoRows || []).find((p: any) =>
        (!p.start_date || p.start_date <= today) && (!p.end_date || p.end_date >= today)
      )
      if (validPromo) setActivePromo(validPromo as any)

      // Check if this listing has Inventory room types set up (Premium companies only)
      const { data: items } = await supabase
        .from('inventory_items')
        .select('id, name, price, weekend_price, holiday_price')
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

        const mapped: RoomType[] = items.map((i: any) => ({
          id: i.id,
          name: i.name,
          price: Number(i.price) || 0,
          weekendPrice: i.weekend_price !== null ? Number(i.weekend_price) : null,
          holidayPrice: i.holiday_price !== null ? Number(i.holiday_price) : null,
          available: availCounts[i.id] || 0,
        }))
        setRoomTypes(mapped)

        if (svc) {
          const { data: holidayRows } = await supabase
            .from('company_holidays')
            .select('date')
            .eq('company_id', (svc as any).company_id)
          setHolidayDates((holidayRows || []).map((h: any) => h.date))
        }
      }

      setLoading(false)
    }
    load()
  }, [id, navigate])

  const usingRoomTypes = roomTypes.length > 0
  const selectedRoom = roomTypes.find((r) => r.id === selectedRoomTypeId)

  useEffect(() => {
    const fetchUnits = async () => {
      if (!selectedRoomTypeId) { setUnitOptions([]); setSelectedUnitId(null); return }
      setLoadingUnits(true)
      const { data } = await supabase
        .from('inventory_units')
        .select('id, unit_number')
        .eq('inventory_item_id', selectedRoomTypeId)
        .eq('status', 'available')
        .order('unit_number', { ascending: true })
      setUnitOptions(data || [])
      setSelectedUnitId(data && data.length > 0 ? data[0].id : null)
      setLoadingUnits(false)
    }
    fetchUnits()
  }, [selectedRoomTypeId])

  const nights = (() => {
    if (!checkInDate || !checkOutDate) return 0
    const inD = new Date(checkInDate)
    const outD = new Date(checkOutDate)
    const diff = Math.round((outD.getTime() - inD.getTime()) / 86400000)
    return diff > 0 ? diff : 0
  })()

  const priceForDate = (dateStr: string): number => {
    if (!selectedRoom) return 0
    if (holidayDates.includes(dateStr)) return selectedRoom.holidayPrice ?? selectedRoom.price
    const day = new Date(dateStr).getDay()
    if (day === 0 || day === 6) return selectedRoom.weekendPrice ?? selectedRoom.price
    return selectedRoom.price
  }

  const calculatedTotal = (() => {
    if (!usingRoomTypes) return (service?.price ?? 0) * (nights || 1)
    if (!selectedRoom || nights <= 0) return 0
    let total = 0
    const cursor = new Date(checkInDate)
    for (let i = 0; i < nights; i++) {
      total += priceForDate(cursor.toISOString().split('T')[0])
      cursor.setDate(cursor.getDate() + 1)
    }
    return total
  })()

  const discountedTotal = (() => {
    if (!activePromo || calculatedTotal <= 0) return calculatedTotal
    if (activePromo.discount_type === 'percentage') {
      return Math.max(0, calculatedTotal * (1 - activePromo.discount_value / 100))
    }
    return Math.max(0, calculatedTotal - activePromo.discount_value)
  })()

  const activePrice = discountedTotal

  const handleBookNow = async () => {
    if (!service) return
    setMessage(null)

    if (usingRoomTypes && !selectedUnitId) {
      setMessage({ type: 'error', text: 'This room type just sold out. Please pick another type.' })
      return
    }

    if (!checkInDate || !checkOutDate || nights <= 0) {
      setMessage({ type: 'error', text: 'Please select valid check-in and check-out dates.' })
      return
    }

    if (walletBalance < activePrice) {
      setMessage({ type: 'error', text: 'Insufficient wallet balance. Please top up your wallet first.' })
      return
    }

    setBooking(true)
    const code = generateTicketCode('HTL')

    let assignedUnitId: string | null = null
    let assignedNumber = ''

    if (selectedRoom && selectedUnitId) {
      const chosen = unitOptions.find((u) => u.id === selectedUnitId)
      const { data: claimed } = await supabase
        .from('inventory_units')
        .update({ status: 'occupied' })
        .eq('id', selectedUnitId)
        .eq('status', 'available')
        .select('id, unit_number')
        .maybeSingle()

      if (!claimed) {
        setBooking(false)
        const { data: refreshed } = await supabase
          .from('inventory_units')
          .select('id, unit_number')
          .eq('inventory_item_id', selectedRoom.id)
          .eq('status', 'available')
          .order('unit_number', { ascending: true })
        setUnitOptions(refreshed || [])
        setSelectedUnitId(refreshed && refreshed.length > 0 ? refreshed[0].id : null)
        setMessage({ type: 'error', text: `Room ${chosen?.unit_number || ''} was just taken. Please pick another available number below.` })
        return
      }
      assignedUnitId = claimed.id
      assignedNumber = claimed.unit_number
    }

    const { data: newBooking, error: bookingErr } = await supabase.from('bookings').insert({
      user_id: userId,
      service_id: service.id,
      company_id: service.company_id,
      inventory_item_id: selectedRoom?.id || null,
      quantity: 1,
      amount_paid: activePrice,
      commission_amount: 0,
      booking_status: 'confirmed',
      ticket_code: code,
      customer_name: displayName || null,
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      assigned_unit_number: assignedNumber || null,
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
        <button onClick={() => navigate('/hotels')} style={{ marginTop: '16px', padding: '10px 20px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '10px' }}>
          Back to Hotels
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
                <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '12px', marginBottom: '4px' }}>YOUR ROOM</p>
                <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.primary }}>Room {assignedUnitNumber}</p>
              </>
            )}
          </div>

          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '20px' }}>
            Show this code to the hotel staff on arrival. You can cancel within 15 minutes from "My Bookings".
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
        <span onClick={() => navigate('/hotels')} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Hotel Details</h1>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{
          height: '180px',
          borderRadius: '16px',
          background: service.photo_url ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '56px',
          marginBottom: '16px',
          overflow: 'hidden'
        }}>
          {service.photo_url ? <img src={service.photo_url} alt={service.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🏨'}
        </div>

        <h2 style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>{service.title}</h2>
        <p style={{ fontSize: '13px', color: COLORS.textMuted, marginBottom: '2px' }}>{service.destination}</p>
         <p
          onClick={() => navigate(`/company/${service.company_id}`)}
          style={{ fontSize: '12px', color: COLORS.primary, fontWeight: 600, marginBottom: '16px', cursor: 'pointer' }}>
          {service.companies?.business_name || 'Traveler.com Partner'} →
        </p>

        {service.description && (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>About this place</p>
            <p style={{ fontSize: '13px', color: COLORS.textMuted, lineHeight: 1.5 }}>{service.description}</p>
          </div>
        )}

        {usingRoomTypes ? (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '10px' }}>Select a Room Type</p>
            {roomTypes.map((room) => {
              const isAvailable = room.available > 0
              const isSelected = selectedRoomTypeId === room.id
              return (
                <div
                  key={room.id}
                  onClick={() => isAvailable && setSelectedRoomTypeId(room.id)}
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
                    <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>{room.name}</p>
                    <p style={{ fontSize: '13px', color: COLORS.primary, fontWeight: 700, marginTop: '2px' }}>₦{room.price.toLocaleString()}</p>
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

            {selectedRoom && (
              <div style={{ marginTop: '4px' }}>
                <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, marginBottom: '8px' }}>Pick a Room Number</p>
                {loadingUnits ? (
                  <p style={{ fontSize: '12px', color: COLORS.textMuted }}>Loading available rooms...</p>
                ) : unitOptions.length === 0 ? (
                  <p style={{ fontSize: '12px', color: COLORS.red }}>No rooms available for this type right now.</p>
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
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: COLORS.textMuted }}>Price per night</span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: COLORS.primary }}>₦{service.price.toLocaleString()}</span>
            </div>
            {service.seats_available !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: COLORS.textMuted }}>Rooms available</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{service.seats_available}</span>
              </div>
            )}
          </div>
        )}

        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '10px' }}>Check-in / Check-out</p>
          <div style={{ display: 'flex', gap: '10px', marginBottom: nights > 0 ? '10px' : 0 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>Check-in</p>
              <input
                type="date"
                value={checkInDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setCheckInDate(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>Check-out</p>
              <input
                type="date"
                value={checkOutDate}
                min={checkInDate || new Date().toISOString().split('T')[0]}
                onChange={(e) => setCheckOutDate(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          {activePromo && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px', background: '#F5F3FF',
              border: '1px solid #DDD6FE', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px'
            }}>
              <span style={{ fontSize: '13px' }}>🏷️</span>
              <p style={{ fontSize: '11.5px', fontWeight: 700, color: '#6B21A8' }}>
                {activePromo.title} — {activePromo.discount_type === 'percentage' ? `${activePromo.discount_value}% OFF` : `₦${activePromo.discount_value.toLocaleString()} OFF`}
              </p>
            </div>
          )}
          {nights > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: `1px solid ${COLORS.border}` }}>
              <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>{nights} night{nights > 1 ? 's' : ''} × applicable rate</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {activePromo && (
                  <span style={{ fontSize: '11.5px', color: COLORS.textMuted, textDecoration: 'line-through' }}>₦{calculatedTotal.toLocaleString()}</span>
                )}
                <span style={{ fontSize: '14px', fontWeight: 800, color: COLORS.primary }}>₦{discountedTotal.toLocaleString()}</span>
              </span>
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
          disabled={booking || (usingRoomTypes && !selectedUnitId) || nights <= 0}
          style={{
            width: '100%',
            padding: '15px',
            background: booking || (usingRoomTypes && !selectedUnitId) || nights <= 0 ? '#94a3b8' : COLORS.secondary,
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

export default HotelDetails
