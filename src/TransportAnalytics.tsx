import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import {
  COLORS, DAY_MS, RangeKey, RANGE_OPTIONS, windowForRange, Bucket, buildBuckets,
  sum, pctChange, formatNaira, formatCompactNaira, KpiCard, SectionCard, EmptyNote, TrendChart,
} from './AnalyticsUI'

// ---------- Types ----------
type TransportBooking = {
  id: string
  created_at: string
  booking_status: string
  amount_paid: number
  quantity: number
  checked_in: boolean
  promotion_id: string | null
  service_id: string | null
}

type Trip = {
  id: string
  title: string | null
  origin: string | null
  destination: string | null
  departure_time: string | null
  arrival_time: string | null
  price: number
  capacity: number | null
  seats_available: number | null
  vehicle_info: string | null
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

type MetricKey = 'revenue' | 'bookings' | 'passengers' | 'trips' | 'seats'
const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'passengers', label: 'Passengers' },
  { key: 'trips', label: 'Trips' },
  { key: 'seats', label: 'Seats' },
]

function formatMetricValue(key: string, v: number) {
  if (key === 'revenue') return formatCompactNaira(v)
  return Math.round(v).toLocaleString()
}

// A trip is "cancelled" if its listing was deactivated (status='inactive');
// otherwise it's "completed" once departure has passed, or "upcoming" if not.
// Traveler.com doesn't have a dedicated trip-cancellation status separate
// from the listing's active/inactive flag, so this is the best real signal
// available rather than an invented one.
function tripState(t: Trip, now: Date): 'completed' | 'cancelled' | 'upcoming' {
  if (t.status === 'inactive') return 'cancelled'
  if (t.departure_time && new Date(t.departure_time) <= now) return 'completed'
  return 'upcoming'
}

function seatsSoldMap(bookings: TransportBooking[]): Record<string, number> {
  const map: Record<string, number> = {}
  bookings.forEach((b) => {
    if (b.booking_status !== 'cancelled' && b.service_id) {
      map[b.service_id] = (map[b.service_id] || 0) + (b.quantity || 1)
    }
  })
  return map
}
function tripCapacity(t: Trip, sold: number) {
  return t.capacity ?? ((t.seats_available || 0) + sold)
}

// ---------- Aggregation: booking-creation-date attribution (Revenue/Bookings/Passengers) ----------
function aggregateByCreated(bookings: TransportBooking[], buckets: { start: Date; end: Date }[]) {
  const n = buckets.length
  const revenue = new Array(n).fill(0)
  const bookingsCount = new Array(n).fill(0)
  const passengers = new Array(n).fill(0)
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
      passengers[idx] += b.quantity || 1
    }
  })
  return { revenue, bookingsCount, passengers }
}

// ---------- Aggregation: trip-departure-date attribution (Trips/Seats/Occupancy) ----------
function aggregateByDeparture(trips: Trip[], sold: Record<string, number>, buckets: { start: Date; end: Date }[]) {
  const n = buckets.length
  const tripsCount = new Array(n).fill(0)
  const seatsSold = new Array(n).fill(0)
  const capacity = new Array(n).fill(0)
  const indexFor = (d: Date) => {
    for (let i = 0; i < n; i++) if (d >= buckets[i].start && d < buckets[i].end) return i
    return -1
  }
  trips.forEach((t) => {
    if (!t.departure_time) return
    const idx = indexFor(new Date(t.departure_time))
    if (idx < 0) return
    tripsCount[idx] += 1
    const s = sold[t.id] || 0
    seatsSold[idx] += s
    capacity[idx] += tripCapacity(t, s)
  })
  return { tripsCount, seatsSold, capacity }
}

