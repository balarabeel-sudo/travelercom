import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import { findAvailableUnit } from './inventoryUtils'
import { DetailsSkeleton } from './LoadingSkeleton'
import NetworkError from './NetworkError'

const COLORS = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  primary: '#0EA5E9',
  secondary: '#F97316',
  purple: '#6B21A8',
  text: '#0F172A',
  textMuted: '#64748B',
  green: '#16A34A',
  red: '#DC2626',
}

const PREFIX_MAP: Record<string, string> = {
  hotel: 'HTL', bus: 'BUS', train: 'TRN', flight: 'ALN', tour: 'TUR', event_center: 'EVT', vehicle_rental: 'VHR',
}
const UNIT_LABELS: Record<string, string> = {
  hotel: 'Room', bus: 'Seat', train: 'Seat', flight: 'Seat', tour: 'Slot', event_center: 'Ticket', vehicle_rental: 'Vehicle',
}
const DETAIL_PLACEHOLDER: Record<string, string> = {
  bus: 'Route (e.g. Lagos → Abuja), travel date',
  train: 'Route, travel date',
  flight: 'Route, flight date',
  tour: 'Tour date, no. of participants',
  event_center: 'Event date',
}
// Categories that book a date range (check-in/out or pickup/return) with
// per-day pricing and date-safe inventory claiming, instead of a single
// free-text detail + manual amount.
const DATE_RANGE_LABELS: Record<string, { unit: string; start: string; end: string }> = {
  hotel: { unit: 'Night', start: 'Check-in Date', end: 'Check-out Date' },
  vehicle_rental: { unit: 'Day', start: 'Pickup Date', end: 'Return Date' },
}
const CATEGORY_ICON: Record<string, string> = {
  hotel: 'hotel', bus: 'bus', train: 'bus', flight: 'plane', tour: 'map', event_center: 'tent', vehicle_rental: 'car',
}

type ServiceOption = { id: string; title: string; category: string; commission_rate: number | null; price: number; photo_url: string | null }
type InvType = { id: string; name: string; price: number; weekendPrice: number | null; holidayPrice: number | null; available: number; availableFrom: string | null }

