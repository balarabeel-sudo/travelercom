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

type CabinClass = {
  id: string | null // existing inventory_item id, or null for a new (not-yet-saved) row
  name: string
  price: string
  quantity: string
  originalQuantity: number
}

const emptyCabinClass = (name = ''): CabinClass => ({ id: null, name, price: '', quantity: '', originalQuantity: 0 })

function AddFlightListing() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [approvalStatus, setApprovalStatus] = useState<string>('pending')
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([])

  const [title, setTitle] = useState('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')
  const [seatLayout, setSeatLayout] = useState('')
  const [boardingInfo, setBoardingInfo] = useState('')
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])

  const [cabinClasses, setCabinClasses] = useState<CabinClass[]>([emptyCabinClass('Economy')])

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [success, setSuccess] = useState(false)
  const [reductionNote, setReductionNote] = useState('')

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
          setOrigin(listing.origin || '')
          setDestination(listing.destination || '')
          setDepartureTime(listing.departure_time ? listing.departure_time.slice(0, 16) : '')
          setArrivalTime(listing.arrival_time ? listing.arrival_time.slice(0, 16) : '')
          setSeatLayout(listing.seat_layout || '')
          setBoardingInfo(listing.boarding_info || '')
          setExistingPhotoUrls(listing.photo_urls && listing.photo_urls.length > 0 ? listing.photo_urls : (listing.photo_url ? [listing.photo_url] : []))

          const { data: invItems, error: invErr } = await supabase
            .from('inventory_items')
            .select('id, name, total_quantity, price')
            .eq('service_id', editId)
            .order('price', { ascending: true })

          if (invErr) { setNetError(true); setLoading(false); return }

          if (invItems && invItems.length > 0) {
            setCabinClasses(invItems.map((it) => ({
              id: it.id, name: it.name, price: String(it.price), quantity: String(it.total_quantity), originalQuantity: it.total_quantity,
            })))
          } else {
            // Older/simple listing with no cabin-class inventory yet — seed one row from its own price/count
            setCabinClasses([{ id: null, name: 'Economy', price: listing.price ? String(listing.price) : '', quantity: listing.seats_available ? String(listing.seats_available) : '', originalQuantity: 0 }])
          }
        }
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [navigate, editId])

  const updateCabinClass = (idx: number, patch: Partial<CabinClass>) => {
    setCabinClasses((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }
  const addCabinClass = () => setCabinClasses((prev) => [...prev, emptyCabinClass()])
  const removeCabinClass = (idx: number) => setCabinClasses((prev) => prev.filter((_, i) => i !== idx))

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const room = 5 - (existingPhotoUrls.length + photoFiles.length)
    const toAdd = files.slice(0, Math.max(room, 0))
    setPhotoFiles((prev) => [...prev, ...toAdd])
    setPhotoPreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))])
    e.target.value = ''
  }
  const removeExistingPhoto = (index: number) => setExistingPhotoUrls((prev) => prev.filter((_, i) => i !== index))
  const removeNewPhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index))
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    setErrorMsg('')
    setReductionNote('')
    if (!title.trim() || !origin.trim() || !destination.trim() || !departureTime) {
      setErrorMsg('Please fill in the flight name, origin, destination, and departure time.')
      return
    }
    if (!companyId) {
      setErrorMsg('Company profile not found.')
      return
    }
    if (arrivalTime && new Date(arrivalTime) <= new Date(departureTime)) {
      setErrorMsg('Arrival time must be after departure time.')
      return
    }
    for (const c of cabinClasses) {
      const qty = parseInt(c.quantity, 10)
      const priceVal = parseFloat(c.price)
      if (!c.name.trim() || !qty || qty < 1 || !priceVal || priceVal <= 0) {
        setErrorMsg('Every cabin class needs a name, a seat count, and a price.')
        return
      }
    }

    setSubmitting(true)

    const uploadedUrls: string[] = []
    for (const file of photoFiles) {
      if (!file) continue
      const fileExt = file.name.split('.').pop()
      const fileName = `${companyId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${fileExt}`
      const { error: uploadErr } = await supabase.storage.from('listing-photos').upload(fileName, file)
      if (uploadErr) {
        setSubmitting(false)
        setErrorMsg('Photo upload failed: ' + uploadErr.message)
        return
      }
      const { data: urlData } = supabase.storage.from('listing-photos').getPublicUrl(fileName)
      uploadedUrls.push(urlData.publicUrl)
    }
    const finalPhotoUrls = [...existingPhotoUrls, ...uploadedUrls].slice(0, 5)

    const lowestPrice = Math.min(...cabinClasses.map((c) => parseFloat(c.price)))
    const totalSeats = cabinClasses.reduce((sum, c) => sum + parseInt(c.quantity, 10), 0)

    const payload = {
      company_id: companyId,
      category: 'flight',
      title: title.trim(),
      origin: origin.trim(),
      destination: destination.trim(),
      departure_time: new Date(departureTime).toISOString(),
      arrival_time: arrivalTime ? new Date(arrivalTime).toISOString() : null,
      seat_layout: seatLayout.trim() || null,
      boarding_info: boardingInfo.trim() || null,
      price: lowestPrice,
      commission_rate: COMMISSION_RATE,
      seats_available: totalSeats,
      photo_url: finalPhotoUrls[0] || null,
      photo_urls: finalPhotoUrls.length > 0 ? finalPhotoUrls : null,
    }

    const { data: savedListing, error } = editId
      ? await supabase.from('services').update(payload).eq('id', editId).select('id').single()
      : await supabase.from('services').insert({ ...payload, status: 'active' }).select('id').single()

    if (error || !savedListing) {
      setSubmitting(false)
      setErrorMsg(error?.message || 'Could not save the listing.')
      return
    }

    const serviceId = savedListing.id
    const notes: string[] = []

    for (const c of cabinClasses) {
      const qty = parseInt(c.quantity, 10)
      const priceVal = parseFloat(c.price)

      if (!c.id) {
        const { data: newItem, error: itemErr } = await supabase.from('inventory_items').insert({
          company_id: companyId, service_id: serviceId, name: c.name.trim(), total_quantity: qty, price: priceVal,
        }).select('id').single()

        if (!itemErr && newItem) {
          const unitRows = Array.from({ length: qty }, (_, i) => ({
            inventory_item_id: newItem.id, unit_number: (i + 1).toString(), status: 'available',
          }))
          await supabase.from('inventory_units').insert(unitRows)
        }
      } else {
        await supabase.from('inventory_items').update({ name: c.name.trim(), price: priceVal }).eq('id', c.id)

        const delta = qty - c.originalQuantity
        if (delta > 0) {
          const { count } = await supabase.from('inventory_units').select('*', { count: 'exact', head: true }).eq('inventory_item_id', c.id)
          const startAt = (count || 0) + 1
          const addRows = Array.from({ length: delta }, (_, i) => ({
            inventory_item_id: c.id, unit_number: (startAt + i).toString(), status: 'available',
          }))
          await supabase.from('inventory_units').insert(addRows)
          await supabase.from('inventory_items').update({ total_quantity: qty }).eq('id', c.id)
        } else if (delta < 0) {
          const { data: availableUnits } = await supabase
            .from('inventory_units').select('id, unit_number').eq('inventory_item_id', c.id).eq('status', 'available')
            .order('unit_number', { ascending: false })

          const removable = Math.min(-delta, (availableUnits || []).length)
          if (removable > 0) {
            const idsToRemove = (availableUnits || []).slice(0, removable).map((u) => u.id)
            await supabase.from('inventory_units').delete().in('id', idsToRemove)
          }
          const actualNewTotal = c.originalQuantity - removable
          await supabase.from('inventory_items').update({ total_quantity: actualNewTotal }).eq('id', c.id)
          if (removable < -delta) {
            notes.push(`"${c.name}" could only be reduced to ${actualNewTotal} seats — some are currently booked.`)
          }
        }
      }
    }

    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      await supabase.rpc('log_audit', {
        p_action: editId ? 'updated_listing' : 'created_listing',
        p_module: 'listings', p_target_type: 'service', p_target_id: serviceId,
        p_previous: null, p_new: { title: title.trim(), category: 'flight' }, p_company_id: companyId,
      })
    }

    setSubmitting(false)
    setReductionNote(notes.join(' '))
    setSuccess(true)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ padding: '18px 20px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Flight Listing</h1>
        </div>
        <DetailsSkeleton />
      </div>
    )
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ padding: '18px 20px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Flight Listing</h1>
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
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Flight Listing</h1>
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
          {reductionNote && <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '14px', maxWidth: '300px' }}>{reductionNote}</p>}
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
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>{editId ? 'Edit Flight Listing' : 'Add Flight Listing'}</h1>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <div style={{ background: COLORS.card, borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: COLORS.primary }}>
          <Icon name="plane" size={14} color={COLORS.primary} /> Flight
        </div>

        {errorMsg && <p style={{ color: COLORS.red, fontSize: '13px', marginBottom: '12px' }}>{errorMsg}</p>}

        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: '14px' }}>

          <Field label={`Photos (${existingPhotoUrls.length + photoFiles.length}/5)`}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {existingPhotoUrls.map((url, i) => (
                <div key={`ex-${i}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: '10px', overflow: 'hidden' }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span onClick={() => removeExistingPhoto(i)} style={{
                    position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}><Icon name="x" size={11} color="white" /></span>
                </div>
              ))}
              {photoPreviews.map((url, i) => (
                <div key={`new-${i}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: '10px', overflow: 'hidden' }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span onClick={() => removeNewPhoto(i)} style={{
                    position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}><Icon name="x" size={11} color="white" /></span>
                </div>
              ))}
              {existingPhotoUrls.length + photoFiles.length < 5 && (
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '1',
                  border: `2px dashed ${COLORS.border}`, borderRadius: '10px', cursor: 'pointer', background: COLORS.bg,
                }}>
                  <Icon name="camera" size={18} color={COLORS.textMuted} />
                  <input type="file" accept="image/*" multiple onChange={handlePhotoChange} style={{ display: 'none' }} />
                </label>
              )}
            </div>
            <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '6px' }}>First photo is used as the cover photo shown in listings.</p>
          </Field>

          <Field label="Flight Name">
            <input type="text" placeholder="e.g. Traveler Air 101" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          </Field>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <Field label="Origin"><input type="text" placeholder="e.g. Abuja (ABV)" value={origin} onChange={(e) => setOrigin(e.target.value)} style={inputStyle} /></Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Destination"><input type="text" placeholder="e.g. Lagos (LOS)" value={destination} onChange={(e) => setDestination(e.target.value)} style={inputStyle} /></Field>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <Field label="Departure"><input type="datetime-local" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} style={inputStyle} /></Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Arrival (optional)"><input type="datetime-local" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} style={inputStyle} /></Field>
            </div>
          </div>

          <Field label="Seat Layout (optional)">
            <input type="text" placeholder="e.g. 3-3 configuration" value={seatLayout} onChange={(e) => setSeatLayout(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Boarding Information (optional)">
            <input type="text" placeholder="e.g. Gate closes 45 minutes before departure" value={boardingInfo} onChange={(e) => setBoardingInfo(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>Cabin Classes</p>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
            Add each cabin class you're selling (e.g. Economy, Business), with how many seats and the price per seat. Seat numbers are assigned automatically.
          </p>

          {cabinClasses.map((c, idx) => (
            <div key={idx} style={{ border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <input
                  type="text" placeholder="Cabin class name (e.g. Economy)" value={c.name}
                  onChange={(e) => updateCabinClass(idx, { name: e.target.value })}
                  style={{ ...inputStyle, fontWeight: 700 }}
                />
                {cabinClasses.length > 1 && !c.id && (
                  <span onClick={() => removeCabinClass(idx)} style={{ marginLeft: '8px', cursor: 'pointer', display: 'flex' }}>
                    <Icon name="x" size={16} color={COLORS.textMuted} />
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number" placeholder="No. of seats" value={c.quantity}
                  onChange={(e) => updateCabinClass(idx, { quantity: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  type="number" placeholder="Price/seat (₦)" value={c.price}
                  onChange={(e) => updateCabinClass(idx, { price: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            </div>
          ))}

          <span onClick={addCabinClass} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: COLORS.primary, fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginBottom: '14px' }}>
            <Icon name="plus" size={14} color={COLORS.primary} /> Add another cabin class
          </span>

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

export default AddFlightListing
