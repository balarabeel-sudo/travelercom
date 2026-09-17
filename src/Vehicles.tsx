import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
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

type Vehicle = {
  id: string
  name: string
  registration_number: string | null
  vehicle_type: string | null
  seat_capacity: number
  seat_layout: { layout?: string } | null
  amenities: string[] | null
  status: 'active' | 'inactive' | 'maintenance'
  created_at: string
}

type StatusFilter = 'all' | 'active' | 'inactive' | 'maintenance'

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: 'Active', bg: '#DCFCE7', color: COLORS.green },
  inactive: { label: 'Inactive', bg: '#F1F5F9', color: COLORS.textMuted },
  maintenance: { label: 'Maintenance', bg: '#FFEDD5', color: COLORS.amber },
}

export default function Vehicles() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const [name, setName] = useState('')
  const [registration, setRegistration] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [capacity, setCapacity] = useState('')
  const [layout, setLayout] = useState('2+2')
  const [amenitiesText, setAmenitiesText] = useState('')

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

    const { data: vehicleRows, error: vehicleErr } = await supabase
      .from('vehicles')
      .select('id, name, registration_number, vehicle_type, seat_capacity, seat_layout, amenities, status, created_at')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })

    if (vehicleErr) { setNetError(true); setLoading(false); return }

    setVehicles((vehicleRows || []) as any)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setName('')
    setRegistration('')
    setVehicleType('')
    setCapacity('')
    setLayout('2+2')
    setAmenitiesText('')
    setAddError('')
  }

  const handleAdd = async () => {
    if (!companyId || !name.trim() || !capacity) return
    setAddError('')

    const cap = parseInt(capacity, 10)
    if (!cap || cap <= 0) { setAddError('Enter a valid seat capacity.') ; return }

    const duplicate = registration.trim()
      ? vehicles.some((v) => (v.registration_number || '').trim().toLowerCase() === registration.trim().toLowerCase())
      : false
    if (duplicate) {
      setAddError(`A vehicle with registration "${registration.trim()}" already exists.`)
      return
    }

    setSaving(true)

    const amenities = amenitiesText
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean)

    const { error: insertErr } = await supabase.from('vehicles').insert({
      company_id: companyId,
      name: name.trim(),
      registration_number: registration.trim() || null,
      vehicle_type: vehicleType.trim() || null,
      seat_capacity: cap,
      seat_layout: layout.trim() ? { layout: layout.trim() } : null,
      amenities: amenities.length > 0 ? amenities : null,
      status: 'active',
    })

    setSaving(false)

    if (insertErr) {
      setAddError(insertErr.message || 'Could not save vehicle. Please try again.')
      return
    }

    resetForm()
    setShowForm(false)
    load()
  }

  const filtered = vehicles.filter((v) => {
    if (filter !== 'all' && v.status !== filter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const haystack = `${v.name} ${v.registration_number || ''} ${v.vehicle_type || ''}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const counts = {
    all: vehicles.length,
    active: vehicles.filter((v) => v.status === 'active').length,
    inactive: vehicles.filter((v) => v.status === 'inactive').length,
    maintenance: vehicles.filter((v) => v.status === 'maintenance').length,
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ padding: '18px 20px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Vehicles</h1>
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
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Vehicles</h1>
        </div>
        <NetworkError onRetry={() => { setLoading(true); load() }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>

      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div onClick={() => navigate('/inventory')} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="arrowLeft" size={22} color={COLORS.text} />
          </div>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Vehicles</h1>
        </div>
        <div
          onClick={() => { setShowForm(!showForm); if (showForm) resetForm() }}
          style={{ width: '38px', height: '38px', borderRadius: '12px', background: COLORS.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="plus" size={19} color="white" />
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, registration or type"
          style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.card }}
        />

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto' }}>
          {(['all', 'active', 'inactive', 'maintenance'] as StatusFilter[]).map((f) => (
            <div
              key={f}
              onClick={() => setFilter(f)}
              style={{
                whiteSpace: 'nowrap', padding: '7px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                background: filter === f ? COLORS.purple : COLORS.card,
                color: filter === f ? 'white' : COLORS.textMuted,
                border: `1px solid ${filter === f ? COLORS.purple : COLORS.border}`,
              }}>
              {f === 'all' ? 'All' : STATUS_LABEL[f].label} ({counts[f]})
            </div>
          ))}
        </div>

        {showForm && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: COLORS.text }}>Add Vehicle</p>

            {addError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', marginBottom: '10px' }}>
                <p style={{ fontSize: '11.5px', color: COLORS.red }}>{addError}</p>
              </div>
            )}

            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vehicle name, e.g. Bus 01" style={inputStyle} />
            <input value={registration} onChange={(e) => setRegistration(e.target.value)} placeholder="Registration number, e.g. KDA 123 XY" style={inputStyle} />
            <input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="Vehicle type, e.g. Coach, Sienna" style={inputStyle} />
            <input value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Seat capacity, e.g. 50" inputMode="numeric" style={inputStyle} />
            <select value={layout} onChange={(e) => setLayout(e.target.value)} style={inputStyle}>
              <option value="2+2">Seat layout: 2 + 2</option>
              <option value="2+1">Seat layout: 2 + 1</option>
              <option value="1+1">Seat layout: 1 + 1</option>
              <option value="3+2">Seat layout: 3 + 2</option>
            </select>
            <input value={amenitiesText} onChange={(e) => setAmenitiesText(e.target.value)} placeholder="Amenities, comma separated e.g. AC, Wi-Fi, Charging Port" style={{ ...inputStyle, marginBottom: '12px' }} />

            <div onClick={saving ? undefined : handleAdd} style={{ background: COLORS.purple, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Save Vehicle'}
            </div>
          </div>
        )}

        <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>Fleet</p>

        {filtered.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
            {vehicles.length === 0 ? 'No vehicles added yet.' : 'No vehicles match your search or filter.'}
          </div>
        ) : (
          filtered.map((v) => {
            const statusInfo = STATUS_LABEL[v.status] || STATUS_LABEL.active
            return (
              <div
                key={v.id}
                onClick={() => navigate(`/vehicles/${v.id}`)}
                style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', marginBottom: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', gap: '12px', cursor: 'pointer' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '12px', flexShrink: 0, background: `linear-gradient(135deg, #F97316, #0EA5E9)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="bus" size={22} color="white" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{v.name}</p>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: statusInfo.color, background: statusInfo.bg, padding: '3px 8px', borderRadius: '7px', whiteSpace: 'nowrap' }}>{statusInfo.label}</span>
                  </div>
                  {v.registration_number && (
                    <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>{v.registration_number}{v.vehicle_type ? ` · ${v.vehicle_type}` : ''}</p>
                  )}
                  <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '4px' }}>
                    Capacity <span style={{ fontWeight: 700, color: COLORS.text }}>{v.seat_capacity} seats</span>
                    {v.seat_layout?.layout ? <> · Layout <span style={{ fontWeight: 700, color: COLORS.text }}>{v.seat_layout.layout}</span></> : null}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Icon name="chevronRight" size={16} color={COLORS.textMuted} />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`,
  marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.bg,
}
