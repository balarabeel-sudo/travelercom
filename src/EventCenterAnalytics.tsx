import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import {
  COLORS, DAY_MS, RangeKey, RANGE_OPTIONS, windowForRange, Bucket, buildBuckets,
  sum, pctChange, formatNaira, formatCompactNaira, KpiCard, SectionCard, EmptyNote, TrendChart,
} from './AnalyticsUI'

// ---------- Types ----------
type EventBooking = {
  id: string
  created_at: string
  booking_status: string
  amount_paid: number
  quantity: number
  promotion_id: string | null
  service_id: string | null
}

// Each row is one scheduled instance of a venue/hall listing (a specific
// event date + time slot). Traveler.com has no separate "venues" master
// table — a venue is the set of instances that share the same title.
type EventInstance = {
  id: string
  title: string | null
  destination: string | null
  event_type: string | null
  departure_time: string | null // event start
  arrival_time: string | null   // event end
  price: number
  capacity: number | null
  seats_available: number | null
  max_guests: number | null
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

type MetricKey = 'revenue' | 'bookings' | 'events' | 'attendees' | 'utilization'
const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'events', label: 'Events' },
  { key: 'attendees', label: 'Attendees' },
  { key: 'utilization', label: 'Venue Utilization' },
]

function formatMetricValue(key: string, v: number) {
  if (key === 'revenue') return formatCompactNaira(v)
  if (key === 'utilization') return Math.round(v) + '%'
  return Math.round(v).toLocaleString()
}

// An event instance is "cancelled" if its listing was deactivated (status=
// 'inactive'); otherwise "completed" once its start time has passed, or
// "upcoming". No dedicated event-cancellation status exists separate from
// the listing's active/inactive flag.
function eventState(t: EventInstance, now: Date): 'completed' | 'cancelled' | 'upcoming' {
  if (t.status === 'inactive') return 'cancelled'
  if (t.departure_time && new Date(t.departure_time) <= now) return 'completed'
  return 'upcoming'
}

function bookedCountMap(bookings: EventBooking[]): Record<string, number> {
  const map: Record<string, number> = {}
  bookings.forEach((b) => {
    if (b.booking_status !== 'cancelled' && b.service_id) {
      map[b.service_id] = (map[b.service_id] || 0) + (b.quantity || 1)
    }
  })
  return map
}
// Venue capacity: prefer max_guests (the hall's real guest capacity) since
// that's the most meaningful denominator for "Venue Utilization"; fall back
// to capacity, then to booked+available as a last resort — same
// derivation approach used for Hotel/Bus/Tour.
function venueCapacity(t: EventInstance, sold: number) {
  return t.max_guests ?? t.capacity ?? ((t.seats_available || 0) + sold)
}

// ---------- Aggregation: booking-creation-date attribution ----------
function aggregateByCreated(bookings: EventBooking[], buckets: { start: Date; end: Date }[]) {
  const n = buckets.length
  const revenue = new Array(n).fill(0)
  const bookingsCount = new Array(n).fill(0)
  const attendees = new Array(n).fill(0)
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
      attendees[idx] += b.quantity || 1
    }
  })
  return { revenue, bookingsCount, attendees }
}

// ---------- Aggregation: event-start-date attribution ----------
function aggregateByStart(instances: EventInstance[], sold: Record<string, number>, buckets: { start: Date; end: Date }[]) {
  const n = buckets.length
  const eventsCount = new Array(n).fill(0)
  const bookedGuests = new Array(n).fill(0)
  const capacity = new Array(n).fill(0)
  const indexFor = (d: Date) => {
    for (let i = 0; i < n; i++) if (d >= buckets[i].start && d < buckets[i].end) return i
    return -1
  }
  instances.forEach((t) => {
    if (!t.departure_time) return
    const idx = indexFor(new Date(t.departure_time))
    if (idx < 0) return
    eventsCount[idx] += 1
    const s = sold[t.id] || 0
    bookedGuests[idx] += s
    capacity[idx] += venueCapacity(t, s)
  })
  return { eventsCount, bookedGuests, capacity }
}

