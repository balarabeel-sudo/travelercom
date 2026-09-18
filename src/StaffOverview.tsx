// Traveler.com — Staff Overview
// The universal, company-wide platform overview every active staff member
// can see, regardless of module permissions. Per Rabeel's Master Staff
// Overview spec: NOT detailed Analytics, NOT a permissions dashboard, NOT
// a management dashboard — just a safe shared picture of platform scale
// and activity. No financial figures anywhere on this page, on purpose.
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import {
  COLORS, KpiCard, SectionCard, EmptyNote, TrendChart,
  RANGE_OPTIONS, type RangeKey,
} from './AnalyticsUI'

const CATEGORY_LABELS: Record<string, string> = {
  hotel: 'Hotels', bus: 'Bus', train: 'Train', flight: 'Flights', tour: 'Tours', event_center: 'Event Centers',
}
const CATEGORY_ICONS: Record<string, string> = {
  hotel: 'hotel', bus: 'bus', train: 'bus', flight: 'plane', tour: 'map', event_center: 'tent',
}
const CATEGORY_DOT: Record<string, string> = {
  hotel: '#0EA5E9', bus: '#16a34a', train: '#7C3AED', flight: '#F97316', tour: '#DB2777', event_center: '#64748B',
}

type CategoryRow = { category: string; active_listings: number; bookings: number }
type Totals = {
  total_customers: number; active_companies: number; active_listings: number
  total_bookings: number; active_categories: number
}
type TodayActivity = { new_customers: number; new_companies: number; new_bookings: number }

type TimeseriesRow = { bucket_start: string; bookings: number; customers: number; companies: number }
type TrendMetric = 'bookings' | 'customers' | 'companies'
const TREND_METRICS: { key: TrendMetric; label: string }[] = [
  { key: 'bookings', label: 'Bookings' },
  { key: 'customers', label: 'Customers' },
  { key: 'companies', label: 'Companies' },
]

