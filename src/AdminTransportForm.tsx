import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import {
  COLORS, Field, Card, inputStyle, MultiChips, usePhotos, PhotoField, CompanyField, FormHeader, LoadingBlock,
  ErrorBlock, SuccessScreen, SubmitButton, toLocalDate, toLocalTime, addDays, formatDuration, auditAdminListing,
} from './AdminFormParts'
import type { FormProps, CompanyOption } from './AdminFormParts'

const COMMISSION_RATE = 5

const AMENITY_ICON: Record<string, string> = {
  WiFi: 'wifi', AC: 'snowflake', 'Charging Port': 'plug', Meals: 'food', 'Reclining Seats': 'seat',
  Toilet: 'toilet', Refundable: 'refresh', 'Baggage Allowance': 'luggage',
}
const AMENITIES_LIST = Object.keys(AMENITY_ICON)

function computeDurationMinutes(travelDate: string, depTime: string, arrTime: string): number | null {
  if (!travelDate || !depTime || !arrTime) return null
  const dep = new Date(`${travelDate}T${depTime}:00`)
  let arr = new Date(`${travelDate}T${arrTime}:00`)
  if (arr.getTime() <= dep.getTime()) arr = new Date(arr.getTime() + 24 * 60 * 60 * 1000)
  return Math.round((arr.getTime() - dep.getTime()) / 60000)
}

