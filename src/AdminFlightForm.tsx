import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9', secondary: '#F97316', bg: '#F8FAFC', card: '#FFFFFF',
  text: '#1A1A1A', textMuted: '#64748B', border: '#E2E8F0', green: '#16a34a', red: '#DC2626',
}

const COMMISSION_RATE = 3

// Seat lettering skips I and O (standard airline convention — avoids confusion with 1/0).
const SEAT_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const PATTERN_PRESETS = ['2-2', '3-3', '2-3-2', '2-4-2', '3-4-3']

// The 5 amenities most relevant to a domestic flight. These exact strings are what
// Flights.tsx already knows how to show with an icon on the customer flight cards.
const FLIGHT_AMENITIES = ['Baggage Allowance', 'Meals', 'Refundable', 'WiFi', 'Charging Port']

function parsePattern(pattern: string): number[] {
  return pattern.split('-').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n) && n > 0)
}

function seatsPerRowOf(pattern: string): number {
  return parsePattern(pattern).reduce((a, b) => a + b, 0)
}

type SeatPos = 'window' | 'middle' | 'aisle'

function buildRowSeats(groupSizes: number[]): { label: string; position: SeatPos }[] {
  const seats: { label: string; position: SeatPos }[] = []
  let li = 0
  groupSizes.forEach((size, gi) => {
    for (let s = 0; s < size; s++) {
      const isFirstOfGroup = s === 0
      const isLastOfGroup = s === size - 1
      const isVeryFirstGroup = gi === 0
      const isVeryLastGroup = gi === groupSizes.length - 1
      let position: SeatPos = 'middle'
      if (size === 1) {
        position = (isVeryFirstGroup || isVeryLastGroup) ? 'window' : 'aisle'
      } else if (isFirstOfGroup && isVeryFirstGroup) position = 'window'
      else if (isLastOfGroup && isVeryLastGroup) position = 'window'
      else if (isFirstOfGroup || isLastOfGroup) position = 'aisle'
      seats.push({ label: SEAT_LETTERS[li] || '?', position })
      li++
    }
  })
  return seats
}

function SeatRowPreview({ pattern }: { pattern: string }) {
  const groupSizes = parsePattern(pattern)
  if (groupSizes.length === 0) return null
  const seats = buildRowSeats(groupSizes)
  const posColor: Record<SeatPos, string> = { window: '#0EA5E9', aisle: '#F97316', middle: '#94a3b8' }
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' as const }}>
        {seats.map((s, i) => (
          <span key={i} style={{
            width: '22px', height: '22px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '9px', fontWeight: 700, color: 'white', background: posColor[s.position],
          }}>{s.label}</span>
        ))}
      </div>
      <p style={{ fontSize: '9.5px', color: COLORS.textMuted, marginTop: '4px' }}>
        <span style={{ color: posColor.window, fontWeight: 700 }}>■</span> Window &nbsp;
        <span style={{ color: posColor.aisle, fontWeight: 700 }}>■</span> Aisle &nbsp;
        <span style={{ color: posColor.middle, fontWeight: 700 }}>■</span> Middle
      </p>
    </div>
  )
}

type CabinClass = {
  id: string | null // existing inventory_item id, or null for a new (not-yet-saved) row
  name: string
  price: string
  hasSeatMap: boolean
  pattern: string        // e.g. "3-3" — only meaningful when hasSeatMap is true
  rows: string            // numeric string — only meaningful when hasSeatMap is true
  originalRows: number    // rows already saved in the DB (0 for a brand-new class)
  legacyQuantity: string  // only meaningful when hasSeatMap is false (pre-seat-map cabin classes)
  originalQuantity: number
}

const emptyCabinClass = (name = ''): CabinClass => ({
  id: null, name, price: '', hasSeatMap: true, pattern: '3-3', rows: '1', originalRows: 0, legacyQuantity: '', originalQuantity: 0,
})

type Addon = { id: string | null; name: string; price: string }
const emptyAddon = (): Addon => ({ id: null, name: '', price: '' })

type CompanyOption = { id: string; business_name: string }

type Props = {
  editId?: string | null
  onSaved: () => void
  onCancel: () => void
}

