import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
}

const CATEGORY_LABELS: Record<string, string> = {
  hotel: 'Room',
  bus: 'Seat',
  train: 'Seat',
  flight: 'Seat',
  tour: 'Slot',
  event_center: 'Ticket',
}

type InventoryItem = {
  id: string
  name: string
  total_quantity: number
  occupied_quantity: number
  reserved_quantity: number
  maintenance_quantity: number
  price: number
  service_id: string | null
}

type ServiceOption = { id: string; title: string; category: string }

export default function InventoryManagement() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [services, setServices] = useState<ServiceOption[]>([])
  const [unitLabel, setUnitLabel] = useState('Item')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [saving, setSaving] = useState(false)

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

    const { data: serviceRows } = await supabase
      .from('services')
      .select('id, title, category')
      .eq('company_id', company.id)

    setServices(serviceRows || [])
    if (serviceRows && serviceRows.length > 0) {
      setUnitLabel(CATEGORY_LABELS[serviceRows[0].category] || 'Item')
    }

    const { data: inventoryRows } = await supabase
      .from('inventory_items')
      .select('id, name, total_quantity, occupied_quantity, reserved_quantity, maintenance_quantity, price, service_id')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })

    setItems(inventoryRows || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!companyId || !name.trim() || !quantity) return
    setSaving(true)
    await supabase.from('inventory_items').insert({
      company_id: companyId,
      service_id: serviceId || null,
      name: name.trim(),
      total_quantity: parseInt(quantity, 10),
      price: price ? parseFloat(price) : 0,
    })
    setName('')
    setQuantity('')
    setPrice('')
    setServiceId('')
    setShowForm(false)
    setSaving(false)
    load()
  }

  const available = (item: InventoryItem) =>
    item.total_quantity - item.occupied_quantity - item.reserved_quantity - item.maintenance_quantity

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, color: COLORS.textMuted }}>
        Loading Inventory...
      </div>
    )
  }

  const totals = items.reduce(
    (acc, item) => ({
      total: acc.total + item.total_quantity,
      available: acc.available + available(item),
      booked: acc.booked + item.occupied_quantity + item.reserved_quantity,
      maintenance: acc.maintenance + item.maintenance_quantity,
    }),
    { total: 0, available: 0, booked: 0, maintenance: 0 }
  )

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: COLORS.card,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="arrowLeft" size={22} color={COLORS.text} />
          </div>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Inventory</h1>
        </div>
        <div
          onClick={() => setShowForm(!showForm)}
          style={{
            width: '34px', height: '34px', borderRadius: '10px', background: COLORS.purple,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}>
          <Icon name="plus" size={18} color="white" />
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>Inventory Overview</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
          <SummaryCard label="Total" value={totals.total} color={COLORS.text} />
          <SummaryCard label="Available" value={totals.available} color={COLORS.green} />
          <SummaryCard label="Booked" value={totals.booked} color={COLORS.primary} />
          <SummaryCard label="Maintenance" value={totals.maintenance} color={COLORS.amber} />
        </div>

        {showForm && (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: COLORS.text }}>Add {unitLabel} Type</p>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g. Executive ${unitLabel}, Suite`}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }}
            />

            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder={`Total ${unitLabel.toLowerCase()}s, e.g. 50`}
              inputMode="numeric"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }}
            />

            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="Price (₦, optional for now)"
              inputMode="decimal"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }}
            />

            {services.length > 0 && (
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px' }}>
                <option value="">Link to a listing (optional)</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            )}

            <div
              onClick={saving ? undefined : handleAdd}
              style={{
                background: COLORS.purple, color: 'white', textAlign: 'center', padding: '11px',
                borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                opacity: saving ? 0.6 : 1
              }}>
              {saving ? 'Saving...' : `Save ${unitLabel} Type`}
            </div>
          </div>
        )}

        <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>{unitLabel} Types</p>

        {items.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted }}>
            No {unitLabel.toLowerCase()} types yet. Tap + to add your first one.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} style={{
              background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '12px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>{item.name}</p>
                  {item.price > 0 && (
                    <p style={{ fontSize: '12px', color: COLORS.textMuted }}>₦{item.price.toLocaleString()}</p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '12px', color: COLORS.textMuted }}>
                  Total: <span style={{ fontWeight: 700, color: COLORS.text }}>{item.total_quantity}</span>
                  {'  ·  '}
                  Available: <span style={{ fontWeight: 700, color: available(item) === 0 ? '#DC2626' : COLORS.green }}>{available(item)}</span>
                </p>
                <div
                  onClick={() => navigate(`/inventory/${item.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    color: COLORS.purple, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer'
                  }}>
                  Manage <Icon name="chevronRight" size={14} color={COLORS.purple} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
      <p style={{ fontSize: '20px', fontWeight: 800, color }}>{value}</p>
      <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{label}</p>
    </div>
  )
}
