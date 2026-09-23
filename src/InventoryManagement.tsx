import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import { releaseExpiredUnits } from './inventoryUtils'
import { ListCardSkeleton } from './LoadingSkeleton'
import NetworkError from './NetworkError'

const COLORS = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  primary: '#0EA5E9',
  purple: '#6B21A8',
  purpleLight: '#A855F7',
  text: '#0F172A',
  textMuted: '#64748B',
  green: '#16A34A',
  red: '#DC2626',
  amber: '#D97706',
}

type InventoryItem = {
  id: string
  name: string
  total_quantity: number
  price: number
  service_id: string | null
  image_url: string | null
  services: { photo_url: string | null; category: string | null } | null
}

type ServiceOption = { id: string; title: string; category: string | null; price: number | null; seats_available: number | null }

const CATEGORY_LABELS: Record<string, { plural: string; singular: string; unitPlural: string; icon: string; placeholder: string }> = {
  hotel: { plural: 'Room Types', singular: 'Room Type', unitPlural: 'Rooms', icon: 'bed', placeholder: 'e.g. Executive Room, Suite' },
  bus: { plural: 'Seat Types', singular: 'Seat Type', unitPlural: 'Seats', icon: 'seat', placeholder: 'e.g. Economy, VIP' },
  train: { plural: 'Seat Types', singular: 'Seat Type', unitPlural: 'Seats', icon: 'seat', placeholder: 'e.g. Economy, First Class' },
  flight: { plural: 'Seat Classes', singular: 'Seat Class', unitPlural: 'Seats', icon: 'plane', placeholder: 'e.g. Economy, Business, First Class' },
  tour: { plural: 'Slot Types', singular: 'Slot Type', unitPlural: 'Slots', icon: 'map', placeholder: 'e.g. Standard Group, Private Tour' },
  event_center: { plural: 'Package Types', singular: 'Package Type', unitPlural: 'Slots', icon: 'tent', placeholder: 'e.g. Standard Hall, VIP Hall' },
}
const DEFAULT_LABELS = { plural: 'Inventory Types', singular: 'Type', unitPlural: 'Units', icon: 'box', placeholder: 'e.g. Standard, Premium' }

