import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  greenBg: '#F0FDF4',
  red: '#dc2626',
  redBg: '#FEF2F2',
  orange: '#d97706',
  orangeBg: '#FFFBEB',
}

type Listing = {
  id: string
  title: string
  destination: string | null
  price: number
  seats_available: number | null
  photo_url: string | null
  status: string | null
  tour_type: string | null
  created_at: string
  company_id: string | null
  companies: { business_name: string } | null
  bookings_count?: number
  total_revenue?: number
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 900)
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isDesktop
}

function formatNaira(n: number) {
  return '₦' + n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status || 'inactive'
  const map: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: COLORS.greenBg, color: COLORS.green, label: 'Active' },
    inactive: { bg: COLORS.redBg, color: COLORS.red, label: 'Inactive' },
  }
  const cfg = map[s] || { bg: COLORS.orangeBg, color: COLORS.orange, label: s }
  return (
    <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' as const }}>
      {cfg.label}
    </span>
  )
}

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
]

export default function AdminTours() {
  const isDesktop = useIsDesktop()
  const [loading, setLoading] = useState(true)
  const [listings, setListings] = useState<Listing[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewing, setViewing] = useState<Listing | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  const load = async () => {
    setLoading(true)
    let query = supabase
      .from('services')
      .select('id, title, destination, price, seats_available, photo_url, status, tour_type, created_at, company_id, companies(business_name)')
      .eq('category', 'tour')
      .order('created_at', { ascending: false })

    if (search.trim()) query = query.ilike('title', `%${search.trim()}%`)
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)

    const { data } = await query
    let rows = (data as any[]) || []

    if (rows.length > 0) {
      const { data: bookingRows } = await supabase
        .from('bookings')
        .select('service_id, amount_paid')
        .in('service_id', rows.map((r) => r.id))
      const agg: Record<string, { count: number; revenue: number }> = {}
      for (const b of bookingRows || []) {
        if (!b.service_id) continue
        if (!agg[b.service_id]) agg[b.service_id] = { count: 0, revenue: 0 }
        agg[b.service_id].count += 1
        agg[b.service_id].revenue += Number(b.amount_paid) || 0
      }
      rows = rows.map((r) => ({ ...r, bookings_count: agg[r.id]?.count || 0, total_revenue: agg[r.id]?.revenue || 0 }))
    }

    setListings(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter])

  const total = listings.length
  const activeCount = listings.filter((l) => l.status === 'active').length
  const inactiveCount = listings.filter((l) => l.status !== 'active').length

  async function toggleStatus(listing: Listing) {
    setActionLoading(true)
    setActionError('')
    const newStatus = listing.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase.from('services').update({ status: newStatus }).eq('id', listing.id)
    if (error) {
      setActionError(error.message)
      setActionLoading(false)
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      await supabase.rpc('log_audit', {
        p_action: newStatus === 'active' ? 'activated_listing' : 'deactivated_listing',
        p_module: 'listings',
        p_target_type: 'service',
        p_target_id: listing.id,
        p_previous: { status: listing.status },
        p_new: { status: newStatus },
        p_company_id: listing.company_id,
      })
    }
    setActionLoading(false)
    setViewing((v) => (v ? { ...v, status: newStatus } : v))
    load()
  }

  if (viewing) {
    return (
      <div style={{ padding: isDesktop ? '24px 28px' : '16px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span onClick={() => setViewing(null)} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="arrowLeft" size={19} color={COLORS.text} />
          </span>
          <h2 style={{ fontSize: isDesktop ? '19px' : '16px', fontWeight: 800, color: COLORS.text }}>Listing Details</h2>
        </div>

        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', overflow: 'hidden', marginBottom: '14px' }}>
          <div style={{ height: '160px', background: viewing.photo_url ? undefined : `linear-gradient(135deg, #F97316, ${COLORS.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {viewing.photo_url ? <img src={viewing.photo_url} alt={viewing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="map" size={34} color="white" />}
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{viewing.title}</p>
                <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>{viewing.companies?.business_name || 'Unknown company'}{viewing.tour_type ? ` · ${viewing.tour_type}` : ''}</p>
              </div>
              <StatusBadge status={viewing.status} />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <div style={{ flex: 1, background: COLORS.bg, borderRadius: '10px', padding: '10px' }}>
                <p style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: 700 }}>DESTINATION</p>
                <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, marginTop: '2px' }}>{viewing.destination || 'Not set'}</p>
              </div>
              <div style={{ flex: 1, background: COLORS.bg, borderRadius: '10px', padding: '10px' }}>
                <p style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: 700 }}>PRICE</p>
                <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, marginTop: '2px' }}>{formatNaira(viewing.price)}</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <div style={{ flex: 1, background: COLORS.bg, borderRadius: '10px', padding: '10px' }}>
                <p style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: 700 }}>TOTAL BOOKINGS</p>
                <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, marginTop: '2px' }}>{(viewing.bookings_count ?? 0).toLocaleString()}</p>
              </div>
              <div style={{ flex: 1, background: COLORS.bg, borderRadius: '10px', padding: '10px' }}>
                <p style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: 700 }}>TOTAL REVENUE</p>
                <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, marginTop: '2px' }}>{formatNaira(viewing.total_revenue ?? 0)}</p>
              </div>
            </div>

            <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '12px' }}>Listed {new Date(viewing.created_at).toLocaleDateString()}</p>

            {actionError && <p style={{ fontSize: '12px', color: COLORS.red, marginTop: '10px' }}>{actionError}</p>}

            <button
              disabled={actionLoading}
              onClick={() => {
                const verb = viewing.status === 'active' ? 'deactivate' : 'activate'
                if (window.confirm(`Are you sure you want to ${verb} "${viewing.title}"? ${verb === 'deactivate' ? 'It will no longer be bookable by customers.' : ''}`)) {
                  toggleStatus(viewing)
                }
              }}
              style={{
                width: '100%', marginTop: '16px', padding: '12px', borderRadius: '10px', border: 'none', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer',
                background: viewing.status === 'active' ? COLORS.red : COLORS.green, color: 'white', opacity: actionLoading ? 0.6 : 1,
              }}>
              {actionLoading ? 'Please wait…' : viewing.status === 'active' ? 'Deactivate Listing' : 'Activate Listing'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: isDesktop ? '24px 28px' : '16px', maxWidth: '1400px', margin: '0 auto', overflowY: 'auto' as const, height: '100%' }}>
      <div style={{ marginBottom: '4px' }}>
        <h2 style={{ fontSize: isDesktop ? '20px' : '17px', fontWeight: 800, color: COLORS.text }}>Tours</h2>
        <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>All tour listings across the platform.</p>
      </div>

      <div style={{ display: 'flex', gap: '8px', margin: '14px 0' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="Search tour name..."
          style={{ flex: 1, padding: '11px', border: `1px solid ${COLORS.border}`, borderRadius: '9px', fontSize: '13px' }}
        />
        <button onClick={load} style={{ padding: '11px 16px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '9px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>
          Search
        </button>
      </div>

      <div style={{ display: 'flex', gap: '7px', overflowX: 'auto' as const, marginBottom: '14px', paddingBottom: '2px' }}>
        {STATUS_FILTERS.map((f) => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            style={{ whiteSpace: 'nowrap' as const, padding: '7px 13px', borderRadius: '999px', border: `1px solid ${statusFilter === f.key ? COLORS.primary : COLORS.border}`, background: statusFilter === f.key ? COLORS.primary : COLORS.card, color: statusFilter === f.key ? 'white' : COLORS.textMuted, fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <SummaryCard label="Total Listings" value={total} />
        <SummaryCard label="Active" value={activeCount} color={COLORS.green} />
        <SummaryCard label="Inactive" value={inactiveCount} color={COLORS.red} />
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: COLORS.textMuted, padding: '40px 0', fontSize: '13px' }}>Loading…</p>
      ) : listings.length === 0 ? (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '30px', textAlign: 'center' as const, color: COLORS.textMuted }}>
          <p style={{ fontSize: '13px' }}>No tour listings found.</p>
        </div>
      ) : (
        <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}` }}>
          {listings.map((l, idx) => (
            <div key={l.id} onClick={() => setViewing(l)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '13px 15px', cursor: 'pointer', borderBottom: idx === listings.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {l.photo_url ? <img src={l.photo_url} alt={l.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="map" size={18} color="white" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{l.title}</p>
                <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '1px' }}>{l.companies?.business_name || 'Unknown'} · {l.destination || 'No destination'}</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                  <span style={{ fontSize: '11px', color: COLORS.textMuted }}>{formatNaira(l.price)}</span>
                  <span style={{ fontSize: '11px', color: COLORS.textMuted }}>{(l.bookings_count ?? 0).toLocaleString()} Bookings</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: '6px' }}>
                <StatusBadge status={l.status} />
                <Icon name="arrowUpRight" size={13} color={COLORS.textMuted} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '12px' }}>
      <p style={{ fontSize: '10.5px', color: COLORS.textMuted, fontWeight: 700 }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: '18px', fontWeight: 800, color: color || COLORS.text, marginTop: '3px' }}>{value.toLocaleString()}</p>
    </div>
  )
}
