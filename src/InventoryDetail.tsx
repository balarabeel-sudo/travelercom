import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  primary: '#0EA5E9',
  text: '#0F172A',
  textMuted: '#64748B',
  purple: '#6B21A8',
  green: '#16A34A',
  amber: '#D97706',
  red: '#DC2626',
}

type Item = {
  id: string
  name: string
  total_quantity: number
  price: number
  weekend_price: number | null
  holiday_price: number | null
}

type Unit = {
  id: string
  unit_number: string
  status: 'available' | 'occupied' | 'reserved' | 'maintenance'
  reason: string | null
  expected_completion: string | null
}

export default function InventoryDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState<Item | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [unitLabel, setUnitLabel] = useState('Room')
  const [tab, setTab] = useState<'stock' | 'pricing' | 'maintenance' | 'availability'>('stock')
  const [sortDesc, setSortDesc] = useState(false)
  const [showTip, setShowTip] = useState(true)

  const [weekdayInput, setWeekdayInput] = useState('')
  const [weekendInput, setWeekendInput] = useState('')
  const [holidayInput, setHolidayInput] = useState('')
  const [savingPrice, setSavingPrice] = useState(false)

  const [showMaintForm, setShowMaintForm] = useState(false)
  const [maintUnitId, setMaintUnitId] = useState('')
  const [reason, setReason] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [savingMaint, setSavingMaint] = useState(false)

  const [showReserveForm, setShowReserveForm] = useState(false)
  const [reserveUnitId, setReserveUnitId] = useState('')
  const [savingReserve, setSavingReserve] = useState(false)

  const [soldOutDates, setSoldOutDates] = useState<string[]>([])

  const load = async () => {
    const { data } = await supabase
      .from('inventory_items')
      .select('id, name, total_quantity, price, weekend_price, holiday_price, service_id, services(category)')
      .eq('id', id)
      .maybeSingle()

    if (data) {
      setItem(data as any)
      setWeekdayInput(data.price ? String(data.price) : '')
      setWeekendInput(data.weekend_price ? String(data.weekend_price) : '')
      setHolidayInput(data.holiday_price ? String(data.holiday_price) : '')
      const category = (data as any).services?.category
      const labels: Record<string, string> = { hotel: 'Room', bus: 'Seat', train: 'Seat', flight: 'Seat', tour: 'Slot', event_center: 'Ticket' }
      setUnitLabel(labels[category] || 'Item')
    }

    const { data: unitRows } = await supabase
      .from('inventory_units')
      .select('id, unit_number, status, reason, expected_completion')
      .eq('inventory_item_id', id)
      .order('unit_number', { ascending: true })

    setUnits((unitRows || []) as Unit[])

    const { data: availRows } = await supabase
      .from('inventory_availability')
      .select('date')
      .eq('inventory_item_id', id)
      .eq('status', 'sold_out')

    setSoldOutDates((availRows || []).map((r: any) => r.date))
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const availableUnits = units.filter((u) => u.status === 'available')
  const occupiedCount = units.filter((u) => u.status === 'occupied').length
  const reservedUnits = units.filter((u) => u.status === 'reserved')
  const maintenanceUnits = units.filter((u) => u.status === 'maintenance')

  const addRoom = async () => {
    if (!item) return
    const nextNumber = (units.length + 1).toString()
    await supabase.from('inventory_units').insert({ inventory_item_id: item.id, unit_number: nextNumber, status: 'available' })
    await supabase.from('inventory_items').update({ total_quantity: item.total_quantity + 1 }).eq('id', item.id)
    load()
  }

  const removeRoom = async () => {
    if (!item || availableUnits.length === 0) return
    const toRemove = availableUnits[availableUnits.length - 1]
    await supabase.from('inventory_units').delete().eq('id', toRemove.id)
    await supabase.from('inventory_items').update({ total_quantity: Math.max(0, item.total_quantity - 1) }).eq('id', item.id)
    load()
  }

  const savePricing = async () => {
    if (!item) return
    setSavingPrice(true)
    await supabase.from('inventory_items').update({
      price: weekdayInput ? parseFloat(weekdayInput) : 0,
      weekend_price: weekendInput ? parseFloat(weekendInput) : null,
      holiday_price: holidayInput ? parseFloat(holidayInput) : null,
    }).eq('id', item.id)
    setSavingPrice(false)
    load()
  }

  const addMaintenance = async () => {
    if (!maintUnitId) return
    setSavingMaint(true)
    await supabase.from('inventory_units').update({
      status: 'maintenance',
      reason: reason.trim() || null,
      expected_completion: expectedDate || null,
    }).eq('id', maintUnitId)
    setMaintUnitId('')
    setReason('')
    setExpectedDate('')
    setShowMaintForm(false)
    setSavingMaint(false)
    load()
  }

  const reopenUnit = async (unitId: string) => {
    await supabase.from('inventory_units').update({ status: 'available', reason: null, expected_completion: null }).eq('id', unitId)
    load()
  }

  const addReservation = async () => {
    if (!reserveUnitId) return
    setSavingReserve(true)
    await supabase.from('inventory_units').update({ status: 'reserved' }).eq('id', reserveUnitId)
    setReserveUnitId('')
    setShowReserveForm(false)
    setSavingReserve(false)
    load()
  }

  const releaseReservation = async (unitId: string) => {
    await supabase.from('inventory_units').update({ status: 'available' }).eq('id', unitId)
    load()
  }

  const toggleDate = async (dateStr: string, isSoldOut: boolean) => {
    if (isSoldOut) {
      await supabase.from('inventory_availability').delete().eq('inventory_item_id', id).eq('date', dateStr)
    } else {
      await supabase.from('inventory_availability').insert({ inventory_item_id: id, date: dateStr, status: 'sold_out' })
    }
    load()
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, color: COLORS.textMuted }}>
        Loading...
      </div>
    )
  }

  if (!item) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, color: COLORS.textMuted }}>
        Item not found
      </div>
    )
  }

  const sortedUnits = [...units].sort((a, b) => {
    const na = parseInt(a.unit_number, 10) || 0
    const nb = parseInt(b.unit_number, 10) || 0
    return sortDesc ? nb - na : na - nb
  })

  const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
    available: { bg: '#DCFCE7', color: COLORS.green, label: 'Available' },
    occupied: { bg: '#DBEAFE', color: COLORS.primary, label: 'Occupied' },
    reserved: { bg: '#F5F3FF', color: COLORS.purple, label: 'Reserved' },
    maintenance: { bg: '#FFEDD5', color: COLORS.amber, label: 'Maintenance' },
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '80px' }}>

      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div onClick={() => navigate('/inventory')} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <div>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>{item.name}</h1>
          <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Manage your {unitLabel.toLowerCase()} inventory</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
          <TabButton icon="bed" label="Items" active={tab === 'stock'} onClick={() => setTab('stock')} />
          <TabButton icon="cash" label="Pricing" active={tab === 'pricing'} onClick={() => setTab('pricing')} />
          <TabButton icon="wrench" label="Maintenance" active={tab === 'maintenance'} onClick={() => setTab('maintenance')} />
          <TabButton icon="calendar" label="Availability" active={tab === 'availability'} onClick={() => setTab('availability')} />
        </div>

        {tab === 'stock' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
              <StatCard icon="clipboard" iconBg="#F3E8FF" iconColor={COLORS.purple} value={units.length} label={`Total ${unitLabel}s`} sub={`All items in this ${unitLabel.toLowerCase()} type`} />
              <StatCard icon="checkCircle" iconBg="#DCFCE7" iconColor={COLORS.green} value={availableUnits.length} label="Available" sub="Ready for booking" />
              <StatCard icon="users" iconBg="#DBEAFE" iconColor={COLORS.primary} value={occupiedCount} label="Occupied" sub="Currently in use" />
              <StatCard icon="edit" iconBg="#FFEDD5" iconColor={COLORS.amber} value={maintenanceUnits.length} label="Maintenance" sub="Under maintenance" />
            </div>

            <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>Total {unitLabel}s</p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>Adjust the total number of {unitLabel.toLowerCase()}s for this type.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <div onClick={removeRoom} style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Icon name="minus" size={14} color={COLORS.red} />
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, minWidth: '16px', textAlign: 'center' }}>{units.length}</p>
                  <div onClick={addRoom} style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Icon name="plus" size={14} color={COLORS.green} />
                  </div>
                </div>
              </div>
              <div style={{ background: '#F5F3FF', borderRadius: '10px', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'flex' }}><Icon name="info" size={12} color={COLORS.purple} /></span>
                <p style={{ fontSize: '11px', color: COLORS.purple }}>Changing the total will affect availability.</p>
              </div>
            </div>

            <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginBottom: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>Reserved {unitLabel}s</p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>{unitLabel}s temporarily blocked or reserved.</p>
                </div>
                <div onClick={() => setShowReserveForm(!showReserveForm)} style={{ display: 'flex', alignItems: 'center', gap: '4px', border: `1.5px solid ${COLORS.purple}`, color: COLORS.purple, fontSize: '11.5px', fontWeight: 700, padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', flexShrink: 0 }}>
                  <Icon name="plus" size={11} color={COLORS.purple} /> Reserve
                </div>
              </div>

              {showReserveForm && (
                <div style={{ background: COLORS.bg, borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                  <select value={reserveUnitId} onChange={(e) => setReserveUnitId(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px' }}>
                    <option value="">Select {unitLabel.toLowerCase()} number</option>
                    {availableUnits.map((u) => <option key={u.id} value={u.id}>{unitLabel} {u.unit_number}</option>)}
                  </select>
                  <div onClick={savingReserve || !reserveUnitId ? undefined : addReservation} style={{ background: COLORS.purple, color: 'white', textAlign: 'center', padding: '10px', borderRadius: '9px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', opacity: !reserveUnitId ? 0.6 : 1 }}>
                    {savingReserve ? 'Saving...' : 'Confirm Reservation'}
                  </div>
                </div>
              )}

              {reservedUnits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                    <Icon name="calendar" size={20} color={COLORS.purple} />
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>No reserved {unitLabel.toLowerCase()}s</p>
                  <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>You don't have any reserved {unitLabel.toLowerCase()}s right now.</p>
                </div>
              ) : (
                reservedUnits.map((u) => (
                  <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${COLORS.border}` }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{unitLabel} {u.unit_number}</p>
                    <div onClick={() => releaseReservation(u.id)} style={{ background: '#f0fdf4', color: COLORS.green, fontSize: '11px', fontWeight: 700, padding: '5px 10px', borderRadius: '8px', cursor: 'pointer' }}>Release</div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{unitLabel} Items ({units.length})</p>
              <div onClick={() => setSortDesc(!sortDesc)} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: COLORS.purple, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                Sort {sortDesc ? '↓' : '↑'}
              </div>
            </div>

            {sortedUnits.length === 0 ? (
              <div style={{ background: COLORS.card, padding: '24px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '12.5px' }}>
                No {unitLabel.toLowerCase()}s yet.
              </div>
            ) : (
              sortedUnits.map((u) => {
                const st = statusStyle[u.status]
                return (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: COLORS.card, borderRadius: '12px', padding: '12px 14px', marginBottom: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name="bed" size={15} color={st.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '13.5px', fontWeight: 800, color: st.color }}>{u.unit_number}</p>
                      <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{item.name}</p>
                    </div>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: st.color, background: st.bg, padding: '4px 10px', borderRadius: '8px', whiteSpace: 'nowrap' }}>{st.label}</span>
                  </div>
                )
              })
            )}

            {showTip && (
              <div style={{ background: '#f0fdf4', borderRadius: '14px', padding: '14px', marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ display: 'flex' }}><Icon name="shield" size={18} color={COLORS.green} /></span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>Keep your inventory updated</p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>Accurate inventory helps you avoid double bookings and improve guest experience.</p>
                </div>
                <div onClick={() => setShowTip(false)} style={{ cursor: 'pointer', color: COLORS.textMuted, display: 'flex' }}><Icon name="x" size={14} color={COLORS.textMuted} /></div>
              </div>
            )}
          </>
        )}

        {tab === 'pricing' && (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Weekday Price</p>
            <input value={weekdayInput} onChange={(e) => setWeekdayInput(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="₦25,000" inputMode="decimal" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '14px', fontSize: '13px', boxSizing: 'border-box' }} />

            <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Weekend Price</p>
            <input value={weekendInput} onChange={(e) => setWeekendInput(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="₦30,000 (optional)" inputMode="decimal" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '14px', fontSize: '13px', boxSizing: 'border-box' }} />

            <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Public Holiday Price</p>
            <input value={holidayInput} onChange={(e) => setHolidayInput(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="₦35,000 (optional)" inputMode="decimal" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '16px', fontSize: '13px', boxSizing: 'border-box' }} />

            <div onClick={savingPrice ? undefined : savePricing} style={{ background: COLORS.purple, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: savingPrice ? 0.6 : 1 }}>
              {savingPrice ? 'Saving...' : 'Save Pricing'}
            </div>
          </div>
        )}

        {tab === 'maintenance' && (
          <>
            <div
              onClick={() => setShowMaintForm(!showMaintForm)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: COLORS.purple, color: 'white', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginBottom: '14px' }}>
              <Icon name="plus" size={15} color="white" /> Mark a {unitLabel} Under Maintenance
            </div>

            {showMaintForm && (
              <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                <select value={maintUnitId} onChange={(e) => setMaintUnitId(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px' }}>
                  <option value="">Select {unitLabel.toLowerCase()} number</option>
                  {availableUnits.map((u) => <option key={u.id} value={u.id}>{unitLabel} {u.unit_number}</option>)}
                </select>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. Air Conditioner Repair" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }} />
                <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '6px' }}>Expected Completion</p>
                <input value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} type="date" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box' }} />
                <div onClick={savingMaint || !maintUnitId ? undefined : addMaintenance} style={{ background: COLORS.amber, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: !maintUnitId ? 0.6 : 1 }}>
                  {savingMaint ? 'Saving...' : 'Save'}
                </div>
              </div>
            )}

            {maintenanceUnits.length === 0 ? (
              <div style={{ background: COLORS.card, padding: '28px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted }}>
                No {unitLabel.toLowerCase()}s under maintenance
              </div>
            ) : (
              maintenanceUnits.map((u) => (
                <div key={u.id} style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>{unitLabel} {u.unit_number}</p>
                      {u.reason && <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>Reason: {u.reason}</p>}
                      <p style={{ fontSize: '11px', color: COLORS.amber, fontWeight: 600, marginTop: '4px' }}>Status: Under Maintenance</p>
                      {u.expected_completion && (
                        <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>Expected Completion: {new Date(u.expected_completion).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</p>
                      )}
                    </div>
                    <div onClick={() => reopenUnit(u.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f0fdf4', color: COLORS.green, fontSize: '11.5px', fontWeight: 700, padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <Icon name="check" size={12} color={COLORS.green} strokeWidth={2.5} /> Reopen
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {tab === 'availability' && (
          <>
            <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '14px' }}>
              Tap a day to mark it Sold Out or Available. Days with no override are Available by default.
            </p>
            {Array.from({ length: 14 }).map((_, i) => {
              const d = new Date()
              d.setDate(d.getDate() + i)
              const dateStr = d.toISOString().split('T')[0]
              const isSoldOut = soldOutDates.includes(dateStr)
              const dayLabel = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
              return (
                <div key={dateStr} onClick={() => toggleDate(dateStr, isSoldOut)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: COLORS.card, borderRadius: '12px', padding: '13px 14px', marginBottom: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.text }}>{dayLabel}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: isSoldOut ? '#fef2f2' : '#f0fdf4', color: isSoldOut ? COLORS.red : COLORS.green, padding: '5px 10px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700 }}>
                    {isSoldOut ? <Icon name="calendarX" size={13} color={COLORS.red} /> : <Icon name="checkCircle" size={13} color={COLORS.green} />}
                    {isSoldOut ? 'Sold Out' : 'Available'}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {tab === 'stock' && (
        <div
          onClick={load}
          style={{
            position: 'fixed', bottom: '20px', left: '20px', width: '48px', height: '48px', borderRadius: '50%',
            background: COLORS.purple, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(107,33,168,0.4)'
          }}>
          <Icon name="refresh" size={20} color="white" />
        </div>
      )}
    </div>
  )
}

function TabButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, textAlign: 'center', padding: '10px 3px', borderRadius: '10px', cursor: 'pointer',
        background: active ? COLORS.purple : COLORS.card, color: active ? 'white' : COLORS.textMuted,
        fontWeight: 700, fontSize: '11.5px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'
      }}>
      <Icon name={icon} size={15} color={active ? 'white' : COLORS.textMuted} />
      {label}
    </div>
  )
}

function StatCard({ icon, iconBg, iconColor, value, label, sub }: {
  icon: string; iconBg: string; iconColor: string; value: number; label: string; sub: string
}) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
      <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
        <Icon name={icon} size={16} color={iconColor} />
      </div>
      <p style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text }}>{value}</p>
      <p style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '1px' }}>{sub}</p>
    </div>
  )
}
