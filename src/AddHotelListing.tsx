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

function AddHotelListing() {
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
  const [checkInTime, setCheckInTime] = useState('14:00')
  const [checkOutTime, setCheckOutTime] = useState('12:00')
  const [maxGuests, setMaxGuests] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [amenities, setAmenities] = useState<string[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([newRow()])

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
          setDestination(listing.destination || '')
          setCheckInTime(listing.check_in_time || '14:00')
          setCheckOutTime(listing.check_out_time || '12:00')
          setMaxGuests(listing.max_guests != null ? String(listing.max_guests) : '')
          setAmenities(listing.amenities || [])
          setExistingPhotoUrl(listing.photo_url || '')

          const { data: invItems, error: invErr } = await supabase
            .from('inventory_items')
            .select('id, name, total_quantity, price')
            .eq('service_id', editId)
            .order('created_at', { ascending: true })

          if (invErr) { setNetError(true); setLoading(false); return }

          if (invItems && invItems.length > 0) {
            setRoomTypes(invItems.map((it) => ({
              key: it.id, inventoryItemId: it.id, name: it.name,
              quantity: String(it.total_quantity), price: String(it.price), originalQuantity: it.total_quantity,
            })))
          } else {
            // Older listing saved before room types existed — seed one row from its own price/count
            setRoomTypes([{
              key: newRow().key, inventoryItemId: null, name: 'Standard Room',
              quantity: listing.seats_available ? String(listing.seats_available) : '',
              price: listing.price ? String(listing.price) : '', originalQuantity: 0,
            }])
          }
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

  const updateRoomType = (key: string, field: 'name' | 'quantity' | 'price', value: string) => {
    setRoomTypes((prev) => prev.map((r) => r.key === key ? { ...r, [field]: value } : r))
  }

  const addRoomTypeRow = () => setRoomTypes((prev) => [...prev, newRow()])
  const removeRoomTypeRow = (key: string) => setRoomTypes((prev) => prev.length > 1 ? prev.filter((r) => r.key !== key) : prev)

  const handleSubmit = async () => {
    setErrorMsg('')
    setReductionNote('')
    if (!title.trim() || !destination.trim()) {
      setErrorMsg('Please fill in the hotel name and city.')
      return
    }
    if (!companyId) {
      setErrorMsg('Company profile not found.')
      return
    }

    const filledRows = roomTypes.filter((r) => r.name.trim() && r.quantity.trim() && r.price.trim())
    if (filledRows.length === 0) {
      setErrorMsg('Add at least one room type with a name, number of rooms, and price.')
      return
    }

    const namesLower = filledRows.map((r) => r.name.trim().toLowerCase())
    const hasDuplicate = namesLower.some((n, i) => namesLower.indexOf(n) !== i)
    if (hasDuplicate) {
      setErrorMsg('Two room types have the same name. Please give each room type a unique name.')
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
      photo_url: photoUrl,
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
            const idsToRemove = (availableUnits || []).slice(0, removable).map((u) => u.id)
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
        p_action: editId ? 'updated_listing' : 'created_listing',
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
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ padding: '18px 20px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Hotel Listing</h1>
        </div>
        <DetailsSkeleton />
      </div>
    )
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ padding: '18px 20px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Hotel Listing</h1>
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
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Hotel Listing</h1>
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
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>{editId ? 'Edit Hotel Listing' : 'Add Hotel Listing'}</h1>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <div style={{ background: COLORS.card, borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: COLORS.primary }}>
          <Icon name="hotel" size={14} color={COLORS.primary} /> Hotel
        </div>

        {errorMsg && <p style={{ color: COLORS.red, fontSize: '13px', marginBottom: '12px' }}>{errorMsg}</p>}

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
            Add each room type you offer with how many you have and the price. Room numbers are assigned automatically.
          </p>

          {roomTypes.map((row, idx) => (
            <div key={row.key} style={{ border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted }}>Room Type {idx + 1}</span>
                {roomTypes.length > 1 && (
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

export default AddHotelListing
