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

function fmtDate(d: Date) { return d.toISOString().slice(0, 10) }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d }

function pctChange(cur: number, prev: number): { text: string; good: boolean } | null {
  if (prev === 0) return cur === 0 ? null : { text: 'new this period', good: true }
  const pct = ((cur - prev) / prev) * 100
  return { text: `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}% vs previous period`, good: pct >= 0 }
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const w = 100, h = 32
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MetricCard({ icon, label, value, color, bg, delta }: {
  icon: string; label: string; value: string; color: string; bg: string; delta: { text: string; good: boolean } | null
}) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}`, padding: '16px', flex: '1 1 220px', minWidth: '220px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} color={color} />
        </div>
        <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted }}>{label}</span>
      </div>
      <p style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text, marginBottom: '5px' }}>{value}</p>
      {delta && <p style={{ fontSize: '11px', fontWeight: 700, color: delta.good ? COLORS.green : COLORS.red }}>{delta.text}</p>}
    </div>
  )
}

function InsightCard({ icon, label, value, color, bg }: { icon: string; label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 150px', minWidth: '150px' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={14} color={color} />
      </div>
      <div>
        <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>{label}</p>
        <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{value}</p>
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
      p_start: startDate,
      p_end: endDate,
      p_category: category,
      p_search: search || null,
      p_page: page,
      p_page_size: pageSize,
    })
    setLoadingTxns(false)
    if (error) {
      if (error.message?.toLowerCase().includes('not authorized')) {
        setTxnForbidden(true)
      } else {
        setTxnError("Couldn't load transactions — run admin_finance_transactions_setup.sql in Supabase first.")
      }
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

  return (
    <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Platform Finance Overview</h2>
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>Real financial summary of the platform</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '7px 10px' }}>
          <Icon name="hourglass" size={13} color={COLORS.textMuted} />
          <input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: '12px', color: COLORS.text, background: 'transparent' }} />
          <span style={{ fontSize: '12px', color: COLORS.textMuted }}>–</span>
          <input type="date" value={endDate} min={startDate} max={fmtDate(new Date())} onChange={(e) => setEndDate(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: '12px', color: COLORS.text, background: 'transparent' }} />
        </div>
      </div>

      {overviewError ? (
        <div style={{ background: COLORS.redBg, border: '1px solid #FCA5A5', borderRadius: '14px', padding: '14px', marginBottom: '20px' }}>
          <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.red, marginBottom: '4px' }}>Couldn't load financial totals</p>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, lineHeight: 1.6 }}>{overviewError}</p>
        </div>
      ) : loadingOverview ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '20px 0' }}>Loading financial summary...</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px', marginBottom: '10px' }}>
          <div style={{ flex: '1 1 220px', minWidth: '220px' }}>
            <MetricCard icon="briefcase" label="Gross Booking Value" value={`₦${Number(cur?.gross_booking_value ?? 0).toLocaleString()}`}
              color={COLORS.blue} bg={COLORS.blueBg} delta={cur && prev ? pctChange(cur.gross_booking_value, prev.gross_booking_value) : null} />
            <div style={{ marginTop: '-14px', padding: '0 16px 12px' }}><Sparkline values={grossSeries} color={COLORS.blue} /></div>
          </div>
          <div style={{ flex: '1 1 220px', minWidth: '220px' }}>
            <MetricCard icon="trendingUp" label="Platform Commission" value={`₦${Number(cur?.platform_commission ?? 0).toLocaleString()}`}
              color={COLORS.green} bg={COLORS.greenBg} delta={cur && prev ? pctChange(cur.platform_commission, prev.platform_commission) : null} />
            <div style={{ marginTop: '-14px', padding: '0 16px 12px' }}><Sparkline values={commissionSeries} color={COLORS.green} /></div>
          </div>
          <div style={{ flex: '1 1 220px', minWidth: '220px' }}>
            <MetricCard icon="refresh" label="Refunded (Cancelled)" value={`₦${Number(cur?.refunded_amount ?? 0).toLocaleString()}`}
              color={COLORS.red} bg={COLORS.redBg} delta={cur && prev ? pctChange(cur.refunded_amount, prev.refunded_amount) : null} />
            <div style={{ marginTop: '-14px', padding: '0 16px 12px' }}><Sparkline values={refundedSeries} color={COLORS.red} /></div>
          </div>
          <div style={{ flex: '1 1 220px', minWidth: '220px' }}>
            <MetricCard icon="ticket" label="Total Bookings" value={(cur?.total_bookings ?? 0).toLocaleString()}
              color={COLORS.purple} bg={COLORS.purpleBg} delta={cur && prev ? pctChange(cur.total_bookings, prev.total_bookings) : null} />
            <div style={{ marginTop: '-14px', padding: '0 16px 12px' }}><Sparkline values={bookingsSeries} color={COLORS.purple} /></div>
          </div>
        </div>
      )}

      {/* Withdrawals & Escrow notice — honest, unchanged */}
      <div style={{ background: COLORS.orangeBg, border: '1px solid #FED7AA', borderRadius: '14px', padding: '14px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <Icon name="wrench" size={15} color="#9A3412" />
        <div>
          <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#9A3412', marginBottom: '4px' }}>Withdrawals &amp; Escrow — pending setup</p>
          <p style={{ fontSize: '11.5px', color: '#9A3412', lineHeight: 1.6 }}>
            Company Earnings, Escrow Balance (Pending/Released/Held/Disputed), and Withdrawals aren't tracked as separate ledgers in the database yet — these need their own tables before we can show real numbers here rather than guesses.
          </p>
        </div>
      </div>

      {/* Quick Insights */}
      {overview && !overviewError && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '16px', marginBottom: '20px' }}>
          <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '14px', letterSpacing: '0.4px' }}>QUICK INSIGHTS (SELECTED PERIOD)</p>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '16px' }}>
            <InsightCard icon="trendingUp" label="Avg. Booking Value" value={insightsAvg !== null ? `₦${insightsAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'} color={COLORS.blue} bg={COLORS.blueBg} />
            <InsightCard icon="briefcase" label="Commission Rate" value={insightsCommissionRate !== null ? `${insightsCommissionRate.toFixed(2)}%` : '—'} color={COLORS.green} bg={COLORS.greenBg} />
            <InsightCard icon="ticket" label={topStatus?.status ? `${topStatus.status.charAt(0).toUpperCase()}${topStatus.status.slice(1)} Bookings` : 'Bookings'} value={topStatus ? topStatus.count.toLocaleString() : '—'} color={COLORS.purple} bg={COLORS.purpleBg} />
            <InsightCard icon="refresh" label="Refund Rate" value={insightsRefundRate !== null ? `${insightsRefundRate.toFixed(2)}%` : '—'} color={COLORS.red} bg={COLORS.redBg} />
          </div>
        </div>
      )}

      {/* Recent Transactions — only shown if the staff member has finance.transactions.view */}
      {!txnForbidden && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
            <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.4px' }}>RECENT TRANSACTIONS</p>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              style={{ padding: '6px 9px', borderRadius: '7px', border: `1px solid ${COLORS.border}`, fontSize: '11.5px', color: COLORS.text, background: COLORS.card }}>
              <option value="all">All Transactions</option>
              {Object.keys(CATEGORY_LABEL).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '9px 12px', marginBottom: '10px' }}>
            <Icon name="search" size={14} color={COLORS.textMuted} />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
              placeholder="Search by ticket code, customer, company, or amount..."
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '12.5px', background: 'transparent', color: COLORS.text }}
            />
            {searchInput && <span onClick={() => setSearch(searchInput)} style={{ fontSize: '11px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Search</span>}
          </div>

          {txnError ? (
            <p style={{ fontSize: '12px', color: COLORS.red, textAlign: 'center' as const, padding: '20px 0' }}>{txnError}</p>
          ) : loadingTxns ? (
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>Loading...</p>
          ) : bookings.length === 0 ? (
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>No transactions found.</p>
          ) : (
            <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}` }}>
              {bookings.map((t, idx) => {
                const icon = (t.category && CATEGORY_ICON[t.category]) || 'ticket'
                const label = (t.category && CATEGORY_LABEL[t.category]) || 'Booking Payment'
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 15px', borderBottom: idx === bookings.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name={icon} size={14} color={COLORS.text} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{label}</p>
                      <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '1px' }}>
                        {t.business_name || 'Unknown company'} · {t.customer_name || 'Unknown customer'} · {t.ticket_code || '—'}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                      <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.text }}>₦{Number(t.amount_paid || 0).toLocaleString()}</p>
                      <p style={{ fontSize: '10px', color: t.booking_status === 'cancelled' ? COLORS.red : COLORS.green }}>
                        {t.booking_status || '—'} · {new Date(t.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {!txnError && !loadingTxns && bookings.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
                  style={{ padding: '7px 9px', borderRadius: '7px', border: `1px solid ${COLORS.border}`, fontSize: '12px', color: COLORS.text, background: COLORS.card }}>
                  {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} per page</option>)}
                </select>
                <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount.toLocaleString()} transactions
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
    </div>
  )
}
