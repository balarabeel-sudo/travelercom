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

export default function InventoryDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState<Item | null>(null)
  const [unitLabel, setUnitLabel] = useState('Room')
  const [tab, setTab] = useState<'stock' | 'pricing'>('stock')
  const [weekdayInput, setWeekdayInput] = useState('')
  const [weekendInput, setWeekendInput] = useState('')
  const [holidayInput, setHolidayInput] = useState('')
  const [savingPrice, setSavingPrice] = useState(false)

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
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const adjust = async (field: 'total_quantity' | 'occupied_quantity' | 'reserved_quantity' | 'maintenance_quantity', delta: number) => {
    if (!item) return
    const newValue = Math.max(0, item[field] + delta)

    if (field !== 'total_quantity') {
      const otherSum = ['occupied_quantity', 'reserved_quantity', 'maintenance_quantity']
        .filter((f) => f !== field)
        .reduce((sum, f) => sum + (item as any)[f], 0)
      if (newValue + otherSum > item.total_quantity) return
    } else {
      const usedSum = item.occupied_quantity + item.reserved_quantity + item.maintenance_quantity
      if (newValue < usedSum) return
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

  const available = item.total_quantity - item.occupied_quantity - item.reserved_quantity - item.maintenance_quantity

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
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
          <TabButton label={`🛏 ${unitLabel}s`} active={tab === 'stock'} onClick={() => setTab('stock')} />
          <TabButton label="💵 Pricing" active={tab === 'pricing'} onClick={() => setTab('pricing')} />
        </div>

        {tab === 'stock' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <StatCard label={`Total ${unitLabel}s`} value={item.total_quantity} color={COLORS.text} />
              <StatCard label="Available" value={available} color={COLORS.green} />
              <StatCard label="Occupied" value={item.occupied_quantity} color={COLORS.primary} />
              <StatCard label="Maintenance" value={item.maintenance_quantity} color={COLORS.amber} />
            </div>

            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: COLORS.text }}>Actions</p>

            <StepperRow label={`Total ${unitLabel}s`} value={item.total_quantity} onMinus={() => adjust('total_quantity', -1)} onPlus={() => adjust('total_quantity', 1)} />
            <StepperRow label="Occupied" value={item.occupied_quantity} onMinus={() => adjust('occupied_quantity', -1)} onPlus={() => adjust('occupied_quantity', 1)} />
            <StepperRow label="Reserved" value={item.reserved_quantity} onMinus={() => adjust('reserved_quantity', -1)} onPlus={() => adjust('reserved_quantity', 1)} />
            <StepperRow label="Maintenance" value={item.maintenance_quantity} onMinus={() => adjust('maintenance_quantity', -1)} onPlus={() => adjust('maintenance_quantity', 1)} />
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
      </div>
    </div>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', cursor: 'pointer',
        background: active ? COLORS.purple : COLORS.card, color: active ? 'white' : COLORS.textMuted,
        fontWeight: 700, fontSize: '13px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
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
