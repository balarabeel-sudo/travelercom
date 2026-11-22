import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import {
  COLORS, Field, Card, inputStyle, MultiChips, SingleChips, usePhotos, PhotoField, CompanyField, FormHeader, LoadingBlock,
  ErrorBlock, SuccessScreen, SubmitButton, toLocalDate, toLocalTime, auditAdminListing,
} from './AdminFormParts'
import type { FormProps, CompanyOption } from './AdminFormParts'

const COMMISSION_RATE = 3

const TOUR_TYPES = ['Nature', 'History', 'Adventure', 'Water', 'Culture']
const TOUR_TYPE_ICON: Record<string, string> = { Nature: 'sun', History: 'building', Adventure: 'compass', Water: 'pool', Culture: 'party' }

const AMENITY_ICON: Record<string, string> = {
  'Guided Tour': 'userPlus', 'Easy Access': 'checkCircle', Parking: 'parking', 'Beach Access': 'pool',
  'Food & Drinks': 'food', Lifeguard: 'shield', Indoor: 'building', 'Air Conditioned': 'snowflake', WiFi: 'wifi',
}
const AMENITIES_LIST = Object.keys(AMENITY_ICON)

function durationText(mins: number | null) {
  if (mins == null) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} minutes`
  if (m === 0) return `${h} hour${h > 1 ? 's' : ''}`
  return `${h}h ${m}m`
}

// Admin version of AddTourListing: the founder picks the tour company.
export default function AdminTourForm({ editId, onSaved, onCancel }: FormProps) {
  const photos = usePhotos(5)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [companyId, setCompanyId] = useState('')

  const [title, setTitle] = useState('')
  const [destination, setDestination] = useState('')
  const [tourDate, setTourDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [meetingPoint, setMeetingPoint] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [tourType, setTourType] = useState('')
  const [gateFee, setGateFee] = useState('')
  const [vehicleFee, setVehicleFee] = useState('')
  const [amenities, setAmenities] = useState<string[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [success, setSuccess] = useState(false)

  const durationMinutes = (() => {
    if (!tourDate || !startTime || !endTime) return null
    const start = new Date(`${tourDate}T${startTime}:00`)
    const end = new Date(`${tourDate}T${endTime}:00`)
    const mins = Math.round((end.getTime() - start.getTime()) / 60000)
    return mins > 0 ? mins : null
  })()

  const init = async () => {
    setLoading(true)
    setLoadError('')
    const { data: companyRows, error: cErr } = await supabase
      .from('companies').select('id, business_name')
      .eq('business_type', 'tour').eq('approval_status', 'approved')
      .order('business_name', { ascending: true })
    if (cErr) { setLoadError(cErr.message); setLoading(false); return }
    setCompanies(companyRows || [])

    if (editId) {
      const { data: listing, error } = await supabase.from('services').select('*').eq('id', editId).maybeSingle()
      if (error) { setLoadError(error.message); setLoading(false); return }
      if (listing) {
        setCompanyId(listing.company_id || '')
        setTitle(listing.title || '')
        setDestination(listing.destination || '')
        if (listing.departure_time) {
          setTourDate(toLocalDate(listing.departure_time))
          setStartTime(toLocalTime(listing.departure_time))
        }
        if (listing.arrival_time) setEndTime(toLocalTime(listing.arrival_time))
        setMeetingPoint(listing.meeting_point || '')
        setPrice(listing.price ? String(listing.price) : '')
        setQuantity(listing.seats_available != null ? String(listing.seats_available) : '')
        setTourType(listing.tour_type || '')
        setGateFee(listing.gate_fee != null ? String(listing.gate_fee) : '')
        setVehicleFee(listing.vehicle_fee != null ? String(listing.vehicle_fee) : '')
        setAmenities(listing.amenities || [])
        photos.setExisting(listing.photo_urls && listing.photo_urls.length > 0 ? listing.photo_urls : (listing.photo_url ? [listing.photo_url] : []))
      }
    } else if (companyRows && companyRows.length > 0) {
      setCompanyId(companyRows[0].id)
    }
    setLoading(false)
  }

  useEffect(() => { init() }, [editId])

  const toggleAmenity = (a: string) => setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))

  const handleSubmit = async () => {
    setErrorMsg('')
    if (!companyId) { setErrorMsg('Please select a company for this listing.'); return }
    if (!title.trim() || !price.trim() || !destination.trim()) {
      setErrorMsg('Please fill in title, price, and destination.')
      return
    }
    if (!(parseFloat(price) > 0)) { setErrorMsg('Price must be above zero.'); return }
    if (!tourDate || !startTime || !endTime) {
      setErrorMsg('Please fill in the tour date, start time, and end time.')
      return
    }
    if (durationMinutes == null) { setErrorMsg('End time must be later than start time.'); return }

    setSubmitting(true)

    const up = await photos.upload(companyId)
    if (up.error) { setSubmitting(false); setErrorMsg('Photo upload failed: ' + up.error); return }

    const payload = {
      company_id: companyId,
      category: 'tour',
      title: title.trim(),
      destination: destination.trim(),
      departure_time: new Date(`${tourDate}T${startTime}:00`).toISOString(),
      arrival_time: new Date(`${tourDate}T${endTime}:00`).toISOString(),
      duration_minutes: durationMinutes,
      meeting_point: meetingPoint.trim() || null,
      price: parseFloat(price),
      commission_rate: COMMISSION_RATE,
      seats_available: quantity ? parseInt(quantity, 10) : null,
      tour_type: tourType || null,
      gate_fee: gateFee ? parseFloat(gateFee) : null,
      vehicle_fee: vehicleFee ? parseFloat(vehicleFee) : null,
      photo_url: up.urls[0] || null,
      photo_urls: up.urls.length > 0 ? up.urls : null,
      amenities: amenities.length > 0 ? amenities : null,
    }

    const { data: saved, error } = editId
      ? await supabase.from('services').update(payload).eq('id', editId).select('id').single()
      : await supabase.from('services').insert({ ...payload, status: 'active' }).select('id').single()

    if (error || !saved) { setSubmitting(false); setErrorMsg(error?.message || 'Could not save the listing.'); return }

    await auditAdminListing(editId ? 'admin_updated_listing' : 'admin_created_listing', saved.id, title.trim(), 'tour', companyId)
    setSubmitting(false)
    setSuccess(true)
  }

  if (loading) return <LoadingBlock />
  if (loadError) return <ErrorBlock message={loadError} onRetry={init} />
  if (success) return <SuccessScreen title={editId ? 'Listing Updated!' : 'Listing Added!'} backLabel="Back to Tours" onBack={onSaved} />

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px' }}>
      <FormHeader title={editId ? 'Edit Tour Listing' : 'Add Tour Listing'} onCancel={onCancel} />

      {errorMsg && <p style={{ color: COLORS.red, fontSize: '13px', marginBottom: '12px' }}>{errorMsg}</p>}

      <Card>
        <CompanyField companies={companies} companyId={companyId} onChange={setCompanyId} typeLabel="tour" />
        <PhotoField photos={photos} />

        <Field label="Title">
          <input type="text" placeholder="e.g. Olumo Rock" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Meeting Point">
          <input type="text" placeholder="e.g. Main gate, Olumo Rock" value={meetingPoint} onChange={(e) => setMeetingPoint(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Destination">
          <input type="text" placeholder="e.g. Abeokuta, Ogun State" value={destination} onChange={(e) => setDestination(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Tour Date">
          <input type="date" value={tourDate} onChange={(e) => setTourDate(e.target.value)} style={inputStyle} />
        </Field>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <Field label="Start Time"><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} /></Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="End Time"><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle} /></Field>
          </div>
        </div>
        {startTime && endTime && (
          <p style={{ fontSize: '11.5px', color: durationMinutes == null ? COLORS.red : COLORS.textMuted, marginTop: '-8px', marginBottom: '14px' }}>
            {durationMinutes == null ? 'End time must be later than start time.' : <>Duration: <strong style={{ color: COLORS.text }}>{durationText(durationMinutes)}</strong></>}
          </p>
        )}

        <Field label="Tour Type">
          <SingleChips options={TOUR_TYPES} value={tourType} onChange={setTourType} icons={TOUR_TYPE_ICON} />
        </Field>

        <Field label="Price (₦ per person)">
          <input type="number" placeholder="e.g. 3500" value={price} onChange={(e) => setPrice(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Slots Available">
          <input type="number" placeholder="e.g. 30" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={inputStyle} />
        </Field>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <Field label="Gate Fee (₦, optional)"><input type="number" placeholder="e.g. 500" value={gateFee} onChange={(e) => setGateFee(e.target.value)} style={inputStyle} /></Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Vehicle Fee (₦, optional)"><input type="number" placeholder="e.g. 1000" value={vehicleFee} onChange={(e) => setVehicleFee(e.target.value)} style={inputStyle} /></Field>
          </div>
        </div>

        <Field label="Amenities">
          <MultiChips options={AMENITIES_LIST} selected={amenities} onToggle={toggleAmenity} icons={AMENITY_ICON} />
        </Field>

        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
          Commission: {COMMISSION_RATE}% will be deducted after each verified booking.
        </p>
        <SubmitButton submitting={submitting} disabled={companies.length === 0} editing={!!editId} onClick={handleSubmit} />
      </Card>
    </div>
  )
}
