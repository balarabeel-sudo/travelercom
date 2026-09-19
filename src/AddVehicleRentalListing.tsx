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

const FEATURE_ICON: Record<string, string> = {
  'Air Conditioning': 'snowflake', GPS: 'compass', Bluetooth: 'bluetooth', USB: 'plug',
  'Wi-Fi': 'wifi', 'Child Seat': 'seat',
}
const FEATURES_LIST = Object.keys(FEATURE_ICON)

const TRANSMISSIONS = ['Automatic', 'Manual']
const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid']
const RENTAL_MODES: { key: string; label: string }[] = [
  { key: 'self_drive', label: 'Self-Drive' },
  { key: 'with_driver', label: 'With Driver' },
  { key: 'both', label: 'Both' },
]

function AddVehicleRentalListing() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [approvalStatus, setApprovalStatus] = useState<string>('pending')
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([])

  const [title, setTitle] = useState('')
  const [destination, setDestination] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [transmission, setTransmission] = useState('Automatic')
  const [fuelType, setFuelType] = useState('Petrol')
  const [doors, setDoors] = useState('')
  const [seats, setSeats] = useState('')
  const [rentalMode, setRentalMode] = useState('self_drive')
  const [deposit, setDeposit] = useState('')
  const [minRentalDays, setMinRentalDays] = useState('1')
  const [maxRentalDays, setMaxRentalDays] = useState('')
  const [pickupLocation, setPickupLocation] = useState('')
  const [dropOffLocation, setDropOffLocation] = useState('')
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [features, setFeatures] = useState<string[]>([])

  const [inventoryItemId, setInventoryItemId] = useState<string | null>(null)
  const [originalQuantity, setOriginalQuantity] = useState(0)
  const [fleetQuantity, setFleetQuantity] = useState('')
  const [pricePerDay, setPricePerDay] = useState('')

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
          setBrand(listing.brand || '')
          setModel(listing.model || '')
          setYear(listing.year != null ? String(listing.year) : '')
          setTransmission(listing.transmission || 'Automatic')
          setFuelType(listing.fuel_type || 'Petrol')
          setDoors(listing.doors != null ? String(listing.doors) : '')
          setSeats(listing.capacity != null ? String(listing.capacity) : '')
          setRentalMode(listing.rental_mode || 'self_drive')
          setDeposit(listing.deposit != null ? String(listing.deposit) : '')
          setMinRentalDays(listing.min_rental_days != null ? String(listing.min_rental_days) : '1')
          setMaxRentalDays(listing.max_rental_days != null ? String(listing.max_rental_days) : '')
          setPickupLocation(listing.pickup_location || '')
          setDropOffLocation(listing.drop_off_location || '')
          setFeatures(listing.amenities || [])
          setExistingPhotoUrls(listing.photo_urls && listing.photo_urls.length > 0 ? listing.photo_urls : (listing.photo_url ? [listing.photo_url] : []))

          const { data: invItems, error: invErr } = await supabase
            .from('inventory_items')
            .select('id, total_quantity, price')
            .eq('service_id', editId)
            .order('created_at', { ascending: true })
            .limit(1)

          if (invErr) { setNetError(true); setLoading(false); return }

          if (invItems && invItems.length > 0) {
            setInventoryItemId(invItems[0].id)
            setOriginalQuantity(invItems[0].total_quantity)
            setFleetQuantity(String(invItems[0].total_quantity))
            setPricePerDay(String(invItems[0].price))
          } else {
            // Older/simple listing with no fleet inventory row yet — seed from its own price/count
            setFleetQuantity(listing.seats_available ? String(listing.seats_available) : '1')
            setPricePerDay(listing.price ? String(listing.price) : '')
          }
        }
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [navigate, editId])

  const toggleFeature = (f: string) => {
    setFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f])
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

  const removeExistingPhoto = (index: number) => {
    setExistingPhotoUrls((prev) => prev.filter((_, i) => i !== index))
  }

  const removeNewPhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index))
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    setErrorMsg('')
    setReductionNote('')
    if (!title.trim() || !destination.trim()) {
      setErrorMsg('Please fill in the vehicle name and city.')
      return
    }
    if (!companyId) {
      setErrorMsg('Company profile not found.')
      return
    }
    const qty = parseInt(fleetQuantity, 10)
    const priceVal = parseFloat(pricePerDay)
    if (!qty || qty < 1 || !priceVal || priceVal <= 0) {
      setErrorMsg('Enter how many of this vehicle you have and the price per day.')
      return
    }
    if (minRentalDays && maxRentalDays && parseInt(maxRentalDays, 10) < parseInt(minRentalDays, 10)) {
      setErrorMsg('Maximum rental days cannot be less than minimum rental days.')
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

    const payload = {
      company_id: companyId,
      category: 'vehicle_rental',
      title: title.trim(),
      destination: destination.trim(),
      brand: brand.trim() || null,
      model: model.trim() || null,
      year: year ? parseInt(year, 10) : null,
      transmission,
      fuel_type: fuelType,
      doors: doors ? parseInt(doors, 10) : null,
      capacity: seats ? parseInt(seats, 10) : null,
      rental_mode: rentalMode,
      deposit: deposit ? parseFloat(deposit) : null,
      min_rental_days: minRentalDays ? parseInt(minRentalDays, 10) : null,
      max_rental_days: maxRentalDays ? parseInt(maxRentalDays, 10) : null,
      pickup_location: pickupLocation.trim() || null,
      drop_off_location: dropOffLocation.trim() || null,
      price: priceVal,
      commission_rate: COMMISSION_RATE,
      seats_available: qty,
      photo_url: finalPhotoUrls[0] || null,
      photo_urls: finalPhotoUrls.length > 0 ? finalPhotoUrls : null,
      amenities: features.length > 0 ? features : null,
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

    if (!inventoryItemId) {
      const { data: newItem, error: itemErr } = await supabase.from('inventory_items').insert({
        company_id: companyId, service_id: serviceId, name: title.trim(), total_quantity: qty, price: priceVal,
      }).select('id').single()

      if (!itemErr && newItem) {
        const unitRows = Array.from({ length: qty }, (_, i) => ({
          inventory_item_id: newItem.id, unit_number: (i + 1).toString(), status: 'available',
        }))
        await supabase.from('inventory_units').insert(unitRows)
      }
    } else {
      await supabase.from('inventory_items').update({ name: title.trim(), price: priceVal }).eq('id', inventoryItemId)

      const delta = qty - originalQuantity
      if (delta > 0) {
        const { count } = await supabase.from('inventory_units').select('*', { count: 'exact', head: true }).eq('inventory_item_id', inventoryItemId)
        const startAt = (count || 0) + 1
        const addRows = Array.from({ length: delta }, (_, i) => ({
          inventory_item_id: inventoryItemId, unit_number: (startAt + i).toString(), status: 'available',
        }))
        await supabase.from('inventory_units').insert(addRows)
        await supabase.from('inventory_items').update({ total_quantity: qty }).eq('id', inventoryItemId)
      } else if (delta < 0) {
        const { data: availableUnits } = await supabase
          .from('inventory_units').select('id, unit_number').eq('inventory_item_id', inventoryItemId).eq('status', 'available')
          .order('unit_number', { ascending: false })

        const removable = Math.min(-delta, (availableUnits || []).length)
        if (removable > 0) {
          const idsToRemove = (availableUnits || []).slice(0, removable).map((u) => u.id)
          await supabase.from('inventory_units').delete().in('id', idsToRemove)
        }
        const actualNewTotal = originalQuantity - removable
        await supabase.from('inventory_items').update({ total_quantity: actualNewTotal }).eq('id', inventoryItemId)
        if (removable < -delta) {
          notes.push(`Fleet could only be reduced to ${actualNewTotal} — some vehicles are currently rented or under maintenance.`)
        }
      }
    }

    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      await supabase.rpc('log_audit', {
        p_action: editId ? 'updated_listing' : 'created_listing',
        p_module: 'listings', p_target_type: 'service', p_target_id: serviceId,
        p_previous: null, p_new: { title: title.trim(), category: 'vehicle_rental' }, p_company_id: companyId,
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
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Vehicle Rental Listing</h1>
        </div>
        <DetailsSkeleton />
      </div>
    )
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ padding: '18px 20px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Vehicle Rental Listing</h1>
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
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Add Vehicle Rental Listing</h1>
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
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>{editId ? 'Edit Vehicle Rental Listing' : 'Add Vehicle Rental Listing'}</h1>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <div style={{ background: COLORS.card, borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: COLORS.primary }}>
          <Icon name="car" size={14} color={COLORS.primary} /> Vehicle Rental
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

          <Field label="Vehicle Name">
            <input type="text" placeholder="e.g. Toyota Camry 2022" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="City">
            <input type="text" placeholder="e.g. Kano" value={destination} onChange={(e) => setDestination(e.target.value)} style={inputStyle} />
          </Field>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <Field label="Brand"><input type="text" placeholder="e.g. Toyota" value={brand} onChange={(e) => setBrand(e.target.value)} style={inputStyle} /></Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Model"><input type="text" placeholder="e.g. Camry" value={model} onChange={(e) => setModel(e.target.value)} style={inputStyle} /></Field>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <Field label="Year"><input type="number" placeholder="e.g. 2022" value={year} onChange={(e) => setYear(e.target.value)} style={inputStyle} /></Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Seats"><input type="number" placeholder="e.g. 5" value={seats} onChange={(e) => setSeats(e.target.value)} style={inputStyle} /></Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Doors"><input type="number" placeholder="e.g. 4" value={doors} onChange={(e) => setDoors(e.target.value)} style={inputStyle} /></Field>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <Field label="Transmission">
                <select value={transmission} onChange={(e) => setTransmission(e.target.value)} style={inputStyle}>
                  {TRANSMISSIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Fuel Type">
                <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} style={inputStyle}>
                  {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
            </div>
          </div>

          <Field label="Rental Mode">
            <div style={{ display: 'flex', gap: '8px' }}>
              {RENTAL_MODES.map((m) => {
                const active = rentalMode === m.key
                return (
                  <span key={m.key} onClick={() => setRentalMode(m.key)} style={{
                    flex: 1, textAlign: 'center' as const, padding: '9px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
                    background: active ? COLORS.primary : COLORS.bg,
                    color: active ? 'white' : COLORS.textMuted,
                  }}>{m.label}</span>
                )
              })}
            </div>
          </Field>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <Field label="Pickup Location"><input type="text" placeholder="e.g. Kano Airport" value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} style={inputStyle} /></Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Drop-off Location"><input type="text" placeholder="Same as pickup if blank" value={dropOffLocation} onChange={(e) => setDropOffLocation(e.target.value)} style={inputStyle} /></Field>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <Field label="Min Rental Days"><input type="number" min="1" value={minRentalDays} onChange={(e) => setMinRentalDays(e.target.value)} style={inputStyle} /></Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Max Rental Days"><input type="number" placeholder="No limit" value={maxRentalDays} onChange={(e) => setMaxRentalDays(e.target.value)} style={inputStyle} /></Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Deposit (₦)"><input type="number" placeholder="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} style={inputStyle} /></Field>
            </div>
          </div>

          <Field label="Features">
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
              {FEATURES_LIST.map((f) => {
                const active = features.includes(f)
                return (
                  <span key={f} onClick={() => toggleFeature(f)} style={{
                    display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '20px',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
                    background: active ? COLORS.primary : COLORS.bg,
                    color: active ? 'white' : COLORS.textMuted,
                  }}>
                    <Icon name={FEATURE_ICON[f]} size={13} color={active ? 'white' : COLORS.textMuted} /> {f}
                  </span>
                )
              })}
            </div>
          </Field>
        </div>

        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>Fleet</p>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
            How many of this exact vehicle do you have, and the price per day. Vehicle numbers are assigned automatically.
          </p>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input
              type="number" placeholder="No. of vehicles" value={fleetQuantity}
              onChange={(e) => setFleetQuantity(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              type="number" placeholder="Price/day (₦)" value={pricePerDay}
              onChange={(e) => setPricePerDay(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
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

export default AddVehicleRentalListing
