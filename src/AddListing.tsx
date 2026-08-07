import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

const COLORS = {
  primary: '#0EA5E9', secondary: '#F97316', bg: '#F8FAFC', card: '#FFFFFF',
  text: '#1A1A1A', textMuted: '#64748B', border: '#E2E8F0', green: '#16a34a',
}

const COMMISSION_BY_CATEGORY: Record<string, number> = {
  hotel: 3, bus: 5, train: 5, flight: 3, tour: 3, event_center: 3,
}
const CATEGORY_LABELS: Record<string, string> = {
  hotel: '🏨 Hotel', bus: '🚌 Bus', train: '🚆 Railway', flight: '✈️ Flight', tour: '🗺️ Tour', event_center: '🎪 Event Center',
}
const AMENITY_ICON: Record<string, string> = {
  WiFi: '📶', Parking: '🅿️', Restaurant: '🍽️', Pool: '🏊', Gym: '🏋️',
  'Airport Pickup': '✈️', 'Conference Hall': '🏢', Laundry: '🧺', AC: '❄️', Breakfast: '☕',
  Meals: '🍱', 'Charging Port': '🔌', 'Reclining Seats': '💺', Toilet: '🚻',
  'Guide Included': '🧭', 'Transport Included': '🚐', 'Meals Included': '🍱', Insurance: '🛡️',
  Catering: '🍽️', 'Sound System': '🔊', Seating: '🪑',
}
const AMENITIES_LIST = Object.keys(AMENITY_ICON)
const TOUR_TYPES = ['Nature', 'History', 'Adventure', 'Water', 'Culture']
const EVENT_TYPES = ['Conference', 'Wedding', 'Party', 'Seminar', 'Exhibition']
const TRAVEL_AMENITY_ICON: Record<string, string> = {
  WiFi: '📶', AC: '❄️', 'Charging Port': '🔌', Meals: '🍱', 'Reclining Seats': '💺', Toilet: '🚻', Refundable: '🔄', 'Baggage Allowance': '🧳',
}
const TRAVEL_AMENITIES_LIST = Object.keys(TRAVEL_AMENITY_ICON)

