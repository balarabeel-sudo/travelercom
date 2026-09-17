import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import {
  COLORS, DAY_MS, RangeKey, RANGE_OPTIONS, windowForRange, Bucket, buildBuckets,
  sum, pctChange, formatNaira, formatCompactNaira, KpiCard, SectionCard, EmptyNote, TrendChart,
} from './AnalyticsUI'

// ---------- Types ----------
type TourBooking = {
  id: string
  created_at: string
  booking_status: string
  amount_paid: number
  quantity: number
  checked_in: boolean
  promotion_id: string | null
  service_id: string | null
}

// Each row is one scheduled instance of a tour (a specific date + time slot).
// Traveler.com has no separate "tours" master table — a tour listing is the
// set of instances that share the same title.
type TourInstance = {
  id: string
  title: string | null
  meeting_point: string | null
  departure_time: string | null // tour start
  arrival_time: string | null   // tour end
  price: number
  capacity: number | null
  seats_available: number | null
  status: string
  created_at: string
}

type PromoRow = {
  id: string
  service_id: string
  title: string
  discount_type: string
  discount_value: number
  active: boolean
  usage_limit: number | null
  services: { title: string } | null
}

type MetricKey = 'revenue' | 'bookings' | 'participants' | 'tours' | 'capacity'
const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'participants', label: 'Participants' },
  { key: 'tours', label: 'Tours' },
  { key: 'capacity', label: 'Capacity' },
]

function formatMetricValue(key: string, v: number) {
  if (key === 'revenue') return formatCompactNaira(v)
  return Math.round(v).toLocaleString()
}

// A tour instance is "cancelled" if its listing was deactivated (status=
// 'inactive'); otherwise "completed" once its start time has passed, or
// "upcoming". Traveler.com has no dedicated tour-cancellation status
// separate from the listing's active/inactive flag.
function tourState(t: TourInstance, now: Date): 'completed' | 'cancelled' | 'upcoming' {
  if (t.status === 'inactive') return 'cancelled'
  if (t.departure_time && new Date(t.departure_time) <= now) return 'completed'
  return 'upcoming'
}

function slotsSoldMap(bookings: TourBooking[]): Record<string, number> {
  const map: Record<string, number> = {}
  bookings.forEach((b) => {
    if (b.booking_status !== 'cancelled' && b.service_id) {
      map[b.service_id] = (map[b.service_id] || 0) + (b.quantity || 1)
    }
  })
  return map
}
function tourCapacity(t: TourInstance, sold: number) {
  return t.capacity ?? ((t.seats_available || 0) + sold)
}

// ---------- Aggregation: booking-creation-date attribution ----------
function aggregateByCreated(bookings: TourBooking[], buckets: { start: Date; end: Date }[]) {
  const n = buckets.length
  const revenue = new Array(n).fill(0)
  const bookingsCount = new Array(n).fill(0)
  const participants = new Array(n).fill(0)
  const indexFor = (d: Date) => {
    for (let i = 0; i < n; i++) if (d >= buckets[i].start && d < buckets[i].end) return i
    return -1
  }
  bookings.forEach((b) => {
    const idx = indexFor(new Date(b.created_at))
    if (idx < 0) return
    bookingsCount[idx] += 1
    if (b.booking_status !== 'cancelled') {
      revenue[idx] += Number(b.amount_paid) || 0
      participants[idx] += b.quantity || 1
    }
  })
  return { revenue, bookingsCount, participants }
}

// ---------- Aggregation: tour-start-date attribution ----------
function aggregateByStart(instances: TourInstance[], sold: Record<string, number>, buckets: { start: Date; end: Date }[]) {
  const n = buckets.length
  const toursCount = new Array(n).fill(0)
  const slotsSold = new Array(n).fill(0)
  const capacity = new Array(n).fill(0)
  const indexFor = (d: Date) => {
    for (let i = 0; i < n; i++) if (d >= buckets[i].start && d < buckets[i].end) return i
    return -1
  }
  instances.forEach((t) => {
    if (!t.departure_time) return
    const idx = indexFor(new Date(t.departure_time))
    if (idx < 0) return
    toursCount[idx] += 1
    const s = sold[t.id] || 0
    slotsSold[idx] += s
    capacity[idx] += tourCapacity(t, s)
  })
  return { toursCount, slotsSold, capacity }
}