// ---------- Main component ----------
export default function TransportAnalytics({ companyId, isOwner, category }: { companyId: string; isOwner: boolean; category: string }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [bookings, setBookings] = useState<TransportBooking[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
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

    const { data: tripRows, error: tripErr } = await supabase
      .from('services')
      .select('id, title, origin, destination, departure_time, arrival_time, price, capacity, seats_available, vehicle_info, status, created_at')
      .eq('company_id', companyId)
      .eq('category', category)
      .order('departure_time', { ascending: false })

    if (tripErr) { setErrorMsg('Could not load trip data: ' + tripErr.message); setLoading(false); return }

    const { data: promoRows } = await supabase
      .from('promotions')
      .select('id, service_id, title, discount_type, discount_value, active, usage_limit, services(title)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    setBookings((bookingRows || []) as any)
    setTrips((tripRows || []) as any)
    setPromotions((promoRows || []) as any)
    setLoading(false)
  }

  useEffect(() => { load() }, [companyId, isOwner, category]) // eslint-disable-line react-hooks/exhaustive-deps

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
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Transport Analytics</h2>
        </div>
        <div style={{ background: COLORS.redBg, borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
          <p style={{ fontSize: '13px', color: COLORS.red }}>Unable to load transport analytics.</p>
        </div>
        <span onClick={load} style={{ display: 'inline-block', padding: '10px 16px', background: COLORS.primary, color: 'white', borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Try Again</span>
      </div>
    )
  }

  const now = new Date()
  const { start: periodStart, end: periodEnd } = windowForRange(range, now)
  const prevStart = new Date(periodStart.getTime() - (periodEnd.getTime() - periodStart.getTime()))
  const prevEnd = periodStart

  const sold = seatsSoldMap(bookings)

  const periodBookingsList = bookings.filter((b) => { const d = new Date(b.created_at); return d >= periodStart && d < periodEnd })
  const prevBookingsList = bookings.filter((b) => { const d = new Date(b.created_at); return d >= prevStart && d < prevEnd })
  const periodTrips = trips.filter((t) => t.departure_time && new Date(t.departure_time) >= periodStart && new Date(t.departure_time) < periodEnd)
  const prevTrips = trips.filter((t) => t.departure_time && new Date(t.departure_time) >= prevStart && new Date(t.departure_time) < prevEnd)

  const periodRevenue = sum(periodBookingsList.filter((b) => b.booking_status !== 'cancelled').map((b) => Number(b.amount_paid) || 0))
  const prevRevenue = sum(prevBookingsList.filter((b) => b.booking_status !== 'cancelled').map((b) => Number(b.amount_paid) || 0))
  const periodPassengers = sum(periodBookingsList.filter((b) => b.booking_status !== 'cancelled').map((b) => b.quantity || 1))
  const prevPassengers = sum(prevBookingsList.filter((b) => b.booking_status !== 'cancelled').map((b) => b.quantity || 1))
  const periodBookingsCount = periodBookingsList.length
  const prevBookingsCount = prevBookingsList.length

  const periodTripsCompleted = periodTrips.filter((t) => tripState(t, now) === 'completed').length
  const periodTripsCancelled = periodTrips.filter((t) => tripState(t, now) === 'cancelled').length
  const periodTripsUpcoming = periodTrips.filter((t) => tripState(t, now) === 'upcoming').length

  const periodSeatsSold = sum(periodTrips.map((t) => sold[t.id] || 0))
  const periodCapacity = sum(periodTrips.map((t) => tripCapacity(t, sold[t.id] || 0)))
  const periodOccupancyPct = periodCapacity > 0 ? Math.min(100, (periodSeatsSold / periodCapacity) * 100) : 0
  const prevSeatsSold = sum(prevTrips.map((t) => sold[t.id] || 0))
  const prevCapacity = sum(prevTrips.map((t) => tripCapacity(t, sold[t.id] || 0)))
  const prevOccupancyPct = prevCapacity > 0 ? Math.min(100, (prevSeatsSold / prevCapacity) * 100) : 0

  const availableSeatsNow = sum(trips.filter((t) => tripState(t, now) === 'upcoming').map((t) => t.seats_available ?? 0))

  const cancelledBookingsCount = periodBookingsList.filter((b) => b.booking_status === 'cancelled').length
  const cancellationRate = periodBookingsList.length > 0 ? Math.round((cancelledBookingsCount / periodBookingsList.length) * 100) : 0
  const avgTicketPrice = periodPassengers > 0 ? periodRevenue / periodPassengers : 0

  // No-show: derived from checked_in status on bookings whose trip has already departed.
  // Traveler.com doesn't track a dedicated no-show status, so this is an estimate.
  const tripById: Record<string, Trip> = {}
  trips.forEach((t) => { tripById[t.id] = t })
  const noShowBookings = periodBookingsList.filter((b) => {
    if (b.booking_status !== 'confirmed' || !b.service_id) return false
    const t = tripById[b.service_id]
    return t?.departure_time && new Date(t.departure_time) < now && !b.checked_in
  })
  const noShowPassengers = sum(noShowBookings.map((b) => b.quantity || 1))
  const confirmedCount = periodBookingsList.filter((b) => b.booking_status === 'confirmed').length
  const noShowRate = confirmedCount > 0 ? Math.round((noShowBookings.length / confirmedCount) * 100) : 0

  const chartBuckets = range === 'today' ? [] : buildBuckets(range, now)
  const createdAgg = chartBuckets.length > 0 ? aggregateByCreated(bookings, chartBuckets) : null
  const departureAgg = chartBuckets.length > 0 ? aggregateByDeparture(trips, sold, chartBuckets) : null
  const chartSeries: Record<string, number[]> | null = createdAgg && departureAgg ? {
    revenue: createdAgg.revenue,
    bookings: createdAgg.bookingsCount,
    passengers: createdAgg.passengers,
    trips: departureAgg.tripsCount,
    seats: departureAgg.seatsSold,
  } : null
  const occupancySeries = departureAgg ? chartBuckets.map((_, i) => (departureAgg.capacity[i] > 0 ? Math.min(100, (departureAgg.seatsSold[i] / departureAgg.capacity[i]) * 100) : 0)) : []

  // ---------- Route Performance ----------
  const routeMap: Record<string, Trip[]> = {}
  periodTrips.forEach((t) => {
    const key = `${t.origin || '—'} → ${t.destination || '—'}`
    if (!routeMap[key]) routeMap[key] = []
    routeMap[key].push(t)
  })
  const routeStats = Object.entries(routeMap).map(([route, routeTrips]) => {
    const tripIds = new Set(routeTrips.map((t) => t.id))
    const routeBookings = bookings.filter((b) => b.service_id && tripIds.has(b.service_id))
    const activeBookings = routeBookings.filter((b) => b.booking_status !== 'cancelled')
    const cap = sum(routeTrips.map((t) => tripCapacity(t, sold[t.id] || 0)))
    const soldForRoute = sum(routeTrips.map((t) => sold[t.id] || 0))
    return {
      route,
      trips: routeTrips.length,
      bookings: routeBookings.length,
      passengers: sum(activeBookings.map((b) => b.quantity || 1)),
      seatsSold: soldForRoute,
      occupancyPct: cap > 0 ? Math.round(Math.min(100, (soldForRoute / cap) * 100)) : 0,
      revenue: sum(activeBookings.map((b) => Number(b.amount_paid) || 0)),
      cancellationRate: routeBookings.length > 0 ? Math.round((routeBookings.filter((b) => b.booking_status === 'cancelled').length / routeBookings.length) * 100) : 0,
    }
  }).sort((a, b) => b.revenue - a.revenue)
  const highestRevenueRoute = routeStats.length > 1 ? routeStats.reduce((a, b) => (b.revenue > a.revenue ? b : a), routeStats[0]) : null
  const mostBookedRoute = routeStats.length > 1 ? routeStats.reduce((a, b) => (b.bookings > a.bookings ? b : a), routeStats[0]) : null
  const highestOccupancyRoute = routeStats.length > 1 ? routeStats.reduce((a, b) => (b.occupancyPct > a.occupancyPct ? b : a), routeStats[0]) : null

  // ---------- Vehicle Performance ----------
  const vehicleMap: Record<string, Trip[]> = {}
  periodTrips.forEach((t) => {
    const key = (t.vehicle_info || '').trim()
    if (!key) return
    if (!vehicleMap[key]) vehicleMap[key] = []
    vehicleMap[key].push(t)
  })
  const vehicleStats = Object.entries(vehicleMap).map(([vehicle, vTrips]) => {
    const tripIds = new Set(vTrips.map((t) => t.id))
    const vBookings = bookings.filter((b) => b.service_id && tripIds.has(b.service_id) && b.booking_status !== 'cancelled')
    const cap = sum(vTrips.map((t) => tripCapacity(t, sold[t.id] || 0)))
    const soldForV = sum(vTrips.map((t) => sold[t.id] || 0))
    return {
      vehicle, trips: vTrips.length,
      passengers: sum(vBookings.map((b) => b.quantity || 1)),
      revenue: sum(vBookings.map((b) => Number(b.amount_paid) || 0)),
      occupancyPct: cap > 0 ? Math.round(Math.min(100, (soldForV / cap) * 100)) : 0,
    }
  }).sort((a, b) => b.revenue - a.revenue)

  // ---------- Departures list (today + next upcoming) ----------
  const todayStr = now.toISOString().split('T')[0]
  const todaysDepartures = trips.filter((t) => t.departure_time && t.departure_time.split('T')[0] === todayStr)
  const upcomingDepartures = trips.filter((t) => t.departure_time && new Date(t.departure_time) > now && t.status !== 'inactive')
    .sort((a, b) => new Date(a.departure_time!).getTime() - new Date(b.departure_time!).getTime())

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
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Transport Analytics</h2>
          <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Trips, routes and revenue for your fleet</p>
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
          <KpiCard label="Total Passengers" value={periodPassengers.toLocaleString()}
            delta={`${pctChange(periodPassengers, prevPassengers) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodPassengers, prevPassengers))}% vs previous period`}
            deltaGood={pctChange(periodPassengers, prevPassengers) >= 0} />
          <KpiCard label="Total Trips" value={periodTrips.length.toLocaleString()} />
          <KpiCard label="Seat Occupancy" value={Math.round(periodOccupancyPct) + '%'}
            delta={`${pctChange(periodOccupancyPct, prevOccupancyPct) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodOccupancyPct, prevOccupancyPct))}% vs previous period`}
            deltaGood={pctChange(periodOccupancyPct, prevOccupancyPct) >= 0} />
          <KpiCard label="Seats Sold" value={periodSeatsSold.toLocaleString()} />
          <KpiCard label="Available Seats" value={availableSeatsNow.toLocaleString()} sub="Across upcoming trips" />
          <KpiCard label="Avg Ticket Price" value={fmtOrLocked(formatNaira(avgTicketPrice))} />
          <KpiCard label="Cancellation Rate" value={cancellationRate + '%'} />
          <KpiCard label="No-show Rate" value={noShowRate + '%'} sub="Estimated" />
        </div>

        {/* Transport Performance trend chart */}
        <SectionCard title="Transport Performance">
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
                { label: 'Passengers', value: String(chartSeries.passengers[idx]) },
                { label: 'Trips', value: String(chartSeries.trips[idx]) },
                { label: 'Seats Sold', value: String(chartSeries.seats[idx]) },
              ]}
            />
          )}
        </SectionCard>

        {/* Seat Occupancy */}
        <SectionCard title="Seat Occupancy">
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const, marginBottom: chartBuckets.length >= 2 ? '14px' : 0 }}>
            <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{Math.round(periodCapacity)}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Total Seats</p>
            </div>
            <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{periodSeatsSold}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Sold</p>
            </div>
            <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{Math.max(0, Math.round(periodCapacity - periodSeatsSold))}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Available</p>
            </div>
            <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{Math.round(periodOccupancyPct)}%</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Occupancy</p>
            </div>
          </div>
          {chartBuckets.length >= 2 && (
            <TrendChart
              buckets={chartBuckets}
              series={occupancySeries}
              allSeries={{ occupancy: occupancySeries }}
              activeMetric="occupancy"
              valueFormatter={(_, v) => Math.round(v) + '%'}
              renderTooltipRows={(idx) => [{ label: 'Occupancy', value: Math.round(occupancySeries[idx]) + '%' }]}
            />
          )}
        </SectionCard>

        {/* Trip Performance */}
        <SectionCard title="Trip Performance">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            {[
              ['Total Trips', periodTrips.length],
              ['Completed', periodTripsCompleted],
              ['Upcoming', periodTripsUpcoming],
              ['Cancelled', periodTripsCancelled],
            ].map(([label, val]) => (
              <div key={label as string} style={{ background: COLORS.bg, borderRadius: '10px', padding: '11px' }}>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{val as number}</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{label as string}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>Avg Passengers / Trip</span>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.text }}>{periodTrips.length > 0 ? Math.round(periodSeatsSold / periodTrips.length) : 0}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>Avg Seats Sold / Trip</span>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.text }}>{periodTrips.length > 0 ? Math.round(periodSeatsSold / periodTrips.length) : 0}</span>
          </div>
        </SectionCard>

        {/* Route Performance */}
        <SectionCard title={`Route Performance (${routeStats.length} active)`}>
          {routeStats.length === 0 ? (
            <EmptyNote text="No route data available yet." />
          ) : (
            routeStats.map((r, i) => (
              <div key={r.route} style={{ padding: '10px 0', borderBottom: i === routeStats.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' as const, gap: '4px' }}>
                  <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{r.route}</p>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {highestRevenueRoute?.route === r.route && r.revenue > 0 && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.green, background: COLORS.greenBg, padding: '2px 7px', borderRadius: '6px' }}>Highest Revenue</span>}
                    {mostBookedRoute?.route === r.route && r.bookings > 0 && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.primary, background: '#E0F2FE', padding: '2px 7px', borderRadius: '6px' }}>Most Booked</span>}
                    {highestOccupancyRoute?.route === r.route && r.occupancyPct > 0 && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.orange, background: COLORS.orangeBg, padding: '2px 7px', borderRadius: '6px' }}>Highest Occupancy</span>}
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>
                  {r.trips} trips · {r.bookings} bookings · {r.passengers} passengers · {r.occupancyPct}% occupancy · {fmtOrLocked(formatNaira(r.revenue))} · {r.cancellationRate}% cancelled
                </p>
              </div>
            ))
          )}
        </SectionCard>

        {/* Passenger Analytics */}
        <SectionCard title="Passenger Analytics">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{periodPassengers}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Total Passengers</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{periodTrips.length > 0 ? Math.round(periodPassengers / periodTrips.length) : 0}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Avg / Trip</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{routeStats.length > 0 ? Math.round(periodPassengers / routeStats.length) : 0}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Avg / Route</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{cancelledBookingsCount}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Cancelled Bookings</p></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>No-shows (estimated)</span>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.text }}>{noShowPassengers} passengers</span>
          </div>
        </SectionCard>

        {/* Revenue Analytics */}
        <SectionCard title="Revenue Analytics">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(periodRevenue))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Total Revenue</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(avgTicketPrice))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Avg Ticket Price</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(periodTrips.length > 0 ? periodRevenue / periodTrips.length : 0))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Revenue / Trip</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(routeStats.length > 0 ? periodRevenue / routeStats.length : 0))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Revenue / Route</p></div>
          </div>
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '10px' }}>See the Revenue tab on Transport Performance above for the trend over time.</p>
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

        {/* Departure Performance */}
        <SectionCard title="Departure Performance">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: todaysDepartures.length > 0 ? '12px' : 0 }}>
            {[
              ["Today's Departures", todaysDepartures.length],
              ['Upcoming Departures', upcomingDepartures.length],
              ['Completed (period)', periodTripsCompleted],
              ['Cancelled (period)', periodTripsCancelled],
            ].map(([label, val]) => (
              <div key={label as string} style={{ background: COLORS.bg, borderRadius: '10px', padding: '11px' }}>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{val as number}</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{label as string}</p>
              </div>
            ))}
          </div>
          {todaysDepartures.slice(0, 5).map((t, i) => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i === 0 ? `1px solid ${COLORS.border}` : 'none', borderBottom: `1px solid ${COLORS.border}` }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{t.origin} → {t.destination}</p>
                <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>{t.departure_time ? new Date(t.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} · {t.vehicle_info || 'Vehicle not set'}</p>
              </div>
              <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{sold[t.id] || 0} sold</p>
            </div>
          ))}
        </SectionCard>

        {/* Vehicle Performance */}
        <SectionCard title="Vehicle Performance">
          {vehicleStats.length < 2 ? (
            <EmptyNote text="Vehicle performance data is not available yet." />
          ) : (
            vehicleStats.map((v, i) => (
              <div key={v.vehicle} style={{ padding: '10px 0', borderBottom: i === vehicleStats.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
                <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{v.vehicle}</p>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{v.trips} trips · {v.passengers} passengers · {fmtOrLocked(formatNaira(v.revenue))} · {v.occupancyPct}% occupancy</p>
              </div>
            ))
          )}
        </SectionCard>

        {/* Trip Issues */}
        <SectionCard title="Trip Issues">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{cancellationRate}%</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Cancellation Rate</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{cancelledBookingsCount}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Cancelled Bookings</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{noShowRate}%</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>No-show Rate (estimated)</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{noShowPassengers}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>No-show Passengers</p></div>
          </div>
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