// Admin version of AddFlightListing.tsx: same listing/cabin-class/addon logic,
// but the company is picked from a dropdown (admin isn't the company owner)
// instead of auto-detected from auth.uid(). Only companies with
// business_type='flight' + approval_status='approved' are offered — same
// rule the company-side AddListingRouter already enforces.
//
// Seat maps: a NEW cabin class always gets a real rows × pattern seat map
// (e.g. "3-3" for 6 seats/row) with window/middle/aisle computed automatically.
// An EXISTING cabin class that already has a seat map can only have rows ADDED
// (the pattern is fixed, rows can't be reduced) — reducing or changing layout
// isn't supported yet since it would need to reconcile real bookings tied to
// specific seats. An EXISTING cabin class from before this feature existed
// (no seat_layout_config saved) keeps the old plain seat-count editor untouched.
function AdminFlightForm({ editId, onSaved, onCancel }: Props) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [companyId, setCompanyId] = useState<string>('')
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([])

  const [title, setTitle] = useState('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')
  const [seatLayout, setSeatLayout] = useState('')
  const [boardingInfo, setBoardingInfo] = useState('')
  const [amenities, setAmenities] = useState<string[]>([])
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])

  const [cabinClasses, setCabinClasses] = useState<CabinClass[]>([emptyCabinClass('Economy')])
  const [addons, setAddons] = useState<Addon[]>([])

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
      .eq('business_type', 'flight')
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
        setOrigin(listing.origin || '')
        setDestination(listing.destination || '')
        setDepartureTime(listing.departure_time ? listing.departure_time.slice(0, 16) : '')
        setArrivalTime(listing.arrival_time ? listing.arrival_time.slice(0, 16) : '')
        setSeatLayout(listing.seat_layout || '')
        setBoardingInfo(listing.boarding_info || '')
        setAmenities(Array.isArray(listing.amenities) ? listing.amenities : [])
        setExistingPhotoUrls(listing.photo_urls && listing.photo_urls.length > 0 ? listing.photo_urls : (listing.photo_url ? [listing.photo_url] : []))

        const { data: invItems, error: invErr } = await supabase
          .from('inventory_items')
          .select('id, name, total_quantity, price, seat_layout_config')
          .eq('service_id', editId)
          .order('price', { ascending: true })

        if (invErr) { setLoadError(invErr.message); setLoading(false); return }

        if (invItems && invItems.length > 0) {
          setCabinClasses(invItems.map((it: any) => {
            const cfg = it.seat_layout_config
            if (cfg && cfg.rows && cfg.pattern) {
              return {
                id: it.id, name: it.name, price: String(it.price),
                hasSeatMap: true, pattern: cfg.pattern, rows: String(cfg.rows), originalRows: cfg.rows,
                legacyQuantity: '', originalQuantity: it.total_quantity,
              }
            }
            return {
              id: it.id, name: it.name, price: String(it.price),
              hasSeatMap: false, pattern: '', rows: '', originalRows: 0,
              legacyQuantity: String(it.total_quantity), originalQuantity: it.total_quantity,
            }
          }))
        } else {
          setCabinClasses([emptyCabinClass('Economy')])
        }

        const { data: addonRows, error: addonErr } = await supabase
          .from('service_addons').select('id, name, price').eq('service_id', editId).order('price', { ascending: true })
        if (addonErr) { setLoadError(addonErr.message); setLoading(false); return }
        if (addonRows) setAddons(addonRows.map((a) => ({ id: a.id, name: a.name, price: String(a.price) })))
      }
    } else if (companyRows && companyRows.length > 0) {
      setCompanyId(companyRows[0].id)
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [editId])

  const updateCabinClass = (idx: number, patch: Partial<CabinClass>) => {
    setCabinClasses((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }
  const addCabinClass = () => setCabinClasses((prev) => [...prev, emptyCabinClass()])
  const removeCabinClass = (idx: number) => setCabinClasses((prev) => prev.filter((_, i) => i !== idx))

  const updateAddon = (idx: number, patch: Partial<Addon>) => setAddons((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)))
  const addAddon = () => setAddons((prev) => [...prev, emptyAddon()])
  const removeAddon = (idx: number) => setAddons((prev) => prev.filter((_, i) => i !== idx))

  const toggleAmenity = (a: string) => setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))

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
    if (!companyId) {
      setErrorMsg('Please select a company for this listing.')
      return
    }
    if (!title.trim() || !origin.trim() || !destination.trim() || !departureTime) {
      setErrorMsg('Please fill in the flight name, origin, destination, and departure time.')
      return
    }
    if (arrivalTime && new Date(arrivalTime) <= new Date(departureTime)) {
      setErrorMsg('Arrival time must be after departure time.')
      return
    }
    for (const c of cabinClasses) {
      const priceVal = parseFloat(c.price)
      if (!c.name.trim() || !priceVal || priceVal <= 0) {
        setErrorMsg('Every cabin class needs a name and a price.')
        return
      }
      if (c.hasSeatMap) {
        const rows = parseInt(c.rows, 10)
        const perRow = seatsPerRowOf(c.pattern)
        if (!rows || rows < 1 || perRow < 1) {
          setErrorMsg(`"${c.name}" needs a valid seat layout pattern and at least 1 row.`)
          return
        }
        if (c.id && rows < c.originalRows) {
          setErrorMsg(`"${c.name}" already has ${c.originalRows} rows — rows can only be added, not removed, for an existing seat map.`)
          return
        }
      } else {
        const qty = parseInt(c.legacyQuantity, 10)
        if (!qty || qty < 1) {
          setErrorMsg(`"${c.name}" needs a valid seat count.`)
          return
        }
      }
    }
    const validAddons = addons.filter((a) => a.name.trim() || a.price.trim())
    for (const a of validAddons) {
      if (!a.name.trim() || !a.price.trim() || parseFloat(a.price) < 0) {
        setErrorMsg('Every extra needs a name and a price.')
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
    const totalSeats = cabinClasses.reduce((sum, c) => {
      if (c.hasSeatMap) return sum + parseInt(c.rows, 10) * seatsPerRowOf(c.pattern)
      return sum + parseInt(c.legacyQuantity, 10)
    }, 0)

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
      amenities: amenities.length > 0 ? amenities : null,
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
      const priceVal = parseFloat(c.price)

      if (c.hasSeatMap) {
        const rows = parseInt(c.rows, 10)
        const groupSizes = parsePattern(c.pattern)
        const perRow = groupSizes.reduce((a, b) => a + b, 0)
        const totalQty = rows * perRow
        const rowSeats = buildRowSeats(groupSizes)

        if (!c.id) {
          const { data: newItem, error: itemErr } = await supabase.from('inventory_items').insert({
            company_id: companyId, service_id: serviceId, name: c.name.trim(), total_quantity: totalQty, price: priceVal,
            seat_layout_config: { rows, pattern: c.pattern },
          }).select('id').single()

          if (!itemErr && newItem) {
            const unitRows: any[] = []
            for (let r = 1; r <= rows; r++) {
              for (const seat of rowSeats) {
                unitRows.push({
                  inventory_item_id: newItem.id, unit_number: `${r}${seat.label}`, status: 'available',
                  seat_row: r, seat_col: seat.label, seat_position: seat.position,
                })
              }
            }
            await supabase.from('inventory_units').insert(unitRows)
          }
        } else {
          await supabase.from('inventory_items').update({ name: c.name.trim(), price: priceVal }).eq('id', c.id)

          const addedRows = rows - c.originalRows
          if (addedRows > 0) {
            const unitRows: any[] = []
            for (let r = c.originalRows + 1; r <= rows; r++) {
              for (const seat of rowSeats) {
                unitRows.push({
                  inventory_item_id: c.id, unit_number: `${r}${seat.label}`, status: 'available',
                  seat_row: r, seat_col: seat.label, seat_position: seat.position,
                })
              }
            }
            await supabase.from('inventory_units').insert(unitRows)
            await supabase.from('inventory_items').update({ total_quantity: totalQty, seat_layout_config: { rows, pattern: c.pattern } }).eq('id', c.id)
          }
        }
      } else if (c.id) {
        const qty = parseInt(c.legacyQuantity, 10)
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

    await supabase.from('service_addons').delete().eq('service_id', serviceId)
    if (validAddons.length > 0) {
      await supabase.from('service_addons').insert(
        validAddons.map((a) => ({ service_id: serviceId, name: a.name.trim(), price: parseFloat(a.price) }))
      )
    }

    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      await supabase.rpc('log_audit', {
        p_action: editId ? 'admin_updated_listing' : 'admin_created_listing',
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
          Back to Flights
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span onClick={onCancel} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="arrowLeft" size={19} color={COLORS.text} /></span>
        <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>{editId ? 'Edit Flight Listing' : 'Add Flight Listing'}</h2>
      </div>

      {errorMsg && <p style={{ color: COLORS.red, fontSize: '13px', marginBottom: '12px' }}>{errorMsg}</p>}

      <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: '14px' }}>
        <Field label="Company">
          {companies.length === 0 ? (
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>No approved flight companies found. Approve a company with business type "Flight" first.</p>
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

        <Field label="Seat Layout Note (optional, shown to customers as text)">
          <input type="text" placeholder="e.g. 3-3 configuration" value={seatLayout} onChange={(e) => setSeatLayout(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Boarding Information (optional)">
          <input type="text" placeholder="e.g. Gate closes 45 minutes before departure" value={boardingInfo} onChange={(e) => setBoardingInfo(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Amenities (shown on the flight card)">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
            {FLIGHT_AMENITIES.map((a) => {
              const on = amenities.includes(a)
              return (
                <span key={a} onClick={() => toggleAmenity(a)}
                  style={{
                    padding: '8px 13px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${on ? COLORS.primary : COLORS.border}`,
                    background: on ? COLORS.primary : COLORS.bg,
                    color: on ? 'white' : COLORS.text,
                  }}>{a}</span>
              )
            })}
          </div>
        </Field>
      </div>

      <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>Cabin Classes</p>
        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
          Add each cabin class (e.g. Economy, Business) with a real seat map — rows × layout pattern — and a price per seat. Seat numbers (e.g. 12A) and window/middle/aisle are assigned automatically.
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

            <input
              type="number" placeholder="Price/seat (₦)" value={c.price}
              onChange={(e) => updateCabinClass(idx, { price: e.target.value })}
              style={{ ...inputStyle, marginBottom: '10px' }}
            />

            {c.hasSeatMap ? (
              <>
                {c.id ? (
                  <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '8px' }}>
                    Layout: <strong style={{ color: COLORS.text }}>{c.pattern}</strong> · {c.originalRows} rows saved — you can only add more rows below, not change the layout.
                  </p>
                ) : (
                  <>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '6px' }}>Seat Layout Pattern</p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const, marginBottom: '8px' }}>
                      {PATTERN_PRESETS.map((p) => (
                        <span key={p} onClick={() => updateCabinClass(idx, { pattern: p })}
                          style={{
                            padding: '6px 11px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                            border: `1.5px solid ${c.pattern === p ? COLORS.primary : COLORS.border}`,
                            background: c.pattern === p ? COLORS.primary : COLORS.bg,
                            color: c.pattern === p ? 'white' : COLORS.text,
                          }}>{p}</span>
                      ))}
                    </div>
                    <input
                      type="text" placeholder="Custom pattern, e.g. 2-4-2" value={c.pattern}
                      onChange={(e) => updateCabinClass(idx, { pattern: e.target.value })}
                      style={{ ...inputStyle, marginBottom: '8px' }}
                    />
                  </>
                )}

                <input
                  type="number" placeholder="Number of rows" value={c.rows}
                  min={c.id ? c.originalRows : 1}
                  onChange={(e) => {
                    let v = parseInt(e.target.value, 10)
                    if (!Number.isFinite(v)) v = 0
                    if (c.id && v < c.originalRows) v = c.originalRows
                    updateCabinClass(idx, { rows: String(v) })
                  }}
                  style={inputStyle}
                />

                {seatsPerRowOf(c.pattern) > 0 && (
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '6px' }}>
                    {seatsPerRowOf(c.pattern)} seats/row × {parseInt(c.rows, 10) || 0} rows = <strong style={{ color: COLORS.text }}>{seatsPerRowOf(c.pattern) * (parseInt(c.rows, 10) || 0)} total seats</strong>
                  </p>
                )}
                <SeatRowPreview pattern={c.pattern} />
              </>
            ) : (
              <>
                <input
                  type="number" placeholder="No. of seats" value={c.legacyQuantity}
                  onChange={(e) => updateCabinClass(idx, { legacyQuantity: e.target.value })}
                  style={inputStyle}
                />
                <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '6px' }}>
                  This cabin class was created before seat maps existed — it still uses a plain seat count, not a visual map.
                </p>
              </>
            )}
          </div>
        ))}

        <span onClick={addCabinClass} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: COLORS.primary, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
          <Icon name="plus" size={14} color={COLORS.primary} /> Add another cabin class
        </span>
      </div>

      <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginTop: '14px' }}>
        <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>Extras (optional)</p>
        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
          Optional add-ons customers can choose at checkout — e.g. extra baggage, travel insurance, airport pickup.
        </p>

        {addons.map((a, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
            <input type="text" placeholder="Extra name (e.g. Extra Baggage)" value={a.name} onChange={(e) => updateAddon(idx, { name: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
            <input type="number" placeholder="Price (₦)" value={a.price} onChange={(e) => updateAddon(idx, { price: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
            <span onClick={() => removeAddon(idx)} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="x" size={16} color={COLORS.textMuted} /></span>
          </div>
        ))}

        <span onClick={addAddon} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: COLORS.primary, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
          <Icon name="plus" size={14} color={COLORS.primary} /> Add an extra
        </span>
      </div>

      <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginTop: '14px' }}>
        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
          Commission: {COMMISSION_RATE}% will be deducted after each verified booking.
        </p>

        <button
          onClick={handleSubmit}
          disabled={submitting || companies.length === 0}
          style={{
            width: '100%', padding: '13px', background: (submitting || companies.length === 0) ? '#94a3b8' : COLORS.secondary,
            color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px',
            cursor: (submitting || companies.length === 0) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
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

export default AdminFlightForm
