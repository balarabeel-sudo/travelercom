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
  occupied_quantity: number
  reserved_quantity: number
  maintenance_quantity: number
  price: number
  weekend_price: number | null
  holiday_price: number | null
}

type MaintenanceUnit = {
  id: string
  unit_number: string
  reason: string | null
  expected_completion: string | null
}

export default function InventoryDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState<Item | null>(null)
  const [unitLabel, setUnitLabel] = useState('Room')
  const [tab, setTab] = useState<'stock' | 'pricing' | 'maintenance' | 'availability'>('stock')
  const [weekdayInput, setWeekdayInput] = useState('')
  const [weekendInput, setWeekendInput] = useState('')
  const [holidayInput, setHolidayInput] = useState('')
  const [savingPrice, setSavingPrice] = useState(false)
  const [units, setUnits] = useState<MaintenanceUnit[]>([])
  const [soldOutDates, setSoldOutDates] = useState<string[]>([])
  const [showMaintForm, setShowMaintForm] = useState(false)
  const [unitNumber, setUnitNumber] = useState('')
  const [reason, setReason] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [savingMaint, setSavingMaint] = useState(false)

  const load = async () => {
    const { data } = await supabase
      .from('inventory_items')
      .select('id, name, total_quantity, occupied_quantity, reserved_quantity, maintenance_quantity, price, weekend_price, holiday_price, service_id, services(category)')
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
      .select('id, unit_number, reason, expected_completion')
      .eq('inventory_item_id', id)
      .order('created_at', { ascending: false })
    setUnits(unitRows || [])

    const { data: availRows } = await supabase
      .from('inventory_availability')
      .select('date')
      .eq('inventory_item_id', id)
      .eq('status', 'sold_out')
    setSoldOutDates((availRows || []).map((r: any) => r.date))

    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const adjust = async (field: 'total_quantity' | 'occupied_quantity' | 'reserved_quantity', delta: number) => {
    if (!item) return
    const newValue = Math.max(0, item[field] + delta)
    const maintenanceCount = units.length

    if (field !== 'total_quantity') {
      const other = field === 'occupied_quantity' ? item.reserved_quantity : item.occupied_quantity
      if (newValue + other + maintenanceCount > item.total_quantity) return
    } else {
      const used = item.occupied_quantity + item.reserved_quantity + maintenanceCount
      if (newValue < used) return
    }

    await supabase.from('inventory_items').update({ [field]: newValue }).eq('id', item.id)
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
    if (!unitNumber.trim()) return
    setSavingMaint(true)
    await supabase.from('inventory_units').insert({
      inventory_item_id: id,
      unit_number: unitNumber.trim(),
      reason: reason.trim() || null,
      expected_completion: expectedDate || null,
    })
    setUnitNumber('')
    setReason('')
    setExpectedDate('')
    setShowMaintForm(false)
    setSavingMaint(false)
    load()
  }

  const reopenUnit = async (unitId: string) => {
    await supabase.from('inventory_units').delete().eq('id', unitId)
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

  const maintenanceCount = units.length
  const available = item.total_quantity - item.occupied_quantity - item.reserved_quantity - maintenanceCount

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
              <StatCard label={`Total ${unitLabel}s`} value={item.total_quantity} color={COLORS.text} />
              <StatCard label="Available" value={available} color={COLORS.green} />
              <StatCard label="Occupied" value={item.occupied_quantity} color={COLORS.primary} />
              <StatCard label="Maintenance" value={maintenanceCount} color={COLORS.amber} />
            </div>

            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: COLORS.text }}>Actions</p>

            <StepperRow label={`Total ${unitLabel}s`} value={item.total_quantity} onMinus={() => adjust('total_quantity', -1)} onPlus={() => adjust('total_quantity', 1)} />
            <StepperRow label="Occupied" value={item.occupied_quantity} onMinus={() => adjust('occupied_quantity', -1)} onPlus={() => adjust('occupied_quantity', 1)} />
            <StepperRow label="Reserved" value={item.reserved_quantity} onMinus={() => adjust('reserved_quantity', -1)} onPlus={() => adjust('reserved_quantity', 1)} />
            <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px' }}>
              Maintenance is now managed in the 🔧 Maintenance tab, per {unitLabel.toLowerCase()} number.
            </p>
          </>
        )}

        {tab === 'pricing' && (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Weekday Price</p>
            <input
              value={weekdayInput}
              onChange={(e) => setWeekdayInput(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="₦25,000"
              inputMode="decimal"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '14px', fontSize: '13px', boxSizing: 'border-box' }}
            />

            <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Weekend Price</p>
            <input
              value={weekendInput}
              onChange={(e) => setWeekendInput(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="₦30,000 (optional)"
              inputMode="decimal"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '14px', fontSize: '13px', boxSizing: 'border-box' }}
            />

            <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '6px' }}>Public Holiday Price</p>
            <input
              value={holidayInput}
              onChange={(e) => setHolidayInput(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="₦35,000 (optional)"
              inputMode="decimal"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '16px', fontSize: '13px', boxSizing: 'border-box' }}
            />

            <div
              onClick={savingPrice ? undefined : savePricing}
              style={{
                background: COLORS.purple, color: 'white', textAlign: 'center', padding: '11px',
                borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: savingPrice ? 0.6 : 1
              }}>
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
              <Icon name="plus" size={15} color="white" /> Mark {unitLabel} Under Maintenance
            </div>

            {showMaintForm && (
              <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                <input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder={`${unitLabel} number, e.g. 105`} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }} />
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. Air Conditioner Repair" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }} />
                <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '6px' }}>Expected Completion</p>
                <input value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} type="date" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box' }} />
                <div onClick={savingMaint ? undefined : addMaintenance} style={{ background: COLORS.amber, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: savingMaint ? 0.6 : 1 }}>
                  {savingMaint ? 'Saving...' : 'Save'}
                </div>
              </div>
            )}

            {units.length === 0 ? (
              <div style={{ background: COLORS.card, padding: '28px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted }}>
                No {unitLabel.toLowerCase()}s under maintenance
              </div>
            ) : (
              units.map((u) => (
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

function StepperRow({ label, value, onMinus, onPlus }: { label: string; value: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: COLORS.card, borderRadius: '12px', padding: '12px 14px', marginBottom: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
    }}>
      <p style={{ fontSize: '13.5px', fontWeight: 600, color: COLORS.text }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div onClick={onMinus} style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="minus" size={14} color={COLORS.red} />
        </div>
        <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, minWidth: '20px', textAlign: 'center' }}>{value}</p>
        <div onClick={onPlus} style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="plus" size={14} color={COLORS.green} />
        </div>
      </div>
    </div>
  )
}
