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
  blue: '#0EA5E9',
  blueBg: '#EFF6FF',
  purple: '#7c3aed',
  purpleBg: '#F5F3FF',
  orange: '#F97316',
  orangeBg: '#FFF7ED',
}

type PeriodTotals = { gross_booking_value: number; platform_commission: number; refunded_amount: number; total_bookings: number }
type DailyPoint = { day: string; gross_booking_value: number; platform_commission: number; refunded_amount: number; total_bookings: number }
type StatusCount = { status: string | null; count: number }
type Overview = { current: PeriodTotals; previous: PeriodTotals; daily: DailyPoint[]; status_breakdown: StatusCount[] }

type Booking = {
  id: string
  ticket_code: string | null
  customer_name: string | null
  amount_paid: number
  commission_amount: number | null
  booking_status: string | null
  category: string | null
  created_at: string
  business_name: string | null
}

const PAGE_SIZE_OPTIONS = [10, 25, 50]
const CATEGORY_ICON: Record<string, string> = {
  hotel: 'bed', bus: 'bus', train: 'train', flight: 'plane', tour: 'map', event_center: 'tent',
}
const CATEGORY_LABEL: Record<string, string> = {
  hotel: 'Hotel Booking', bus: 'Bus Booking', train: 'Train Booking', flight: 'Flight Booking', tour: 'Tour Booking', event_center: 'Event Booking',
}
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  completed: { bg: COLORS.greenBg, color: COLORS.green },
  cancelled: { bg: COLORS.redBg, color: COLORS.red },
  pending: { bg: COLORS.orangeBg, color: COLORS.orange },
}

function fmtDate(d: Date) { return d.toISOString().slice(0, 10) }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d }

function pctChange(cur: number, prev: number): { text: string; good: boolean } | null {
  if (prev === 0) return cur === 0 ? null : { text: 'New this period', good: true }
  const pct = ((cur - prev) / prev) * 100
  return { text: `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}% from last period`, good: pct >= 0 }
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div style={{ width: '90px', height: '44px' }} />
  const w = 90, h = 44
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 6) - 3
    return [x, y]
  })
  const line = pts.map((p) => p.join(',')).join(' ')
  const area = `0,${h} ${line} ${w},${h}`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', flexShrink: 0 }}>
      <polygon points={area} fill={color} opacity={0.08} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 2.5 : 0} fill={color} />
      ))}
    </svg>
  )
}

function MetricCard({ icon, label, value, color, bg, delta, sparkValues }: {
  icon: string; label: string; value: string; color: string; bg: string
  delta: { text: string; good: boolean } | null; sparkValues: number[]
}) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '16px', border: `1px solid ${COLORS.border}`, padding: '18px', flex: '1 1 260px', minWidth: '260px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '11px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name={icon} size={17} color={color} />
          </div>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.textMuted }}>{label}</span>
        </div>
        <p style={{ fontSize: '23px', fontWeight: 800, color: COLORS.text, marginBottom: '6px', whiteSpace: 'nowrap' as const }}>{value}</p>
        {delta && <p style={{ fontSize: '11.5px', fontWeight: 700, color: delta.good ? COLORS.green : COLORS.red }}>{delta.text}</p>}
      </div>
      <Sparkline values={sparkValues} color={color} />
    </div>
  )
}

function InsightCard({ icon, label, value, color, bg }: { icon: string; label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 150px', minWidth: '150px' }}>
      <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={15} color={color} />
      </div>
      <div>
        <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '2px' }}>{label}</p>
        <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{value}</p>
      </div>
    </div>
  )
}