export default function AddGuest() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [services, setServices] = useState<ServiceOption[]>([])
  const [serviceId, setServiceId] = useState('')
  const [showServicePicker, setShowServicePicker] = useState(false)

  const [invTypes, setInvTypes] = useState<InvType[]>([])
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [loadingTypes, setLoadingTypes] = useState(false)

  const [activePromo, setActivePromo] = useState<{ title: string; discount_type: string; discount_value: number } | null>(null)
  const [holidayDates, setHolidayDates] = useState<string[]>([])

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')

  const [checkInDate, setCheckInDate] = useState('')
  const [checkOutDate, setCheckOutDate] = useState('')
  const [nights, setNights] = useState(1)
  const [bookingDetails, setBookingDetails] = useState('')
  const [amountOverride, setAmountOverride] = useState('')

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'pos'>('cash')
  const [saving, setSaving] = useState(false)
  const [successCode, setSuccessCode] = useState<string | null>(null)
  const [assignedUnitNumber, setAssignedUnitNumber] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const load = async () => {
    setNetError(false)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { navigate('/login'); return }

    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', userData.user.id)
      .maybeSingle()

    if (companyErr) { setNetError(true); setLoading(false); return }

    let resolvedCompanyId: string | null = company?.id || null
    if (!resolvedCompanyId) {
      const { data: staffRow } = await supabase
        .from('company_staff')
        .select('company_id')
        .eq('user_id', userData.user.id)
        .eq('status', 'active')
        .maybeSingle()
      if (staffRow) resolvedCompanyId = staffRow.company_id
    }

    if (!resolvedCompanyId) { setLoading(false); return }
    setCompanyId(resolvedCompanyId)

    const { data: serviceRows, error: servicesErr } = await supabase
      .from('services')
      .select('id, title, category, commission_rate, price, photo_url')
      .eq('company_id', resolvedCompanyId)

    if (servicesErr) { setNetError(true); setLoading(false); return }

    setServices(serviceRows || [])
    if (serviceRows && serviceRows.length > 0) setServiceId(serviceRows[0].id)
    setLoading(false)
  }

  useEffect(() => { load() }, [navigate])

  const selectedService = services.find((s) => s.id === serviceId)
  const category = selectedService?.category || 'hotel'
  const dateRangeLabels = DATE_RANGE_LABELS[category]
  const isDateRange = !!dateRangeLabels
  const unitLabel = UNIT_LABELS[category] || 'Item'
  const usingTypes = invTypes.length > 0
  const selectedType = invTypes.find((t) => t.id === selectedTypeId)

  useEffect(() => {
    const loadTypesAndPromo = async () => {
      if (!serviceId) { setInvTypes([]); setSelectedTypeId(null); return }
      setLoadingTypes(true)

      const { data: items } = await supabase
        .from('inventory_items')
        .select('id, name, price, weekend_price, holiday_price, total_quantity')
        .eq('service_id', serviceId)

      if (items && items.length > 0) {
        let mapped: InvType[]

        if (isDateRange && checkInDate && checkOutDate) {
          mapped = await Promise.all(items.map(async (i: any) => {
            const result = await findAvailableUnit(i.id, checkInDate, checkOutDate)
            return {
              id: i.id,
              name: i.name,
              price: Number(i.price) || 0,
              weekendPrice: i.weekend_price !== null ? Number(i.weekend_price) : null,
              holidayPrice: i.holiday_price !== null ? Number(i.holiday_price) : null,
              available: result.available ? 1 : 0,
              availableFrom: result.available ? null : result.availableFrom,
            }
          }))
        } else {
          // Dates not chosen yet (or not a hotel category) — the real check happens
          // again at save time regardless, this is just so the list isn't empty.
          mapped = items.map((i: any) => ({
            id: i.id,
            name: i.name,
            price: Number(i.price) || 0,
            weekendPrice: i.weekend_price !== null ? Number(i.weekend_price) : null,
            holidayPrice: i.holiday_price !== null ? Number(i.holiday_price) : null,
            available: 1,
            availableFrom: null,
          }))
        }

        setInvTypes(mapped)
        setSelectedTypeId(mapped[0]?.id || null)
      } else {
        setInvTypes([])
        setSelectedTypeId(null)
      }

      const today = new Date().toISOString().split('T')[0]
      const { data: promoRows } = await supabase
        .from('promotions')
        .select('title, discount_type, discount_value, start_date, end_date')
        .eq('service_id', serviceId)
        .eq('active', true)
      const validPromo = (promoRows || []).find((p: any) => (!p.start_date || p.start_date <= today) && (!p.end_date || p.end_date >= today))
      setActivePromo(validPromo ? (validPromo as any) : null)

      if (companyId) {
        const { data: holidayRows } = await supabase.from('company_holidays').select('date').eq('company_id', companyId)
        setHolidayDates((holidayRows || []).map((h: any) => h.date))
      }

      setLoadingTypes(false)
    }
    loadTypesAndPromo()
  }, [serviceId, companyId, checkInDate, checkOutDate, isDateRange])

  // keep checkout in sync with nights whenever check-in or nights changes
  useEffect(() => {
    if (!checkInDate) return
    const d = new Date(checkInDate)
    d.setDate(d.getDate() + nights)
    setCheckOutDate(d.toISOString().split('T')[0])
  }, [checkInDate, nights])

  const priceForDate = (dateStr: string): number => {
    if (!selectedType) return 0
    if (holidayDates.includes(dateStr)) return selectedType.holidayPrice ?? selectedType.price
    const day = new Date(dateStr).getDay()
    if (day === 0 || day === 6) return selectedType.weekendPrice ?? selectedType.price
    return selectedType.price
  }

  const rawTotal = (() => {
    if (isDateRange) {
      if (usingTypes && selectedType) {
        if (!checkInDate || nights <= 0) return 0
        let total = 0
        const cursor = new Date(checkInDate)
        for (let i = 0; i < nights; i++) {
          total += priceForDate(cursor.toISOString().split('T')[0])
          cursor.setDate(cursor.getDate() + 1)
        }
        return total
      }
      return (selectedService?.price || 0) * (nights || 1)
    }
    return amountOverride ? parseFloat(amountOverride) : 0
  })()

  const finalTotal = (() => {
    if (!activePromo || rawTotal <= 0) return rawTotal
    if (activePromo.discount_type === 'percentage') return Math.max(0, rawTotal * (1 - activePromo.discount_value / 100))
    return Math.max(0, rawTotal - activePromo.discount_value)
  })()

  const canSave = companyId && serviceId && customerName.trim() && customerPhone.trim() &&
    (isDateRange ? checkInDate && checkOutDate && nights > 0 : !!amountOverride) &&
    (!usingTypes || (selectedType && selectedType.available > 0))

  const handleSave = async () => {
    if (!canSave || !companyId) return
    setSaving(true)
    setErrorMsg('')

    const category = selectedService?.category || 'hotel'
    const prefix = PREFIX_MAP[category] || 'TRV'
    const year = new Date().getFullYear()
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    const ticketCode = `${prefix}-${year}-${random}`
    const rate = Number(selectedService?.commission_rate ?? 3)
    const amount = isDateRange ? finalTotal : (activePromo ? finalTotal : parseFloat(amountOverride))
    const commission = amount * (rate / 100)

    let assignedUnitId: string | null = null
    let assignedNumber = ''

    if (selectedType && isDateRange) {
      const { data: claimed, error: claimErr } = await supabase.rpc('claim_inventory_unit_for_dates', {
        p_item_id: selectedType.id, p_check_in: checkInDate, p_check_out: checkOutDate,
      })
      if (claimErr) {
        setSaving(false)
        setErrorMsg('Could not check availability: ' + claimErr.message)
        return
      }
      const claimedUnit = claimed?.[0]
      if (!claimedUnit) {
        setSaving(false)
        const preview = await findAvailableUnit(selectedType.id, checkInDate, checkOutDate)
        setErrorMsg(
          !preview.available && preview.availableFrom
            ? `No ${unitLabel.toLowerCase()} of this type free for these dates — the next one becomes available from ${new Date(preview.availableFrom).toLocaleDateString()}.`
            : `No available ${unitLabel.toLowerCase()} of this type right now. Please pick a different type.`
        )
        return
      }
      assignedUnitId = claimedUnit.id
      assignedNumber = claimedUnit.unit_number
    } else if (selectedType) {
      const { data: freeUnit, error: freeUnitErr } = await supabase
        .from('inventory_units')
        .select('id, unit_number')
        .eq('inventory_item_id', selectedType.id)
        .eq('status', 'available')
        .order('unit_number', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (freeUnitErr) {
        setSaving(false)
        setErrorMsg('Could not check availability: ' + freeUnitErr.message)
        return
      }
      if (!freeUnit) {
        setSaving(false)
        setErrorMsg(`No available ${unitLabel.toLowerCase()} of this type right now. Please pick a different type.`)
        return
      }
      assignedUnitId = freeUnit.id
      assignedNumber = freeUnit.unit_number
    }

    const { data: newBooking, error } = await supabase.from('bookings').insert({
      service_id: serviceId,
      company_id: companyId,
      inventory_item_id: selectedType?.id || null,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_email: customerEmail.trim() || null,
      quantity: 1,
      amount_paid: amount,
      commission_amount: commission,
      booking_status: 'confirmed',
      booking_source: 'offline',
      payment_method: paymentMethod,
      booking_details: isDateRange ? null : bookingDetails.trim() || null,
      check_in_date: isDateRange ? checkInDate : null,
      check_out_date: isDateRange ? checkOutDate : null,
      ticket_code: ticketCode,
      checked_in: true,
      checked_in_at: new Date().toISOString(),
      assigned_unit_number: assignedNumber || null,
    }).select('id').single()

    if (error) {
      setSaving(false)
      setErrorMsg(error.message)
      return
    }

    if (assignedUnitId && !isDateRange) {
      const { error: unitErr } = await supabase.from('inventory_units').update({ status: 'occupied', booking_id: newBooking?.id || null }).eq('id', assignedUnitId)
      if (unitErr) {
        // Booking already saved successfully -- don't block success on this,
        // but surface it so the mismatch (unit still shows "available") can be fixed manually.
        setErrorMsg(`Booking saved, but the ${unitLabel.toLowerCase()} status could not be updated: ${unitErr.message}`)
      }
    }

    setSaving(false)
    setSuccessCode(ticketCode)
    setAssignedUnitNumber(assignedNumber)
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setCheckInDate('')
    setNights(1)
    setBookingDetails('')
    setAmountOverride('')
    setPaymentMethod('cash')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ padding: '18px 20px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Guest</h1>
        </div>
        <DetailsSkeleton />
      </div>
    )
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ padding: '18px 20px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Guest</h1>
        </div>
        <NetworkError onRetry={() => { setLoading(true); load() }} />
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
        <div>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Guest</h1>
          <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Add walk-in guest & record payment</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        {successCode && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '16px', marginBottom: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.green, marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Icon name="checkCircle" size={15} color={COLORS.green} /> Guest booking saved
            </p>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{successCode}</p>
            {assignedUnitNumber && <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.purple, marginTop: '4px' }}>Assigned: {unitLabel} {assignedUnitNumber}</p>}
          </div>
        )}

        {services.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted }}>
            You need at least one listing before adding a guest booking.
          </div>
        ) : (
          <>
            {/* Selected listing / type card */}
            <div style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div
                onClick={() => setShowServicePicker(!showServicePicker)}
                style={{ display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '12px', flexShrink: 0, overflow: 'hidden', background: selectedService?.photo_url ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selectedService?.photo_url ? <img src={selectedService.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name={CATEGORY_ICON[category] || 'box'} size={26} color="white" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{selectedType ? selectedType.name : selectedService?.title}</p>
                  {activePromo && (
                    <p style={{ fontSize: '10.5px', fontWeight: 700, color: COLORS.purple, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icon name="ticket" size={11} color={COLORS.purple} /> {activePromo.discount_type === 'percentage' ? `${activePromo.discount_value}% OFF` : `₦${activePromo.discount_value.toLocaleString()} OFF`}
                    </p>
                  )}
                  {usingTypes && selectedType && (
                    <span style={{ display: 'inline-block', marginTop: '5px', fontSize: '10.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '7px', background: selectedType.available > 0 ? '#f0fdf4' : '#fef2f2', color: selectedType.available > 0 ? COLORS.green : COLORS.red }}>
                      {selectedType.available > 0 ? 'Available' : 'Not Available'}
                    </span>
                  )}
                  {usingTypes && selectedType && selectedType.available === 0 && selectedType.availableFrom && (
                    <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '4px' }}>
                      Next available from {new Date(selectedType.availableFrom).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Icon name="chevronRight" size={18} color={COLORS.textMuted} />
              </div>

              {showServicePicker && (
                <div style={{ marginTop: '12px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '10px' }}>
                  <select
                    value={serviceId}
                    onChange={(e) => { setServiceId(e.target.value); setShowServicePicker(false) }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px' }}>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
              )}

              {loadingTypes && <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '10px' }}>Checking inventory...</p>}

              {usingTypes && (
                <div style={{ marginTop: '10px' }}>
                  <div onClick={() => setShowTypePicker(!showTypePicker)} style={{ fontSize: '12px', color: COLORS.purple, fontWeight: 700, cursor: 'pointer' }}>
                    Change {unitLabel} Type
                  </div>
                  {showTypePicker && (
                    <div style={{ marginTop: '8px' }}>
                      {invTypes.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => { if (t.available > 0) { setSelectedTypeId(t.id); setShowTypePicker(false) } }}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px',
                            borderRadius: '10px', marginBottom: '6px', border: `1px solid ${t.id === selectedTypeId ? COLORS.purple : COLORS.border}`,
                            cursor: t.available > 0 ? 'pointer' : 'not-allowed', opacity: t.available > 0 ? 1 : 0.5
                          }}>
                          <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{t.name}</p>
                          <p style={{ fontSize: '12px', color: COLORS.textMuted }}>₦{t.price.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '10px' }}>Price per {(dateRangeLabels?.unit || 'Night').toLowerCase()}</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.purple }}>₦{(selectedType?.price ?? selectedService?.price ?? 0).toLocaleString()}</p>
            </div>

            {/* Guest Information */}
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '10px' }}>Guest Information</p>
            <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Full Name *</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '10px 12px', marginBottom: '12px' }}>
                <Icon name="user" size={15} color={COLORS.textMuted} />
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Enter full name" style={{ border: 'none', outline: 'none', fontSize: '13px', flex: 1 }} />
              </div>

              <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Phone Number *</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '10px 12px', marginBottom: '12px' }}>
                <Icon name="bell" size={15} color={COLORS.textMuted} />
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="080..." inputMode="tel" style={{ border: 'none', outline: 'none', fontSize: '13px', flex: 1 }} />
              </div>

              <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Email (Optional)</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '10px 12px' }}>
                <Icon name="fileText" size={15} color={COLORS.textMuted} />
                <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Enter email address (optional)" style={{ border: 'none', outline: 'none', fontSize: '13px', flex: 1 }} />
              </div>
            </div>

            {/* Booking Details */}
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '10px' }}>Booking Details</p>
            <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              {isDateRange ? (
                <>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>{dateRangeLabels?.start || 'Start Date'} *</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '9px 10px' }}>
                        <Icon name="calendar" size={14} color={COLORS.textMuted} />
                        <input value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} type="date" min={new Date().toISOString().split('T')[0]} style={{ border: 'none', outline: 'none', fontSize: '12.5px', flex: 1, width: '100%' }} />
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>{dateRangeLabels?.end || 'End Date'} *</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '9px 10px', background: '#f8fafc' }}>
                        <Icon name="calendar" size={14} color={COLORS.textMuted} />
                        <p style={{ fontSize: '12.5px', color: COLORS.text }}>{checkOutDate || 'Select date'}</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>{dateRangeLabels?.unit || 'Night'}s</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '7px 10px' }}>
                        <div onClick={() => setNights(Math.max(1, nights - 1))} style={{ cursor: 'pointer', color: COLORS.textMuted }}>
                          <Icon name="minus" size={14} color={COLORS.textMuted} />
                        </div>
                        <p style={{ fontSize: '14px', fontWeight: 700, minWidth: '16px', textAlign: 'center' }}>{nights}</p>
                        <div onClick={() => setNights(nights + 1)} style={{ cursor: 'pointer' }}>
                          <Icon name="plus" size={14} color={COLORS.purple} />
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: 1, background: '#F5F3FF', borderRadius: '10px', padding: '10px 14px' }}>
                      <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Total Amount</p>
                      <p style={{ fontSize: '17px', fontWeight: 800, color: COLORS.purple }}>₦{finalTotal.toLocaleString()}</p>
                      <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>{nights} {dateRangeLabels?.unit || 'Night'}{nights > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Details</p>
                  <textarea value={bookingDetails} onChange={(e) => setBookingDetails(e.target.value)} rows={3} placeholder={DETAIL_PLACEHOLDER[category] || 'Booking details'} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'none' }} />
                  <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Amount Paid (₦) *</p>
                  <input value={amountOverride} onChange={(e) => setAmountOverride(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="18000" inputMode="decimal" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', boxSizing: 'border-box' }} />
                </>
              )}
            </div>

            {/* Payment Method */}
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '10px' }}>Payment Method</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
              {(['cash', 'transfer', 'pos'] as const).map((method) => (
                <div
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  style={{
                    flex: 1, textAlign: 'center', padding: '14px 6px', borderRadius: '12px', cursor: 'pointer',
                    border: `1.5px solid ${paymentMethod === method ? COLORS.purple : COLORS.border}`,
                    background: paymentMethod === method ? '#F5F3FF' : COLORS.card
                  }}>
                  <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, marginBottom: '8px', textTransform: 'capitalize' }}>{method === 'pos' ? 'POS' : method}</p>
                  <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${paymentMethod === method ? COLORS.purple : COLORS.border}`, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {paymentMethod === method && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: COLORS.purple }} />}
                  </div>
                </div>
              ))}
            </div>

            <div
              onClick={saving || !canSave ? undefined : handleSave}
              style={{
                background: saving || !canSave ? '#94a3b8' : COLORS.purple, color: 'white', textAlign: 'center', padding: '13px',
                borderRadius: '12px', fontWeight: 700, fontSize: '14px', cursor: saving || !canSave ? 'not-allowed' : 'pointer', marginBottom: '14px'
              }}>
              {saving ? 'Saving...' : 'Save Guest Booking'}
            </div>

            {errorMsg && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 14px', marginBottom: '14px' }}>
                <p style={{ fontSize: '12px', color: COLORS.red, lineHeight: 1.5 }}>{errorMsg}</p>
              </div>
            )}

            <div style={{ background: '#F5F3FF', borderRadius: '12px', padding: '14px', display: 'flex', gap: '10px' }}>
              <Icon name="shield" size={16} color={COLORS.purple} />
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, lineHeight: 1.5 }}>
                This booking will be saved as a walk-in guest. You can view and manage it in your bookings list.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
