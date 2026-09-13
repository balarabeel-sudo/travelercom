import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import { DetailsSkeleton } from './LoadingSkeleton'
import NetworkError from './NetworkError'

const COLORS = {
  primary: '#0EA5E9', secondary: '#F97316', bg: '#F8FAFC', card: '#FFFFFF',
  text: '#1A1A1A', textMuted: '#64748B', border: '#E2E8F0', green: '#16a34a', red: '#DC2626',
}

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

function formatDuration(mins: number | null): string {
  if (mins == null) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function AddBusListing() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [approvalStatus, setApprovalStatus] = useState<string>('pending')
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('')

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
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')

  const [repeatEnabled, setRepeatEnabled] = useState(false)
  const [repeatDays, setRepeatDays] = useState('7')

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [success, setSuccess] = useState(false)
  const [createdCount, setCreatedCount] = useState(1)

  const duration = computeDurationMinutes(travelDate, departureTime, arrivalTime)
  const isOvernight = duration != null && arrivalTime && departureTime && arrivalTime <= departureTime

  const load = async () => {
    setNetError(false)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { navigate('/login'); return }
    const { data: company, error: companyErr } = await supabase
      .from('companies').select('id, approval_status')
      .eq('owner_id', userData.user.id).maybeSingle()

    if (companyErr) { setNetError(true); setLoading(false); return }

    if (company) {
      setCompanyId(company.id)
      setApprovalStatus(company.approval_status)

      if (editId) {
        const { data: listing, error: listingErr } = await supabase.from('services').select('*').eq('id', editId).eq('company_id', company.id).maybeSingle()
        if (listingErr) { setNetError(true); setLoading(false); return }

        if (listing) {
          setOrigin(listing.origin || '')
          setDestination(listing.destination || '')
          if (listing.departure_time) {
            const dep = new Date(listing.departure_time)
            setTravelDate(dep.toISOString().slice(0, 10))
            setDepartureTime(dep.toISOString().slice(11, 16))
          }
          if (listing.arrival_time) {
            setArrivalTime(new Date(listing.arrival_time).toISOString().slice(11, 16))
          }
          setVehicleInfo(listing.vehicle_info || '')
          setSeatLayout(listing.seat_layout || '')
          setSeatsAvailable(listing.seats_available ? String(listing.seats_available) : '')
          setPrice(listing.price ? String(listing.price) : '')
          setBoardingInfo(listing.boarding_info || '')
          setAmenities(listing.amenities || [])
          setExistingPhotoUrl(listing.photo_url || '')
        }
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [navigate, editId])

  const toggleAmenity = (a: string) => {
    setAmenities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a])
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async () => {
    setErrorMsg('')
    if (!origin.trim() || !destination.trim() || !travelDate || !departureTime || !arrivalTime || !price.trim() || !seatsAvailable.trim()) {
      setErrorMsg('Please fill in departure station, destination, travel date, departure/arrival time, seats and price.')
      return
    }
    if (!companyId) {
      setErrorMsg('Company profile not found.')
      return
    }

    setSubmitting(true)

    let photoUrl: string | null = null
    if (photoFile) {
      const fileExt = photoFile.name.split('.').pop()
      const fileName = `${companyId}-${Date.now()}.${fileExt}`
      const { error: uploadErr } = await supabase.storage.from('listing-photos').upload(fileName, photoFile)
      if (uploadErr) {
        setSubmitting(false)
        setErrorMsg('Photo upload failed: ' + uploadErr.message)
        return
      }
      const { data: urlData } = supabase.storage.from('listing-photos').getPublicUrl(fileName)
      photoUrl = urlData.publicUrl
    }
    if (!photoFile && editId) photoUrl = existingPhotoUrl || null

    const buildTimes = (dateStr: string) => {
      const dep = new Date(`${dateStr}T${departureTime}:00`)
      let arr = new Date(`${dateStr}T${arrivalTime}:00`)
      if (arr.getTime() <= dep.getTime()) arr = new Date(arr.getTime() + 24 * 60 * 60 * 1000)
      return { dep, arr }
    }

    const basePayload = (dateStr: string) => {
      const { dep, arr } = buildTimes(dateStr)
      return {
        company_id: companyId,
        category: 'bus',
        title: `${origin.trim()} → ${destination.trim()}`,
        origin: origin.trim(),
        destination: destination.trim(),
        departure_time: dep.toISOString(),
        arrival_time: arr.toISOString(),
        duration_minutes: Math.round((arr.getTime() - dep.getTime()) / 60000),
        price: parseFloat(price),
        commission_rate: COMMISSION_RATE,
        seats_available: parseInt(seatsAvailable, 10),
        photo_url: photoUrl,
        amenities: amenities.length > 0 ? amenities : null,
        vehicle_info: vehicleInfo.trim() || null,
        seat_layout: seatLayout.trim() || null,
        boarding_info: boardingInfo.trim() || null,
      }
    }

    if (editId) {
      const { error } = await supabase.from('services').update(basePayload(travelDate)).eq('id', editId)
      if (error) {
        setSubmitting(false)
        setErrorMsg(error.message)
        return
      }
    } else if (repeatEnabled) {
      const days = Math.min(parseInt(repeatDays || '1', 10) || 1, 60)
      const rows = []
      const start = new Date(`${travelDate}T00:00:00`)
      for (let i = 0; i < days; i++) {
        const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000)
        rows.push({ ...basePayload(d.toISOString().slice(0, 10)), status: 'active' })
      }
      const { error } = await supabase.from('services').insert(rows)
      if (error) {
        setSubmitting(false)
        setErrorMsg(error.message)
        return
      }
      setCreatedCount(days)
    } else {
      const { error } = await supabase.from('services').insert({ ...basePayload(travelDate), status: 'active' })
      if (error) {
        setSubmitting(false)
        setErrorMsg(error.message)
        return
      }
    }

    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      await supabase.rpc('log_audit', {
        p_action: editId ? 'updated_listing' : 'created_listing',
        p_module: 'listings', p_target_type: 'service', p_target_id: editId || null,
        p_previous: null, p_new: { route: `${origin.trim()} → ${destination.trim()}`, category: 'bus' }, p_company_id: companyId,
      })
    }

    setSubmitting(false)
    setSuccess(true)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ padding: '18px 20px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Bus Listing</h1>
        </div>
        <DetailsSkeleton />
      </div>
    )
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ padding: '18px 20px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Bus Listing</h1>
        </div>
        <NetworkError onRetry={() => { setLoading(true); load() }} />
      </div>
    )
  }

  if (approvalStatus !== 'approved') {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <span onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="arrowLeft" size={20} color={COLORS.text} /></span>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Bus Listing</h1>
        </div>
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><Icon name="hourglass" size={38} color={COLORS.textMuted} /></div>
          <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>Account Not Yet Approved</p>
          <p style={{ fontSize: '13px', color: COLORS.textMuted }}>You need to be approved before you can add listings.</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><Icon name="checkCircle" size={44} color={COLORS.green} /></div>
          <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.green, marginBottom: '8px' }}>
            {editId ? 'Listing Updated!' : createdCount > 1 ? `${createdCount} Listings Added!` : 'Listing Added!'}
          </p>
          <button onClick={() => navigate('/my-listings')} style={{ padding: '12px 24px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
            Back to My Listings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <span onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="arrowLeft" size={20} color={COLORS.text} /></span>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>{editId ? 'Edit Bus Listing' : 'Add Bus Listing'}</h1>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <div style={{ background: COLORS.card, borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: COLORS.primary }}>
          <Icon name="bus" size={14} color={COLORS.primary} /> Bus / Transport
        </div>

        {errorMsg && <p style={{ color: COLORS.red, fontSize: '13px', marginBottom: '12px' }}>{errorMsg}</p>}

        {origin.trim() && destination.trim() && (
          <div style={{ background: `linear-gradient(135deg, ${COLORS.primary}, #075985)`, borderRadius: '12px', padding: '14px 16px', marginBottom: '14px', color: 'white' }}>
            <p style={{ fontSize: '16px', fontWeight: 800 }}>{origin.trim().toUpperCase()} → {destination.trim().toUpperCase()}</p>
            {duration != null && <p style={{ fontSize: '12px', opacity: 0.9, marginTop: '4px' }}>Duration: {formatDuration(duration)}{isOvernight ? ' (overnight)' : ''}</p>}
          </div>
        )}

        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: '14px' }}>
          <Field label="Photo">
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', height: '140px', border: `2px dashed ${COLORS.border}`, borderRadius: '10px',
              cursor: 'pointer', overflow: 'hidden', background: COLORS.bg,
            }}>
              {photoPreview || existingPhotoUrl ? (
                <img src={photoPreview || existingPhotoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '13px', color: COLORS.textMuted, display: 'flex', alignItems: 'center', gap: '6px' }}><Icon name="camera" size={16} color={COLORS.textMuted} /> Tap to upload photo</span>
              )}
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </label>
          </Field>

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

          <Field label="Bus / Vehicle (optional)">
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
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
              {AMENITIES_LIST.map((a) => {
                const active = amenities.includes(a)
                return (
                  <span key={a} onClick={() => toggleAmenity(a)} style={{
                    display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '20px',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
                    background: active ? COLORS.primary : COLORS.bg,
                    color: active ? 'white' : COLORS.textMuted,
                  }}>
                    <Icon name={AMENITY_ICON[a]} size={13} color={active ? 'white' : COLORS.textMuted} /> {a}
                  </span>
                )
              })}
            </div>
          </Field>
        </div>

        {!editId && (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: '14px' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <span style={{ fontSize: '12px', color: COLORS.textMuted }}>For the next</span>
                <input type="number" min={2} max={60} value={repeatDays} onChange={(e) => setRepeatDays(e.target.value)} style={{ ...inputStyle, width: '70px', padding: '8px' }} />
                <span style={{ fontSize: '12px', color: COLORS.textMuted }}>days (max 60)</span>
              </div>
            )}
            {repeatEnabled && (
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '8px' }}>
                Creates {Math.min(parseInt(repeatDays || '1', 10) || 1, 60)} separate listings, same route and time each day, starting from the travel date above.
              </p>
            )}
          </div>
        )}

        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
            Commission: {COMMISSION_RATE}% will be deducted after each verified booking.
          </p>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: '100%', padding: '13px', background: submitting ? '#94a3b8' : COLORS.secondary,
              color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px',
              cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}>
            {submitting ? (editId ? 'Updating...' : 'Adding...') : editId ? (<><Icon name="check" size={14} color="white" strokeWidth={2.5} /> Update Listing</>) : (<><Icon name="plus" size={14} color="white" strokeWidth={2.5} /> Add Listing</>)}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '6px', display: 'block' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '11px', border: `1px solid ${COLORS.border}`, borderRadius: '8px',
  fontSize: '14px', boxSizing: 'border-box' as const, fontFamily: 'inherit',
}

export default AddBusListing
