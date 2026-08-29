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
  purple: '#7c3aed',
  purpleBg: '#F5F3FF',
}

type Company = {
  id: string
  owner_id: string | null
  business_name: string
  business_type: string | null
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  description: string | null
  plan: string | null
  verification_status: string | null
  created_at: string
  bookings_count?: number
  total_revenue?: number
}

type Summary = {
  total_companies: number
  total_new_this_week: number
  pending: number
  pending_new_this_week: number
  verified: number
  verified_this_week: number
  rejected: number
  rejected_this_week: number
  suspended: number
  suspended_this_week: number
}

type ChipFilter = 'all' | 'pending' | 'verified' | 'rejected' | 'suspended'
const PAGE_SIZE_OPTIONS = [10, 25, 50]

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: COLORS.orangeBg, color: COLORS.orange, label: 'Pending' },
  verified: { bg: COLORS.greenBg, color: COLORS.green, label: 'Verified' },
  rejected: { bg: COLORS.redBg, color: COLORS.red, label: 'Rejected' },
  suspended: { bg: COLORS.purpleBg, color: COLORS.purple, label: 'Suspended' },
}

function formatNaira(n: number) {
  return '₦' + n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false)
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isDesktop
}

function StatCard({ label, value, delta, deltaGood, icon, color, bg }: {
  label: string; value: number; delta?: string; deltaGood?: boolean; icon: string; color: string; bg: string
}) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px', flex: '1 1 150px', minWidth: '150px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} color={color} />
        </div>
        <span style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted }}>{label}</span>
      </div>
      <p style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text, lineHeight: 1 }}>{value.toLocaleString()}</p>
      {delta && <p style={{ fontSize: '10.5px', fontWeight: 700, color: deltaGood ? COLORS.green : COLORS.red, marginTop: '5px' }}>{delta}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const s = STATUS_STYLE[status || 'pending'] || STATUS_STYLE.pending
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 9px', borderRadius: '6px', background: s.bg, color: s.color, display: 'inline-block' }}>
      {s.label.toUpperCase()}
    </span>
  )
}

