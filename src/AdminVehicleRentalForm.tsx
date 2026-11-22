import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import {
  COLORS, Field, Card, inputStyle, MultiChips, usePhotos, PhotoField, CompanyField, FormHeader, LoadingBlock,
  ErrorBlock, SuccessScreen, SubmitButton, auditAdminListing,
} from './AdminFormParts'
import type { FormProps, CompanyOption } from './AdminFormParts'

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

// Admin version of AddVehicleRentalListing: the founder picks the rental company.
// Same fleet logic: one inventory item (this exact vehicle) with numbered units.
export default function AdminVehicleRentalForm({ editId, onSaved, onCancel }: FormProps) {
  const photos = usePhotos(5)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [companyId, setCompanyId] = useState('')

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
  const [features, setFeatures] = useState<string[]>([])

  const [inventoryItemId, setInventoryItemId] = useState<string | null>(null)
  const [originalQuantity, setOriginalQuantity] = useState(0)
  const [fleetQuantity, setFleetQuantity] = useState('')
  const [pricePerDay, setPricePerDay] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [success, setSuccess] = useState(false)
  const [note, setNote] = useState('')

  const init = async () => {
    setLoading(true)
    setLoadError('')
    const { data: companyRows, error: cErr } = await supabase
      .from('companies').select('id, business_name')
      .eq('business_type', 'vehicle_rental').eq('approval_status', 'approved')
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
        photos.setExisting(listing.photo_urls && listing.photo_urls.length > 0 ? listing.photo_urls : (listing.photo_url ? [listing.photo_url] : []))

        const { data: invItems, error: invErr } = await supabase
          .from('inventory_items').select('id, total_quantity, price')
          .eq('service_id', editId).order('created_at', { ascending: true }).limit(1)
        if (invErr) { setLoadError(invErr.message); setLoading(false); return }

        if (invItems && invItems.length > 0) {
          setInventoryItemId(invItems[0].id)
          setOriginalQuantity(invItems[0].total_quantity)
          setFleetQuantity(String(invItems[0].total_quantity))
          setPricePerDay(String(invItems[0].price))
        } else {
          setFleetQuantity(listing.seats_available ? String(listing.seats_available) : '1')
          setPricePerDay(listing.price ? String(listing.price) : '')
        }
      }
    } else if (companyRows && companyRows.length > 0) {
      setCompanyId(companyRows[0].id)
    }
    setLoading(false)
  }

  useEffect(() => { init() }, [editId])

  const toggleFeature = (f: string) => setFeatures((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]))

  const handleSubmit = async () => {
    setErrorMsg('')
    setNote('')
    if (!companyId) { setErrorMsg('Please select a company for this listing.'); return }
    if (!title.trim() || !destination.trim()) {
      setErrorMsg('Please fill in the vehicle name and city.')
      return
    }
    const qty = parseInt(fleetQuantity, 10)
    const priceVal = parseFloat(pricePerDay)
    if (!qty || qty < 1 || !priceVal || priceVal <= 0) {
      setErrorMsg('Enter how many of this vehicle there are and the price per day.')
      return
    }
    if (minRentalDays && maxRentalDays && parseInt(maxRentalDays, 10) < parseInt(minRentalDays, 10)) {
      setErrorMsg('Maximum rental days cannot be less than minimum rental days.')
      return
    }

    setSubmitting(true)

    const up = await photos.upload(companyId)
    if (up.error) { setSubmitting(false); setErrorMsg('Photo upload failed: ' + up.error); return }

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
      photo_url: up.urls[0] || null,
      photo_urls: up.urls.length > 0 ? up.urls : null,
      amenities: features.length > 0 ? features : null,
    }

    const { data: saved, error } = editId
      ? await supabase.from('services').update(payload).eq('id', editId).select('id').single()
      : await supabase.from('services').insert({ ...payload, status: 'active' }).select('id').single()

    if (error || !saved) { setSubmitting(false); setErrorMsg(error?.message || 'Could not save the listing.'); return }

    const serviceId = saved.id
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
      } else if (itemErr) {
        notes.push(`Fleet could not be saved: ${itemErr.message}`)
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
          const idsToRemove = (availableUnits || []).slice(0, removable).map((u: any) => u.id)
          await supabase.from('inventory_units').delete().in('id', idsToRemove)
        }
        const actualNewTotal = originalQuantity - removable
        await supabase.from('inventory_items').update({ total_quantity: actualNewTotal }).eq('id', inventoryItemId)
        if (removable < -delta) {
          notes.push(`Fleet could only be reduced to ${actualNewTotal} — some vehicles are currently rented or under maintenance.`)
        }
      }
    }

    await auditAdminListing(editId ? 'admin_updated_listing' : 'admin_created_listing', serviceId, title.trim(), 'vehicle_rental', companyId)
    setSubmitting(false)
    setNote(notes.join(' '))
    setSuccess(true)
  }

  if (loading) return <LoadingBlock />
  if (loadError) return <ErrorBlock message={loadError} onRetry={init} />
  if (success) return <SuccessScreen title={editId ? 'Listing Updated!' : 'Listing Added!'} note={note} backLabel="Back to Vehicle Rental" onBack={onSaved} />

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px' }}>
      <FormHeader title={editId ? 'Edit Vehicle Rental Listing' : 'Add Vehicle Rental Listing'} onCancel={onCancel} />

      {errorMsg && <p style={{ color: COLORS.red, fontSize: '13px', marginBottom: '12px' }}>{errorMsg}</p>}

      <Card>
        <CompanyField companies={companies} companyId={companyId} onChange={setCompanyId} typeLabel="vehicle_rental" />
        <PhotoField photos={photos} />

        <Field label="Vehicle Name">
          <input type="text" placeholder="e.g. Toyota Camry 2022" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="City">
          <input type="text" placeholder="e.g. Kano" value={destination} onChange={(e) => setDestination(e.target.value)} style={inputStyle} />
        </Field>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}><Field label="Brand"><input type="text" placeholder="e.g. Toyota" value={brand} onChange={(e) => setBrand(e.target.value)} style={inputStyle} /></Field></div>
          <div style={{ flex: 1 }}><Field label="Model"><input type="text" placeholder="e.g. Camry" value={model} onChange={(e) => setModel(e.target.value)} style={inputStyle} /></Field></div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}><Field label="Year"><input type="number" placeholder="e.g. 2022" value={year} onChange={(e) => setYear(e.target.value)} style={inputStyle} /></Field></div>
          <div style={{ flex: 1 }}><Field label="Seats"><input type="number" placeholder="e.g. 5" value={seats} onChange={(e) => setSeats(e.target.value)} style={inputStyle} /></Field></div>
          <div style={{ flex: 1 }}><Field label="Doors"><input type="number" placeholder="e.g. 4" value={doors} onChange={(e) => setDoors(e.target.value)} style={inputStyle} /></Field></div>
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
          <div style={{ flex: 1 }}><Field label="Pickup Location"><input type="text" placeholder="e.g. Kano Airport" value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} style={inputStyle} /></Field></div>
          <div style={{ flex: 1 }}><Field label="Drop-off Location"><input type="text" placeholder="Same as pickup if blank" value={dropOffLocation} onChange={(e) => setDropOffLocation(e.target.value)} style={inputStyle} /></Field></div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}><Field label="Min Rental Days"><input type="number" min="1" value={minRentalDays} onChange={(e) => setMinRentalDays(e.target.value)} style={inputStyle} /></Field></div>
          <div style={{ flex: 1 }}><Field label="Max Rental Days"><input type="number" placeholder="No limit" value={maxRentalDays} onChange={(e) => setMaxRentalDays(e.target.value)} style={inputStyle} /></Field></div>
          <div style={{ flex: 1 }}><Field label="Deposit (₦)"><input type="number" placeholder="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} style={inputStyle} /></Field></div>
        </div>

        <Field label="Features">
          <MultiChips options={FEATURES_LIST} selected={features} onToggle={toggleFeature} icons={FEATURE_ICON} />
        </Field>
      </Card>

      <Card>
        <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>Fleet</p>
        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
          How many of this exact vehicle there are, and the price per day. Vehicle numbers are assigned automatically.
        </p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <input type="number" placeholder="No. of vehicles" value={fleetQuantity} onChange={(e) => setFleetQuantity(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <input type="number" placeholder="Price/day (₦)" value={pricePerDay} onChange={(e) => setPricePerDay(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        </div>
        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
          Commission: {COMMISSION_RATE}% will be deducted after each verified booking.
        </p>
        <SubmitButton submitting={submitting} disabled={companies.length === 0} editing={!!editId} onClick={handleSubmit} />
      </Card>
    </div>
  )
}
