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

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div onClick={() => navigate('/inventory')} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>{item.name}</h1>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
          <TabButton label={`🛏 ${unitLabel}s`} active={tab === 'stock'} onClick={() => setTab('stock')} />
          <TabButton label="💵 Pricing" active={tab === 'pricing'} onClick={() => setTab('pricing')} />
          <TabButton label="🔧 Maintenance" active={tab === 'maintenance'} onClick={() => setTab('maintenance')} />
          <TabButton label="📅 Availability" active={tab === 'availability'} onClick={() => setTab('availability')} />
        </div>

        {tab === 'stock' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <StatCard label={`Total ${unitLabel}s`} value={units.length} color={COLORS.text} />
              <StatCard label="Available" value={availableUnits.length} color={COLORS.green} />
              <StatCard label="Occupied" value={occupiedCount} color={COLORS.primary} />
              <StatCard label="Maintenance" value={maintenanceUnits.length} color={COLORS.amber} />
            </div>

            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: COLORS.text }}>Total {unitLabel}s</p>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: COLORS.card, borderRadius: '12px', padding: '12px 14px', marginBottom: '18px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
            }}>
              <p style={{ fontSize: '13.5px', fontWeight: 600, color: COLORS.text }}>Adjust total {unitLabel.toLowerCase()}s</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div onClick={removeRoom} style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon name="minus" size={14} color={COLORS.red} />
                </div>
                <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, minWidth: '20px', textAlign: 'center' }}>{units.length}</p>
                <div onClick={addRoom} style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon name="plus" size={14} color={COLORS.green} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>Reserved {unitLabel}s</p>
              <div onClick={() => setShowReserveForm(!showReserveForm)} style={{ color: COLORS.purple, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>
                + Reserve
              </div>
            </div>

            {showReserveForm && (
              <div style={{ background: COLORS.card, borderRadius: '12px', padding: '14px', marginBottom: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                <select
                  value={reserveUnitId}
                  onChange={(e) => setReserveUnitId(e.target.value)}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px' }}>
                  <option value="">Select {unitLabel.toLowerCase()} number</option>
                  {availableUnits.map((u) => (
                    <option key={u.id} value={u.id}>{unitLabel} {u.unit_number}</option>
                  ))}
                </select>
                <div
                  onClick={savingReserve || !reserveUnitId ? undefined : addReservation}
                  style={{ background: COLORS.purple, color: 'white', textAlign: 'center', padding: '10px', borderRadius: '9px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', opacity: !reserveUnitId ? 0.6 : 1 }}>
                  {savingReserve ? 'Saving...' : 'Confirm Reservation'}
                </div>
              </div>
            )}

            {reservedUnits.length === 0 ? (
              <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '4px' }}>No {unitLabel.toLowerCase()}s reserved right now.</p>
            ) : (
              reservedUnits.map((u) => (
                <div key={u.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: COLORS.card, borderRadius: '12px', padding: '12px 14px', marginBottom: '8px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
                }}>
                  <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{unitLabel} {u.unit_number}</p>
                  <div onClick={() => releaseReservation(u.id)} style={{ background: '#f0fdf4', color: COLORS.green, fontSize: '11.5px', fontWeight: 700, padding: '5px 10px', borderRadius: '8px', cursor: 'pointer' }}>
                    Release
                  </div>
                </div>
              ))
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
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                background: COLORS.purple, color: 'white', padding: '11px', borderRadius: '10px',
                fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginBottom: '14px'
              }}>
              <Icon name="plus" size={15} color="white" /> Mark a {unitLabel} Under Maintenance
            </div>

            {showMaintForm && (
              <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                <select
                  value={maintUnitId}
                  onChange={(e) => setMaintUnitId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px' }}>
                  <option value="">Select {unitLabel.toLowerCase()} number</option>
                  {availableUnits.map((u) => (
                    <option key={u.id} value={u.id}>{unitLabel} {u.unit_number}</option>
                  ))}
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
                      ✅ Reopen
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
    </div>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, textAlign: 'center', padding: '10px 3px', borderRadius: '10px', cursor: 'pointer',
        background: active ? COLORS.purple : COLORS.card, color: active ? 'white' : COLORS.textMuted,
        fontWeight: 700, fontSize: '11.5px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
      {label}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
      <p style={{ fontSize: '20px', fontWeight: 800, color }}>{value}</p>
      <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{label}</p>
    </div>
  )
}