export default function AdminCompanies() {
  const isDesktop = useIsDesktop()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [chip, setChip] = useState<ChipFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [selected, setSelected] = useState<Company | null>(null)
  const [viewingCompany, setViewingCompany] = useState<Company | null>(null)
  const [reasonInput, setReasonInput] = useState('')
  const [showReasonBox, setShowReasonBox] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  const fetchSummary = async () => {
    const { data, error } = await supabase.rpc('admin_companies_summary')
    if (!error && data) setSummary(data as Summary)
  }

  const fetchCompanies = async () => {
    setLoading(true)
    setErrorMsg('')
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase.from('companies').select('*', { count: 'exact' }).order('created_at', { ascending: false })

    if (search.trim()) {
      query = query.or(`business_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`)
    }
    if (chip !== 'all') query = query.eq('verification_status', chip)

    query = query.range(from, to)

    const { data, error, count } = await query
    setLoading(false)
    if (error) {
      setErrorMsg("Couldn't load companies — make sure admin_companies_round1_setup.sql has been run.")
      return
    }
    let rows = (data as Company[]) || []
    if (rows.length > 0) {
      const { data: bookingRows } = await supabase
        .from('bookings')
        .select('company_id, amount_paid')
        .in('company_id', rows.map((c) => c.id))
      const agg: Record<string, { count: number; revenue: number }> = {}
      for (const b of bookingRows || []) {
        if (!b.company_id) continue
        if (!agg[b.company_id]) agg[b.company_id] = { count: 0, revenue: 0 }
        agg[b.company_id].count += 1
        agg[b.company_id].revenue += Number(b.amount_paid) || 0
      }
      rows = rows.map((c) => ({ ...c, bookings_count: agg[c.id]?.count || 0, total_revenue: agg[c.id]?.revenue || 0 }))
    }
    setCompanies(rows)
    setTotalCount(count || 0)
  }

  useEffect(() => { fetchSummary() }, [])
  useEffect(() => { fetchCompanies() }, [chip, page, pageSize, search]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1) }, [chip, search, pageSize])

  const runAction = async (action: 'verify' | 'reject' | 'suspend' | 'restore', reason?: string) => {
    if (!selected) return
    setActionLoading(true)
    setActionError('')
    const { data, error } = await supabase.functions.invoke('admin-manage-companies', {
      body: { action, target_company_id: selected.id, reason: reason || undefined },
    })
    setActionLoading(false)
    if (error || (data && data.error)) {
      setActionError((data && data.error) || error?.message || 'Action failed')
      return
    }
    setSelected(null)
    setShowReasonBox(false)
    setReasonInput('')
    fetchCompanies()
    fetchSummary()
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const chips: { key: ChipFilter; label: string; count: number | undefined; dotColor?: string }[] = [
    { key: 'all', label: 'All', count: summary?.total_companies },
    { key: 'pending', label: 'Pending', count: summary?.pending, dotColor: COLORS.orange },
    { key: 'verified', label: 'Verified', count: summary?.verified, dotColor: COLORS.green },
    { key: 'rejected', label: 'Rejected', count: summary?.rejected, dotColor: COLORS.red },
    { key: 'suspended', label: 'Suspended', count: summary?.suspended, dotColor: COLORS.purple },
  ]

  return (
    <div style={{ padding: isDesktop ? '24px 28px' : '16px', maxWidth: '1400px', margin: '0 auto', overflowY: 'auto' as const, height: '100%' }}>
      {viewingCompany ? (
        <CompanyDetailsView
          company={viewingCompany}
          isDesktop={isDesktop}
          onBack={() => setViewingCompany(null)}
          onAction={(c) => setSelected(c)}
        />
      ) : (
      <>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
        <div>
          <h2 style={{ fontSize: isDesktop ? '20px' : '17px', fontWeight: 800, color: COLORS.text }}>Companies &amp; Partners</h2>
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>Manage and verify all registered companies and partners on the platform.</p>
        </div>
        <div style={{ display: 'flex', gap: '9px' }}>
          <button onClick={() => alert('Export is coming soon.')}
            style={{ padding: '9px 14px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, color: COLORS.text, cursor: 'pointer' }}>
            Export
          </button>
          <button onClick={() => alert('Add Company is coming soon.')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: COLORS.primary, border: 'none', borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, color: 'white', cursor: 'pointer' }}>
            <Icon name="plus" size={14} color="white" />
            Add Company
          </button>
        </div>
      </div>

      <div style={{ marginTop: '18px', display: 'flex', flexWrap: 'wrap' as const, gap: '10px', marginBottom: '16px' }}>
        <StatCard label="Total Companies" value={summary?.total_companies ?? 0}
          delta={summary ? `↑ ${summary.total_new_this_week} this week` : undefined} deltaGood icon="briefcase" color={COLORS.purple} bg={COLORS.purpleBg} />
        <StatCard label="Pending Verification" value={summary?.pending ?? 0}
          delta={summary ? `↑ ${summary.pending_new_this_week} this week` : undefined} deltaGood icon="hourglass" color={COLORS.orange} bg={COLORS.orangeBg} />
        <StatCard label="Verified Companies" value={summary?.verified ?? 0}
          delta={summary ? `↑ ${summary.verified_this_week} this week` : undefined} deltaGood icon="check" color={COLORS.green} bg={COLORS.greenBg} />
        <StatCard label="Rejected" value={summary?.rejected ?? 0}
          delta={summary ? `${summary.rejected_this_week} this week` : undefined} deltaGood={false} icon="x" color={COLORS.red} bg={COLORS.redBg} />
        <StatCard label="Suspended" value={summary?.suspended ?? 0}
          delta={summary ? `${summary.suspended_this_week} this week` : undefined} deltaGood={false} icon="x" color={COLORS.purple} bg={COLORS.purpleBg} />
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '10px 13px', marginBottom: '12px' }}>
        <Icon name="search" size={15} color={COLORS.textMuted} />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
          placeholder="Search company name, email, phone..."
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', background: 'transparent', color: COLORS.text }}
        />
        {searchInput && <span onClick={() => setSearch(searchInput)} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Search</span>}
      </div>

      {/* Chips */}
      <div style={{ display: 'flex', gap: '7px', marginBottom: '16px', overflowX: 'auto' as const, paddingBottom: '2px' }}>
        {chips.map((c) => (
          <span key={c.key} onClick={() => setChip(c.key)}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 13px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
              background: chip === c.key ? COLORS.primary : COLORS.card,
              color: chip === c.key ? 'white' : COLORS.text,
              border: `1px solid ${chip === c.key ? COLORS.primary : COLORS.border}`,
            }}>
            {c.dotColor && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: chip === c.key ? 'white' : c.dotColor }} />}
            {c.label}
            {c.count !== undefined && <span style={{ opacity: 0.85 }}>{c.count.toLocaleString()}</span>}
          </span>
        ))}
      </div>

      {/* Table / List */}
      {errorMsg ? (
        <div style={{ padding: '30px 20px', textAlign: 'center' as const, background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}` }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.red, marginBottom: '6px' }}>Couldn't load companies</p>
          <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.6 }}>{errorMsg}</p>
        </div>
      ) : loading ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>Loading companies...</p>
      ) : companies.length === 0 ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>No companies found.</p>
      ) : isDesktop ? (
        <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}`, overflowX: 'auto' as const }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, minWidth: '760px' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                {['Company', 'Business Type', 'Location', 'Status', 'Registered', 'Actions'].map((h) => (
                  <th key={h} style={{ textAlign: 'left' as const, padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase' as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: COLORS.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
                        {c.business_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{c.business_name}</p>
                        <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{c.email || c.phone || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: COLORS.text }}>{c.business_type || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: COLORS.text }}>{c.city || 'No city set'}</td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={c.verification_status} /></td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: COLORS.text }}>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => setSelected(c)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '7px', fontSize: '11.5px', fontWeight: 700, color: COLORS.text, cursor: 'pointer' }}>
                      <Icon name="eye" size={13} color={COLORS.text} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}` }}>
          {companies.map((c, idx) => (
            <div key={c.id} onClick={() => setViewingCompany(c)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '13px 15px', cursor: 'pointer', borderBottom: idx === companies.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: COLORS.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>
                {c.business_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{c.business_name}</p>
                  {c.verification_status === 'verified' && <Icon name="check" size={13} color={COLORS.green} />}
                </div>
                <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '1px' }}>{c.business_type || 'No type set'} · {c.city || 'No city set'}</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                  <span style={{ fontSize: '11px', color: COLORS.textMuted }}>{(c.bookings_count ?? 0).toLocaleString()} Bookings</span>
                  <span style={{ fontSize: '11px', color: COLORS.textMuted }}>{formatNaira(c.total_revenue ?? 0)} Revenue</span>
                </div>
                <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '3px' }}>Joined {new Date(c.created_at).toLocaleDateString()}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: '6px' }}>
                <StatusBadge status={c.verification_status} />
                <Icon name="arrowUpRight" size={13} color={COLORS.textMuted} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!errorMsg && !loading && companies.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ padding: '7px 9px', borderRadius: '7px', border: `1px solid ${COLORS.border}`, fontSize: '12px', color: COLORS.text, background: COLORS.card }}>
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} per page</option>)}
            </select>
            <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount.toLocaleString()} companies
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: '6px 11px', borderRadius: '7px', border: `1px solid ${COLORS.border}`, background: COLORS.card, fontSize: '12px', fontWeight: 700, color: page === 1 ? COLORS.textMuted : COLORS.text, cursor: page === 1 ? 'default' : 'pointer' }}>‹</button>
            <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, padding: '0 6px' }}>{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: '6px 11px', borderRadius: '7px', border: `1px solid ${COLORS.border}`, background: COLORS.card, fontSize: '12px', fontWeight: 700, color: page === totalPages ? COLORS.textMuted : COLORS.text, cursor: page === totalPages ? 'default' : 'pointer' }}>›</button>
          </div>
        </div>
      )}
      </>
      )}

      {/* Detail sheet */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center', zIndex: 100, padding: isDesktop ? '20px' : 0 }}>
          <div style={{ background: COLORS.card, borderRadius: isDesktop ? '16px' : '20px 20px 0 0', padding: '22px 20px', width: '100%', maxWidth: '460px', maxHeight: '88vh', overflowY: 'auto' as const }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: COLORS.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: 700 }}>
                {selected.business_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{selected.business_name}</p>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                  <StatusBadge status={selected.verification_status} />
                  {selected.business_type && <span style={{ fontSize: '11px', color: COLORS.textMuted }}>{selected.business_type}</span>}
                </div>
              </div>
              <span onClick={() => { setSelected(null); setShowReasonBox(false); setActionError('') }} style={{ cursor: 'pointer' }}>
                <Icon name="x" size={18} color={COLORS.textMuted} />
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              {selected.email && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Email</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>{selected.email}</span>
                </div>
              )}
              {selected.phone && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Phone</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>{selected.phone}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Location</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>{selected.city || 'No city set'}</span>
              </div>
              {selected.address && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Address</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text, textAlign: 'right' as const, maxWidth: '65%' }}>{selected.address}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: selected.description ? `1px solid ${COLORS.border}` : 'none' }}>
                <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Registered</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>{new Date(selected.created_at).toLocaleDateString()}</span>
              </div>
              {selected.description && (
                <div style={{ padding: '9px 0' }}>
                  <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Description</span>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text, marginTop: '3px', lineHeight: 1.5 }}>{selected.description}</p>
                </div>
              )}
            </div>

            {actionError && (
              <div style={{ background: COLORS.redBg, borderRadius: '8px', padding: '9px 11px', marginBottom: '12px' }}>
                <p style={{ fontSize: '11.5px', color: COLORS.red, fontWeight: 600 }}>{actionError}</p>
              </div>
            )}

            {selected.verification_status === 'pending' && !showReasonBox && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <button onClick={() => runAction('verify')} disabled={actionLoading}
                  style={{ flex: 1, padding: '12px', background: COLORS.green, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', opacity: actionLoading ? 0.7 : 1 }}>
                  {actionLoading ? 'Working...' : 'Verify'}
                </button>
                <button onClick={() => runAction('reject')} disabled={actionLoading}
                  style={{ flex: 1, padding: '12px', background: COLORS.red, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', opacity: actionLoading ? 0.7 : 1 }}>
                  {actionLoading ? 'Working...' : 'Reject'}
                </button>
              </div>
            )}

            {selected.verification_status === 'suspended' && (
              <button onClick={() => runAction('restore')} disabled={actionLoading}
                style={{ width: '100%', padding: '13px', background: COLORS.green, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer', marginBottom: '10px', opacity: actionLoading ? 0.7 : 1 }}>
                {actionLoading ? 'Restoring...' : 'Restore Company'}
              </button>
            )}

            {selected.verification_status === 'verified' && !showReasonBox && (
              <button onClick={() => setShowReasonBox(true)}
                style={{ width: '100%', padding: '13px', background: COLORS.redBg, color: COLORS.red, border: `1px solid ${COLORS.red}`, borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer', marginBottom: '10px' }}>
                Suspend Company
              </button>
            )}

            {showReasonBox && (
              <div style={{ marginBottom: '10px' }}>
                <textarea
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Reason for suspension (optional)"
                  rows={3}
                  style={{ width: '100%', padding: '10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', resize: 'none' as const, marginBottom: '9px', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', gap: '9px' }}>
                  <button onClick={() => runAction('suspend', reasonInput)} disabled={actionLoading}
                    style={{ flex: 1, padding: '12px', background: COLORS.red, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', opacity: actionLoading ? 0.7 : 1 }}>
                    {actionLoading ? 'Suspending...' : 'Confirm Suspend'}
                  </button>
                  <button onClick={() => { setShowReasonBox(false); setReasonInput('') }}
                    style={{ padding: '12px 16px', background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {selected.verification_status === 'rejected' && !showReasonBox && (
              <button onClick={() => runAction('verify')} disabled={actionLoading}
                style={{ width: '100%', padding: '13px', background: COLORS.green, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer', marginBottom: '10px', opacity: actionLoading ? 0.7 : 1 }}>
                {actionLoading ? 'Working...' : 'Verify Instead'}
              </button>
            )}

            {!showReasonBox && (
              <button onClick={() => { setSelected(null); setActionError('') }}
                style={{ width: '100%', padding: '13px', background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer' }}>
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============ Company Details drill-down (Round 2) ============
const PERIODS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'month', label: 'This Month' },
]

function periodStartDate(key: string): Date | null {
  const now = new Date()
  if (key === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (key === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  if (key === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  if (key === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
  return null
}

function CompanyDetailsView({
  company, isDesktop, onBack, onAction,
}: {
  company: Company
  isDesktop: boolean
  onBack: () => void
  onAction: (c: Company) => void
}) {
  const [period, setPeriod] = useState('all')
  const [bookings, setBookings] = useState<{ id: string; amount_paid: number | null; booking_status: string | null; created_at: string }[]>([])
  const [refundsCount, setRefundsCount] = useState(0)
  const [activity, setActivity] = useState<{ id: string; action: string; module: string; created_at: string; actor_name?: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data: bookingRows } = await supabase
        .from('bookings')
        .select('id, amount_paid, booking_status, created_at')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })

      const { data: refundRows } = await supabase
        .from('refund_requests')
        .select('id, bookings!inner(company_id)')
        .eq('bookings.company_id', company.id)

      const { data: logRows } = await supabase
        .from('audit_logs')
        .select('id, action, module, created_at, actor_id')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(6)

      let logsWithNames = logRows || []
      const actorIds = [...new Set(logsWithNames.map((l) => l.actor_id).filter(Boolean))]
      if (actorIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', actorIds)
        const nameMap: Record<string, string> = {}
        for (const p of profs || []) nameMap[p.id] = p.full_name || ''
        logsWithNames = logsWithNames.map((l) => ({ ...l, actor_name: nameMap[l.actor_id] }))
      }

      if (!cancelled) {
        setBookings(bookingRows || [])
        setRefundsCount((refundRows || []).length)
        setActivity(logsWithNames)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [company.id])

  const start = periodStartDate(period)
  const filteredBookings = start ? bookings.filter((b) => new Date(b.created_at) >= start) : bookings
  const totalBookings = filteredBookings.length
  const totalRevenue = filteredBookings.reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0)
  const pendingBookings = filteredBookings.filter((b) => b.booking_status === 'pending').length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={19} color={COLORS.text} />
        </span>
        <h2 style={{ fontSize: isDesktop ? '19px' : '16px', fontWeight: 800, color: COLORS.text }}>Company Details</h2>
      </div>

      {/* Company header card */}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '16px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '13px', background: COLORS.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, flexShrink: 0 }}>
            {company.business_name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{company.business_name}</p>
              {company.verification_status === 'verified' && <Icon name="check" size={14} color={COLORS.green} />}
            </div>
            <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>{company.business_type || 'No type set'} · {company.city || 'No city set'}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <StatusBadge status={company.verification_status} />
              <span style={{ fontSize: '11px', color: COLORS.textMuted }}>Joined {new Date(company.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          <button onClick={() => onAction(company)}
            style={{ flex: 1, padding: '10px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>
            {company.verification_status === 'pending' ? 'Verify' : company.verification_status === 'suspended' ? 'Restore' : 'Manage'}
          </button>
          <button onClick={() => onAction(company)}
            style={{ flex: 1, padding: '10px', background: COLORS.card, color: COLORS.red, border: `1px solid ${COLORS.border}`, borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>
            {company.verification_status === 'suspended' ? 'Suspended' : 'Suspend'}
          </button>
          <button onClick={() => alert('Editing company info is coming soon.')}
            style={{ flex: 1, padding: '10px', background: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>
            Edit
          </button>
        </div>
      </div>

      {/* Overview */}
      <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, marginBottom: '8px' }}>Performance Overview</p>
      <div style={{ display: 'flex', gap: '7px', overflowX: 'auto' as const, marginBottom: '10px', paddingBottom: '2px' }}>
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            style={{ whiteSpace: 'nowrap' as const, padding: '6px 12px', borderRadius: '999px', border: `1px solid ${period === p.key ? COLORS.primary : COLORS.border}`, background: period === p.key ? COLORS.primary : COLORS.card, color: period === p.key ? 'white' : COLORS.textMuted, fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}>
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '12px' }}>
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, fontWeight: 700 }}>TOTAL BOOKINGS</p>
          <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text, marginTop: '3px' }}>{totalBookings.toLocaleString()}</p>
        </div>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '12px' }}>
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, fontWeight: 700 }}>REVENUE</p>
          <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text, marginTop: '3px' }}>{formatNaira(totalRevenue)}</p>
        </div>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '12px' }}>
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, fontWeight: 700 }}>PENDING BOOKINGS</p>
          <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text, marginTop: '3px' }}>{pendingBookings.toLocaleString()}</p>
        </div>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '12px' }}>
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, fontWeight: 700 }}>REFUNDS</p>
          <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text, marginTop: '3px' }}>{refundsCount.toLocaleString()}</p>
        </div>
      </div>

      {/* Company Information */}
      <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, marginBottom: '8px' }}>Company Information</p>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '4px 14px', marginBottom: '16px' }}>
        {[
          ['Company Type', company.business_type || 'Not set'],
          ['Business Email', company.email || 'Not set'],
          ['Phone Number', company.phone || 'Not set'],
          ['City', company.city || 'Not set'],
          ['Address', company.address || 'Not set'],
        ].map(([label, value], i) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i === 4 ? 'none' : `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: '12px', color: COLORS.textMuted }}>{label}</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text, textAlign: 'right' as const, maxWidth: '60%' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, marginBottom: '8px' }}>Recent Activity</p>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '4px 14px', marginBottom: '20px' }}>
        {loading && <p style={{ fontSize: '12px', color: COLORS.textMuted, padding: '14px 0', textAlign: 'center' as const }}>Loading…</p>}
        {!loading && activity.length === 0 && (
          <p style={{ fontSize: '12px', color: COLORS.textMuted, padding: '14px 0', textAlign: 'center' as const }}>No activity logged yet.</p>
        )}
        {activity.map((a, i) => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i === activity.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
            <div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>{a.action.replace(/_/g, ' ')}</p>
              <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '1px' }}>{a.actor_name || 'Someone'} · {new Date(a.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