function SystemStatusRow({ label, status, note }: { label: string; status: 'checking' | 'healthy' | 'error' | 'unmonitored'; note?: string }) {
  const color = status === 'healthy' ? COLORS.green : status === 'error' ? COLORS.red : status === 'checking' ? COLORS.orange : COLORS.textMuted
  const text = status === 'healthy' ? 'Operational' : status === 'error' ? 'Error' : status === 'checking' ? 'Checking...' : 'Not monitored'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${COLORS.border}` }}>
      <div>
        <p style={{ fontSize: '13px', color: COLORS.text }}>{label}</p>
        {note && <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '2px' }}>{note}</p>}
      </div>
      <span style={{ fontSize: '11px', fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color }} />
        {text}
      </span>
    </div>
  )
}

const QUICK_ACCESS: { key: string; label: string; icon: string; permission?: string | string[] }[] = [
  { key: 'bookings', label: 'Bookings', icon: 'ticket', permission: 'bookings.view' },
  { key: 'companies', label: 'Companies', icon: 'building', permission: ['companies.view', 'verification.view'] },
  { key: 'users', label: 'Customers', icon: 'users', permission: 'users.view' },
  { key: 'analytics', label: 'Analytics', icon: 'trendingUp' },
]

export default function StaffOverview({
  isSuperAdmin, permissions, onNavigate,
}: {
  isSuperAdmin: boolean
  permissions: Set<string>
  onNavigate: (sectionKey: string) => void
}) {
  const [staffName, setStaffName] = useState('')

  const [totals, setTotals] = useState<Totals | null>(null)
  const [byCategory, setByCategory] = useState<CategoryRow[]>([])
  const [today, setToday] = useState<TodayActivity | null>(null)
  const [totalsLoading, setTotalsLoading] = useState(true)
  const [totalsError, setTotalsError] = useState('')

  const [range, setRange] = useState<RangeKey>('30d')
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('bookings')
  const [trendRows, setTrendRows] = useState<TimeseriesRow[]>([])
  const [trendLoading, setTrendLoading] = useState(true)
  const [trendError, setTrendError] = useState('')

  const [dbStatus, setDbStatus] = useState<'checking' | 'healthy' | 'error'>('checking')
  const [authStatus, setAuthStatus] = useState<'checking' | 'healthy' | 'error'>('checking')

  useEffect(() => {
    const loadWho = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', userData.user.id).maybeSingle()
      setStaffName(prof?.full_name || userData.user.user_metadata?.full_name || userData.user.email || '')
    }
    loadWho()

    const checkHealth = async () => {
      try {
        const { error } = await supabase.from('platform_settings').select('id').limit(1)
        setDbStatus(error ? 'error' : 'healthy')
      } catch { setDbStatus('error') }
      try {
        const { error } = await supabase.auth.getSession()
        setAuthStatus(error ? 'error' : 'healthy')
      } catch { setAuthStatus('error') }
    }
    checkHealth()
  }, [])

  useEffect(() => {
    const loadTotals = async () => {
      setTotalsLoading(true)
      setTotalsError('')
      const { data, error } = await supabase.rpc('staff_overview_totals')
      if (error) { setTotalsError(error.message); setTotalsLoading(false); return }
      setTotals(data?.totals || null)
      setByCategory(data?.by_category || [])
      setToday(data?.today || null)
      setTotalsLoading(false)
    }
    loadTotals()
  }, [])

  useEffect(() => {
    const loadTrend = async () => {
      setTrendLoading(true)
      setTrendError('')
      const { data, error } = await supabase.rpc('admin_analytics_timeseries', { p_range: range })
      if (error) { setTrendError(error.message); setTrendLoading(false); return }
      setTrendRows((data as TimeseriesRow[]) || [])
      setTrendLoading(false)
    }
    loadTrend()
  }, [range])

  const buckets = trendRows.map((r) => {
    const start = new Date(r.bucket_start)
    return {
      start,
      end: start,
      label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullLabel: start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    }
  })
  const seriesFor = (metric: TrendMetric) => trendRows.map((r) => r[metric])

  const canSee = (permission?: string | string[]) => {
    if (isSuperAdmin || !permission) return true
    const list = Array.isArray(permission) ? permission : [permission]
    return list.some((p) => permissions.has(p))
  }

  return (
    <div style={{ padding: '20px 24px 60px 24px' }}>
      {/* Header */}
      <p style={{ fontSize: '19px', fontWeight: 800 }}>
        <span style={{ color: COLORS.primary }}>TRAVELER</span><span style={{ color: '#F97316' }}>.COM</span>
      </p>
      <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginTop: '2px' }}>Platform Overview</p>
      <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '20px' }}>
        {staffName ? `Welcome, ${staffName}` : 'One Platform. All Your Travel Needs.'}
      </p>

      {/* Platform Health */}
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>PLATFORM HEALTH</p>
      {totalsLoading ? (
        <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '20px' }}>Loading...</p>
      ) : totalsError ? (
        <p style={{ fontSize: '12px', color: COLORS.red, marginBottom: '20px' }}>{totalsError}</p>
      ) : totals ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px', marginBottom: '10px' }}>
            <KpiCard label="Total Customers" value={totals.total_customers.toLocaleString()} sub={today ? `+${today.new_customers} today` : undefined} />
            <KpiCard label="Active Partner Companies" value={totals.active_companies.toLocaleString()} sub={today ? `+${today.new_companies} today` : undefined} />
            <KpiCard label="Active Listings" value={totals.active_listings.toLocaleString()} />
            <KpiCard label="Total Bookings" value={totals.total_bookings.toLocaleString()} sub={today ? `+${today.new_bookings} today` : undefined} />
            <KpiCard label="Active Travel Categories" value={totals.active_categories.toLocaleString()} />
          </div>
          {totals.total_customers === 0 && totals.total_bookings === 0 && (
            <p style={{ fontSize: '13px', color: COLORS.textMuted, marginBottom: '10px' }}>Traveler.com is growing 🚀 — platform activity will appear here as customers, partners and bookings increase.</p>
          )}
        </>
      ) : null}

      {/* Travel Ecosystem */}
      <div style={{ marginTop: '10px' }}>
        <SectionCard title="Travel Ecosystem">
          {totalsLoading ? (
            <EmptyNote text="Loading..." />
          ) : byCategory.length === 0 ? (
            <EmptyNote text="No active travel categories yet." />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px' }}>
              {byCategory.map((c) => (
                <div key={c.category} style={{ flex: '1 1 45%', minWidth: '140px', background: COLORS.bg, borderRadius: '12px', padding: '12px', border: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '3px', background: CATEGORY_DOT[c.category] || COLORS.textMuted }} />
                    <Icon name={CATEGORY_ICONS[c.category] || 'globe'} size={13} color={COLORS.textMuted} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{CATEGORY_LABELS[c.category] || c.category}</span>
                  </div>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{c.active_listings} active listing{c.active_listings === 1 ? '' : 's'}</p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{c.bookings} booking{c.bookings === 1 ? '' : 's'}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Activity Trend */}
      <SectionCard
        title="Traveler.com Activity"
        action={
          <div style={{ display: 'flex', gap: '4px' }}>
            {RANGE_OPTIONS.map((r) => (
              <span
                key={r.key}
                onClick={() => setRange(r.key)}
                style={{
                  fontSize: '10.5px', fontWeight: 700, padding: '4px 8px', borderRadius: '7px', cursor: 'pointer',
                  color: range === r.key ? '#fff' : COLORS.textMuted,
                  background: range === r.key ? COLORS.primary : COLORS.bg,
                }}>
                {r.label}
              </span>
            ))}
          </div>
        }>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          {TREND_METRICS.map((m) => (
            <span
              key={m.key}
              onClick={() => setTrendMetric(m.key)}
              style={{
                fontSize: '11px', fontWeight: 700, padding: '5px 10px', borderRadius: '20px', cursor: 'pointer',
                color: trendMetric === m.key ? COLORS.primary : COLORS.textMuted,
                background: trendMetric === m.key ? '#EFF6FF' : 'transparent',
                border: `1px solid ${trendMetric === m.key ? COLORS.primary : COLORS.border}`,
              }}>
              {m.label}
            </span>
          ))}
        </div>
        {trendLoading ? (
          <EmptyNote text="Loading..." />
        ) : trendError ? (
          <p style={{ fontSize: '12px', color: COLORS.red }}>{trendError}</p>
        ) : (
          <TrendChart
            buckets={buckets}
            series={seriesFor(trendMetric)}
            allSeries={{ bookings: seriesFor('bookings'), customers: seriesFor('customers'), companies: seriesFor('companies') }}
            activeMetric={trendMetric}
            valueFormatter={(_key, v) => Math.round(v).toLocaleString()}
            renderTooltipRows={(idx) => TREND_METRICS.map((m) => ({ label: m.label, value: Math.round(seriesFor(m.key)[idx] || 0).toLocaleString() }))}
          />
        )}
      </SectionCard>

      {/* Milestones & Announcements — honest placeholder, no CMS exists yet */}
      <SectionCard title="Milestones & Announcements">
        <EmptyNote text="No milestone or announcement system is wired up yet — flagged for Rabeel to decide whether to build one before this section shows real content." />
      </SectionCard>

      {/* Platform Status */}
      <SectionCard title="Platform Status">
        <SystemStatusRow label="Database" status={dbStatus} />
        <SystemStatusRow label="Booking System" status={dbStatus} />
        <SystemStatusRow label="Payments" status="unmonitored" note="Needs a server-side check — not yet built" />
        <SystemStatusRow label="Authentication" status={authStatus} />
      </SectionCard>

      {/* Quick Access — respects existing module permissions, never bypasses them */}
      <SectionCard title="Quick Access">
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px' }}>
          {QUICK_ACCESS.map((q) => {
            const allowed = canSee(q.permission)
            return (
              <div
                key={q.key}
                onClick={() => allowed && onNavigate(q.key)}
                style={{
                  flex: '1 1 21%', minWidth: '90px', textAlign: 'center' as const, padding: '14px 8px', borderRadius: '12px',
                  border: `1px solid ${COLORS.border}`, cursor: allowed ? 'pointer' : 'not-allowed',
                  opacity: allowed ? 1 : 0.45, background: COLORS.bg,
                }}>
                <Icon name={allowed ? q.icon : 'lock'} size={18} color={allowed ? COLORS.primary : COLORS.textMuted} />
                <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.text, marginTop: '6px' }}>{q.label}</p>
                {!allowed && <p style={{ fontSize: '9px', color: COLORS.textMuted, marginTop: '2px' }}>No access</p>}
              </div>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}