// ---------- Main component ----------
export default function EventCenterAnalytics({ companyId, isOwner }: { companyId: string; isOwner: boolean }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [bookings, setBookings] = useState<EventBooking[]>([])
  const [instances, setInstances] = useState<EventInstance[]>([])
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
      .select('id, created_at, booking_status, amount_paid, quantity, promotion_id, service_id')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })

    if (bookingErr) { setErrorMsg('Could not load booking data: ' + bookingErr.message); setLoading(false); return }

    const { data: instanceRows, error: instanceErr } = await supabase
      .from('services')
      .select('id, title, destination, event_type, departure_time, arrival_time, price, capacity, seats_available, max_guests, status, created_at')
      .eq('company_id', companyId)
      .eq('category', 'event_center')
      .order('departure_time', { ascending: false })

    if (instanceErr) { setErrorMsg('Could not load event data: ' + instanceErr.message); setLoading(false); return }

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
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Event Center Analytics</h2>
        </div>
        <div style={{ background: COLORS.redBg, borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
          <p style={{ fontSize: '13px', color: COLORS.red }}>Unable to load event center analytics.</p>
        </div>
        <span onClick={load} style={{ display: 'inline-block', padding: '10px 16px', background: COLORS.primary, color: 'white', borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Try Again</span>
      </div>
    )
  }

  const now = new Date()
  const { start: periodStart, end: periodEnd } = windowForRange(range, now)
  const prevStart = new Date(periodStart.getTime() - (periodEnd.getTime() - periodStart.getTime()))
  const prevEnd = periodStart

  const sold = bookedCountMap(bookings)

  const periodBookingsList = bookings.filter((b) => { const d = new Date(b.created_at); return d >= periodStart && d < periodEnd })
  const prevBookingsList = bookings.filter((b) => { const d = new Date(b.created_at); return d >= prevStart && d < prevEnd })
  const periodEvents = instances.filter((t) => t.departure_time && new Date(t.departure_time) >= periodStart && new Date(t.departure_time) < periodEnd)
  const prevEvents = instances.filter((t) => t.departure_time && new Date(t.departure_time) >= prevStart && new Date(t.departure_time) < prevEnd)

  const periodRevenue = sum(periodBookingsList.filter((b) => b.booking_status !== 'cancelled').map((b) => Number(b.amount_paid) || 0))
  const prevRevenue = sum(prevBookingsList.filter((b) => b.booking_status !== 'cancelled').map((b) => Number(b.amount_paid) || 0))
  const periodAttendees = sum(periodBookingsList.filter((b) => b.booking_status !== 'cancelled').map((b) => b.quantity || 1))
  const prevAttendees = sum(prevBookingsList.filter((b) => b.booking_status !== 'cancelled').map((b) => b.quantity || 1))
  const periodBookingsCount = periodBookingsList.length
  const prevBookingsCount = prevBookingsList.length

  const periodEventsCompleted = periodEvents.filter((t) => eventState(t, now) === 'completed').length
  const periodEventsCancelled = periodEvents.filter((t) => eventState(t, now) === 'cancelled').length
  const periodEventsUpcoming = periodEvents.filter((t) => eventState(t, now) === 'upcoming').length

  const periodBookedGuests = sum(periodEvents.map((t) => sold[t.id] || 0))
  const periodCapacity = sum(periodEvents.map((t) => venueCapacity(t, sold[t.id] || 0)))
  const periodUtilizationPct = periodCapacity > 0 ? Math.min(100, (periodBookedGuests / periodCapacity) * 100) : 0
  const prevBookedGuests = sum(prevEvents.map((t) => sold[t.id] || 0))
  const prevCapacity = sum(prevEvents.map((t) => venueCapacity(t, sold[t.id] || 0)))
  const prevUtilizationPct = prevCapacity > 0 ? Math.min(100, (prevBookedGuests / prevCapacity) * 100) : 0

  const cancelledBookingsCount = periodBookingsList.filter((b) => b.booking_status === 'cancelled').length
  const cancellationRate = periodBookingsList.length > 0 ? Math.round((cancelledBookingsCount / periodBookingsList.length) * 100) : 0
  const avgBookingValue = periodBookingsCount > 0 ? periodRevenue / periodBookingsCount : 0

  const chartBuckets = range === 'today' ? [] : buildBuckets(range, now)
  const createdAgg = chartBuckets.length > 0 ? aggregateByCreated(bookings, chartBuckets) : null
  const startAgg = chartBuckets.length > 0 ? aggregateByStart(instances, sold, chartBuckets) : null
  const chartSeries: Record<string, number[]> | null = createdAgg && startAgg ? {
    revenue: createdAgg.revenue,
    bookings: createdAgg.bookingsCount,
    attendees: createdAgg.attendees,
    events: startAgg.eventsCount,
    utilization: chartBuckets.map((_, i) => (startAgg.capacity[i] > 0 ? Math.min(100, (startAgg.bookedGuests[i] / startAgg.capacity[i]) * 100) : 0)),
  } : null

  // ---------- Venue Performance (group by listing title) ----------
  const venueMap: Record<string, EventInstance[]> = {}
  periodEvents.forEach((t) => {
    const key = t.title || 'Untitled venue'
    if (!venueMap[key]) venueMap[key] = []
    venueMap[key].push(t)
  })
  const venueStats = Object.entries(venueMap).map(([name, vInstances]) => {
    const ids = new Set(vInstances.map((t) => t.id))
    const relatedBookings = bookings.filter((b) => b.service_id && ids.has(b.service_id))
    const activeBookings = relatedBookings.filter((b) => b.booking_status !== 'cancelled')
    const cap = sum(vInstances.map((t) => venueCapacity(t, sold[t.id] || 0)))
    const soldForVenue = sum(vInstances.map((t) => sold[t.id] || 0))
    const revenue = sum(activeBookings.map((b) => Number(b.amount_paid) || 0))
    return {
      name,
      events: vInstances.length,
      bookings: relatedBookings.length,
      capacity: Math.round(cap),
      utilizationPct: cap > 0 ? Math.round(Math.min(100, (soldForVenue / cap) * 100)) : 0,
      revenue,
      avgBookingValue: activeBookings.length > 0 ? revenue / activeBookings.length : 0,
      cancellationRate: relatedBookings.length > 0 ? Math.round((relatedBookings.filter((b) => b.booking_status === 'cancelled').length / relatedBookings.length) * 100) : 0,
    }
  }).sort((a, b) => b.revenue - a.revenue)
  const mostBookedVenue = venueStats.length > 1 ? venueStats.reduce((a, b) => (b.bookings > a.bookings ? b : a), venueStats[0]) : null
  const highestRevenueVenue = venueStats.length > 1 ? venueStats.reduce((a, b) => (b.revenue > a.revenue ? b : a), venueStats[0]) : null

  // ---------- Event Type Performance ----------
  const typeMap: Record<string, EventInstance[]> = {}
  periodEvents.forEach((t) => {
    const key = t.event_type || 'Not specified'
    if (!typeMap[key]) typeMap[key] = []
    typeMap[key].push(t)
  })
  const typeStats = Object.entries(typeMap).map(([type, tInstances]) => {
    const ids = new Set(tInstances.map((t) => t.id))
    const tBookings = bookings.filter((b) => b.service_id && ids.has(b.service_id) && b.booking_status !== 'cancelled')
    const cap = sum(tInstances.map((t) => venueCapacity(t, sold[t.id] || 0)))
    const soldForType = sum(tInstances.map((t) => sold[t.id] || 0))
    return {
      type, events: tInstances.length,
      bookings: tBookings.length,
      revenue: sum(tBookings.map((b) => Number(b.amount_paid) || 0)),
      utilizationPct: cap > 0 ? Math.round(Math.min(100, (soldForType / cap) * 100)) : 0,
    }
  }).sort((a, b) => b.revenue - a.revenue)

  // ---------- Time Slot Analytics ----------
  const slotMap: Record<string, EventInstance[]> = {}
  periodEvents.forEach((t) => {
    if (!t.departure_time) return
    const key = new Date(t.departure_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    if (!slotMap[key]) slotMap[key] = []
    slotMap[key].push(t)
  })
  const slotStats = Object.entries(slotMap).map(([slot, sInstances]) => {
    const ids = new Set(sInstances.map((t) => t.id))
    const sBookings = bookings.filter((b) => b.service_id && ids.has(b.service_id) && b.booking_status !== 'cancelled')
    const cap = sum(sInstances.map((t) => venueCapacity(t, sold[t.id] || 0)))
    const soldForSlot = sum(sInstances.map((t) => sold[t.id] || 0))
    return {
      slot, events: sInstances.length,
      bookings: sBookings.length,
      revenue: sum(sBookings.map((b) => Number(b.amount_paid) || 0)),
      utilizationPct: cap > 0 ? Math.round(Math.min(100, (soldForSlot / cap) * 100)) : 0,
    }
  }).sort((a, b) => b.bookings - a.bookings)
  const topVolumeSlot = slotStats.length > 1 ? slotStats.reduce((a, b) => (b.bookings > a.bookings ? b : a), slotStats[0]) : null
  const topRevenueSlot = slotStats.length > 1 ? slotStats.reduce((a, b) => (b.revenue > a.revenue ? b : a), slotStats[0]) : null
  const topUtilSlot = slotStats.length > 1 ? slotStats.reduce((a, b) => (b.utilizationPct > a.utilizationPct ? b : a), slotStats[0]) : null

  // ---------- Schedule (today + tomorrow + upcoming) ----------
  const todayStr = now.toISOString().split('T')[0]
  const tomorrowStr = new Date(now.getTime() + DAY_MS).toISOString().split('T')[0]
  const todaysEvents = instances.filter((t) => t.departure_time && t.departure_time.split('T')[0] === todayStr)
  const tomorrowsEvents = instances.filter((t) => t.departure_time && t.departure_time.split('T')[0] === tomorrowStr)
  const upcomingEvents = instances.filter((t) => t.departure_time && new Date(t.departure_time) > now && t.status !== 'inactive')

  // ---------- Customer Analytics ----------
  // "Customer" here means the booking user; Traveler.com's bookings table
  // doesn't expose a joinable customer identity to this component beyond
  // the booking row itself, so unique/repeat customers aren't calculable
  // here without a user_id column on bookings — flagged rather than guessed.

  // ---------- Promotions ----------
  const activePromotions = promotions.filter((p) => p.active)
  const promoBookingsInPeriod = periodBookingsList.filter((b) => b.promotion_id && b.booking_status !== 'cancelled')
  const promoRevenueInPeriod = sum(promoBookingsInPeriod.map((b) => Number(b.amount_paid) || 0))
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
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Event Center Analytics</h2>
          <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Venues, events and revenue for your center</p>
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
          <KpiCard label="Total Events" value={periodEvents.length.toLocaleString()} />
          <KpiCard label="Upcoming Events" value={periodEventsUpcoming.toLocaleString()} />
          <KpiCard label="Completed Events" value={periodEventsCompleted.toLocaleString()} />
          <KpiCard label="Total Attendees" value={periodAttendees.toLocaleString()}
            delta={`${pctChange(periodAttendees, prevAttendees) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodAttendees, prevAttendees))}% vs previous period`}
            deltaGood={pctChange(periodAttendees, prevAttendees) >= 0} sub="Sum of guests per booking" />
          <KpiCard label="Venue Utilization" value={Math.round(periodUtilizationPct) + '%'}
            delta={`${pctChange(periodUtilizationPct, prevUtilizationPct) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodUtilizationPct, prevUtilizationPct))}% vs previous period`}
            deltaGood={pctChange(periodUtilizationPct, prevUtilizationPct) >= 0} />
          <KpiCard label="Avg Booking Value" value={fmtOrLocked(formatNaira(avgBookingValue))} />
          <KpiCard label="Cancellation Rate" value={cancellationRate + '%'} />
        </div>

        {/* Event Performance trend chart */}
        <SectionCard title="Event Performance">
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
                { label: 'Events', value: String(chartSeries.events[idx]) },
                { label: 'Attendees', value: String(chartSeries.attendees[idx]) },
                { label: 'Venue Utilization', value: Math.round(chartSeries.utilization[idx]) + '%' },
              ]}
            />
          )}
        </SectionCard>

        {/* Venue Capacity */}
        <SectionCard title="Venue Capacity">
          {periodCapacity === 0 ? (
            <EmptyNote text="Venue capacity data is not available yet." />
          ) : (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const }}>
              <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
                <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{Math.round(periodCapacity)}</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Total Capacity</p>
              </div>
              <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
                <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{periodBookedGuests}</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Expected / Booked</p>
              </div>
              <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
                <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{Math.max(0, Math.round(periodCapacity - periodBookedGuests))}</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Available</p>
              </div>
              <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
                <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{Math.round(periodUtilizationPct)}%</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Utilization</p>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Event Performance summary */}
        <SectionCard title="Event Performance Summary">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              ['Total Events', periodEvents.length],
              ['Completed', periodEventsCompleted],
              ['Upcoming', periodEventsUpcoming],
              ['Cancelled', periodEventsCancelled],
            ].map(([label, val]) => (
              <div key={label as string} style={{ background: COLORS.bg, borderRadius: '10px', padding: '11px' }}>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{val as number}</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{label as string}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Venue Performance */}
        <SectionCard title={`Venue Performance (${venueStats.length})`}>
          {venueStats.length === 0 ? (
            <EmptyNote text="No venue data available yet." />
          ) : (
            venueStats.map((v, i) => (
              <div key={v.name} style={{ padding: '10px 0', borderBottom: i === venueStats.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' as const, gap: '4px' }}>
                  <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{v.name}</p>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {mostBookedVenue?.name === v.name && v.bookings > 0 && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.primary, background: '#E0F2FE', padding: '2px 7px', borderRadius: '6px' }}>Most Booked</span>}
                    {highestRevenueVenue?.name === v.name && v.revenue > 0 && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.green, background: COLORS.greenBg, padding: '2px 7px', borderRadius: '6px' }}>Highest Revenue</span>}
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>
                  {v.events} events · {v.bookings} bookings · {v.capacity} capacity · {v.utilizationPct}% utilized · {fmtOrLocked(formatNaira(v.revenue))} · {v.cancellationRate}% cancelled
                </p>
              </div>
            ))
          )}
        </SectionCard>

        {/* Revenue Analytics */}
        <SectionCard title="Revenue Analytics">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(periodRevenue))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Total Revenue</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(avgBookingValue))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Avg Booking Value</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(periodEvents.length > 0 ? periodRevenue / periodEvents.length : 0))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Revenue / Event</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(venueStats.length > 0 ? periodRevenue / venueStats.length : 0))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Revenue / Venue</p></div>
          </div>
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '10px' }}>See the Revenue tab on Event Performance above for the trend over time.</p>
        </SectionCard>

        {/* Booking Performance */}
        <SectionCard title="Booking Performance">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              ['Total Bookings', periodBookingsList.length],
              ['Confirmed', periodBookingsList.filter((b) => b.booking_status === 'confirmed').length],
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

        {/* Customer Analytics */}
        <SectionCard title="Customer Analytics">
          <EmptyNote text="Customer identity isn't linked to bookings in a way this page can read yet, so unique/repeat customer counts aren't available. Flagging this as a data-architecture gap rather than estimating it." />
        </SectionCard>

        {/* Cancellation Performance */}
        <SectionCard title="Cancellation Performance">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{cancellationRate}%</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Cancellation Rate</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{cancelledBookingsCount}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Cancelled Bookings</p></div>
          </div>
        </SectionCard>

        {/* Event Schedule Performance */}
        <SectionCard title="Event Schedule Performance">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            {[
              ["Today's Events", todaysEvents.length],
              ["Tomorrow's Events", tomorrowsEvents.length],
              ['Upcoming', upcomingEvents.length],
              ['Cancelled (period)', periodEventsCancelled],
            ].map(([label, val]) => (
              <div key={label as string} style={{ background: COLORS.bg, borderRadius: '10px', padding: '11px' }}>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{val as number}</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{label as string}</p>
              </div>
            ))}
          </div>
          {todaysEvents.length === 0 && tomorrowsEvents.length === 0 ? (
            <EmptyNote text="No event data available for this period." />
          ) : (
            [...todaysEvents, ...tomorrowsEvents].slice(0, 6).map((t, i, arr) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i === 0 ? `1px solid ${COLORS.border}` : 'none', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{t.title || 'Untitled venue'}</p>
                  <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>
                    {t.departure_time ? new Date(t.departure_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    {t.arrival_time ? ` – ${new Date(t.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''} · {t.event_type || 'Type not set'}
                  </p>
                </div>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{sold[t.id] || 0} booked</p>
              </div>
            ))
          )}
        </SectionCard>

        {/* Event Type Performance */}
        <SectionCard title="Event Type Performance">
          {typeStats.length === 0 ? (
            <EmptyNote text="No event data available for this period." />
          ) : (
            typeStats.map((t, i) => (
              <div key={t.type} style={{ padding: '10px 0', borderBottom: i === typeStats.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
                <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{t.type}</p>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{t.events} events · {t.bookings} bookings · {fmtOrLocked(formatNaira(t.revenue))} · {t.utilizationPct}% utilized</p>
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
                    {topVolumeSlot?.slot === s.slot && s.bookings > 0 && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.primary, background: '#E0F2FE', padding: '2px 7px', borderRadius: '6px' }}>Highest Booking Volume</span>}
                    {topRevenueSlot?.slot === s.slot && s.revenue > 0 && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.green, background: COLORS.greenBg, padding: '2px 7px', borderRadius: '6px' }}>Highest Revenue</span>}
                    {topUtilSlot?.slot === s.slot && s.utilizationPct > 0 && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.orange, background: COLORS.orangeBg, padding: '2px 7px', borderRadius: '6px' }}>Highest Venue Utilization</span>}
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{s.events} events · {s.bookings} bookings · {fmtOrLocked(formatNaira(s.revenue))} · {s.utilizationPct}% utilized</p>
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
