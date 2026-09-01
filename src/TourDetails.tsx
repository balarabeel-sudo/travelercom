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
  amenities: string[] | null
  capacity: number | null
  companies: { business_name: string; allow_unit_selection: boolean | null } | null
}

const AMENITY_ICON: Record<string, string> = {
  WiFi: 'wifi', Parking: 'parking', Restaurant: 'restaurant', Pool: 'pool', Gym: 'gym',
  'Airport Pickup': 'plane', 'Conference Hall': 'building', Laundry: 'laundry', AC: 'snowflake', Breakfast: 'coffee',
  Meals: 'food', 'Charging Port': 'plug', 'Reclining Seats': 'seat', Toilet: 'toilet',
  'Guide Included': 'compass', 'Transport Included': 'van', 'Meals Included': 'food', Insurance: 'shield',
  Catering: 'restaurant', 'Sound System': 'speaker', Seating: 'seat',
}

type Step = 'details' | 'guest' | 'dates' | 'summary' | 'payment'
const STEP_ORDER: Step[] = ['details', 'guest', 'dates', 'summary', 'payment']

type HallType = {
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

function EventCenterDetails() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [service, setService] = useState<ServiceDetail | null>(null)
  const [userId, setUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)

  const [hallTypes, setHallTypes] = useState<HallType[]>([])
  const [selectedHallTypeId, setSelectedHallTypeId] = useState<string | null>(null)
  const [unitOptions, setUnitOptions] = useState<{ id: string; unit_number: string }[]>([])
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [holidayDates, setHolidayDates] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activePromo, setActivePromo] = useState<{ id: string; title: string; discount_type: string; discount_value: number } | null>(null)

  const [booking, setBooking] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [ticketCode, setTicketCode] = useState('')
  const [assignedUnitNumber, setAssignedUnitNumber] = useState('')

  // --- Booking wizard ---
  const [step, setStep] = useState<Step>('details')
  // Guest info is prefilled from the account and shown for confirmation only —
  // it is not written to the database (bookings table has no email/phone columns).
  const [gName, setGName] = useState('')
  const [gEmail, setGEmail] = useState('')
  const [gPhone, setGPhone] = useState('')
  const [guestErrors, setGuestErrors] = useState<{ name?: string; email?: string; phone?: string }>({})
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'paystack'>('wallet')

  const load = async () => {
      setLoading(true)
      setNetError(false)
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

      const { data: svc, error: svcErr } = await supabase
        .from('services')
        .select('id, title, description, destination, price, seats_available, company_id, photo_url, amenities, capacity, companies(business_name, allow_unit_selection)')
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

      // Check if this listing has Inventory hall types set up (Premium companies only)
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

        const mapped: HallType[] = items.map((i: any) => ({
          id: i.id,
          name: i.name,
          price: Number(i.price) || 0,
          weekendPrice: i.weekend_price !== null ? Number(i.weekend_price) : null,
          holidayPrice: i.holiday_price !== null ? Number(i.holiday_price) : null,
          available: availCounts[i.id] || 0,
        }))
        setHallTypes(mapped)

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

  useEffect(() => {
    load()
  }, [id, navigate])

  const usingHallTypes = hallTypes.length > 0
  const selectedHall = hallTypes.find((r) => r.id === selectedHallTypeId)

  useEffect(() => {
    const fetchUnits = async () => {
      if (!selectedHallTypeId) { setUnitOptions([]); setSelectedUnitId(null); return }
      setLoadingUnits(true)
      const { data } = await supabase
        .from('inventory_units')
        .select('id, unit_number')
        .eq('inventory_item_id', selectedHallTypeId)
        .eq('status', 'available')
        .order('unit_number', { ascending: true })
      setUnitOptions(data || [])
      setSelectedUnitId(data && data.length > 0 ? data[0].id : null)
      setLoadingUnits(false)
    }
    fetchUnits()
  }, [selectedHallTypeId])

  const days = (() => {
    if (!startDate || !endDate) return 0
    const inD = new Date(startDate)
    const outD = new Date(endDate)
    const diff = Math.round((outD.getTime() - inD.getTime()) / 86400000)
    return diff > 0 ? diff : (startDate === endDate && startDate ? 1 : 0)
  })()

  const priceForDate = (dateStr: string): number => {
    if (!selectedHall) return 0
    if (holidayDates.includes(dateStr)) return selectedHall.holidayPrice ?? selectedHall.price
    const day = new Date(dateStr).getDay()
    if (day === 0 || day === 6) return selectedHall.weekendPrice ?? selectedHall.price
    return selectedHall.price
  }

  const calculatedTotal = (() => {
    if (!usingHallTypes) return (service?.price ?? 0) * (days || 1)
    if (!selectedHall || days <= 0) return 0
    let total = 0
    const cursor = new Date(startDate)
    for (let i = 0; i < days; i++) {
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
    if (idx <= 0) navigate('/event-centers')
    else setStep(STEP_ORDER[idx - 1])
  }

  const canContinueFromDetails = usingHallTypes
    ? !!selectedHallTypeId && (service?.companies?.allow_unit_selection === false || !!selectedUnitId)
    : true

  // Branded, Opay-style receipt image — built only from real confirmed booking data.
  const downloadReceipt = () => {
    if (!service) return
    downloadReceiptImage({
      serviceName: service.title,
      subtitle: service.destination,
      bookingReference: ticketCode,
      amountPaid: activePrice,
      paymentDate: new Date().toLocaleString(),
      filenamePrefix: 'EventCenter',
      rows: [
        { label: 'Hall', value: selectedHall?.name || 'Standard' },
        { label: 'Start date', value: startDate },
        { label: 'End date', value: endDate },
        { label: 'Duration', value: `${days} day${days > 1 ? 's' : ''}` },
        { label: 'Customer', value: gName },
        { label: 'Email', value: gEmail },
        { label: 'Phone', value: gPhone },
      ],
    })
  }

  const handleBookNow = async () => {
    if (!service) return
    setMessage(null)

    if (usingHallTypes && !selectedUnitId) {
      setMessage({ type: 'error', text: 'This hall type just sold out. Please pick another type.' })
      return
    }

    if (!startDate || !endDate || days <= 0) {
      setMessage({ type: 'error', text: 'Please select a valid event start and end date.' })
      return
    }

    if (walletBalance < activePrice) {
      setMessage({ type: 'error', text: 'Insufficient wallet balance. Please top up your wallet first.' })
      return
    }

    setBooking(true)
    const code = generateTicketCode('EVT')

    let assignedUnitId: string | null = null
    let assignedNumber = ''

    if (selectedHall && selectedUnitId) {
      const chosen = unitOptions.find((u) => u.id === selectedUnitId)
      const { data: claimedRows } = await supabase.rpc('claim_inventory_unit', { p_unit_id: selectedUnitId })
      const claimed = claimedRows && claimedRows.length > 0 ? claimedRows[0] : null

      if (!claimed) {
        setBooking(false)
        const { data: refreshed } = await supabase
          .from('inventory_units')
          .select('id, unit_number')
          .eq('inventory_item_id', selectedHall.id)
          .eq('status', 'available')
          .order('unit_number', { ascending: true })
        setUnitOptions(refreshed || [])
        setSelectedUnitId(refreshed && refreshed.length > 0 ? refreshed[0].id : null)
        setMessage({ type: 'error', text: `Hall ${chosen?.unit_number || ''} was just taken. Please pick another available option below.` })
        return
      }
      assignedUnitId = claimed.id
      assignedNumber = claimed.unit_number
    }

    const { data: newBooking, error: bookingErr } = await supabase.from('bookings').insert({
      user_id: userId,
      service_id: service.id,
      company_id: service.company_id,
      inventory_item_id: selectedHall?.id || null,
      quantity: 1,
      amount_paid: activePrice,
      commission_amount: 0,
      booking_status: 'confirmed',
      ticket_code: code,
      customer_name: displayName || null,
      check_in_date: startDate,
      check_out_date: endDate,
      promotion_id: activePromo?.id || null,
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
    } else if (!usingHallTypes && service.seats_available !== null && service.seats_available > 0) {
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

  if (netError) {
    return <NetworkError onRetry={load} />
  }

  if (loading) {
    return <DetailsSkeleton />
  }

  if (!service) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', padding: '20px', textAlign: 'center' }}>
        <p style={{ color: COLORS.textMuted, fontSize: '14px', marginTop: '40px' }}>Listing not found.</p>
        <button onClick={() => navigate('/event-centers')} style={{ marginTop: '16px', padding: '10px 20px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '10px' }}>
          Back to Event Centers
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
              {assignedUnitNumber && (
                <>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '10px', marginBottom: '4px' }}>YOUR HALL</p>
                  <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.primary }}>{assignedUnitNumber}</p>
                </>
              )}
            </div>
            <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: '10px', display: 'flex', flexDirection: 'column' as const, gap: '6px' }}>
              <SummaryRow label="Customer" value={gName} />
              <SummaryRow label="Event date" value={startDate} />
              <SummaryRow label="End date" value={endDate} />
              <SummaryRow label="Duration" value={`${days} day${days > 1 ? 's' : ''}`} />
              <SummaryRow label="Hall" value={selectedHall?.name || 'Standard'} />
              <SummaryRow label="Total paid" value={`₦${activePrice.toLocaleString()}`} bold />
              <SummaryRow label="Status" value="Confirmed" valueColor={COLORS.green} />
            </div>
          </div>

          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '14px' }}>
            Show this code to the venue staff on arrival. You can cancel within 15 minutes from "My Bookings".
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
        <span onClick={goBack} style={{ display: 'flex', cursor: 'pointer' }}><Icon name="arrowLeft" size={20} color={COLORS.text} /></span>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>
          {step === 'details' && 'Event Center Details'}
          {step === 'guest' && 'Your Information'}
          {step === 'dates' && 'Select Event Date'}
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
          {service.photo_url ? <img src={service.photo_url} alt={service.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="tent" size={56} color="white" />}
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
        {service.capacity != null && (
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Icon name="user" size={12} color={COLORS.textMuted} /> {service.capacity.toLocaleString()} people capacity
          </p>
        )}
        <p
          onClick={() => navigate(`/company/${service.company_id}`)}
          style={{ fontSize: '12px', color: COLORS.primary, fontWeight: 700, marginBottom: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {service.companies?.business_name || 'Traveler.com Partner'} <Icon name="chevronRight" size={12} color={COLORS.primary} />
        </p>

        {service.description && (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>About this venue</p>
            <p style={{ fontSize: '13px', color: COLORS.textMuted, lineHeight: 1.5 }}>{service.description}</p>
          </div>
        )}

        {service.amenities && service.amenities.length > 0 && (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '10px' }}>Amenities</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {service.amenities.map((a) => (
                <div key={a} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Icon name={AMENITY_ICON[a] || 'check'} size={14} color={COLORS.textMuted} />
                  <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>{a}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {usingHallTypes ? (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '10px' }}>Select a Hall / Package</p>
            {hallTypes.map((hall) => {
              const isAvailable = hall.available > 0
              const isSelected = selectedHallTypeId === hall.id
              return (
                <div
                  key={hall.id}
                  onClick={() => isAvailable && setSelectedHallTypeId(hall.id)}
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
                    <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>{hall.name}</p>
                    <p style={{ fontSize: '13px', color: COLORS.primary, fontWeight: 700, marginTop: '2px' }}>₦{hall.price.toLocaleString()}</p>
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

            {selectedHall && (() => {
              const allowPicking = service.companies?.allow_unit_selection ?? true
              return (
              <div style={{ marginTop: '4px' }}>
                {allowPicking ? (
                  <>
                    <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, marginBottom: '8px' }}>Pick a Hall Number</p>
                    {loadingUnits ? (
                      <p style={{ fontSize: '12px', color: COLORS.textMuted }}>Loading available halls...</p>
                    ) : unitOptions.length === 0 ? (
                      <p style={{ fontSize: '12px', color: COLORS.red }}>No halls available for this type right now.</p>
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
                    {loadingUnits ? 'Checking availability...' : unitOptions.length === 0 ? 'No halls available for this type right now.' : 'A hall will be assigned automatically at booking.'}
                  </p>
                )}
              </div>
              )
            })()}
          </div>
        ) : (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: COLORS.textMuted }}>Price per day</span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: COLORS.primary }}>₦{service.price.toLocaleString()}</span>
            </div>
            {service.seats_available !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: COLORS.textMuted }}>Slots available</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{service.seats_available}</span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setStep('guest')}
          disabled={!canContinueFromDetails}
          style={{
            width: '100%', padding: '15px', background: canContinueFromDetails ? COLORS.secondary : '#94a3b8',
            color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px',
            cursor: canContinueFromDetails ? 'pointer' : 'not-allowed',
          }}>
          Book Now
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
          <div style={{ display: 'flex', gap: '10px', marginBottom: days > 0 ? '10px' : 0 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>Event start date</p>
              <input
                type="date"
                value={startDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>Event end date</p>
              <input
                type="date"
                value={endDate}
                min={startDate || new Date().toISOString().split('T')[0]}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          {endDate && startDate && days <= 0 && (
            <p style={{ fontSize: '11.5px', color: COLORS.red, marginBottom: '8px' }}>End date must be on or after the start date.</p>
          )}
          {activePromo && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px', background: '#F5F3FF',
              border: '1px solid #DDD6FE', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px'
            }}>
              <span style={{ display: 'flex' }}><Icon name="tag" size={13} color="#6B21A8" /></span>
              <p style={{ fontSize: '11.5px', fontWeight: 700, color: '#6B21A8' }}>
                {activePromo.title} — {activePromo.discount_type === 'percentage' ? `${activePromo.discount_value}% OFF` : `₦${activePromo.discount_value.toLocaleString()} OFF`}
              </p>
            </div>
          )}
          {days > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: `1px solid ${COLORS.border}` }}>
              <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>{days} day{days > 1 ? 's' : ''} × applicable rate</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {activePromo && (
                  <span style={{ fontSize: '11.5px', color: COLORS.textMuted, textDecoration: 'line-through' }}>₦{calculatedTotal.toLocaleString()}</span>
                )}
                <span style={{ fontSize: '14px', fontWeight: 800, color: COLORS.primary }}>₦{discountedTotal.toLocaleString()}</span>
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => setStep('summary')}
          disabled={days <= 0}
          style={{ width: '100%', padding: '15px', background: days > 0 ? COLORS.secondary : '#94a3b8', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: days > 0 ? 'pointer' : 'not-allowed' }}>
          Continue
        </button>
      </>)}

      {step === 'summary' && (<>
        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' as const, gap: '14px' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase' as const, marginBottom: '6px' }}>Event Center</p>
            <SummaryRow label="Name" value={service.title} />
            <SummaryRow label="Location" value={service.destination} />
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase' as const, marginBottom: '6px' }}>Customer</p>
            <SummaryRow label="Full Name" value={gName} />
            <SummaryRow label="Email" value={gEmail} />
            <SummaryRow label="Phone" value={gPhone} />
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase' as const, marginBottom: '6px' }}>Event</p>
            <SummaryRow label="Start date" value={startDate} />
            <SummaryRow label="End date" value={endDate} />
            <SummaryRow label="Duration" value={`${days} day${days > 1 ? 's' : ''}`} />
            <SummaryRow label="Hall" value={selectedHall?.name || 'Standard'} />
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase' as const, marginBottom: '6px' }}>Price Breakdown</p>
            <SummaryRow label={`Venue × ${days} day${days > 1 ? 's' : ''}`} value={`₦${calculatedTotal.toLocaleString()}`} />
            {activePromo && (
              <SummaryRow label={activePromo.title} value={`− ₦${(calculatedTotal - discountedTotal).toLocaleString()}`} valueColor={COLORS.green} />
            )}
            <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: '4px', paddingTop: '8px' }}>
              <SummaryRow label="Total Amount" value={`₦${discountedTotal.toLocaleString()}`} bold />
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
            <span style={{ fontSize: '13px', color: COLORS.textMuted }}>Booking Total</span>
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
    { key: 'dates', label: 'Date & Time' },
    { key: 'summary', label: 'Review' },
    { key: 'payment', label: 'Payment' },
  ]
  const currentIdx = labels.findIndex((l) => l.key === step)
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', background: '#FFFFFF', gap: '4px' }}>
      {labels.map((l, i) => (
        <div key={l.key} style={{ display: 'flex', alignItems: 'center', flex: i < labels.length - 1 ? 1 : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: i <= currentIdx ? COLORS_LOCAL.primary : COLORS_LOCAL.border,
              color: i <= currentIdx ? 'white' : COLORS_LOCAL.textMuted,
              fontSize: '10px', fontWeight: 700, flexShrink: 0,
            }}>
              {i + 1}
            </div>
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: i <= currentIdx ? COLORS_LOCAL.text : COLORS_LOCAL.textMuted, whiteSpace: 'nowrap' as const }}>{l.label}</span>
          </div>
          {i < labels.length - 1 && <div style={{ flex: 1, height: '1px', background: i < currentIdx ? COLORS_LOCAL.primary : COLORS_LOCAL.border, margin: '0 6px' }} />}
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

export default EventCenterDetails