export default function InventoryManagement() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [statusCounts, setStatusCounts] = useState<Record<string, { available: number; occupied: number; reserved: number; maintenance: number }>>({})
  // Real occupancy computed live from confirmed bookings for "today" — the
  // static inventory_units.status column is only ever set to 'available' at
  // creation or 'maintenance'/'reserved' by the company manually. The actual
  // booking claim functions (claim_inventory_unit_for_dates / claim_specific_unit_for_dates,
  // used by hotel + vehicle_rental) deliberately never touch status, since a unit's
  // occupancy is date-range-dependent, not a permanent flag — so this was always
  // showing every unit as "available" forever, no matter how many real bookings existed.
  const [occupiedTodayCounts, setOccupiedTodayCounts] = useState<Record<string, number>>({})
  const [services, setServices] = useState<ServiceOption[]>([])
  const [serviceId, setServiceId] = useState('')
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [holidays, setHolidays] = useState<{ id: string; date: string; label: string | null }[]>([])
  const [showHolidayForm, setShowHolidayForm] = useState(false)
  const [holidayDate, setHolidayDate] = useState('')
  const [holidayLabel, setHolidayLabel] = useState('')
  const [savingHoliday, setSavingHoliday] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')

  const load = async () => {
    setNetError(false)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { navigate('/login'); return }

    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', userData.user.id)
      .maybeSingle()

    if (companyErr) { setNetError(true); setLoading(false); return }
    if (!company) { setLoading(false); return }
    setCompanyId(company.id)
    loadHolidays(company.id)
    releaseExpiredUnits(company.id).catch(() => {})

    const { data: serviceRows, error: serviceErr } = await supabase
      .from('services')
      .select('id, title, category, price, seats_available')
      .eq('company_id', company.id)

    if (serviceErr) { setNetError(true); setLoading(false); return }

    setServices(serviceRows || [])
    if (serviceRows && serviceRows.length > 0) setServiceId(serviceRows[0].id)

    const { data: inventoryRows, error: invErr } = await supabase
      .from('inventory_items')
      .select('id, name, total_quantity, price, service_id, image_url, services(photo_url, category)')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })

    if (invErr) { setNetError(true); setLoading(false); return }

    setItems((inventoryRows || []) as any)

    const itemIds = (inventoryRows || []).map((i) => i.id)
    if (itemIds.length > 0) {
      const { data: unitRows } = await supabase
        .from('inventory_units')
        .select('inventory_item_id, status')
        .in('inventory_item_id', itemIds)

      const counts: Record<string, { available: number; occupied: number; reserved: number; maintenance: number }> = {}
      ;(unitRows || []).forEach((u: any) => {
        if (!counts[u.inventory_item_id]) counts[u.inventory_item_id] = { available: 0, occupied: 0, reserved: 0, maintenance: 0 }
        const s = u.status as 'available' | 'occupied' | 'reserved' | 'maintenance'
        counts[u.inventory_item_id][s] = (counts[u.inventory_item_id][s] || 0) + 1
      })
      setStatusCounts(counts)

      // Real occupancy for "today": a unit counts as occupied if a confirmed
      // booking's date range covers today (hotel/vehicle_rental, check_out_date
      // set) or its single travel date is today (bus/train/flight/tour/event_center,
      // check_out_date null). Distinct by assigned_unit_number since one unit
      // shouldn't be double-counted across bookings.
      const today = new Date().toISOString().split('T')[0]
      const { data: bookingRows } = await supabase
        .from('bookings')
        .select('inventory_item_id, assigned_unit_number, check_in_date, check_out_date')
        .eq('company_id', company.id)
        .eq('booking_status', 'confirmed')
        .in('inventory_item_id', itemIds)
        .not('assigned_unit_number', 'is', null)

      const occupiedSets: Record<string, Set<string>> = {}
      ;(bookingRows || []).forEach((b: any) => {
        const occupiedToday = b.check_out_date
          ? b.check_in_date <= today && b.check_out_date > today
          : b.check_in_date === today
        if (!occupiedToday) return
        if (!occupiedSets[b.inventory_item_id]) occupiedSets[b.inventory_item_id] = new Set()
        occupiedSets[b.inventory_item_id].add(b.assigned_unit_number)
      })
      const occupiedCounts: Record<string, number> = {}
      Object.keys(occupiedSets).forEach((k) => { occupiedCounts[k] = occupiedSets[k].size })
      setOccupiedTodayCounts(occupiedCounts)
    } else {
      setStatusCounts({})
      setOccupiedTodayCounts({})
    }

    setLoading(false)
  }

  const loadHolidays = async (compId: string) => {
    const { data } = await supabase
      .from('company_holidays')
      .select('id, date, label')
      .eq('company_id', compId)
      .order('date', { ascending: true })
    setHolidays(data || [])
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!companyId || !name.trim()) return
    if (!editingId && !quantity) return
    setAddError('')

    const duplicate = items.some((it) =>
      it.id !== editingId && it.service_id === (serviceId || null) && it.name.trim().toLowerCase() === name.trim().toLowerCase()
    )
    if (duplicate) {
      setAddError(`"${name.trim()}" already exists in your inventory. Please use a different name.`)
      return
    }

    setSaving(true)

    let imageUrl: string | null = editingId ? (items.find((it) => it.id === editingId)?.image_url ?? null) : null
    if (photoFile) {
      const fileExt = photoFile.name.split('.').pop()
      const fileName = `${companyId}/${Date.now()}.${fileExt}`
      const { error: uploadErr } = await supabase.storage.from('listing-photos').upload(fileName, photoFile)
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('listing-photos').getPublicUrl(fileName)
        imageUrl = urlData.publicUrl
      }
    }

    if (editingId) {
      // Renaming/repricing only — total_quantity is deliberately left alone here;
      // it's changed one unit at a time from the InventoryDetail stock tab so it
      // always stays in sync with the actual inventory_units rows.
      await supabase.from('inventory_items').update({
        service_id: serviceId || null,
        name: name.trim(),
        price: price ? parseFloat(price) : 0,
        image_url: imageUrl,
      }).eq('id', editingId)
    } else {
      const qty = parseInt(quantity, 10)
      const { data: newItem } = await supabase.from('inventory_items').insert({
        company_id: companyId,
        service_id: serviceId || null,
        name: name.trim(),
        total_quantity: qty,
        price: price ? parseFloat(price) : 0,
        image_url: imageUrl,
      }).select('id').single()

      if (newItem) {
        const unitRows = Array.from({ length: qty }, (_, i) => ({
          inventory_item_id: newItem.id,
          unit_number: (i + 1).toString(),
          status: 'available',
        }))
        await supabase.from('inventory_units').insert(unitRows)
      }
    }

    setName('')
    setQuantity('')
    setPrice('')
    setPhotoFile(null)
    setPhotoPreview('')
    setShowForm(false)
    setEditingId(null)
    setSaving(false)
    setAddError('')
    load()
  }

  const handleEditClick = (item: InventoryItem) => {
    setEditingId(item.id)
    setName(item.name)
    setQuantity(String(item.total_quantity))
    setPrice(String(item.price))
    setServiceId(item.service_id || '')
    setPhotoPreview(item.image_url || '')
    setPhotoFile(null)
    setAddError('')
    setShowForm(true)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setName('')
    setQuantity('')
    setPrice('')
    setPhotoFile(null)
    setPhotoPreview('')
    setAddError('')
  }

  const handleDelete = async (item: InventoryItem) => {
    if (!companyId) return
    const today = new Date().toISOString().split('T')[0]
    const { data: activeBookings } = await supabase
      .from('bookings')
      .select('id, check_in_date, check_out_date')
      .eq('inventory_item_id', item.id)
      .eq('booking_status', 'confirmed')

    const hasActive = (activeBookings || []).some((b: any) =>
      b.check_out_date ? b.check_out_date > today : b.check_in_date >= today
    )
    if (hasActive) {
      alert(`"${item.name}" has active or upcoming bookings and can't be deleted. Wait until they're completed, or mark rooms as maintenance instead.`)
      return
    }

    if (!window.confirm(`Delete "${item.name}" and all its ${item.total_quantity} units? This cannot be undone.`)) return
    setDeletingId(item.id)

    await supabase.from('inventory_units').delete().eq('inventory_item_id', item.id)
    const { error } = await supabase.from('inventory_items').delete().eq('id', item.id)
    if (error) {
      alert('Could not delete: ' + error.message)
      setDeletingId(null)
      return
    }

    await supabase.rpc('log_audit', {
      p_action: 'deleted_inventory_item',
      p_module: 'inventory',
      p_target_type: 'inventory_item',
      p_target_id: item.id,
      p_previous: { name: item.name, total_quantity: item.total_quantity },
      p_new: null,
      p_company_id: companyId,
    }).catch(() => {})

    setDeletingId(null)
    load()
  }

  const addHoliday = async () => {
    if (!companyId || !holidayDate) return
    setSavingHoliday(true)
    await supabase.from('company_holidays').insert({ company_id: companyId, date: holidayDate, label: holidayLabel.trim() || null })
    setHolidayDate('')
    setHolidayLabel('')
    setShowHolidayForm(false)
    setSavingHoliday(false)
    loadHolidays(companyId)
  }

  const deleteHoliday = async (holidayId: string) => {
    if (!companyId) return
    await supabase.from('company_holidays').delete().eq('id', holidayId)
    loadHolidays(companyId)
  }

  const occupiedToday = (item: InventoryItem) => occupiedTodayCounts[item.id] || 0
  const available = (item: InventoryItem) => {
    const s = statusCounts[item.id] || { available: 0, occupied: 0, reserved: 0, maintenance: 0 }
    return Math.max(0, item.total_quantity - occupiedToday(item) - s.reserved - s.maintenance)
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const selectedCategory = services.find((s) => s.id === serviceId)?.category || null
  const formLabels = (selectedCategory && CATEGORY_LABELS[selectedCategory]) || DEFAULT_LABELS

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ padding: '18px 20px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Inventory</h1>
        </div>
        <div style={{ padding: '16px' }}>
          <ListCardSkeleton count={3} />
        </div>
      </div>
    )
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ padding: '18px 20px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Inventory</h1>
        </div>
        <NetworkError onRetry={() => { setLoading(true); load() }} />
      </div>
    )
  }

  const totals = items.reduce(
    (acc, item) => {
      const s = statusCounts[item.id] || { available: 0, occupied: 0, reserved: 0, maintenance: 0 }
      const occ = occupiedTodayCounts[item.id] || 0
      return {
        total: acc.total + item.total_quantity,
        available: acc.available + Math.max(0, item.total_quantity - occ - s.reserved - s.maintenance),
        booked: acc.booked + occ + s.reserved,
        maintenance: acc.maintenance + s.maintenance,
      }
    },
    { total: 0, available: 0, booked: 0, maintenance: 0 }
  )

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>

      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="arrowLeft" size={22} color={COLORS.text} />
          </div>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Inventory</h1>
        </div>
        <div
          onClick={() => (showForm ? cancelForm() : setShowForm(true))}
          style={{ width: '38px', height: '38px', borderRadius: '12px', background: COLORS.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="plus" size={19} color="white" />
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        <div style={{
          background: `linear-gradient(135deg, ${COLORS.purple}, #4C1D95)`, borderRadius: '18px',
          padding: '20px', marginBottom: '18px', color: 'white'
        }}>
          <p style={{ fontSize: '17px', fontWeight: 800, marginBottom: '6px' }}>Inventory Overview</p>
          <p style={{ fontSize: '12px', color: '#DDD6FE', lineHeight: 1.5 }}>Track and manage your inventory in real-time.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
          <OverviewCard icon="box" iconBg="#F3E8FF" iconColor={COLORS.purple} label="Total Units" value={totals.total} sub="All units in inventory" />
          <OverviewCard icon="checkCircle" iconBg="#DCFCE7" iconColor={COLORS.green} label="Available" value={totals.available} valueColor={COLORS.green} sub="Ready for booking" />
          <OverviewCard icon="calendar" iconBg="#DBEAFE" iconColor={COLORS.primary} label="Booked" value={totals.booked} valueColor={COLORS.primary} sub="Currently booked" />
          <OverviewCard icon="edit" iconBg="#FFEDD5" iconColor={COLORS.amber} label="Maintenance" value={totals.maintenance} valueColor={COLORS.amber} sub="Under maintenance" />
        </div>

        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginBottom: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="calendar" size={17} color={COLORS.purple} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>Public Holidays</p>
                <div onClick={() => setShowHolidayForm(!showHolidayForm)} style={{ display: 'flex', alignItems: 'center', gap: '4px', border: `1.5px solid ${COLORS.purple}`, color: COLORS.purple, fontSize: '11.5px', fontWeight: 700, padding: '5px 10px', borderRadius: '8px', cursor: 'pointer' }}>
                  <Icon name="plus" size={11} color={COLORS.purple} /> Add Date
                </div>
              </div>
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '3px' }}>Set public holiday dates for special pricing and availability rules.</p>
            </div>
          </div>

          {showHolidayForm && (
            <div style={{ background: COLORS.bg, borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
              <input value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} type="date" style={{ width: '100%', padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, marginBottom: '8px', fontSize: '12.5px', boxSizing: 'border-box' }} />
              <input value={holidayLabel} onChange={(e) => setHolidayLabel(e.target.value)} placeholder="Label, e.g. Sallah (optional)" style={{ width: '100%', padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '12.5px', boxSizing: 'border-box' }} />
              <div onClick={savingHoliday ? undefined : addHoliday} style={{ background: COLORS.purple, color: 'white', textAlign: 'center', padding: '9px', borderRadius: '9px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', opacity: savingHoliday ? 0.6 : 1 }}>
                {savingHoliday ? 'Saving...' : 'Save Holiday Date'}
              </div>
            </div>
          )}

          {holidays.length === 0 ? (
            <div style={{ background: '#F5F3FF', borderRadius: '10px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="info" size={14} color={COLORS.purple} />
              <p style={{ fontSize: '11.5px', color: COLORS.purple }}>No public holiday dates set. Weekday/Weekend pricing will still apply.</p>
            </div>
          ) : (
            holidays.map((h) => (
              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${COLORS.border}` }}>
                <div>
                  <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{new Date(h.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  {h.label && <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{h.label}</p>}
                </div>
                <div onClick={() => deleteHoliday(h.id)} style={{ cursor: 'pointer' }}>
                  <Icon name="trash" size={15} color={COLORS.red} />
                </div>
              </div>
            ))
          )}
        </div>

        {showForm && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: COLORS.text }}>{editingId ? 'Edit' : 'Add'} {formLabels.singular}</p>

            {services.length > 0 && (
              <select value={serviceId} onChange={(e) => { setServiceId(e.target.value); setAddError('') }} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px' }}>
                <option value="">Link to a listing (optional)</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            )}

            {!editingId && (() => {
              const linkedService = services.find((s) => s.id === serviceId)
              const hasNoItemsYet = linkedService && !items.some((it) => it.service_id === linkedService.id)
              if (!hasNoItemsYet) return null
              return (
                <div
                  onClick={() => {
                    setName(linkedService.title)
                    if (linkedService.seats_available != null) setQuantity(String(linkedService.seats_available))
                    if (linkedService.price != null) setPrice(String(linkedService.price))
                    setAddError('')
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', background: '#EFF6FF', border: `1px solid #BFDBFE`,
                    borderRadius: '10px', padding: '10px 12px', marginBottom: '10px', cursor: 'pointer',
                  }}>
                  <Icon name="download" size={14} color={COLORS.primary} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.primary }}>
                    Import name, price &amp; quantity from "{linkedService.title}"
                  </span>
                </div>
              )
            })()}

            {addError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', marginBottom: '10px' }}>
                <p style={{ fontSize: '11.5px', color: COLORS.red }}>{addError}</p>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', border: `1.5px dashed ${COLORS.border}`, borderRadius: '10px', padding: '10px 12px', marginBottom: '10px', cursor: 'pointer' }}>
              {photoPreview ? (
                <img src={photoPreview} alt="preview" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
              ) : (
                <Icon name={formLabels.icon} size={20} color={COLORS.textMuted} />
              )}
              <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>{photoPreview ? 'Change photo' : `Tap to add a ${formLabels.singular.toLowerCase()} photo (optional)`}</span>
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </label>

            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={formLabels.placeholder} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }} />
            {editingId ? (
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '10px' }}>
                {quantity} {formLabels.unitPlural.toLowerCase()} total — add or remove individual {formLabels.unitPlural.toLowerCase()} from the Manage page.
              </p>
            ) : (
              <input value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ''))} placeholder={`Total ${formLabels.unitPlural.toLowerCase()}, e.g. 10`} inputMode="numeric" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }} />
            )}
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Price (₦)" inputMode="decimal" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <div onClick={saving ? undefined : handleSave} style={{ flex: 1, background: COLORS.purple, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : `Save ${formLabels.singular}`}
              </div>
              <div onClick={cancelForm} style={{ padding: '11px 16px', textAlign: 'center', color: COLORS.textMuted, fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                Cancel
              </div>
            </div>
          </div>
        )}

        <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>{formLabels.plural}</p>

        {items.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted }}>
            No {formLabels.plural.toLowerCase()} yet. Tap + to add your first one.
          </div>
        ) : (
          items.map((item) => {
            const avail = available(item)
            const photo = item.image_url || item.services?.photo_url
            const itemLabels = (item.services?.category && CATEGORY_LABELS[item.services.category]) || DEFAULT_LABELS
            return (
              <div key={item.id} style={{ background: COLORS.card, borderRadius: '16px', padding: '12px', marginBottom: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', gap: '12px' }}>
                <div style={{ width: '68px', height: '68px', borderRadius: '12px', flexShrink: 0, overflow: 'hidden', background: photo ? undefined : `linear-gradient(135deg, #F97316, #0EA5E9)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {photo ? <img src={photo} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name={itemLabels.icon} size={22} color="white" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{item.name}</p>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: COLORS.green, background: '#DCFCE7', padding: '3px 8px', borderRadius: '7px', whiteSpace: 'nowrap' }}>Active</span>
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.purple, marginTop: '2px' }}>₦{Number(item.price).toLocaleString()}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <p style={{ fontSize: '11px', color: COLORS.textMuted }}>
                      Total <span style={{ fontWeight: 700, color: COLORS.text }}>{item.total_quantity}</span>
                      {'  '}· Available <span style={{ fontWeight: 700, color: avail === 0 ? COLORS.red : COLORS.green }}>{avail}</span>
                      {occupiedToday(item) > 0 && <>{'  '}· Occupied <span style={{ fontWeight: 700, color: COLORS.primary }}>{occupiedToday(item)}</span></>}
                    </p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div onClick={() => handleEditClick(item)} style={{ cursor: 'pointer', padding: '2px' }}>
                        <Icon name="edit" size={14} color={COLORS.textMuted} />
                      </div>
                      <div onClick={() => (deletingId === item.id ? undefined : handleDelete(item))} style={{ cursor: deletingId === item.id ? 'default' : 'pointer', padding: '2px', opacity: deletingId === item.id ? 0.4 : 1 }}>
                        <Icon name="trash" size={14} color={COLORS.red} />
                      </div>
                    </div>
                    <div onClick={() => navigate(`/inventory/${item.id}`)} style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#F5F3FF', color: COLORS.purple, fontSize: '11px', fontWeight: 700, padding: '5px 10px', borderRadius: '8px', cursor: 'pointer' }}>
                      Manage <Icon name="chevronRight" size={12} color={COLORS.purple} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function OverviewCard({ icon, iconBg, iconColor, label, value, valueColor, sub }: {
  icon: string; iconBg: string; iconColor: string; label: string; value: number; valueColor?: string; sub: string
}) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
      <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
        <Icon name={icon} size={16} color={iconColor} />
      </div>
      <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '2px' }}>{label}</p>
      <p style={{ fontSize: '20px', fontWeight: 800, color: valueColor || COLORS.text }}>{value}</p>
      <p style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '2px' }}>{sub}</p>
    </div>
  )
}
