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
  red: '#dc2626',
  orange: '#F97316',
}

type Company = {
  id: string
  business_name: string
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  description: string | null
  plan: string | null
  verification_status: string | null
  created_at: string
}

type Stats = { bookings: number; revenue: number } | null

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#FFF7ED', color: COLORS.orange },
  verified: { bg: '#F0FDF4', color: COLORS.green },
  rejected: { bg: '#FEF2F2', color: COLORS.red },
  suspended: { bg: '#FEF2F2', color: COLORS.red },
}

const PAGE_SIZE = 30

export default function AdminCompanies() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected' | 'suspended'>('all')
  const [selected, setSelected] = useState<Company | null>(null)
  const [stats, setStats] = useState<Stats>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [acting, setActing] = useState(false)

  const fetchCompanies = async () => {
    setLoading(true)
    let query = supabase.from('companies').select('*').order('created_at', { ascending: false }).limit(PAGE_SIZE)
    if (search.trim()) query = query.ilike('business_name', `%${search.trim()}%`)
    if (filter !== 'all') query = query.eq('verification_status', filter)

    const { data } = await query
    setLoading(false)
    setCompanies((data as any[]) || [])
  }

  useEffect(() => {
    fetchCompanies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const openCompany = async (c: Company) => {
    setSelected(c)
    setStats(null)
    setActionMsg('')
    setStatsLoading(true)
    const { data, count } = await supabase
      .from('bookings')
      .select('amount_paid', { count: 'exact' })
      .eq('company_id', c.id)
    const revenue = (data || []).reduce((sum, b: any) => sum + Number(b.amount_paid || 0), 0)
    setStats({ bookings: count || 0, revenue })
    setStatsLoading(false)
  }

  const updateStatus = async (status: string) => {
    if (!selected) return
    setActing(true)
    const { error } = await supabase.from('companies').update({ verification_status: status }).eq('id', selected.id)
    setActing(false)
    if (error) {
      setActionMsg('Failed: ' + error.message)
      return
    }
    setSelected({ ...selected, verification_status: status })
    setCompanies(companies.map((c) => (c.id === selected.id ? { ...c, verification_status: status } : c)))
    setActionMsg(`Status updated to "${status}".`)
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '10px 13px', marginBottom: '12px' }}>
        <Icon name="search" size={15} color={COLORS.textMuted} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchCompanies()}
          placeholder="Search company name..."
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', background: 'transparent' }}
        />
        {search && <span onClick={fetchCompanies} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Search</span>}
      </div>

      <div style={{ display: 'flex', gap: '7px', marginBottom: '14px', overflowX: 'auto' as const }}>
        {(['all', 'pending', 'verified', 'rejected', 'suspended'] as const).map((f) => (
          <span
            key={f}
            onClick={() => setFilter(f)}
            style={{
              flexShrink: 0, padding: '7px 13px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
              background: filter === f ? COLORS.primary : COLORS.card,
              color: filter === f ? 'white' : COLORS.text,
              border: `1px solid ${filter === f ? COLORS.primary : COLORS.border}`,
            }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </span>
        ))}
      </div>

      {loading ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>Loading companies...</p>
      ) : companies.length === 0 ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>No companies found.</p>
      ) : (
        <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}` }}>
          {companies.map((c, idx) => {
            const status = c.verification_status || 'pending'
            const style = STATUS_STYLE[status] || STATUS_STYLE.pending
            return (
              <div
                key={c.id}
                onClick={() => openCompany(c)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 15px', cursor: 'pointer',
                  borderBottom: idx === companies.length - 1 ? 'none' : `1px solid ${COLORS.border}`,
                }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: COLORS.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>
                  {c.business_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{c.business_name}</p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '1px' }}>{c.city || 'No city set'}{c.plan === 'business_suite' ? ' · Business Suite' : ''}</p>
                </div>
                <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: style.bg, color: style.color }}>
                  {status.toUpperCase()}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {companies.length === PAGE_SIZE && (
        <p style={{ fontSize: '11px', color: COLORS.textMuted, textAlign: 'center' as const, marginTop: '12px' }}>
          Showing first {PAGE_SIZE} — refine your search to narrow results.
        </p>
      )}

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: COLORS.card, borderRadius: '20px 20px 0 0', padding: '22px 20px', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto' as const }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: COLORS.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: 700 }}>
                {selected.business_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{selected.business_name}</p>
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>{selected.city || 'No city set'}</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <div style={{ flex: 1, background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
                <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginBottom: '3px' }}>Bookings</p>
                <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{statsLoading ? '…' : stats?.bookings ?? 0}</p>
              </div>
              <div style={{ flex: 1, background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
                <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginBottom: '3px' }}>Revenue</p>
                <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{statsLoading ? '…' : `₦${(stats?.revenue ?? 0).toLocaleString()}`}</p>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              {selected.phone && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Phone</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>{selected.phone}</span>
                </div>
              )}
              {selected.email && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Email</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>{selected.email}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0' }}>
                <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Joined</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>{new Date(selected.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {actionMsg && (
              <p style={{ fontSize: '11.5px', color: actionMsg.startsWith('Failed') ? COLORS.red : COLORS.green, marginBottom: '10px' }}>{actionMsg}</p>
            )}

            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <button onClick={() => updateStatus('verified')} disabled={acting} style={{ flex: 1, padding: '11px', background: COLORS.green, color: 'white', border: 'none', borderRadius: '9px', fontWeight: 'bold', fontSize: '12.5px', cursor: 'pointer' }}>Approve</button>
              <button onClick={() => updateStatus('rejected')} disabled={acting} style={{ flex: 1, padding: '11px', background: COLORS.red, color: 'white', border: 'none', borderRadius: '9px', fontWeight: 'bold', fontSize: '12.5px', cursor: 'pointer' }}>Reject</button>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {selected.verification_status === 'suspended' ? (
                <button onClick={() => updateStatus('verified')} disabled={acting} style={{ flex: 1, padding: '11px', background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: '9px', fontWeight: 'bold', fontSize: '12.5px', cursor: 'pointer' }}>Restore</button>
              ) : (
                <button onClick={() => updateStatus('suspended')} disabled={acting} style={{ flex: 1, padding: '11px', background: COLORS.bg, color: COLORS.red, border: `1px solid ${COLORS.border}`, borderRadius: '9px', fontWeight: 'bold', fontSize: '12.5px', cursor: 'pointer' }}>Suspend</button>
              )}
            </div>

            <button
              onClick={() => setSelected(null)}
              style={{ width: '100%', padding: '13px', background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
