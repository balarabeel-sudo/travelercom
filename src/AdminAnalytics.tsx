import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import {
  COLORS, RangeKey, RANGE_OPTIONS, windowForRange, Bucket,
  sum, pctChange, formatNaira, formatCompactNaira, KpiCard, SectionCard, EmptyNote, TrendChart,
} from './AnalyticsUI'

// ---------- Types (match the admin_analytics_summary / admin_analytics_timeseries RPCs) ----------
type Summary = {
  platform: { total_customers: number; total_companies: number; total_listings: number; category_totals: Record<string, number> }
  period: {
    bookings_total: number; bookings_confirmed: number; bookings_completed: number; bookings_cancelled: number
    gross_revenue: number; traveler_fee: number; cancelled_amount: number
    new_customers: number; active_customers: number; returning_customers: number; new_companies: number
    payments_successful_count: number; payments_successful_amount: number; payments_pending_count: number
    refund_amount: number; refund_count: number
  }
  previous: { bookings_total: number; gross_revenue: number; new_customers: number; new_companies: number; active_customers: number }
  bookings_by_category: { category: string; bookings: number; revenue: number; cancelled: number }[]
  companies_by_status: { status: string; cnt: number }[]
  companies_by_category: { category: string; cnt: number; with_bookings: number }[]
  top_companies: { id: string; business_name: string; business_type: string; bookings: number; revenue: number }[]
  top_routes: { category: string; origin: string; destination: string; bookings: number; revenue: number }[]
  operations: { today_bookings: number; today_revenue: number; pending_company_approvals: number; upcoming_activity_48h: number }
}
type TimePoint = { bucket_start: string; bookings: number; revenue: number; customers: number; companies: number; transactions: number }

type MetricKey = 'revenue' | 'bookings' | 'customers' | 'companies' | 'transactions'
const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'customers', label: 'Customers' },
  { key: 'companies', label: 'Companies' },
  { key: 'transactions', label: 'Transactions' },
]
function formatMetricValue(key: string, v: number) {
  if (key === 'revenue') return formatCompactNaira(v)
  return Math.round(v).toLocaleString()
}

const CATEGORY_LABELS: Record<string, string> = {
  hotel: 'Hotels', bus: 'Bus', train: 'Train', flight: 'Flights', tour: 'Tours', event_center: 'Event Centers',
}

function humanize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

