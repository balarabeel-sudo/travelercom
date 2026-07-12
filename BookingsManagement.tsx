import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  red: '#dc2626',
  orange: '#c2410c',
}

type Booking = {
  id: string
  ticket_code: string
  customer_name: string | null
  booking_status: string
  checked_in: boolean
  amount_paid: number
  created_at: string
  services: { title: string; category: string } | null
}

type FilterTab = 'all' | 'pending' | 'completed' | 'cancelled'

function BookingsManagement() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterTab>('all')

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        navigate('/login')
        return
      }

      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', userData.user.id)
        .maybeSingle()

      if (!company) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('bookings')
        .select('id, ticket_code, customer_name, booking_status, checked_in, amount_paid, created_at, services(title, category)')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })

      setBookings((data as any) || [])
      setLoading(false)
    }
    load()
  }, [navigate])

  const getTab = (b: Booking): FilterTab => {
    if (b.booking_status === 'cancelled') return 'cancelled'
    if (b.checked_in) return 'completed'
    return 'pending'
  }

  const filtered = bookings.filter((b) => {
    const matchesFilter = filter === 'all' || getTab(b) === filter
    const q = search.trim().toLowerCase()
    const matchesSearch = !q ||
      (b.customer_name || '').toLowerCase().includes(q) ||
      b.ticket_code.toLowerCase().includes(q)
    return matchesFilter && matchesSearch
  })

  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => getTab(b) === 'pending').length,
    completed: bookings.filter((b) => getTab(b) === 'completed').length,
    cancelled: bookings.filter((b) => getTab(b) === 'cancelled').length,
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'pending', label: `Pending (${counts.pending})` },
    { key: 'completed', label: `Completed (${counts.completed})` },
    { key: 'cancelled', label: `Cancelled (${counts.cancelled})` },
  ]

  const statusBadge = (b: Booking) => {
    const tab = getTab(b)
    if (tab === 'completed') return { text: 'Completed', bg: '#f0fdf4', color: COLORS.green }
    if (tab === 'cancelled') return { text: 'Cancelled', bg: '#fef2f2', color: COLORS.red }
    return { text: 'Pending', bg: '#fff7ed', color: COLORS.orange }
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: COLORS.card,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <span onClick={() => navigate('/home')} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Bookings Management</h1>
      </div>

      <div style={{ padding: '16px' }}>
        <input
          type="text"
          placeholder="Search by customer or ticket code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '11px',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '10px',
            fontSize: '13.5px',
            marginBottom: '12px',
            boxSizing: 'border-box',
            background: COLORS.card,
          }}
        />

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px' }}>
          {tabs.map((t) => (
            <div
              key={t.key}
              onClick={() => setFilter(t.key)}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                background: filter === t.key ? COLORS.primary : COLORS.card,
                color: filter === t.key ? 'white' : COLORS.textMuted,
                fontSize: '12.5px',
                fontWeight: 700,
                whiteSpace: 'nowrap' as const,
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
              }}>
              {t.label}
            </div>
          ))}
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: COLORS.textMuted, fontSize: '13px', padding: '30px 0' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={{
            background: COLORS.card,
            borderRadius: '16px',
            padding: '30px',
            textAlign: 'center',
            color: COLORS.textMuted,
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
          }}>
            <p style={{ fontSize: '13px' }}>No bookings found</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map((b) => {
              const badge = statusBadge(b)
              return (
                <div key={b.id} style={{
                  background: COLORS.card,
                  borderRadius: '14px',
                  padding: '14px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{b.customer_name || 'Unknown Customer'}</p>
                      <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>{b.services?.title || '—'}</p>
                    </div>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: badge.color,
                      background: badge.bg,
                      padding: '4px 10px',
                      borderRadius: '8px'
                    }}>
                      {badge.text}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: '11px', color: COLORS.textMuted, fontFamily: 'monospace' }}>{b.ticket_code}</p>
                      <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{new Date(b.created_at).toLocaleDateString()}</p>
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.primary }}>₦{Number(b.amount_paid).toLocaleString()}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default BookingsManagement