// ---------- Main component ----------
export default function TourAnalytics({ companyId, isOwner }: { companyId: string; isOwner: boolean }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [bookings, setBookings] = useState<TourBooking[]>([])
  const [instances, setInstances] = useState<TourInstance[]>([])
  const [promotions, setPromotions] = useState<PromoRow[]>([])
  const [financeAllowed, setFinanceAllowed] = useState(true)
  const [range, setRange] = useState<RangeKey>('30d')
  const [metric, setMetric] = useState<MetricKey>('revenue')

  const load = async () => {
    setLoading(true)
    setErrorMsg('')

    if (!isOwner) {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data: allowed } = await supabase.rpc('has_permission', { p_user_id: userData.user.id, p_permission: 'finance.view' })
        setFinanceAllowed(!!allowed)
      }
    }

    const { data: bookingRows, error: bookingErr } = await supabase
      .from('bookings')
      .select('id, created_at, booking_status, amount_paid, quantity, checked_in, promotion_id, service_id')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })

    if (bookingErr) { setErrorMsg('Could not load booking data: ' + bookingErr.message); setLoading(false); return }

    const { data: instanceRows, error: instanceErr } = await supabase
      .from('services')
      .select('id, title, meeting_point, departure_time, arrival_time, price, capacity, seats_available, status, created_at')
      .eq('company_id', companyId)
      .eq('category', 'tour')
      .order('departure_time', { ascending: false })

    if (instanceErr) { setErrorMsg('Could not load tour data: ' + instanceErr.message); setLoading(false); return }

    const { data: promoRows } = await supabase
      .from('promotions')
      .select('id, service_id, title, discount_type, discount_value, active, usage_limit, services(title)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    setBookings((bookingRows || []) as any)
    setInstances((instanceRows || []) as any)
    setPromotions((promoRows || []) as any)
    setLoading(false)
  }

  useEffect(() => { load() }, [companyId, isOwner]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg }}>
        <div style={{ padding: '16px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: i === 1 ? '160px' : '90px', background: COLORS.card, borderRadius: '14px', marginBottom: '14px', border: `1px solid ${COLORS.border}` }} />
          ))}
        </div>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="arrowLeft" size={20} color={COLORS.text} /></span>
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Tour Analytics</h2>
        </div>
        <div style={{ background: COLORS.redBg, borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
          <p style={{ fontSize: '13px', color: COLORS.red }}>Unable to load tour analytics.</p>
        </div>
        <span onClick={load} style={{ display: 'inline-block', padding: '10px 16px', background: COLORS.primary, color: 'white', borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Try Again</span>
      </div>
    )
  }

  const now = new Date()
  const { start: periodStart, end: periodEnd } = windowForRange(range, now)
  const prevStart = new Date(periodStart.getTime() - (periodEnd.getTime() - periodStart.getTime()))
  const prevEnd = periodStart

  const sold = slotsSoldMap(bookings)

  const periodBookingsList = bookings.filter((b) => { const d = new Date(b.created_at); return d >= periodStart && d < periodEnd })
  const prevBookingsList = bookings.filter((b) => { const d = new Date(b.created_at); return d >= prevStart && d < prevEnd })
  const periodTours = instances.filter((t) => t.departure_time && new Date(t.departure_time) >= periodStart && new Date(t.departure_time) < periodEnd)
  const prevTours = instances.filter((t) => t.departure_time && new Date(t.departure_time) >= prevStart && new Date(t.departure_time) < prevEnd)

  const periodRevenue = sum(periodBookingsList.filter((b) => b.booking_status !== 'cancelled').map((b) => Number(b.amount_paid) || 0))
  const prevRevenue = sum(prevBookingsList.filter((b) => b.booking_status !== 'cancelled').map((b) => Number(b.amount_paid) || 0))
  const periodParticipants = sum(periodBookingsList.filter((b) => b.booking_status !== 'cancelled').map((b) => b.quantity || 1))
  const prevParticipants = sum(prevBookingsList.filter((b) => b.booking_status !== 'cancelled').map((b) => b.quantity || 1))
  const periodBookingsCount = periodBookingsList.length
  const prevBookingsCount = prevBookingsList.length

  const periodToursCompleted = periodTours.filter((t) => tourState(t, now) === 'completed').length
  const periodToursCancelled = periodTours.filter((t) => tourState(t, now) === 'cancelled').length
  const periodToursUpcoming = periodTours.filter((t) => tourState(t, now) === 'upcoming').length

  const periodSlotsSold = sum(periodTours.map((t) => sold[t.id] || 0))
  const periodCapacity = sum(periodTours.map((t) => tourCapacity(t, sold[t.id] || 0)))
  const periodUtilizationPct = periodCapacity > 0 ? Math.min(100, (periodSlotsSold / periodCapacity) * 100) : 0
  const prevSlotsSold = sum(prevTours.map((t) => sold[t.id] || 0))
  const prevCapacity = sum(prevTours.map((t) => tourCapacity(t, sold[t.id] || 0)))
  const prevUtilizationPct = prevCapacity > 0 ? Math.min(100, (prevSlotsSold / prevCapacity) * 100) : 0

  const availableSlotsNow = sum(instances.filter((t) => tourState(t, now) === 'upcoming').map((t) => t.seats_available ?? 0))

  const cancelledBookingsCount = periodBookingsList.filter((b) => b.booking_status === 'cancelled').length
  const cancellationRate = periodBookingsList.length > 0 ? Math.round((cancelledBookingsCount / periodBookingsList.length) * 100) : 0
  const avgBookingValue = periodBookingsCount > 0 ? periodRevenue / periodBookingsCount : 0

  // No-show: derived from checked_in status on bookings whose tour has already started.
  // Traveler.com doesn't track a dedicated no-show status, so this is an estimate.
  const instanceById: Record<string, TourInstance> = {}
  instances.forEach((t) => { instanceById[t.id] = t })
  const noShowBookings = periodBookingsList.filter((b) => {
    if (b.booking_status !== 'confirmed' || !b.service_id) return false
    const t = instanceById[b.service_id]
    return t?.departure_time && new Date(t.departure_time) < now && !b.checked_in
  })
  const noShowParticipants = sum(noShowBookings.map((b) => b.quantity || 1))
  const confirmedCount = periodBookingsList.filter((b) => b.booking_status === 'confirmed').length
  const noShowRate = confirmedCount > 0 ? Math.round((noShowBookings.length / confirmedCount) * 100) : 0

  const chartBuckets = range === 'today' ? [] : buildBuckets(range, now)
  const createdAgg = chartBuckets.length > 0 ? aggregateByCreated(bookings, chartBuckets) : null
  const startAgg = chartBuckets.length > 0 ? aggregateByStart(instances, sold, chartBuckets) : null
  const chartSeries: Record<string, number[]> | null = createdAgg && startAgg ? {
    revenue: createdAgg.revenue,
    bookings: createdAgg.bookingsCount,
    participants: createdAgg.participants,
    tours: startAgg.toursCount,
    capacity: startAgg.slotsSold,
  } : null
  const utilizationSeries = startAgg ? chartBuckets.map((_, i) => (startAgg.capacity[i] > 0 ? Math.min(100, (startAgg.slotsSold[i] / startAgg.capacity[i]) * 100) : 0)) : []

  // ---------- Tour Performance by Listing ----------
  const listingMap: Record<string, TourInstance[]> = {}
  periodTours.forEach((t) => {
    const key = t.title || 'Untitled tour'
    if (!listingMap[key]) listingMap[key] = []
    listingMap[key].push(t)
  })
  const listingStats = Object.entries(listingMap).map(([name, tInstances]) => {
    const ids = new Set(tInstances.map((t) => t.id))
    const relatedBookings = bookings.filter((b) => b.service_id && ids.has(b.service_id))
    const activeBookings = relatedBookings.filter((b) => b.booking_status !== 'cancelled')
    const cap = sum(tInstances.map((t) => tourCapacity(t, sold[t.id] || 0)))
    const soldForListing = sum(tInstances.map((t) => sold[t.id] || 0))
    const revenue = sum(activeBookings.map((b) => Number(b.amount_paid) || 0))
    return {
      name,
      tours: tInstances.length,
      bookings: relatedBookings.length,
      participants: sum(activeBookings.map((b) => b.quantity || 1)),
      availableCapacity: Math.max(0, cap - soldForListing),
      utilizationPct: cap > 0 ? Math.round(Math.min(100, (soldForListing / cap) * 100)) : 0,
      revenue,
      avgBookingValue: activeBookings.length > 0 ? revenue / activeBookings.length : 0,
      cancellationRate: relatedBookings.length > 0 ? Math.round((relatedBookings.filter((b) => b.booking_status === 'cancelled').length / relatedBookings.length) * 100) : 0,
    }
  }).sort((a, b) => b.revenue - a.revenue)
  const mostBookedListing = listingStats.length > 1 ? listingStats.reduce((a, b) => (b.bookings > a.bookings ? b : a), listingStats[0]) : null
  const highestRevenueListing = listingStats.length > 1 ? listingStats.reduce((a, b) => (b.revenue > a.revenue ? b : a), listingStats[0]) : null

  // ---------- Time Slot Analytics ----------
  const slotMap: Record<string, TourInstance[]> = {}
  periodTours.forEach((t) => {
    if (!t.departure_time) return
    const key = new Date(t.departure_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    if (!slotMap[key]) slotMap[key] = []
    slotMap[key].push(t)
  })
  const slotStats = Object.entries(slotMap).map(([slot, sInstances]) => {
    const ids = new Set(sInstances.map((t) => t.id))
    const sBookings = bookings.filter((b) => b.service_id && ids.has(b.service_id) && b.booking_status !== 'cancelled')
    const cap = sum(sInstances.map((t) => tourCapacity(t, sold[t.id] || 0)))
    const soldForSlot = sum(sInstances.map((t) => sold[t.id] || 0))
    return {
      slot, tours: sInstances.length,
      participants: sum(sBookings.map((b) => b.quantity || 1)),
      revenue: sum(sBookings.map((b) => Number(b.amount_paid) || 0)),
      utilizationPct: cap > 0 ? Math.round(Math.min(100, (soldForSlot / cap) * 100)) : 0,
    }
  }).sort((a, b) => b.participants - a.participants)
  const topVolumeSlot = slotStats.length > 1 ? slotStats.reduce((a, b) => (b.participants > a.participants ? b : a), slotStats[0]) : null
  const topRevenueSlot = slotStats.length > 1 ? slotStats.reduce((a, b) => (b.revenue > a.revenue ? b : a), slotStats[0]) : null

  // ---------- Schedule (today + upcoming) ----------
  const todayStr = now.toISOString().split('T')[0]
  const tomorrowStr = new Date(now.getTime() + DAY_MS).toISOString().split('T')[0]
  const todaysTours = instances.filter((t) => t.departure_time && t.departure_time.split('T')[0] === todayStr)
  const tomorrowsTours = instances.filter((t) => t.departure_time && t.departure_time.split('T')[0] === tomorrowStr)
  const upcomingTours = instances.filter((t) => t.departure_time && new Date(t.departure_time) > now && t.status !== 'inactive')
    .sort((a, b) => new Date(a.departure_time!).getTime() - new Date(b.departure_time!).getTime())

  // ---------- Promotions ----------
  const activePromotions = promotions.filter((p) => p.active)
  const promoBookingsInPeriod = periodBookingsList.filter((b) => b.promotion_id && b.booking_status !== 'cancelled')
  const promoRevenueInPeriod = sum(promoBookingsInPeriod.map((b) => Number(b.amount_paid) || 0))
  const promoParticipantsInPeriod = sum(promoBookingsInPeriod.map((b) => b.quantity || 1))
  const promoStats = promotions.map((p) => {
    const matching = bookings.filter((b) => b.promotion_id === p.id && b.booking_status !== 'cancelled')
    return { ...p, bookingsCount: matching.length, revenue: sum(matching.map((b) => Number(b.amount_paid) || 0)) }
  }).sort((a, b) => b.bookingsCount - a.bookingsCount).slice(0, 6)

  const fmtOrLocked = (v: string) => (financeAllowed ? v : '🔒')

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ padding: '16px 16px 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="arrowLeft" size={20} color={COLORS.text} /></span>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Tour Analytics</h2>
          <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Tours, participants and revenue for your experiences</p>
        </div>
      </div>

      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' as const, marginBottom: '14px', paddingBottom: '2px' }}>
          {RANGE_OPTIONS.map((r) => (
            <span key={r.key} onClick={() => setRange(r.key)}
              style={{ flexShrink: 0, padding: '7px 13px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                background: range === r.key ? COLORS.primary : COLORS.card, color: range === r.key ? 'white' : COLORS.text,
                border: `1px solid ${range === r.key ? COLORS.primary : COLORS.border}` }}>
              {r.label}
            </span>
          ))}
        </div>

        {!financeAllowed && (
          <div style={{ background: COLORS.orangeBg, borderRadius: '10px', padding: '9px 12px', marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', color: COLORS.orange, fontWeight: 600 }}>Financial figures are hidden — you don't have Finance viewing access.</p>
          </div>
        )}

        {/* Primary KPIs */}
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px', marginBottom: '14px' }}>
          <KpiCard label="Total Revenue" value={fmtOrLocked(formatNaira(periodRevenue))}
            delta={`${pctChange(periodRevenue, prevRevenue) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodRevenue, prevRevenue))}% vs previous period`}
            deltaGood={pctChange(periodRevenue, prevRevenue) >= 0} />
          <KpiCard label="Total Bookings" value={periodBookingsCount.toLocaleString()}
            delta={`${pctChange(periodBookingsCount, prevBookingsCount) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodBookingsCount, prevBookingsCount))}% vs previous period`}
            deltaGood={pctChange(periodBookingsCount, prevBookingsCount) >= 0} />
          <KpiCard label="Total Participants" value={periodParticipants.toLocaleString()}
            delta={`${pctChange(periodParticipants, prevParticipants) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodParticipants, prevParticipants))}% vs previous period`}
            deltaGood={pctChange(periodParticipants, prevParticipants) >= 0} />
          <KpiCard label="Total Tours" value={periodTours.length.toLocaleString()} />
          <KpiCard label="Completed Tours" value={periodToursCompleted.toLocaleString()} />
          <KpiCard label="Upcoming Tours" value={periodToursUpcoming.toLocaleString()} />
          <KpiCard label="Capacity Utilization" value={Math.round(periodUtilizationPct) + '%'}
            delta={`${pctChange(periodUtilizationPct, prevUtilizationPct) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodUtilizationPct, prevUtilizationPct))}% vs previous period`}
            deltaGood={pctChange(periodUtilizationPct, prevUtilizationPct) >= 0} />
          <KpiCard label="Avg Booking Value" value={fmtOrLocked(formatNaira(avgBookingValue))} />
          <KpiCard label="Avg Participants / Tour" value={periodTours.length > 0 ? Math.round(periodParticipants / periodTours.length).toLocaleString() : '0'} />
          <KpiCard label="Cancellation Rate" value={cancellationRate + '%'} />
          <KpiCard label="No-show Rate" value={noShowRate + '%'} sub="Estimated" />
        </div>

        {/* Tour Performance trend chart */}
        <SectionCard title="Tour Performance">
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
                { label: 'Participants', value: String(chartSeries.participants[idx]) },
                { label: 'Tours', value: String(chartSeries.tours[idx]) },
                { label: 'Capacity Sold', value: String(chartSeries.capacity[idx]) },
              ]}
            />
          )}
        </SectionCard>

        {/* Capacity Utilization */}
        <SectionCard title="Capacity Utilization">
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const, marginBottom: chartBuckets.length >= 2 ? '14px' : 0 }}>
            <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{Math.round(periodCapacity)}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Total Capacity</p>
            </div>
            <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{periodSlotsSold}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Sold</p>
            </div>
            <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{Math.max(0, Math.round(periodCapacity - periodSlotsSold))}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Available</p>
            </div>
            <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{Math.round(periodUtilizationPct)}%</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Utilization</p>
            </div>
          </div>
          {chartBuckets.length >= 2 && (
            <TrendChart
              buckets={chartBuckets}
              series={utilizationSeries}
              allSeries={{ utilization: utilizationSeries }}
              activeMetric="utilization"
              valueFormatter={(_, v) => Math.round(v) + '%'}
              renderTooltipRows={(idx) => [{ label: 'Utilization', value: Math.round(utilizationSeries[idx]) + '%' }]}
            />
          )}
        </SectionCard>

        {/* Tour Performance (operational) */}
        <SectionCard title="Tour Schedule Summary">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              ['Total Tours', periodTours.length],
              ['Completed', periodToursCompleted],
              ['Upcoming', periodToursUpcoming],
              ['Cancelled', periodToursCancelled],
            ].map(([label, val]) => (
              <div key={label as string} style={{ background: COLORS.bg, borderRadius: '10px', padding: '11px' }}>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{val as number}</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{label as string}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Tour Performance by Listing */}
        <SectionCard title={`Tour Performance by Listing (${listingStats.length})`}>
          {listingStats.length === 0 ? (
            <EmptyNote text="No tour data available for this period." />
          ) : (
            listingStats.map((l, i) => (
              <div key={l.name} style={{ padding: '10px 0', borderBottom: i === listingStats.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' as const, gap: '4px' }}>
                  <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{l.name}</p>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {mostBookedListing?.name === l.name && l.bookings > 0 && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.primary, background: '#E0F2FE', padding: '2px 7px', borderRadius: '6px' }}>Most Booked</span>}
                    {highestRevenueListing?.name === l.name && l.revenue > 0 && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.green, background: COLORS.greenBg, padding: '2px 7px', borderRadius: '6px' }}>Highest Revenue</span>}
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>
                  {l.tours} tours · {l.bookings} bookings · {l.participants} participants · {l.availableCapacity} slots left · {l.utilizationPct}% utilized · {fmtOrLocked(formatNaira(l.revenue))} · {l.cancellationRate}% cancelled
                </p>
              </div>
            ))
          )}
        </SectionCard>

        {/* Participant Analytics */}
        <SectionCard title="Participant Analytics">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{periodParticipants}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Total Participants</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{periodTours.length > 0 ? Math.round(periodParticipants / periodTours.length) : 0}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Avg / Tour</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{availableSlotsNow}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Available Slots (upcoming)</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{periodSlotsSold}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Sold Slots</p></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>Cancelled Participants</span>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.text }}>{sum(periodBookingsList.filter((b) => b.booking_status === 'cancelled').map((b) => b.quantity || 1))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>No-show Participants (estimated)</span>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.text }}>{noShowParticipants}</span>
          </div>
        </SectionCard>

        {/* Revenue Analytics */}
        <SectionCard title="Revenue Analytics">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(periodRevenue))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Total Revenue</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(avgBookingValue))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Avg Booking Value</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(periodTours.length > 0 ? periodRevenue / periodTours.length : 0))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Revenue / Tour</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(periodParticipants > 0 ? periodRevenue / periodParticipants : 0))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Revenue / Participant</p></div>
          </div>
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '10px' }}>See the Revenue tab on Tour Performance above for the trend over time.</p>
        </SectionCard>

        {/* Booking Performance */}
        <SectionCard title="Booking Performance">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              ['Total Bookings', periodBookingsList.length],
              ['Confirmed', confirmedCount],
              ['Completed', periodBookingsList.filter((b) => b.booking_status === 'completed').length],
              ['Cancelled', cancelledBookingsCount],
            ].map(([label, val]) => (
              <div key={label as string} style={{ background: COLORS.bg, borderRadius: '10px', padding: '11px' }}>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{val as number}</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{label as string}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '10px' }}>Traveler.com doesn't currently track a separate "Pending" booking status.</p>
        </SectionCard>

        {/* Cancellation & No-show */}
        <SectionCard title="Cancellation & No-show">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{cancellationRate}%</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Cancellation Rate</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{cancelledBookingsCount}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Cancelled Bookings</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{noShowRate}%</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>No-show Rate (estimated)</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{noShowParticipants}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>No-show Participants</p></div>
          </div>
        </SectionCard>

        {/* Tour Schedule Performance */}
        <SectionCard title="Tour Schedule Performance">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            {[
              ["Today's Tours", todaysTours.length],
              ["Tomorrow's Tours", tomorrowsTours.length],
              ['Upcoming', upcomingTours.length],
              ['Cancelled (period)', periodToursCancelled],
            ].map(([label, val]) => (
              <div key={label as string} style={{ background: COLORS.bg, borderRadius: '10px', padding: '11px' }}>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{val as number}</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{label as string}</p>
              </div>
            ))}
          </div>
          {todaysTours.length === 0 && tomorrowsTours.length === 0 ? (
            <EmptyNote text="No tour data available for this period." />
          ) : (
            [...todaysTours, ...tomorrowsTours].slice(0, 6).map((t, i, arr) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i === 0 ? `1px solid ${COLORS.border}` : 'none', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{t.title || 'Untitled tour'}</p>
                  <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>
                    {t.departure_time ? new Date(t.departure_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'} · {t.meeting_point || 'Meeting point not set'}
                  </p>
                </div>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{sold[t.id] || 0} sold</p>
              </div>
            ))
          )}
        </SectionCard>

        {/* Time Slot Analytics */}
        <SectionCard title="Time Slot Analytics">
          {slotStats.length < 2 ? (
            <EmptyNote text="Not enough distinct time slots yet to compare." />
          ) : (
            slotStats.map((s, i) => (
              <div key={s.slot} style={{ padding: '10px 0', borderBottom: i === slotStats.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' as const, gap: '4px' }}>
                  <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{s.slot}</p>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {topVolumeSlot?.slot === s.slot && s.participants > 0 && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.primary, background: '#E0F2FE', padding: '2px 7px', borderRadius: '6px' }}>Highest Participant Volume</span>}
                    {topRevenueSlot?.slot === s.slot && s.revenue > 0 && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.green, background: COLORS.greenBg, padding: '2px 7px', borderRadius: '6px' }}>Highest Revenue</span>}
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{s.tours} tours · {s.participants} participants · {fmtOrLocked(formatNaira(s.revenue))} · {s.utilizationPct}% utilized</p>
              </div>
            ))
          )}
        </SectionCard>

        {/* Promotion Performance */}
        <SectionCard title="Promotion Performance" action={
          <span onClick={() => navigate('/promotions')} style={{ fontSize: '11px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Manage →</span>
        }>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{activePromotions.length}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Active Promotions</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{promoBookingsInPeriod.length}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Bookings from Promotions</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{promoParticipantsInPeriod}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Participants from Promotions</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(promoRevenueInPeriod))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Revenue from Promotions</p></div>
          </div>
          {promoStats.length === 0 ? (
            <EmptyNote text="No promotions created yet." />
          ) : (
            promoStats.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderTop: i === 0 ? `1px solid ${COLORS.border}` : 'none', borderBottom: i === promoStats.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{p.title}</p>
                  <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>{p.services?.title || '—'} · {p.active ? 'Active' : 'Inactive'} · Usage {p.bookingsCount}/{p.usage_limit ?? '∞'}</p>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{p.bookingsCount}</p>
                  <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{fmtOrLocked(formatNaira(p.revenue))}</p>
                </div>
              </div>
            ))
          )}
        </SectionCard>
      </div>
    </div>
  )
}