function bucketsFromTimeseries(points: TimePoint[], range: RangeKey): Bucket[] {
  const stepMs = range === '1y' ? 30 * 86400000 : (range === '3m' || range === '6m') ? 7 * 86400000 : 86400000
  return points.map((p) => {
    const start = new Date(p.bucket_start)
    const label = range === '1y'
      ? start.toLocaleDateString('en-US', { month: 'short' })
      : start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const fullLabel = range === '1y'
      ? start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : (range === '3m' || range === '6m')
        ? `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return { start, end: new Date(start.getTime() + stepMs), label, fullLabel }
  })
}

export default function AdminAnalytics() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [timeseries, setTimeseries] = useState<TimePoint[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [range, setRange] = useState<RangeKey>('30d')
  const [metric, setMetric] = useState<MetricKey>('revenue')

  const load = async () => {
    setLoading(true)
    setErrorMsg('')

    const now = new Date()
    const { start, end } = windowForRange(range, now)
    const prevStart = new Date(start.getTime() - (end.getTime() - start.getTime()))
    const prevEnd = start

    const [summaryRes, seriesRes] = await Promise.all([
      supabase.rpc('admin_analytics_summary', {
        p_start: start.toISOString(), p_end: end.toISOString(),
        p_prev_start: prevStart.toISOString(), p_prev_end: prevEnd.toISOString(),
      }),
      range === 'today' ? Promise.resolve({ data: [], error: null }) : supabase.rpc('admin_analytics_timeseries', { p_range: range }),
    ])

    if (summaryRes.error) { setErrorMsg(summaryRes.error.message); setLoading(false); return }
    if (seriesRes.error) { setErrorMsg(seriesRes.error.message); setLoading(false); return }

    setSummary(summaryRes.data as Summary)
    setTimeseries((seriesRes.data as TimePoint[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [range]) // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = () => {
    if (!summary) return
    const rows = [
      ['Metric', 'Value'],
      ['Total Bookings (period)', String(summary.period.bookings_total)],
      ['Gross Revenue (period)', String(summary.period.gross_revenue)],
      ["Traveler.com Fee (period)", String(summary.period.traveler_fee)],
      ['New Customers (period)', String(summary.period.new_customers)],
      ['New Companies (period)', String(summary.period.new_companies)],
      ['Total Customers (all-time)', String(summary.platform.total_customers)],
      ['Total Companies (all-time)', String(summary.platform.total_companies)],
      ['Total Listings (all-time)', String(summary.platform.total_listings)],
    ]
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `travelercom-analytics-${range}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div style={{ padding: '16px' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: i === 1 ? '160px' : '90px', background: COLORS.card, borderRadius: '14px', marginBottom: '14px', border: `1px solid ${COLORS.border}` }} />
        ))}
      </div>
    )
  }

  if (errorMsg || !summary) {
    return (
      <div style={{ padding: '16px' }}>
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
          <p style={{ fontSize: '13px', color: '#dc2626' }}>{errorMsg || 'Unable to load analytics.'}</p>
        </div>
        <span onClick={load} style={{ display: 'inline-block', padding: '10px 16px', background: COLORS.primary, color: 'white', borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Try Again</span>
      </div>
    )
  }

  const { platform, period, previous, bookings_by_category, companies_by_status, companies_by_category, top_companies, top_routes, operations } = summary

  const providerRevenue = period.gross_revenue - period.traveler_fee
  const cancellationRate = period.bookings_total > 0 ? Math.round((period.bookings_cancelled / period.bookings_total) * 100) : 0
  const avgBookingValue = period.bookings_total > 0 ? period.gross_revenue / period.bookings_total : 0

  const chartBuckets = timeseries ? bucketsFromTimeseries(timeseries, range) : []
  const chartSeries: Record<string, number[]> | null = timeseries ? {
    revenue: timeseries.map((p) => p.revenue),
    bookings: timeseries.map((p) => p.bookings),
    customers: timeseries.map((p) => p.customers),
    companies: timeseries.map((p) => p.companies),
    transactions: timeseries.map((p) => p.transactions),
  } : null

  const mostBookedCategory = bookings_by_category.length > 1 ? bookings_by_category.reduce((a, b) => (b.bookings > a.bookings ? b : a), bookings_by_category[0]) : null
  const highestValueCategory = bookings_by_category.length > 1 ? bookings_by_category.reduce((a, b) => (b.revenue > a.revenue ? b : a), bookings_by_category[0]) : null

  return (
    <div style={{ padding: '16px 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap' as const, gap: '10px' }}>
        <div>
          <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>Traveler.com Analytics</p>
          <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Platform performance & ecosystem insights</p>
        </div>
        <span onClick={exportCsv} style={{ padding: '8px 13px', border: `1px solid ${COLORS.border}`, borderRadius: '9px', fontSize: '12px', fontWeight: 700, color: COLORS.text, cursor: 'pointer', background: COLORS.card }}>
          Export
        </span>
      </div>

      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' as const, marginBottom: '16px', paddingBottom: '2px' }}>
        {RANGE_OPTIONS.map((r) => (
          <span key={r.key} onClick={() => setRange(r.key)}
            style={{ flexShrink: 0, padding: '7px 13px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
              background: range === r.key ? COLORS.primary : COLORS.card, color: range === r.key ? 'white' : COLORS.text,
              border: `1px solid ${range === r.key ? COLORS.primary : COLORS.border}` }}>
            {r.label}
          </span>
        ))}
      </div>

      {/* Platform Totals (all-time) */}
      <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '8px', letterSpacing: '0.4px' }}>PLATFORM TOTALS (ALL-TIME)</p>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px', marginBottom: '10px' }}>
        <KpiCard label="Total Customers" value={platform.total_customers.toLocaleString()} />
        <KpiCard label="Total Companies" value={platform.total_companies.toLocaleString()} />
        <KpiCard label="Total Listings" value={platform.total_listings.toLocaleString()} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px', marginBottom: '20px' }}>
        {Object.entries(platform.category_totals).map(([cat, cnt]) => (
          <div key={cat} style={{ flex: '1 1 30%', minWidth: '100px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '10px', textAlign: 'center' as const }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{cnt}</p>
            <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{CATEGORY_LABELS[cat] || humanize(cat)}</p>
          </div>
        ))}
      </div>

      {/* Primary KPIs (selected period) */}
      <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '8px', letterSpacing: '0.4px' }}>SELECTED PERIOD</p>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px', marginBottom: '14px' }}>
        <KpiCard label="Total Bookings" value={period.bookings_total.toLocaleString()}
          delta={`${pctChange(period.bookings_total, previous.bookings_total) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(period.bookings_total, previous.bookings_total))}% vs previous period`}
          deltaGood={pctChange(period.bookings_total, previous.bookings_total) >= 0} />
        <KpiCard label="Gross Booking Value" value={formatNaira(period.gross_revenue)}
          delta={`${pctChange(period.gross_revenue, previous.gross_revenue) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(period.gross_revenue, previous.gross_revenue))}% vs previous period`}
          deltaGood={pctChange(period.gross_revenue, previous.gross_revenue) >= 0} />
        <KpiCard label="New Customers" value={period.new_customers.toLocaleString()}
          delta={`${pctChange(period.new_customers, previous.new_customers) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(period.new_customers, previous.new_customers))}% vs previous period`}
          deltaGood={pctChange(period.new_customers, previous.new_customers) >= 0} />
        <KpiCard label="New Companies" value={period.new_companies.toLocaleString()}
          delta={`${pctChange(period.new_companies, previous.new_companies) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(period.new_companies, previous.new_companies))}% vs previous period`}
          deltaGood={pctChange(period.new_companies, previous.new_companies) >= 0} />
        <KpiCard label="Active Customers" value={period.active_customers.toLocaleString()}
          delta={`${pctChange(period.active_customers, previous.active_customers) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(period.active_customers, previous.active_customers))}% vs previous period`}
          deltaGood={pctChange(period.active_customers, previous.active_customers) >= 0} sub="Made a booking this period" />
        <KpiCard label="Returning Customers" value={period.returning_customers.toLocaleString()} sub="Had a prior booking too" />
        <KpiCard label="Avg Booking Value" value={formatNaira(avgBookingValue)} />
        <KpiCard label="Cancellation Rate" value={cancellationRate + '%'} />
      </div>

      {/* Platform Performance trend chart */}
      <SectionCard title="Platform Performance">
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto' as const }}>
          {METRIC_OPTIONS.map((m) => (
            <span key={m.key} onClick={() => setMetric(m.key)}
              style={{ flexShrink: 0, padding: '6px 11px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                background: metric === m.key ? COLORS.primary : COLORS.bg, color: metric === m.key ? 'white' : COLORS.textMuted }}>
              {m.label}
            </span>
          ))}
        </div>
        {range === 'today' || !chartSeries ? (
          <EmptyNote text="Not enough data to display this trend for a single day. Pick a wider range." />
        ) : (
          <TrendChart
            buckets={chartBuckets}
            series={chartSeries[metric]}
            allSeries={chartSeries}
            activeMetric={metric}
            valueFormatter={formatMetricValue}
            renderTooltipRows={(idx) => [
              { label: 'Revenue', value: formatNaira(chartSeries.revenue[idx]) },
              { label: 'Bookings', value: String(chartSeries.bookings[idx]) },
              { label: 'Customers', value: String(chartSeries.customers[idx]) },
              { label: 'Companies', value: String(chartSeries.companies[idx]) },
              { label: 'Transactions', value: String(chartSeries.transactions[idx]) },
            ]}
          />
        )}
      </SectionCard>

      {/* Financial Overview */}
      <SectionCard title="Financial Overview">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{formatNaira(period.gross_revenue)}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Gross Booking Value</p></div>
          <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{formatNaira(period.traveler_fee)}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Traveler.com Revenue (fees)</p></div>
          <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{formatNaira(providerRevenue)}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Company/Provider Revenue</p></div>
          <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{formatNaira(period.cancelled_amount)}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Cancelled Booking Value</p></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '10px', borderTop: `1px solid ${COLORS.border}` }}>
          <div><p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>{period.payments_successful_count.toLocaleString()}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Successful Payments ({formatNaira(period.payments_successful_amount)})</p></div>
          <div><p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>{period.payments_pending_count.toLocaleString()}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Pending Payments</p></div>
          <div><p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>{period.refund_count.toLocaleString()}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Refunds ({formatNaira(period.refund_amount)})</p></div>
        </div>
        <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '10px' }}>Traveler.com doesn't currently record a "Failed" payment status separately from Pending.</p>
      </SectionCard>

      {/* Booking Category Analytics */}
      <SectionCard title="Booking Category Analytics">
        {bookings_by_category.length === 0 ? (
          <EmptyNote text="No booking data available for this period." />
        ) : (
          bookings_by_category.map((c, i) => (
            <div key={c.category} style={{ padding: '10px 0', borderBottom: i === bookings_by_category.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' as const, gap: '4px' }}>
                <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{CATEGORY_LABELS[c.category] || humanize(c.category)}</p>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {mostBookedCategory?.category === c.category && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.primary, background: '#E0F2FE', padding: '2px 7px', borderRadius: '6px' }}>Most Booked Category</span>}
                  {highestValueCategory?.category === c.category && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.green, padding: '2px 7px', borderRadius: '6px', background: '#F0FDF4' }}>Highest Booking Value</span>}
                </div>
              </div>
              <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{c.bookings} bookings · {formatNaira(c.revenue)} · {c.cancelled} cancelled</p>
            </div>
          ))
        )}
      </SectionCard>

      {/* Company / Partner Analytics */}
      <SectionCard title="Company / Partner Analytics">
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px', marginBottom: '12px' }}>
          {companies_by_status.map((s) => (
            <div key={s.status} style={{ flex: '1 1 40%', background: COLORS.bg, borderRadius: '10px', padding: '10px' }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{s.cnt}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{humanize(s.status)}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '8px' }}>By category (with bookings / total)</p>
        {companies_by_category.map((c, i) => (
          <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i === companies_by_category.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: '12px', color: COLORS.text }}>{CATEGORY_LABELS[c.category] || humanize(c.category)}</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{c.with_bookings} / {c.cnt}</span>
          </div>
        ))}
      </SectionCard>

      {/* Top Performers */}
      <SectionCard title="Top Companies by Revenue">
        {top_companies.length === 0 ? (
          <EmptyNote text="No company revenue data for this period." />
        ) : (
          top_companies.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i === top_companies.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{c.business_name}</p>
                <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>{CATEGORY_LABELS[c.business_type] || humanize(c.business_type || '')}</p>
              </div>
              <div style={{ textAlign: 'right' as const }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{formatNaira(c.revenue)}</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{c.bookings} bookings</p>
              </div>
            </div>
          ))
        )}
      </SectionCard>

      <SectionCard title="Top Routes (Bus/Train/Flight)">
        {top_routes.length === 0 ? (
          <EmptyNote text="No route data available yet." />
        ) : (
          top_routes.map((r, i) => (
            <div key={`${r.category}-${r.origin}-${r.destination}`} style={{ padding: '9px 0', borderBottom: i === top_routes.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{r.origin} → {r.destination} <span style={{ fontWeight: 500, color: COLORS.textMuted }}>({CATEGORY_LABELS[r.category] || humanize(r.category)})</span></p>
              <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>{r.bookings} bookings · {formatNaira(r.revenue)}</p>
            </div>
          ))
        )}
      </SectionCard>

      {/* Platform Operations */}
      <SectionCard title="Platform Operations">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{operations.today_bookings}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Today's Bookings</p></div>
          <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{formatNaira(operations.today_revenue)}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Today's Revenue</p></div>
          <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{operations.pending_company_approvals}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Pending Company Approvals</p></div>
          <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{operations.upcoming_activity_48h}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Departures/Check-ins/Tours/Events (next 48h)</p></div>
        </div>
      </SectionCard>

      {/* Honest data-gap notes rather than fake sections */}
      <SectionCard title="Not Yet Available">
        <EmptyNote text="Cabin/geographical customer analytics (by country/state), user activity/search tracking, and cross-page drill-down (Platform → Category → Company → Booking) aren't built yet — none of the underlying data (customer location, page-view/search logs) or navigation exists yet. Flagging these rather than estimating them." />
      </SectionCard>
    </div>
  )
}