function AddListing() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [approvalStatus, setApprovalStatus] = useState<string>('pending')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')
  const [duration, setDuration] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [amenities, setAmenities] = useState<string[]>([])
  const [tourType, setTourType] = useState('')
  const [eventType, setEventType] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { navigate('/login'); return }
      const { data: company } = await supabase
        .from('companies').select('id, business_type, approval_status')
        .eq('owner_id', userData.user.id).maybeSingle()
      if (company) {
        setCompanyId(company.id)
        setCategory(company.business_type)
        setApprovalStatus(company.approval_status)
      }
      setLoading(false)
    }
    load()
  }, [navigate])

  const isTransport = category === 'bus' || category === 'train' || category === 'flight'
  const quantityLabel = category === 'hotel' ? 'Rooms Available' : isTransport ? 'Seats Available' : 'Slots Available'
  const destinationLabel = category === 'hotel' || category === 'event_center' ? 'City' : isTransport ? 'Destination' : 'Location'

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
    if (!title.trim() || !price.trim() || !destination.trim()) {
      setErrorMsg('Please fill in title, price, and destination/city.')
      return
    }
    if (!companyId || !category) {
      setErrorMsg('Company profile not found.')
      return
    }

    setSubmitting(true)

    let photoUrl: string | null = null
    if (photoFile) {
      const fileExt = photoFile.name.split('.').pop()
      const fileName = `${companyId}-${Date.now()}.${fileExt}`
      const { error: uploadErr } = await supabase.storage
        .from('listing-photos')
        .upload(fileName, photoFile)

      if (uploadErr) {
        setSubmitting(false)
        setErrorMsg('Photo upload failed: ' + uploadErr.message)
        return
      }

      const { data: urlData } = supabase.storage.from('listing-photos').getPublicUrl(fileName)
      photoUrl = urlData.publicUrl
    }

    const { error } = await supabase.from('services').insert({
      company_id: companyId,
      category: category,
      title: title.trim(),
      description: description.trim() || null,
      origin: isTransport ? origin.trim() || null : null,
      destination: destination.trim(),
      departure_time: departureTime ? new Date(departureTime).toISOString() : null,
      arrival_time: isTransport && arrivalTime ? new Date(arrivalTime).toISOString() : null,
      duration_minutes: isTransport && duration ? parseInt(duration, 10) : null,
      price: parseFloat(price),
      commission_rate: COMMISSION_BY_CATEGORY[category] ?? 3,
      seats_available: quantity ? parseInt(quantity, 10) : null,
      status: 'active',
      photo_url: photoUrl,
      amenities: (category === 'hotel' || isTransport) && amenities.length > 0 ? amenities : null,
      tour_type: category === 'tour' && tourType ? tourType : null,
      event_type: category === 'event_center' && eventType ? eventType : null,
    })

    setSubmitting(false)
    if (error) {
      setErrorMsg(error.message)
    } else {
      setSuccess(true)
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted }}>Loading...</div>
  }

  if (approvalStatus !== 'approved') {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <span onClick={() => navigate('/home')} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Listing</h1>
        </div>
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
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
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
          <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.green, marginBottom: '8px' }}>Listing Added!</p>
          <button onClick={() => navigate('/home')} style={{ padding: '12px 24px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <span onClick={() => navigate('/home')} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Listing</h1>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <div style={{ background: COLORS.card, borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', display: 'inline-block', fontSize: '13px', fontWeight: 700, color: COLORS.primary }}>
          {category ? CATEGORY_LABELS[category] || category : 'Unknown category'}
        </div>

        {errorMsg && <p style={{ color: 'red', fontSize: '13px', marginBottom: '12px' }}>{errorMsg}</p>}

        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>

          <Field label="Photo">
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', height: '140px', border: `2px dashed ${COLORS.border}`, borderRadius: '10px',
              cursor: 'pointer', overflow: 'hidden', background: COLORS.bg,
            }}>
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '13px', color: COLORS.textMuted }}>📷 Tap to upload photo</span>
              )}
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </label>
          </Field>

          <Field label="Title">
            <input type="text" placeholder="e.g. Executive Room, Lagos-Abuja Express" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Description">
            <textarea placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' as const }} />
          </Field>

          {isTransport && (
            <Field label="Origin (departure city)">
              <input type="text" placeholder="e.g. Lagos" value={origin} onChange={(e) => setOrigin(e.target.value)} style={inputStyle} />
            </Field>
          )}

          <Field label={destinationLabel}>
            <input type="text" placeholder="e.g. Abuja" value={destination} onChange={(e) => setDestination(e.target.value)} style={inputStyle} />
          </Field>

          {isTransport && (
            <Field label="Departure Time">
              <input type="datetime-local" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} style={inputStyle} />
            </Field>
          )}

          {isTransport && (
            <Field label="Arrival Time">
              <input type="datetime-local" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} style={inputStyle} />
            </Field>
          )}

          {isTransport && (
            <Field label="Duration (minutes)">
              <input type="number" placeholder="e.g. 80" value={duration} onChange={(e) => setDuration(e.target.value)} style={inputStyle} />
            </Field>
          )}

          <Field label="Price (₦)">
            <input type="number" placeholder="e.g. 15000" value={price} onChange={(e) => setPrice(e.target.value)} style={inputStyle} />
          </Field>

          <Field label={quantityLabel}>
            <input type="number" placeholder="e.g. 20" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={inputStyle} />
          </Field>

          {category === 'hotel' && (
            <Field label="Amenities">
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
                {AMENITIES_LIST.map((a) => {
                  const active = amenities.includes(a)
                  return (
                    <span
                      key={a}
                      onClick={() => toggleAmenity(a)}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
                        background: active ? COLORS.primary : COLORS.bg,
                        color: active ? 'white' : COLORS.textMuted,
                      }}>
                      {AMENITY_ICON[a]} {a}
                    </span>
                  )
                })}
              </div>
            </Field>
          )}

          {isTransport && (
            <Field label="Travel Amenities">
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
                {TRAVEL_AMENITIES_LIST.map((a) => {
                  const active = amenities.includes(a)
                  return (
                    <span
                      key={a}
                      onClick={() => toggleAmenity(a)}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
                        background: active ? COLORS.primary : COLORS.bg,
                        color: active ? 'white' : COLORS.textMuted,
                      }}>
                      {TRAVEL_AMENITY_ICON[a]} {a}
                    </span>
                  )
                })}
              </div>
            </Field>
          )}

          {category === 'tour' && (
            <Field label="Tour Type">
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
                {TOUR_TYPES.map((t) => (
                  <span
                    key={t}
                    onClick={() => setTourType(t)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: `1px solid ${tourType === t ? COLORS.primary : COLORS.border}`,
                      background: tourType === t ? COLORS.primary : COLORS.bg,
                      color: tourType === t ? 'white' : COLORS.textMuted,
                    }}>
                    {t}
                  </span>
                ))}
              </div>
            </Field>
          )}

          {category === 'event_center' && (
            <Field label="Event Type">
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
                {EVENT_TYPES.map((t) => (
                  <span
                    key={t}
                    onClick={() => setEventType(t)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: `1px solid ${eventType === t ? COLORS.primary : COLORS.border}`,
                      background: eventType === t ? COLORS.primary : COLORS.bg,
                      color: eventType === t ? 'white' : COLORS.textMuted,
                    }}>
                    {t}
                  </span>
                ))}
              </div>
            </Field>
          )}

          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
            Commission: {category ? COMMISSION_BY_CATEGORY[category] ?? 3 : 3}% will be deducted after each verified booking.
          </p>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: '100%', padding: '13px', background: submitting ? '#94a3b8' : COLORS.secondary,
              color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px',
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}>
            {submitting ? 'Adding...' : '➕ Add Listing'}
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

export default AddListing