// Admin version of AddBusListing / AddListing (train): the founder picks the
// company and the type (bus or train), for transport companies that are not
// on TravelerCom themselves.
export default function AdminTransportForm({ editId, onSaved, onCancel }: FormProps) {
  const photos = usePhotos(5)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [companyId, setCompanyId] = useState('')
  const [category, setCategory] = useState<'bus' | 'train'>('bus')

  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [travelDate, setTravelDate] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')
  const [vehicleInfo, setVehicleInfo] = useState('')
  const [seatLayout, setSeatLayout] = useState('')
  const [seatsAvailable, setSeatsAvailable] = useState('')
  const [price, setPrice] = useState('')
  const [boardingInfo, setBoardingInfo] = useState('')
  const [amenities, setAmenities] = useState<string[]>([])
  const [repeatEnabled, setRepeatEnabled] = useState(false)
  const [repeatDays, setRepeatDays] = useState('7')

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [success, setSuccess] = useState(false)
  const [createdCount, setCreatedCount] = useState(1)

  const duration = computeDurationMinutes(travelDate, departureTime, arrivalTime)
  const isOvernight = duration != null && !!arrivalTime && !!departureTime && arrivalTime <= departureTime

  const loadCompanies = async (cat: string, selectFirst: boolean) => {
    const { data, error } = await supabase
      .from('companies').select('id, business_name')
      .eq('business_type', cat).eq('approval_status', 'approved')
      .order('business_name', { ascending: true })
    if (error) { setLoadError(error.message); return }
    setCompanies(data || [])
    if (selectFirst) setCompanyId(data && data.length > 0 ? data[0].id : '')
  }

  const init = async () => {
    setLoading(true)
    setLoadError('')
    if (editId) {
      const { data: listing, error } = await supabase.from('services').select('*').eq('id', editId).maybeSingle()
      if (error) { setLoadError(error.message); setLoading(false); return }
      if (listing) {
        const cat = listing.category === 'train' ? 'train' : 'bus'
        setCategory(cat)
        setCompanyId(listing.company_id || '')
        setOrigin(listing.origin || '')
        setDestination(listing.destination || '')
        if (listing.departure_time) {
          setTravelDate(toLocalDate(listing.departure_time))
          setDepartureTime(toLocalTime(listing.departure_time))
        }
        if (listing.arrival_time) setArrivalTime(toLocalTime(listing.arrival_time))
        setVehicleInfo(listing.vehicle_info || '')
        setSeatLayout(listing.seat_layout || '')
        setSeatsAvailable(listing.seats_available != null ? String(listing.seats_available) : '')
        setPrice(listing.price ? String(listing.price) : '')
        setBoardingInfo(listing.boarding_info || '')
        setAmenities(listing.amenities || [])
        photos.setExisting(listing.photo_urls && listing.photo_urls.length > 0 ? listing.photo_urls : (listing.photo_url ? [listing.photo_url] : []))
        await loadCompanies(cat, false)
      }
    } else {
      await loadCompanies('bus', true)
    }
    setLoading(false)
  }

  useEffect(() => { init() }, [editId])

  const changeCategory = async (cat: 'bus' | 'train') => {
    setCategory(cat)
    await loadCompanies(cat, true)
  }

  const toggleAmenity = (a: string) => setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))

  const handleSubmit = async () => {
    setErrorMsg('')
    if (!companyId) { setErrorMsg('Please select a company for this listing.'); return }
    if (!origin.trim() || !destination.trim() || !travelDate || !departureTime || !arrivalTime || !price.trim() || !seatsAvailable.trim()) {
      setErrorMsg('Please fill in departure station, destination, travel date, departure/arrival time, seats and price.')
      return
    }
    if (!(parseFloat(price) > 0) || !(parseInt(seatsAvailable, 10) > 0)) {
      setErrorMsg('Price and seats must be above zero.')
      return
    }

    setSubmitting(true)

    const up = await photos.upload(companyId)
    if (up.error) { setSubmitting(false); setErrorMsg('Photo upload failed: ' + up.error); return }

    const basePayload = (dateStr: string) => {
      const dep = new Date(`${dateStr}T${departureTime}:00`)
      let arr = new Date(`${dateStr}T${arrivalTime}:00`)
      if (arr.getTime() <= dep.getTime()) arr = new Date(arr.getTime() + 24 * 60 * 60 * 1000)
      return {
        company_id: companyId,
        category,
        title: `${origin.trim()} → ${destination.trim()}`,
        origin: origin.trim(),
        destination: destination.trim(),
        departure_time: dep.toISOString(),
        arrival_time: arr.toISOString(),
        duration_minutes: Math.round((arr.getTime() - dep.getTime()) / 60000),
        price: parseFloat(price),
        commission_rate: COMMISSION_RATE,
        seats_available: parseInt(seatsAvailable, 10),
        photo_url: up.urls[0] || null,
        photo_urls: up.urls.length > 0 ? up.urls : null,
        amenities: amenities.length > 0 ? amenities : null,
        vehicle_info: vehicleInfo.trim() || null,
        seat_layout: seatLayout.trim() || null,
        boarding_info: boardingInfo.trim() || null,
      }
    }

    const title = `${origin.trim()} → ${destination.trim()}`

    if (editId) {
      const { error } = await supabase.from('services').update(basePayload(travelDate)).eq('id', editId)
      if (error) { setSubmitting(false); setErrorMsg(error.message); return }
      await auditAdminListing('admin_updated_listing', editId, title, category, companyId)
      setCreatedCount(1)
    } else {
      const days = repeatEnabled ? Math.min(parseInt(repeatDays || '1', 10) || 1, 60) : 1
      const rows = Array.from({ length: days }, (_, i) => ({ ...basePayload(addDays(travelDate, i)), status: 'active' }))
      const { data: saved, error } = await supabase.from('services').insert(rows).select('id')
      if (error) { setSubmitting(false); setErrorMsg(error.message); return }
      for (const s of saved || []) {
        await auditAdminListing('admin_created_listing', s.id, title, category, companyId)
      }
      setCreatedCount(days)
    }

    setSubmitting(false)
    setSuccess(true)
  }

  if (loading) return <LoadingBlock />
  if (loadError) return <ErrorBlock message={loadError} onRetry={init} />
  if (success) {
    return (
      <SuccessScreen
        title={editId ? 'Listing Updated!' : createdCount > 1 ? `${createdCount} Listings Added!` : 'Listing Added!'}
        backLabel="Back to Transport"
        onBack={onSaved}
      />
    )
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px' }}>
      <FormHeader title={editId ? 'Edit Transport Listing' : 'Add Transport Listing'} onCancel={onCancel} />

      {errorMsg && <p style={{ color: COLORS.red, fontSize: '13px', marginBottom: '12px' }}>{errorMsg}</p>}

      <Card>
        {!editId && (
          <Field label="Type">
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['bus', 'train'] as const).map((c) => {
                const active = category === c
                return (
                  <span key={c} onClick={() => changeCategory(c)} style={{
                    flex: 1, textAlign: 'center' as const, padding: '9px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
                    background: active ? COLORS.primary : COLORS.bg,
                    color: active ? 'white' : COLORS.textMuted,
                  }}>{c === 'bus' ? 'Bus' : 'Train'}</span>
                )
              })}
            </div>
          </Field>
        )}

        <CompanyField companies={companies} companyId={companyId} onChange={setCompanyId} typeLabel={category} />

        <PhotoField photos={photos} />

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <Field label="Departure Station"><input type="text" placeholder="e.g. Kaduna" value={origin} onChange={(e) => setOrigin(e.target.value)} style={inputStyle} /></Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Destination"><input type="text" placeholder="e.g. Abuja" value={destination} onChange={(e) => setDestination(e.target.value)} style={inputStyle} /></Field>
          </div>
        </div>

        <Field label="Travel Date">
          <input type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} style={inputStyle} />
        </Field>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <Field label="Departure Time"><input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} style={inputStyle} /></Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Arrival Time"><input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} style={inputStyle} /></Field>
          </div>
        </div>
        {duration != null && (
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '-8px', marginBottom: '14px' }}>
            Duration calculated automatically: <strong style={{ color: COLORS.text }}>{formatDuration(duration)}</strong>
            {isOvernight ? ' — overnight trip, arrival is the next day' : ''}
          </p>
        )}

        <Field label={category === 'train' ? 'Train / Coach (optional)' : 'Bus / Vehicle (optional)'}>
          <input type="text" placeholder="e.g. Luxury Coach, 18-seater" value={vehicleInfo} onChange={(e) => setVehicleInfo(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Seat Layout (optional)">
          <input type="text" placeholder="e.g. 2-2 seating" value={seatLayout} onChange={(e) => setSeatLayout(e.target.value)} style={inputStyle} />
        </Field>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <Field label="Available Seats"><input type="number" placeholder="e.g. 18" value={seatsAvailable} onChange={(e) => setSeatsAvailable(e.target.value)} style={inputStyle} /></Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Ticket Price (₦)"><input type="number" placeholder="e.g. 15000" value={price} onChange={(e) => setPrice(e.target.value)} style={inputStyle} /></Field>
          </div>
        </div>

        <Field label="Boarding Information (optional)">
          <input type="text" placeholder="e.g. Boarding gate B, Kaduna Motor Park" value={boardingInfo} onChange={(e) => setBoardingInfo(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Amenities">
          <MultiChips options={AMENITIES_LIST} selected={amenities} onToggle={toggleAmenity} icons={AMENITY_ICON} />
        </Field>
      </Card>

      {!editId && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>Repeat this route</p>
              <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Create this same trip across several days at once</p>
            </div>
            <div onClick={() => setRepeatEnabled(!repeatEnabled)} style={{
              width: '44px', height: '24px', borderRadius: '20px', background: repeatEnabled ? COLORS.primary : COLORS.border,
              position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
            }}>
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px',
                left: repeatEnabled ? '23px' : '3px', transition: 'left 0.2s',
              }} />
            </div>
          </div>
          {repeatEnabled && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <span style={{ fontSize: '12px', color: COLORS.textMuted }}>For the next</span>
                <input type="number" min={2} max={60} value={repeatDays} onChange={(e) => setRepeatDays(e.target.value)} style={{ ...inputStyle, width: '70px', padding: '8px' }} />
                <span style={{ fontSize: '12px', color: COLORS.textMuted }}>days (max 60)</span>
              </div>
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '8px' }}>
                Creates {Math.min(parseInt(repeatDays || '1', 10) || 1, 60)} separate listings, same route and time each day, starting from the travel date above.
              </p>
            </>
          )}
        </Card>
      )}

      <Card>
        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
          Commission: {COMMISSION_RATE}% will be deducted after each verified booking.
        </p>
        <SubmitButton submitting={submitting} disabled={companies.length === 0} editing={!!editId} onClick={handleSubmit} />
      </Card>
    </div>
  )
}
