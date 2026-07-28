import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

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
  amber: '#D97706',
  blue: '#0EA5E9',
}

const PAYMENT_COLORS: Record<string, string> = {
  online: '#0EA5E9',
  transfer: '#16A34A',
  cash: '#D97706',
  pos: '#6B21A8',
}
const PAYMENT_LABELS: Record<string, string> = {
  online: 'Online (Wallet)',
  transfer: 'Transfer',
  cash: 'Cash',
  pos: 'POS',
}

type Booking = {
  created_at: string
  checked_in: boolean
  amount_paid: number
  booking_source: string | null
  payment_method: string | null
  inventory_item_id: string | null
  service_id: string | null
  services: { title: string } | null
  inventory_items: { name: string } | null
}

export default function Analytics() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState<'week' | 'month' | 'year'>('week')

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { navigate('/login'); return }

      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', userData.user.id)
        .maybeSingle()

      if (!company) { setLoading(false); return }

      const { data: rows } = await supabase
        .from('bookings')
        .select('created_at, checked_in, amount_paid, booking_source, payment_method, inventory_item_id, service_id, services(title), inventory_items(name)')
        .eq('company_id', company.id)
        .order('created_at', { ascending: true })

      setBookings((rows || []) as any)
      setLoading(false)
    }
    load()
  }, [navigate])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, color: COLORS.textMuted }}>
        Loading Analytics...
      </div>
    )
  }

  const now = new Date()
  const daysBack = filter === 'week' ? 7 : filter === 'month' ? 30 : 365
  const periodStart = new Date(now.getTime() - daysBack * 86400000)

  const periodBookings = bookings.filter((b) => new Date(b.created_at) >= periodStart)
  const revenueBookings = periodBookings.filter((b) => b.checked_in)

  const bucketCount = filter === 'year' ? 12 : filter === 'month' ? 30 : 7
  const trendValues: number[] = new Array(bucketCount).fill(0)

  revenueBookings.forEach((b) => {
    const d = new Date(b.created_at)
    if (filter === 'year') {
      const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
      const idx = bucketCount - 1 - monthsAgo
      if (idx >= 0 && idx < bucketCount) trendValues[idx] += Number(b.amount_paid)
    } else {
      const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86400000)
      const idx = bucketCount - 1 - daysAgo
      if (idx >= 0 && idx < bucketCount) trendValues[idx] += Number(b.amount_paid)
    }
  })

  const maxTrend = Math.max(...trendValues, 1)
  const chartW = 320
  const chartH = 100
  const stepX = chartW / (bucketCount - 1 || 1)
  const points = trendValues.map((v, i) => {
    const x = i * stepX
    const y = chartH - (v / maxTrend) * chartH
    return `${x},${y}`
  }).join(' ')

  const totalRevenue = revenueBookings.reduce((sum, b) => sum + Number(b.amount_paid), 0)

  const paymentCounts: Record<string, number> = { online: 0, transfer: 0, cash: 0, pos: 0 }
  periodBookings.forEach((b) => {
    if (b.booking_source === 'offline' && b.payment_method) {
      paymentCounts[b.payment_method] = (paymentCounts[b.payment_method] || 0) + 1
    } else {
      paymentCounts.online += 1
    }
  })
  const totalPayments = Object.values(paymentCounts).reduce((a, b) => a + b, 0) || 1

  let cumulativePct = 0
  const gradientStops: string[] = []
  Object.entries(paymentCounts).forEach(([key, count]) => {
    if (count === 0) return
    const pct = (count / totalPayments) * 100
    gradientStops.push(`${PAYMENT_COLORS[key]} ${cumulativePct}% ${cumulativePct + pct}%`)
    cumulativePct += pct
  })
  const donutStyle = gradientStops.length > 0
    ? { background: `conic-gradient(${gradientStops.join(', ')})` }
    : { background: '#E2E8F0' }

  const perfCounts: Record<string, number> = {}
  periodBookings.forEach((b) => {
    const name = b.inventory_items?.name || b.services?.title
    if (name) perfCounts[name] = (perfCounts[name] || 0) + 1
  })
  const topPerformance = Object.entries(perfCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  const maxPerf = topPerformance[0]?.count || 1

  const filterLabel = filter === 'week' ? 'Last 7 Days' : filter === 'month' ? 'Last 30 Days' : 'Last 12 Months'

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: `linear-gradient(135deg, ${COLORS.purple}, #4C1D95)`, color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="arrowLeft" size={22} color="white" />
          </div>
          <h1 style={{ fontSize: '17px', fontWeight: 800 }}>Analytics</h1>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'week' | 'month' | 'year')}
          style={{
            fontSize: '12px', fontWeight: 700, color: 'white', background: 'rgba(255,255,255,0.15)',
            border: 'none', borderRadius: '8px', padding: '6px 10px'
          }}>
          <option value="week" style={{ color: COLORS.text }}>Last 7 Days</option>
          <option value="month" style={{ color: COLORS.text }}>Last 30 Days</option>
          <option value="year" style={{ color: COLORS.text }}>Last 12 Months</option>
        </select>
      </div>

      <div style={{ padding: '16px' }}>

        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '18px', marginBottom: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div>
              <p style={{ fontSize: '12px', color: COLORS.textMuted }}>Revenue — {filterLabel}</p>
              <p style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text }}>₦{totalRevenue.toLocaleString()}</p>
            </div>
            <Icon name="trendingUp" size={22} color={COLORS.purple} />
          </div>
          <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height="90" preserveAspectRatio="none">
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.purpleLight} stopOpacity="0.35" />
                <stop offset="100%" stopColor={COLORS.purpleLight} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={`0,${chartH} ${points} ${chartW},${chartH}`} fill="url(#trendFill)" />
            <polyline points={points} fill="none" stroke={COLORS.purple} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </div>

        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '18px', marginBottom: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.07)' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '14px' }}>Payment Sources — {filterLabel}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '110px', height: '110px', borderRadius: '50%', flexShrink: 0,
              position: 'relative', ...donutStyle
            }}>
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: '68px', height: '68px', borderRadius: '50%', background: COLORS.card,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'
              }}>
                <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{totalPayments}</p>
                <p style={{ fontSize: '9px', color: COLORS.textMuted }}>bookings</p>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              {Object.entries(paymentCounts).filter(([, c]) => c > 0).map(([key, count]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: PAYMENT_COLORS[key], flexShrink: 0 }} />
                  <p style={{ fontSize: '11.5px', color: COLORS.text, flex: 1 }}>{PAYMENT_LABELS[key]}</p>
                  <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted }}>{Math.round((count / totalPayments) * 100)}%</p>
                </div>
              ))}
              {totalPayments === 0 && (
                <p style={{ fontSize: '12px', color: COLORS.textMuted }}>No bookings in this period</p>
              )}
            </div>
          </div>
        </div>

        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '18px', boxShadow: '0 4px 15px rgba(0,0,0,0.07)' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '14px' }}>Top Performing — {filterLabel}</p>
          {topPerformance.length === 0 ? (
            <p style={{ fontSize: '12px', color: COLORS.textMuted }}>No bookings yet to rank performance</p>
          ) : (
            topPerformance.map((p, i) => (
              <div key={p.name} style={{ marginBottom: i < topPerformance.length - 1 ? '14px' : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.text }}>{p.name}</p>
                  <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>{p.count} bookings</p>
                </div>
                <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px' }}>
                  <div style={{
                    width: `${(p.count / maxPerf) * 100}%`, height: '100%',
                    background: `linear-gradient(to right, ${COLORS.purple}, ${COLORS.purpleLight})`, borderRadius: '3px'
                  }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
