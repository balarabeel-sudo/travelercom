import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9', secondary: '#F97316', bg: '#F8FAFC', card: '#FFFFFF',
  text: '#1A1A1A', textMuted: '#64748B', border: '#E2E8F0', green: '#16a34a', red: '#DC2626',
}

const COMMISSION_RATE = 3

const AMENITY_ICON: Record<string, string> = {
  WiFi: 'wifi', Parking: 'parking', Restaurant: 'restaurant', Pool: 'pool', Gym: 'gym',
  'Airport Pickup': 'plane', 'Conference Hall': 'building', Laundry: 'laundry', AC: 'snowflake', Breakfast: 'coffee',
}
const AMENITIES_LIST = Object.keys(AMENITY_ICON)

type RoomTypeRow = {
  key: string
  inventoryItemId: string | null
  name: string
  quantity: string
  price: string
  originalQuantity: number
}

function newRow(): RoomTypeRow {
  return { key: Math.random().toString(36).slice(2), inventoryItemId: null, name: '', quantity: '', price: '', originalQuantity: 0 }
}

type CompanyOption = { id: string; business_name: string }

type Props = {
  editId?: string | null
  onSaved: () => void
  onCancel: () => void
}

// Admin version of AddHotelListing.tsx: same listing / room-type logic, but the
// company is picked from a dropdown (admin is not the company owner). Only
// approved companies with business_type='hotel' are offered. This lets the
// founder list hotels that are not on TravelerCom themselves, using the prices
// the hotel gave us.
function AdminHotelForm({ editId, onSaved, onCancel }: Props) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [companyId, setCompanyId] = useState<string>('')
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([])

  const [title, setTitle] = useState('')
  const [destination, setDestination] = useState('')
  const [checkInTime, setCheckInTime] = useState('14:00')
  const [checkOutTime, setCheckOutTime] = useState('12:00')
  const [maxGuests, setMaxGuests] = useState('')
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [amenities, setAmenities] = useState<string[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([newRow()])

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [success, setSuccess] = useState(false)
  const [reductionNote, setReductionNote] = useState('')

  const load = async () => {
    setLoading(true)
    setLoadError('')

    const { data: companyRows, error: companiesErr } = await supabase
      .from('companies')
      .select('id, business_name')
      .eq('business_type', 'hotel')
      .eq('approval_status', 'approved')
      .order('business_name', { ascending: true })

    if (companiesErr) { setLoadError(companiesErr.message); setLoading(false); return }
    setCompanies(companyRows || [])

    if (editId) {
      const { data: listing, error: listingErr } = await supabase.from('services').select('*').eq('id', editId).maybeSingle()
      if (listingErr) { setLoadError(listingErr.message); setLoading(false); return }

      if (listing) {
        setCompanyId(listing.company_id || '')
        setTitle(listing.title || '')
        setDestination(listing.destination || '')
        setCheckInTime(listing.check_in_time || '14:00')
        setCheckOutTime(listing.check_out_time || '12:00')
        setMaxGuests(listing.max_guests != null ? String(listing.max_guests) : '')
        setAmenities(listing.amenities || [])
        setExistingPhotoUrls(listing.photo_urls && listing.photo_urls.length > 0 ? listing.photo_urls : (listing.photo_url ? [listing.photo_url] : []))

        const { data: invItems, error: invErr } = await supabase
          .from('inventory_items')
          .select('id, name, total_quantity, price')
          .eq('service_id', editId)
          .order('created_at', { ascending: true })

        if (invErr) { setLoadError(invErr.message); setLoading(false); return }

        if (invItems && invItems.length > 0) {
          setRoomTypes(invItems.map((it: any) => ({
            key: it.id, inventoryItemId: it.id, name: it.name,
            quantity: String(it.total_quantity), price: String(it.price), originalQuantity: it.total_quantity,
          })))
        } else {
          // Older listing saved before room types existed: seed one row from its own price/count.
          setRoomTypes([{
            key: newRow().key, inventoryItemId: null, name: 'Standard Room',
            quantity: listing.seats_available ? String(listing.seats_available) : '',
            price: listing.price ? String(listing.price) : '', originalQuantity: 0,
          }])
        }
      }
    } else if (companyRows && companyRows.length > 0) {
      setCompanyId(companyRows[0].id)
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [editId])

  const toggleAmenity = (a: string) => {
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))
  }

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

  const updateRoomType = (key: string, field: 'name' | 'quantity' | 'price', value: string) => {
    setRoomTypes((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)))
  }
  const addRoomTypeRow = () => setRoomTypes((prev) => [...prev, newRow()])
  const removeRoomTypeRow = (key: string) => setRoomTypes((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev))

  const handleSubmit = async () => {
    setErrorMsg('')
    setReductionNote('')
    if (!companyId) {
      setErrorMsg('Please select a company for this listing.')
      return
    }
    if (!title.trim() || !destination.trim()) {
      setErrorMsg('Please fill in the hotel name and city.')
      return
    }

    const filledRows = roomTypes.filter((r) => r.name.trim() && r.quantity.trim() && r.price.trim())
    if (filledRows.length === 0) {
      setErrorMsg('Add at least one room type with a name, number of rooms, and price.')
      return
    }
    for (const r of filledRows) {
      const q = parseInt(r.quantity, 10)
      const p = parseFloat(r.price)
      if (!q || q < 1 || !p || p <= 0) {
        setErrorMsg(`"${r.name.trim()}" needs a valid number of rooms and a price above zero.`)
        return
      }
    }

    const namesLower = filledRows.map((r) => r.name.trim().toLowerCase())
    const hasDuplicate = namesLower.some((n, i) => namesLower.indexOf(n) !== i)
    if (hasDuplicate) {
      setErrorMsg('Two room types have the same name. Please give each room type a unique name.')
      return
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

    const totalRooms = filledRows.reduce((sum, r) => sum + parseInt(r.quantity, 10), 0)
    const minPrice = Math.min(...filledRows.map((r) => parseFloat(r.price)))

    const payload = {
      company_id: companyId,
      category: 'hotel',
      title: title.trim(),
      destination: destination.trim(),
      price: minPrice,
      commission_rate: COMMISSION_RATE,
      seats_available: totalRooms,
      photo_url: finalPhotoUrls[0] || null,
      photo_urls: finalPhotoUrls.length > 0 ? finalPhotoUrls : null,
      amenities: amenities.length > 0 ? amenities : null,
      check_in_time: checkInTime || null,
      check_out_time: checkOutTime || null,
      max_guests: maxGuests ? parseInt(maxGuests, 10) : null,
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

    for (const row of filledRows) {
      const qty = parseInt(row.quantity, 10)
      const priceVal = parseFloat(row.price)

      if (!row.inventoryItemId) {
        const { data: newItem, error: itemErr } = await supabase.from('inventory_items').insert({
          company_id: companyId, service_id: serviceId, name: row.name.trim(), total_quantity: qty, price: priceVal,
        }).select('id').single()

        if (!itemErr && newItem) {
          const unitRows = Array.from({ length: qty }, (_, i) => ({
            inventory_item_id: newItem.id, unit_number: (i + 1).toString(), status: 'available',
          }))
          await supabase.from('inventory_units').insert(unitRows)
        } else if (itemErr) {
          notes.push(`Room type "${row.name.trim()}" could not be saved: ${itemErr.message}`)
        }
      } else {
        await supabase.from('inventory_items').update({ name: row.name.trim(), price: priceVal }).eq('id', row.inventoryItemId)

        const delta = qty - row.originalQuantity
        if (delta > 0) {
          const { count } = await supabase.from('inventory_units').select('*', { count: 'exact', head: true }).eq('inventory_item_id', row.inventoryItemId)
          const startAt = (count || 0) + 1
          const addRows = Array.from({ length: delta }, (_, i) => ({
            inventory_item_id: row.inventoryItemId, unit_number: (startAt + i).toString(), status: 'available',
          }))
          await supabase.from('inventory_units').insert(addRows)
          await supabase.from('inventory_items').update({ total_quantity: qty }).eq('id', row.inventoryItemId)
        } else if (delta < 0) {
          const { data: availableUnits } = await supabase
            .from('inventory_units').select('id, unit_number').eq('inventory_item_id', row.inventoryItemId).eq('status', 'available')
            .order('unit_number', { ascending: false })

          const removable = Math.min(-delta, (availableUnits || []).length)
          if (removable > 0) {
            const idsToRemove = (availableUnits || []).slice(0, removable).map((u: any) => u.id)
            await supabase.from('inventory_units').delete().in('id', idsToRemove)
          }
          const actualNewTotal = row.originalQuantity - removable
          await supabase.from('inventory_items').update({ total_quantity: actualNewTotal }).eq('id', row.inventoryItemId)
          if (removable < -delta) {
            notes.push(`"${row.name.trim()}" could only be reduced to ${actualNewTotal} — some rooms are currently booked or under maintenance.`)
          }
        }
      }
    }

    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      await supabase.rpc('log_audit', {
        p_action: editId ? 'admin_updated_listing' : 'admin_created_listing',
        p_module: 'listings', p_target_type: 'service', p_target_id: serviceId,
        p_previous: null, p_new: { title: title.trim(), category: 'hotel' }, p_company_id: companyId,
      })
    }

    setSubmitting(false)
    setReductionNote(notes.join(' '))
    setSuccess(true)
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
        <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
        <p style={{ fontSize: '13px', color: COLORS.red, marginBottom: '12px' }}>{loadError}</p>
        <span onClick={load} style={{ fontSize: '13px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Retry</span>
      </div>
    )
  }

  if (success) {
    return (
      <div style={{ padding: '50px 20px', textAlign: 'center' as const }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><Icon name="check" size={40} color={COLORS.green} /></div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.green, marginBottom: '8px' }}>{editId ? 'Listing Updated!' : 'Listing Added!'}</p>
        {reductionNote && <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '14px', maxWidth: '360px', margin: '0 auto 14px auto' }}>{reductionNote}</p>}
        <button onClick={onSaved} style={{ padding: '12px 24px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
          Back to Hotels
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span onClick={onCancel} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="arrowLeft" size={19} color={COLORS.text} /></span>
        <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>{editId ? 'Edit Hotel Listing' : 'Add Hotel Listing'}</h2>
      </div>

      {errorMsg && <p style={{ color: COLORS.red, fontSize: '13px', marginBottom: '12px' }}>{errorMsg}</p>}

      <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: '14px' }}>
        <Field label="Company">
          {companies.length === 0 ? (
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>No approved hotel companies found. Create and approve a company with business type "Hotel" first.</p>
          ) : (
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} style={inputStyle}>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
          )}
        </Field>

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

        <Field label="Hotel Name">
          <input type="text" placeholder="e.g. Zaranda Hotel" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="City">
          <input type="text" placeholder="e.g. Kano" value={destination} onChange={(e) => setDestination(e.target.value)} style={inputStyle} />
        </Field>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <Field label="Check-in Time">
              <input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} style={inputStyle} />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Check-out Time">
              <input type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </div>

        <Field label="Maximum Guests per Room">
          <input type="number" placeholder="e.g. 2" value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} style={inputStyle} />
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

      <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>Room Types</p>
        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
          Add each room type the hotel offers with how many rooms there are and the price per night. Room numbers are assigned automatically.
        </p>

        {roomTypes.map((row, idx) => (
          <div key={row.key} style={{ border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted }}>Room Type {idx + 1}</span>
              {roomTypes.length > 1 && !row.inventoryItemId && (
                <span onClick={() => removeRoomTypeRow(row.key)} style={{ cursor: 'pointer', display: 'flex' }}>
                  <Icon name="trash" size={14} color={COLORS.red} />
                </span>
              )}
            </div>
            <input
              type="text" placeholder="e.g. Deluxe Room" value={row.name}
              onChange={(e) => updateRoomType(row.key, 'name', e.target.value)}
              style={{ ...inputStyle, marginBottom: '8px' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number" placeholder="No. of rooms" value={row.quantity}
                onChange={(e) => updateRoomType(row.key, 'quantity', e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="number" placeholder="Price/night (₦)" value={row.price}
                onChange={(e) => updateRoomType(row.key, 'price', e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
          </div>
        ))}

        <div onClick={addRoomTypeRow} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          border: `1.5px dashed ${COLORS.primary}`, color: COLORS.primary, borderRadius: '10px',
          padding: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', marginBottom: '14px',
        }}>
          <Icon name="plus" size={13} color={COLORS.primary} /> Add Another Room Type
        </div>

        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
          Commission: {COMMISSION_RATE}% will be deducted after each verified booking.
        </p>

        <button
          onClick={handleSubmit}
          disabled={submitting || companies.length === 0}
          style={{
            width: '100%', padding: '13px', background: (submitting || companies.length === 0) ? '#94a3b8' : COLORS.secondary,
            color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px',
            cursor: (submitting || companies.length === 0) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}>
          {submitting ? (editId ? 'Updating...' : 'Adding...') : editId ? (<><Icon name="check" size={14} color="white" strokeWidth={2.5} /> Update Listing</>) : (<><Icon name="plus" size={14} color="white" strokeWidth={2.5} /> Add Listing</>)}
        </button>
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

export default AdminHotelForm
