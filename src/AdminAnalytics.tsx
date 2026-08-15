import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  bg: '#F8FAFC',
}

type DayPoint = { day: string; revenue?: number; bookings?: number; new_users?: number }
type CategoryRow = { category: string; bookings: number; revenue: number }
type CompanyRow = { id: string; business_name: string; bookings: number; revenue: number }
type Summary = {
  revenue_by_day: DayPoint[]
  new_users_by_day: DayPoint[]
  bookings_by_category: CategoryRow[]
  top_companies: CompanyRow[]
  totals: { total_revenue_30d: number; total_bookings_30d: number; total_new_users_30d: number }
}

function MetricCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}`, padding: '14px', flex: '1 1 45%', minWidth: '140px' }}>
      <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
        <Icon name={icon} size={14} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '3px' }}>{label}</p>
      <p style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text }}>{value}</p>
    </div>
  )
}

function BarRow({ label, value, max, sub }: { label: string; value: number; max: number; sub: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 4
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>{label}</span>
        <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>{sub}</span>
      </div>
      <div style={{ background: '#F1F5F9', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: COLORS.primary, borderRadius: '6px' }} />
      </div>
    </div>
  )
}

export default function AdminAnalytics() {
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.rpc('admin_analytics_summary')
    if (error) setError(error.message)
    else setData(data as Summary)
    setLoading(false)
  }

  if (loading) {
    return <div style={{ padding: '16px' }}><p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p></div>
  }

  if (error) {
    return (
      <div style={{ padding: '16px' }}>
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px' }}>
          <p style={{ fontSize: '12px', color: '#dc2626' }}>{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const revenue7 = data.revenue_by_day.slice(-7)
  const maxRevenue = Math.max(1, ...revenue7.map((d) => d.revenue || 0))
  const maxCategory = Math.max(1, ...data.bookings_by_category.map((c) => c.revenue || 0))
  const maxCompany = Math.max(1, ...data.top_companies.map((c) => c.revenue || 0))

  return (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>
        LAST 30 DAYS
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '22px' }}>
        <MetricCard icon="cash" label="Total Revenue" value={`₦${data.totals.total_revenue_30d.toLocaleString()}`} />
        <MetricCard icon="ticket" label="Total Bookings" value={data.totals.total_bookings_30d.toLocaleString()} />
        <MetricCard icon="users" label="New Users" value={data.totals.total_new_users_30d.toLocaleString()} />
      </div>

      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>
        REVENUE -- LAST 7 DAYS
      </p>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px', marginBottom: '22px' }}>
        {revenue7.length === 0 ? (
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>No bookings in the last 7 days.</p>
        ) : (
          revenue7.map((d) => (
            <BarRow
              key={d.day}
              label={new Date(d.day).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })}
              value={d.revenue || 0}
              max={maxRevenue}
              sub={`₦${(d.revenue || 0).toLocaleString()}`}
            />
          ))
        )}
      </div>

      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>
        BOOKINGS BY CATEGORY
      </p>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px', marginBottom: '22px' }}>
        {data.bookings_by_category.length === 0 ? (
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>No bookings yet.</p>
        ) : (
          data.bookings_by_category.map((c) => (
            <BarRow
              key={c.category}
              label={c.category.charAt(0).toUpperCase() + c.category.slice(1).replace('_', ' ')}
              value={c.revenue || 0}
              max={maxCategory}
              sub={`${c.bookings} bookings · ₦${(c.revenue || 0).toLocaleString()}`}
            />
          ))
        )}
      </div>

      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>
        TOP 5 COMPANIES BY REVENUE
      </p>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px' }}>
        {data.top_companies.length === 0 ? (
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>No company revenue yet.</p>
        ) : (
          data.top_companies.map((c) => (
            <BarRow
              key={c.id}
              label={c.business_name}
              value={c.revenue || 0}
              max={maxCompany}
              sub={`${c.bookings} bookings · ₦${(c.revenue || 0).toLocaleString()}`}
            />
          ))
        )}
      </div>
    </div>
  )
}
