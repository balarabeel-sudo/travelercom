import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import { releaseExpiredUnits } from './inventoryUtils'

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

type ServiceOption = { id: string; title: string; category: string | null }

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
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [statusCounts, setStatusCounts] = useState<Record<string, { available: number; occupied: number; reserved: number; maintenance: number }>>({})
  const [services, setServices] = useState<ServiceOption[]>([])
  const [serviceId, setServiceId] = useState('')
  const [saving, setSaving] = useState(false)
  const [holidays, setHolidays] = useState<{ id: string; date: string; label: string | null }[]>([])
  const [showHolidayForm, setShowHolidayForm] = useState(false)
  const [holidayDate, setHolidayDate] = useState('')
  const [holidayLabel, setHolidayLabel] = useState('')
  const [savingHoliday, setSavingHoliday] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')

  const load = async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { navigate('/login'); return }

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', userData.user.id)
      .maybeSingle()

    if (!company) { setLoading(false); return }
    setCompanyId(company.id)
    loadHolidays(company.id)
    releaseExpiredUnits(company.id).catch(() => {})

    const { data: serviceRows } = await supabase
      .from('services')
      .select('id, title, category')
      .eq('company_id', company.id)

    setServices(serviceRows || [])
    if (serviceRows && serviceRows.length > 0) setServiceId(serviceRows[0].id)

    const { data: inventoryRows } = await supabase
      .from('inventory_items')
      .select('id, name, total_quantity, price, service_id, image_url, services(photo_url, category)')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })

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
    } else {
      setStatusCounts({})
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

  const handleAdd = async () => {
    if (!companyId || !name.trim() || !quantity) return
    setSaving(true)
    const qty = parseInt(quantity, 10)

    let imageUrl: string | null = null
    if (photoFile) {
      const fileExt = photoFile.name.split('.').pop()
      const fileName = `${companyId}/${Date.now()}.${fileExt}`
      const { error: uploadErr } = await supabase.storage.from('listing-photos').upload(fileName, photoFile)
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('listing-photos').getPublicUrl(fileName)
        imageUrl = urlData.publicUrl
      }
    }

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

    setName('')
    setQuantity('')
    setPrice('')
    setPhotoFile(null)
    setPhotoPreview('')
    setShowForm(false)
    setSaving(false)
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

  const available = (item: InventoryItem) => Math.max(0, statusCounts[item.id]?.available ?? 0)

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, color: COLORS.textMuted }}>
        Loading Inventory...
      </div>
    )
  }

  const totals = items.reduce(
    (acc, item) => {
      const s = statusCounts[item.id] || { available: 0, occupied: 0, reserved: 0, maintenance: 0 }
      return {
        total: acc.total + item.total_quantity,
        available: acc.available + Math.max(0, s.available),
        booked: acc.booked + s.occupied + s.reserved,
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
          onClick={() => setShowForm(!showForm)}
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
              <span style={{ display: 'flex' }}><Icon name="info" size={13} color={COLORS.purple} /></span>
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
            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: COLORS.text }}>Add {formLabels.singular}</p>

            {services.length > 0 && (
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px' }}>
                <option value="">Link to a listing (optional)</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', border: `1.5px dashed ${COLORS.border}`, borderRadius: '10px', padding: '10px 12px', marginBottom: '10px', cursor: 'pointer' }}>
              {photoPreview ? (
                <img src={photoPreview} alt="preview" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
              ) : (
                <span style={{ display: 'flex' }}><Icon name={formLabels.icon} size={20} color={COLORS.purple} /></span>
              )}
              <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>{photoPreview ? 'Change photo' : `Tap to add a ${formLabels.singular.toLowerCase()} photo (optional)`}</span>
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </label>

            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={formLabels.placeholder} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }} />
            <input value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ''))} placeholder={`Total ${formLabels.unitPlural.toLowerCase()}, e.g. 10`} inputMode="numeric" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }} />
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Price (₦)" inputMode="decimal" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box' }} />
            <div onClick={saving ? undefined : handleAdd} style={{ background: COLORS.purple, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : `Save ${formLabels.singular}`}
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
                    </p>
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