export default function AdminFinance() {
  const [startDate, setStartDate] = useState(fmtDate(daysAgo(6)))
  const [endDate, setEndDate] = useState(fmtDate(new Date()))

  const [overview, setOverview] = useState<Overview | null>(null)
  const [overviewError, setOverviewError] = useState('')
  const [loadingOverview, setLoadingOverview] = useState(true)

  const [bookings, setBookings] = useState<Booking[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loadingTxns, setLoadingTxns] = useState(true)
  const [txnError, setTxnError] = useState('')
  const [txnForbidden, setTxnForbidden] = useState(false)
  const [category, setCategory] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const fetchOverview = async () => {
    setLoadingOverview(true)
    setOverviewError('')
    const { data, error } = await supabase.rpc('admin_finance_overview', { p_start: startDate, p_end: endDate })
    setLoadingOverview(false)
    if (error) {
      setOverviewError("Couldn't load financial totals — run admin_finance_overview_setup.sql in Supabase first.")
      return
    }
    setOverview(data as Overview)
  }

  const fetchBookings = async () => {
    setLoadingTxns(true)
    setTxnError('')
    setTxnForbidden(false)
    const { data, error } = await supabase.rpc('admin_finance_transactions', {
      p_start: startDate, p_end: endDate, p_category: category, p_search: search || null, p_page: page, p_page_size: pageSize,
    })
    setLoadingTxns(false)
    if (error) {
      if (error.message?.toLowerCase().includes('not authorized')) setTxnForbidden(true)
      else setTxnError("Couldn't load transactions — run admin_finance_transactions_setup.sql in Supabase first.")
      return
    }
    const result = data as { rows: Booking[]; total_count: number }
    setBookings(result?.rows || [])
    setTotalCount(result?.total_count || 0)
  }

  useEffect(() => { fetchOverview() }, [startDate, endDate]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchBookings() }, [startDate, endDate, category, search, page, pageSize]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1) }, [startDate, endDate, category, search, pageSize])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const daily = overview?.daily || []
  const cur = overview?.current
  const prev = overview?.previous

  const grossSeries = daily.map((d) => Number(d.gross_booking_value))
  const commissionSeries = daily.map((d) => Number(d.platform_commission))
  const refundedSeries = daily.map((d) => Number(d.refunded_amount))
  const bookingsSeries = daily.map((d) => Number(d.total_bookings))

  const insightsAvg = cur && cur.total_bookings > 0 ? cur.gross_booking_value / cur.total_bookings : null
  const insightsCommissionRate = cur && cur.gross_booking_value > 0 ? (cur.platform_commission / cur.gross_booking_value) * 100 : null
  const insightsRefundRate = cur && cur.gross_booking_value > 0 ? (cur.refunded_amount / cur.gross_booking_value) * 100 : null
  const topStatus = overview?.status_breakdown?.find((s) => s.status && s.status.toLowerCase() !== 'cancelled') || null

  const dateLabel = startDate === endDate
    ? new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : `${new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`

  return (
    <div style={{ padding: '18px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Section header */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '18px' }}>
        <div>
          <h2 style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text }}>Platform Finance Overview</h2>
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '3px' }}>Real-time financial summary of the platform</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '9px 13px', cursor: 'pointer' }}>
          <Icon name="hourglass" size={13} color={COLORS.textMuted} />
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: COLORS.text }}>{dateLabel}</span>
          <input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: 0, height: 0, opacity: 0, position: 'absolute' as const }} />
          <input type="date" value={endDate} min={startDate} max={fmtDate(new Date())} onChange={(e) => setEndDate(e.target.value)} style={{ width: 0, height: 0, opacity: 0, position: 'absolute' as const }} />
        </label>
      </div>

      {/* Two visible date inputs (kept simple/real — the label above is just a compact summary) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' as const }}>
        <input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12px', color: COLORS.text }} />
        <input type="date" value={endDate} min={startDate} max={fmtDate(new Date())} onChange={(e) => setEndDate(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12px', color: COLORS.text }} />
      </div>

      {/* Metric cards — 2x2 with inline sparkline */}
      {overviewError ? (
        <div style={{ background: COLORS.redBg, border: '1px solid #FCA5A5', borderRadius: '14px', padding: '14px', marginBottom: '20px' }}>
          <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.red, marginBottom: '4px' }}>Couldn't load financial totals</p>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, lineHeight: 1.6 }}>{overviewError}</p>
        </div>
      ) : loadingOverview ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '20px 0' }}>Loading financial summary...</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '14px', marginBottom: '20px' }}>
          <MetricCard icon="briefcase" label="Gross Booking Value" value={`₦${Number(cur?.gross_booking_value ?? 0).toLocaleString()}`}
            color={COLORS.blue} bg={COLORS.blueBg} delta={cur && prev ? pctChange(cur.gross_booking_value, prev.gross_booking_value) : null} sparkValues={grossSeries} />
          <MetricCard icon="trendingUp" label="Platform Commission" value={`₦${Number(cur?.platform_commission ?? 0).toLocaleString()}`}
            color={COLORS.green} bg={COLORS.greenBg} delta={cur && prev ? pctChange(cur.platform_commission, prev.platform_commission) : null} sparkValues={commissionSeries} />
          <MetricCard icon="refresh" label="Refunded (Cancelled)" value={`₦${Number(cur?.refunded_amount ?? 0).toLocaleString()}`}
            color={COLORS.red} bg={COLORS.redBg} delta={cur && prev ? pctChange(cur.refunded_amount, prev.refunded_amount) : null} sparkValues={refundedSeries} />
          <MetricCard icon="ticket" label="Total Bookings" value={(cur?.total_bookings ?? 0).toLocaleString()}
            color={COLORS.purple} bg={COLORS.purpleBg} delta={cur && prev ? pctChange(cur.total_bookings, prev.total_bookings) : null} sparkValues={bookingsSeries} />
        </div>
      )}

      {/* Withdrawals & Escrow notice */}
      <div style={{ background: COLORS.orangeBg, border: '1px solid #FED7AA', borderRadius: '14px', padding: '16px', marginBottom: '22px', display: 'flex', flexWrap: 'wrap' as const, gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '11px', alignItems: 'flex-start', flex: '1 1 300px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#FDBA74', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="wrench" size={14} color="#7C2D12" />
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#7C2D12', marginBottom: '4px' }}>Withdrawals &amp; Escrow — pending setup</p>
            <p style={{ fontSize: '12px', color: '#9A3412', lineHeight: 1.6 }}>
              Company Earnings, Escrow Balance (Pending/Released/Held/Disputed), and Withdrawals aren't tracked as separate ledgers in the database yet — these need their own tables before we can show real numbers here rather than guesses.
            </p>
          </div>
        </div>
        <button onClick={() => alert('Setup guide coming soon — this needs new escrow/withdrawal ledger tables first.')}
          style={{ padding: '10px 16px', background: 'white', border: '1px solid #FDBA74', borderRadius: '9px', fontSize: '12px', fontWeight: 700, color: '#9A3412', cursor: 'pointer', flexShrink: 0 }}>
          View Setup Guide
        </button>
      </div>

      {/* Recent Transactions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Recent Transactions</h3>
        {!txnForbidden && (
          <span onClick={() => setPageSize(50)} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>
            View All <Icon name="arrowUpRight" size={12} color={COLORS.primary} />
          </span>
        )}
      </div>

      {txnForbidden ? (
        <p style={{ fontSize: '12px', color: COLORS.textMuted, padding: '10px 0 20px' }}>You don't have permission to view transaction details.</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px', marginBottom: '12px' }}>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              style={{ padding: '8px 11px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12px', color: COLORS.text, background: COLORS.card }}>
              <option value="all">All Transactions</option>
              {Object.keys(CATEGORY_LABEL).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 220px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '8px', padding: '8px 12px' }}>
              <Icon name="search" size={13} color={COLORS.textMuted} />
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
                placeholder="Search transactions..."
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: COLORS.text }} />
              {searchInput && <span onClick={() => setSearch(searchInput)} style={{ fontSize: '11px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Go</span>}
            </div>
          </div>

          {txnError ? (
            <p style={{ fontSize: '12px', color: COLORS.red, textAlign: 'center' as const, padding: '20px 0' }}>{txnError}</p>
          ) : loadingTxns ? (
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>Loading...</p>
          ) : bookings.length === 0 ? (
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>No transactions found.</p>
          ) : (
            <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}`, overflowX: 'auto' as const }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const, minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    {['Type', 'Description', 'Amount', 'Status', 'Date', ''].map((h) => (
                      <th key={h} style={{ textAlign: 'left' as const, padding: '11px 14px', fontSize: '10.5px', fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase' as const }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((t, idx) => {
                    const icon = (t.category && CATEGORY_ICON[t.category]) || 'ticket'
                    const label = (t.category && CATEGORY_LABEL[t.category]) || 'Booking Payment'
                    const statusKey = (t.booking_status || '').toLowerCase()
                    const statusStyle = STATUS_STYLE[statusKey] || { bg: COLORS.bg, color: COLORS.textMuted }
                    return (
                      <tr key={t.id} style={{ borderBottom: idx === bookings.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Icon name={icon} size={14} color={COLORS.text} />
                            </div>
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap' as const }}>{label}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <p style={{ fontSize: '12.5px', color: COLORS.text }}>{t.business_name || t.ticket_code || 'Booking'}</p>
                          <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '1px' }}>by {t.customer_name || 'Unknown customer'}</p>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 800, color: COLORS.text, whiteSpace: 'nowrap' as const }}>
                          ₦{Number(t.amount_paid || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: statusStyle.bg, color: statusStyle.color, textTransform: 'capitalize' as const, display: 'inline-block' }}>
                            {t.booking_status || 'Unknown'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '11.5px', color: COLORS.text, whiteSpace: 'nowrap' as const }}>
                          {new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          <br />
                          <span style={{ color: COLORS.textMuted }}>{new Date(t.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td style={{ padding: '12px 14px', color: COLORS.textMuted, fontSize: '16px' }}>⋮</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer: page size + count + numbered pagination */}
          {!txnError && !loadingTxns && bookings.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
                  style={{ padding: '7px 9px', borderRadius: '7px', border: `1px solid ${COLORS.border}`, fontSize: '12px', color: COLORS.text, background: COLORS.card }}>
                  {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} per page</option>)}
                </select>
                <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount.toLocaleString()} transactions
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ width: '30px', height: '30px', borderRadius: '7px', border: `1px solid ${COLORS.border}`, background: COLORS.card, fontSize: '13px', fontWeight: 700, color: page === 1 ? COLORS.textMuted : COLORS.text, cursor: page === 1 ? 'default' : 'pointer' }}>‹</button>
                {getPageNumbers(page, totalPages).map((p, i) =>
                  p === '...' ? (
                    <span key={`e${i}`} style={{ padding: '0 4px', fontSize: '12px', color: COLORS.textMuted }}>...</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p)}
                      style={{
                        width: '30px', height: '30px', borderRadius: '7px', border: `1px solid ${p === page ? COLORS.primary : COLORS.border}`,
                        background: p === page ? COLORS.primary : COLORS.card, fontSize: '12px', fontWeight: 700,
                        color: p === page ? 'white' : COLORS.text, cursor: 'pointer',
                      }}>{p}</button>
                  )
                )}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  style={{ width: '30px', height: '30px', borderRadius: '7px', border: `1px solid ${COLORS.border}`, background: COLORS.card, fontSize: '13px', fontWeight: 700, color: page === totalPages ? COLORS.textMuted : COLORS.text, cursor: page === totalPages ? 'default' : 'pointer' }}>›</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick Insights — below transactions, matching the mockup order */}
      {overview && !overviewError && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '18px', marginTop: '22px' }}>
          <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, marginBottom: '16px' }}>Quick Insights (Selected Period)</p>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '20px' }}>
            <InsightCard icon="trendingUp" label="Avg. Booking Value" value={insightsAvg !== null ? `₦${insightsAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'} color={COLORS.blue} bg={COLORS.blueBg} />
            <InsightCard icon="briefcase" label="Commission Rate" value={insightsCommissionRate !== null ? `${insightsCommissionRate.toFixed(2)}%` : '—'} color={COLORS.green} bg={COLORS.greenBg} />
            <InsightCard icon="ticket" label={topStatus?.status ? `${topStatus.status.charAt(0).toUpperCase()}${topStatus.status.slice(1)} Bookings` : 'Bookings'} value={topStatus ? topStatus.count.toLocaleString() : '—'} color={COLORS.purple} bg={COLORS.purpleBg} />
            <InsightCard icon="refresh" label="Refund Rate" value={insightsRefundRate !== null ? `${insightsRefundRate.toFixed(2)}%` : '—'} color={COLORS.red} bg={COLORS.redBg} />
          </div>
        </div>
      )}
    </div>
  )
}
