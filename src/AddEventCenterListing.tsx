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

const COMMISSION_RATE = 3

const EVENT_TYPES = ['Conference', 'Wedding', 'Party', 'Seminar', 'Exhibition']
const EVENT_TYPE_ICON: Record<string, string> = { Conference: 'mic', Wedding: 'rings', Party: 'party', Seminar: 'clipboard', Exhibition: 'image' }

const AMENITY_ICON: Record<string, string> = {
  Parking: 'parking', 'AC Hall': 'snowflake', Projector: 'image', WiFi: 'wifi', 'Sound System': 'mic', Catering: 'food', Generator: 'plug',
}
const AMENITIES_LIST = Object.keys(AMENITY_ICON)

function AddEventCenterListing() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [approvalStatus, setApprovalStatus] = useState<string>('pending')
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('')

  const [title, setTitle] = useState('')
  const [destination, setDestination] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [eventType, setEventType] = useState('')
  const [capacity, setCapacity] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [amenities, setAmenities] = useState<string[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [success, setSuccess] = useState(false)

  const durationMinutes = (() => {
    if (!eventDate || !startTime || !endTime) return null
    const start = new Date(`${eventDate}T${startTime}:00`)
    const end = new Date(`${eventDate}T${endTime}:00`)
    const mins = Math.round((end.getTime() - start.getTime()) / 60000)
    return mins > 0 ? mins : null
  })()

  const formatDuration = (mins: number | null) => {
    if (mins == null) return null
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h === 0) return `${m} minutes`
    if (m === 0) return `${h} hour${h > 1 ? 's' : ''}`
    return `${h}h ${m}m`
  }

  const load = async () => {
    setNetError(false)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { navigate('/login'); return }
    const { data: company, error: companyErr } = await supabase
      .from('companies').select('id, business_type, approval_status')
      .eq('owner_id', userData.user.id).maybeSingle()

    if (companyErr) { setNetError(true); setLoading(false); return }

    if (company) {
      setCompanyId(company.id)
      setApprovalStatus(company.approval_status)

      if (editId) {
        const { data: listing, error: listingErr } = await supabase.from('services').select('*').eq('id', editId).eq('company_id', company.id).maybeSingle()
        if (listingErr) { setNetError(true); setLoading(false); return }
        if (listing) {
          setTitle(listing.title || '')
          setDestination(listing.destination || '')
          if (listing.departure_time) {
            const d = new Date(listing.departure_time)
            setEventDate(d.toISOString().slice(0, 10))
            setStartTime(d.toISOString().slice(11, 16))
          }
          if (listing.arrival_time) setEndTime(new Date(listing.arrival_time).toISOString().slice(11, 16))
          setPrice(listing.price ? String(listing.price) : '')
          setQuantity(listing.seats_available ? String(listing.seats_available) : '')
          setEventType(listing.event_type || '')
          setCapacity(listing.capacity != null ? String(listing.capacity) : '')
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
    if (!title.trim() || !price.trim() || !destination.trim()) {
      setErrorMsg('Please fill in title, price, and location.')
      return
    }
    if (!eventDate || !startTime || !endTime) {
      setErrorMsg('Please fill in the available date, start time, and end time.')
      return
    }
    if (durationMinutes == null) {
      setErrorMsg('End time must be later than start time.')
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

    if (!photoFile && editId) photoUrl = existingPhotoUrl || null

    const startDateTime = new Date(`${eventDate}T${startTime}:00`)
    const endDateTime = new Date(`${eventDate}T${endTime}:00`)

    const payload = {
      company_id: companyId,
      category: 'event_center',
      title: title.trim(),
      destination: destination.trim(),
      departure_time: startDateTime.toISOString(),
      arrival_time: endDateTime.toISOString(),
      duration_minutes: durationMinutes,
      price: parseFloat(price),
      commission_rate: COMMISSION_RATE,
      seats_available: quantity ? parseInt(quantity, 10) : null,
      event_type: eventType || null,
      capacity: capacity ? parseInt(capacity, 10) : null,
      photo_url: photoUrl,
      amenities: amenities.length > 0 ? amenities : null,
    }

    const { data: savedListing, error } = editId
      ? await supabase.from('services').update(payload).eq('id', editId).select('id').single()
      : await supabase.from('services').insert({ ...payload, status: 'active' }).select('id').single()

    setSubmitting(false)
    if (error) {
      setErrorMsg(error.message)
    } else {
      if (savedListing) {
        const { data: userData } = await supabase.auth.getUser()
        if (userData?.user) {
          await supabase.rpc('log_audit', {
            p_action: editId ? 'updated_listing' : 'created_listing',
            p_module: 'listings',
            p_target_type: 'service',
            p_target_id: savedListing.id,
            p_previous: null,
            p_new: { title: title.trim(), category: 'event_center' },
            p_company_id: companyId,
          })
        }
      }
      setSuccess(true)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ padding: '18px 20px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Event Center Listing</h1>
        </div>
        <DetailsSkeleton />
      </div>
    )
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ padding: '18px 20px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Event Center Listing</h1>
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
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Event Center Listing</h1>
        </div>
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: COLORS.textMuted }}><Icon name="hourglass" size={38} color={COLORS.textMuted} /></div>
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
          <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.green, marginBottom: '8px' }}>{editId ? 'Listing Updated!' : 'Listing Added!'}</p>
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
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>{editId ? 'Edit Event Center Listing' : 'Add Event Center Listing'}</h1>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <div style={{ background: COLORS.card, borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: COLORS.primary }}>
          <Icon name="tent" size={14} color={COLORS.primary} /> Event Center
        </div>

        {errorMsg && <p style={{ color: 'red', fontSize: '13px', marginBottom: '12px' }}>{errorMsg}</p>}

        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>

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

          <Field label="Title">
            <input type="text" placeholder="e.g. Royal Event Center" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Location">
            <input type="text" placeholder="e.g. Kano, Kano State" value={destination} onChange={(e) => setDestination(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Available Date">
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={inputStyle} />
          </Field>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <Field label="Start Time">
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="End Time">
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle} />
              </Field>
            </div>
          </div>
          {startTime && endTime && (
            <p style={{ fontSize: '11.5px', color: durationMinutes == null ? COLORS.red : COLORS.textMuted, marginTop: '-8px', marginBottom: '14px' }}>
              {durationMinutes == null ? 'End time must be later than start time.' : <>Duration: <strong style={{ color: COLORS.text }}>{formatDuration(durationMinutes)}</strong></>}
            </p>
          )}

          <Field label="Event Type">
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
              {EVENT_TYPES.map((t) => {
                const active = eventType === t
                return (
                  <span
                    key={t}
                    onClick={() => setEventType(active ? '' : t)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '20px',
                      fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                      border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
                      background: active ? COLORS.primary : COLORS.bg,
                      color: active ? 'white' : COLORS.textMuted,
                    }}>
                    <Icon name={EVENT_TYPE_ICON[t]} size={13} color={active ? 'white' : COLORS.textMuted} /> {t}
                  </span>
                )
              })}
            </div>
          </Field>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <Field label="Price (₦ per day)">
                <input type="number" placeholder="e.g. 250000" value={price} onChange={(e) => setPrice(e.target.value)} style={inputStyle} />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Capacity (people)">
                <input type="number" placeholder="e.g. 500" value={capacity} onChange={(e) => setCapacity(e.target.value)} style={inputStyle} />
              </Field>
            </div>
          </div>

          <Field label="Slots Available">
            <input type="number" placeholder="e.g. 5" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Amenities">
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
              {AMENITIES_LIST.map((a) => {
                const active = amenities.includes(a)
                return (
                  <span
                    key={a}
                    onClick={() => toggleAmenity(a)}
                    style={{
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

          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
            Commission: {COMMISSION_RATE}% will be deducted after each verified booking.
          </p>

          <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '14px' }}>
            Need to set up individual halls with their own pricing? Do that from{' '}
            <span onClick={() => navigate('/inventory')} style={{ color: COLORS.primary, fontWeight: 700, cursor: 'pointer' }}>Inventory</span> after saving this listing.
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

export default AddEventCenterListing
