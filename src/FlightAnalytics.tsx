import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import {
  COLORS, DAY_MS, RangeKey, RANGE_OPTIONS, windowForRange, Bucket, buildBuckets,
  sum, pctChange, formatNaira, formatCompactNaira, KpiCard, SectionCard, EmptyNote, TrendChart,
  bookedQtyMap, itemCapacity, aggregateByCreated, aggregateByDeparture,
} from './AnalyticsUI'

// ---------- Types ----------
type FlightBooking = {
  id: string
  created_at: string
  booking_status: string
  amount_paid: number
  commission_amount: number | null
  quantity: number
  checked_in: boolean
  promotion_id: string | null
  service_id: string | null
}

// Each row is one scheduled flight (a specific date + departure time).
// Traveler.com has no separate "flights" master table — a route is the set
// of flights that share the same origin/destination pair.
type FlightInstance = {
  id: string
  title: string | null
  origin: string | null
  destination: string | null
  departure_time: string | null
  arrival_time: string | null
  price: number
  capacity: number | null
  seats_available: number | null
  vehicle_info: string | null // doubles as aircraft/flight-number info, same field bus listings use for vehicle description
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

type MetricKey = 'revenue' | 'bookings' | 'passengers' | 'flights' | 'seats'
const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'passengers', label: 'Passengers' },
  { key: 'flights', label: 'Flights' },
  { key: 'seats', label: 'Seats Sold' },
]

function formatMetricValue(key: string, v: number) {
  if (key === 'revenue') return formatCompactNaira(v)
  return Math.round(v).toLocaleString()
}

// A flight is "cancelled" if its listing was deactivated (status='inactive');
// otherwise "completed" once departure has passed, or "upcoming". No
// dedicated flight-cancellation status exists separate from the listing's
// active/inactive flag.
function flightState(t: FlightInstance, now: Date): 'completed' | 'cancelled' | 'upcoming' {
  if (t.status === 'inactive') return 'cancelled'
  if (t.departure_time && new Date(t.departure_time) <= now) return 'completed'
  return 'upcoming'
}

// ---------- Main component ----------
export default function FlightAnalytics({ companyId, isOwner }: { companyId: string; isOwner: boolean }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [bookings, setBookings] = useState<FlightBooking[]>([])
  const [flights, setFlights] = useState<FlightInstance[]>([])
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
      .select('id, created_at, booking_status, amount_paid, commission_amount, quantity, checked_in, promotion_id, service_id')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })

    if (bookingErr) { setErrorMsg('Could not load booking data: ' + bookingErr.message); setLoading(false); return }

    const { data: flightRows, error: flightErr } = await supabase
      .from('services')
      .select('id, title, origin, destination, departure_time, arrival_time, price, capacity, seats_available, vehicle_info, status, created_at')
      .eq('company_id', companyId)
      .eq('category', 'flight')
      .order('departure_time', { ascending: false })

    if (flightErr) { setErrorMsg('Could not load flight data: ' + flightErr.message); setLoading(false); return }

    const { data: promoRows } = await supabase
      .from('promotions')
      .select('id, service_id, title, discount_type, discount_value, active, usage_limit, services(title)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    setBookings((bookingRows || []) as any)
    setFlights((flightRows || []) as any)
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
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Flight Analytics</h2>
        </div>
        <div style={{ background: COLORS.redBg, borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
          <p style={{ fontSize: '13px', color: COLORS.red }}>Unable to load flight analytics.</p>
        </div>
        <span onClick={load} style={{ display: 'inline-block', padding: '10px 16px', background: COLORS.primary, color: 'white', borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Try Again</span>
      </div>
    )
  }

  const now = new Date()
  const { start: periodStart, end: periodEnd } = windowForRange(range, now)
  const prevStart = new Date(periodStart.getTime() - (periodEnd.getTime() - periodStart.getTime()))
  const prevEnd = periodStart

  const sold = bookedQtyMap(bookings)

  const periodBookingsList = bookings.filter((b) => { const d = new Date(b.created_at); return d >= periodStart && d < periodEnd })
  const prevBookingsList = bookings.filter((b) => { const d = new Date(b.created_at); return d >= prevStart && d < prevEnd })
  const periodFlights = flights.filter((t) => t.departure_time && new Date(t.departure_time) >= periodStart && new Date(t.departure_time) < periodEnd)
  const prevFlights = flights.filter((t) => t.departure_time && new Date(t.departure_time) >= prevStart && new Date(t.departure_time) < prevEnd)

  const activePeriodBookings = periodBookingsList.filter((b) => b.booking_status !== 'cancelled')
  const activePrevBookings = prevBookingsList.filter((b) => b.booking_status !== 'cancelled')

  const periodGrossRevenue = sum(activePeriodBookings.map((b) => Number(b.amount_paid) || 0))
  const prevGrossRevenue = sum(activePrevBookings.map((b) => Number(b.amount_paid) || 0))
  const periodServiceFee = sum(activePeriodBookings.map((b) => Number(b.commission_amount) || 0))
  const periodProviderRevenue = periodGrossRevenue - periodServiceFee
  const periodCancelledAmount = sum(periodBookingsList.filter((b) => b.booking_status === 'cancelled').map((b) => Number(b.amount_paid) || 0))

  const periodPassengers = sum(activePeriodBookings.map((b) => b.quantity || 1))
  const prevPassengers = sum(activePrevBookings.map((b) => b.quantity || 1))
  const periodBookingsCount = periodBookingsList.length
  const prevBookingsCount = prevBookingsList.length

  const periodFlightsCompleted = periodFlights.filter((t) => flightState(t, now) === 'completed').length
  const periodFlightsCancelled = periodFlights.filter((t) => flightState(t, now) === 'cancelled').length
  const periodFlightsUpcoming = periodFlights.filter((t) => flightState(t, now) === 'upcoming').length

  const periodSeatsSold = sum(periodFlights.map((t) => sold[t.id] || 0))
  const periodSeatCapacity = sum(periodFlights.map((t) => itemCapacity(t, sold[t.id] || 0)))
  const periodOccupancyPct = periodSeatCapacity > 0 ? Math.min(100, (periodSeatsSold / periodSeatCapacity) * 100) : 0
  const prevSeatsSold = sum(prevFlights.map((t) => sold[t.id] || 0))
  const prevSeatCapacity = sum(prevFlights.map((t) => itemCapacity(t, sold[t.id] || 0)))
  const prevOccupancyPct = prevSeatCapacity > 0 ? Math.min(100, (prevSeatsSold / prevSeatCapacity) * 100) : 0

  const availableSeatsNow = sum(flights.filter((t) => flightState(t, now) === 'upcoming').map((t) => t.seats_available ?? 0))
  const activeRoutesCount = new Set(periodFlights.map((t) => `${t.origin || '—'} → ${t.destination || '—'}`)).size

  const cancelledBookingsCount = periodBookingsList.filter((b) => b.booking_status === 'cancelled').length
  const cancellationRate = periodBookingsList.length > 0 ? Math.round((cancelledBookingsCount / periodBookingsList.length) * 100) : 0
  const avgTicketPrice = periodPassengers > 0 ? periodGrossRevenue / periodPassengers : 0
  const avgBookingValue = periodBookingsCount > 0 ? periodGrossRevenue / periodBookingsCount : 0

  // No-show: derived from checked_in status on bookings whose flight has already departed.
  // Traveler.com doesn't track a dedicated no-show status, so this is an estimate.
  const flightById: Record<string, FlightInstance> = {}
  flights.forEach((t) => { flightById[t.id] = t })
  const noShowBookings = periodBookingsList.filter((b) => {
    if (b.booking_status !== 'confirmed' || !b.service_id) return false
    const t = flightById[b.service_id]
    return t?.departure_time && new Date(t.departure_time) < now && !b.checked_in
  })
  const confirmedCount = periodBookingsList.filter((b) => b.booking_status === 'confirmed').length
  const noShowRate = confirmedCount > 0 ? Math.round((noShowBookings.length / confirmedCount) * 100) : 0

  const chartBuckets = range === 'today' ? [] : buildBuckets(range, now)
  const createdAgg = chartBuckets.length > 0 ? aggregateByCreated(bookings, chartBuckets) : null
  const departureAgg = chartBuckets.length > 0 ? aggregateByDeparture(flights, sold, chartBuckets) : null
  const chartSeries: Record<string, number[]> | null = createdAgg && departureAgg ? {
    revenue: createdAgg.revenue,
    bookings: createdAgg.bookingsCount,
    passengers: createdAgg.units,
    flights: departureAgg.itemsCount,
    seats: departureAgg.unitsSold,
  } : null

  // ---------- Route Performance ----------
  const routeMap: Record<string, FlightInstance[]> = {}
  periodFlights.forEach((t) => {
    const key = `${t.origin || '—'} → ${t.destination || '—'}`
    if (!routeMap[key]) routeMap[key] = []
    routeMap[key].push(t)
  })
  const routeStats = Object.entries(routeMap).map(([route, rFlights]) => {
    const ids = new Set(rFlights.map((t) => t.id))
    const routeBookings = bookings.filter((b) => b.service_id && ids.has(b.service_id))
    const activeBookings = routeBookings.filter((b) => b.booking_status !== 'cancelled')
    const cap = sum(rFlights.map((t) => itemCapacity(t, sold[t.id] || 0)))
    const soldForRoute = sum(rFlights.map((t) => sold[t.id] || 0))
    const revenue = sum(activeBookings.map((b) => Number(b.amount_paid) || 0))
    return {
      route, flights: rFlights.length,
      bookings: routeBookings.length,
      passengers: sum(activeBookings.map((b) => b.quantity || 1)),
      occupancyPct: cap > 0 ? Math.round(Math.min(100, (soldForRoute / cap) * 100)) : 0,
      revenue,
      avgTicketPrice: sum(activeBookings.map((b) => b.quantity || 1)) > 0 ? revenue / sum(activeBookings.map((b) => b.quantity || 1)) : 0,
    }
  }).sort((a, b) => b.revenue - a.revenue)
  const mostBookedRoute = routeStats.length > 1 ? routeStats.reduce((a, b) => (b.bookings > a.bookings ? b : a), routeStats[0]) : null
  const highestRevenueRoute = routeStats.length > 1 ? routeStats.reduce((a, b) => (b.revenue > a.revenue ? b : a), routeStats[0]) : null
  const highestOccupancyRoute = routeStats.length > 1 ? routeStats.reduce((a, b) => (b.occupancyPct > a.occupancyPct ? b : a), routeStats[0]) : null

  // ---------- Aircraft Performance (grouped by the freeform vehicle_info field) ----------
  const aircraftMap: Record<string, FlightInstance[]> = {}
  periodFlights.forEach((t) => {
    const key = (t.vehicle_info || '').trim()
    if (!key) return
    if (!aircraftMap[key]) aircraftMap[key] = []
    aircraftMap[key].push(t)
  })
  const aircraftStats = Object.entries(aircraftMap).map(([aircraft, aFlights]) => {
    const ids = new Set(aFlights.map((t) => t.id))
    const aBookings = bookings.filter((b) => b.service_id && ids.has(b.service_id) && b.booking_status !== 'cancelled')
    const cap = sum(aFlights.map((t) => itemCapacity(t, sold[t.id] || 0)))
    const soldForA = sum(aFlights.map((t) => sold[t.id] || 0))
    return {
      aircraft, flights: aFlights.length,
      passengers: sum(aBookings.map((b) => b.quantity || 1)),
      revenue: sum(aBookings.map((b) => Number(b.amount_paid) || 0)),
      occupancyPct: cap > 0 ? Math.round(Math.min(100, (soldForA / cap) * 100)) : 0,
    }
  }).sort((a, b) => b.revenue - a.revenue)

  // ---------- Schedule (today + upcoming) ----------
  const todayStr = now.toISOString().split('T')[0]
  const todaysDepartures = flights.filter((t) => t.departure_time && t.departure_time.split('T')[0] === todayStr)
  const upcomingDepartures = flights.filter((t) => t.departure_time && new Date(t.departure_time) > now && t.status !== 'inactive')
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
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Flight Analytics</h2>
          <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Flights, routes and revenue for your airline</p>
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
          <KpiCard label="Total Flight Revenue" value={fmtOrLocked(formatNaira(periodGrossRevenue))}
            delta={`${pctChange(periodGrossRevenue, prevGrossRevenue) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodGrossRevenue, prevGrossRevenue))}% vs previous period`}
            deltaGood={pctChange(periodGrossRevenue, prevGrossRevenue) >= 0} />
          <KpiCard label="Total Bookings" value={periodBookingsCount.toLocaleString()}
            delta={`${pctChange(periodBookingsCount, prevBookingsCount) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodBookingsCount, prevBookingsCount))}% vs previous period`}
            deltaGood={pctChange(periodBookingsCount, prevBookingsCount) >= 0} />
          <KpiCard label="Total Passengers" value={periodPassengers.toLocaleString()}
            delta={`${pctChange(periodPassengers, prevPassengers) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodPassengers, prevPassengers))}% vs previous period`}
            deltaGood={pctChange(periodPassengers, prevPassengers) >= 0} />
          <KpiCard label="Total Flights" value={periodFlights.length.toLocaleString()} />
          <KpiCard label="Upcoming Flights" value={periodFlightsUpcoming.toLocaleString()} />
          <KpiCard label="Completed Flights" value={periodFlightsCompleted.toLocaleString()} />
          <KpiCard label="Cancelled Flights" value={periodFlightsCancelled.toLocaleString()} />
          <KpiCard label="Active Routes" value={activeRoutesCount.toLocaleString()} />
          <KpiCard label="Seat Occupancy" value={Math.round(periodOccupancyPct) + '%'}
            delta={`${pctChange(periodOccupancyPct, prevOccupancyPct) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodOccupancyPct, prevOccupancyPct))}% vs previous period`}
            deltaGood={pctChange(periodOccupancyPct, prevOccupancyPct) >= 0} />
          <KpiCard label="Seats Sold" value={periodSeatsSold.toLocaleString()} />
          <KpiCard label="Available Seats" value={availableSeatsNow.toLocaleString()} sub="Across upcoming flights" />
          <KpiCard label="Avg Ticket Price" value={fmtOrLocked(formatNaira(avgTicketPrice))} />
          <KpiCard label="Avg Booking Value" value={fmtOrLocked(formatNaira(avgBookingValue))} />
          <KpiCard label="Cancellation Rate" value={cancellationRate + '%'} />
          <KpiCard label="No-show Rate" value={noShowRate + '%'} sub="Estimated" />
        </div>

        {/* Flight Performance trend chart */}
        <SectionCard title="Flight Performance">
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
                { label: 'Flights', value: String(chartSeries.flights[idx]) },
                { label: 'Seats Sold', value: String(chartSeries.seats[idx]) },
              ]}
            />
          )}
        </SectionCard>

        {/* Seat Occupancy */}
        <SectionCard title="Seat Occupancy">
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const }}>
            <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{Math.round(periodSeatCapacity)}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Total Seats</p>
            </div>
            <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{periodSeatsSold}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Sold</p>
            </div>
            <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{Math.max(0, Math.round(periodSeatCapacity - periodSeatsSold))}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Available</p>
            </div>
            <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{Math.round(periodOccupancyPct)}%</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Occupancy Rate</p>
            </div>
          </div>
        </SectionCard>

        {/* Route Analytics */}
        <SectionCard title={`Route Analytics (${routeStats.length} active)`}>
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
                    {highestOccupancyRoute?.route === r.route && r.occupancyPct > 0 && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.orange, background: COLORS.orangeBg, padding: '2px 7px', borderRadius: '6px' }}>Highest Seat Occupancy</span>}
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>
                  {r.flights} flights · {r.bookings} bookings · {r.passengers} passengers · {r.occupancyPct}% occupancy · Avg fare {fmtOrLocked(formatNaira(r.avgTicketPrice))} · {fmtOrLocked(formatNaira(r.revenue))}
                </p>
              </div>
            ))
          )}
        </SectionCard>

        {/* Passenger Analytics */}
        <SectionCard title="Passenger Analytics">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{periodPassengers}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Total Passengers</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{periodBookingsCount > 0 ? (periodPassengers / periodBookingsCount).toFixed(1) : 0}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Avg / Booking</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{routeStats.length > 0 ? Math.round(periodPassengers / routeStats.length) : 0}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Avg / Route</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{sum(periodBookingsList.filter((b) => b.booking_status === 'cancelled').map((b) => b.quantity || 1))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Cancelled Passengers</p></div>
          </div>
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '10px' }}>Domestic vs international split isn't stored in the current booking data, so it isn't shown here.</p>
        </SectionCard>

        {/* Revenue Analytics */}
        <SectionCard title="Revenue Analytics">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(periodGrossRevenue))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Gross Booking Value</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(periodServiceFee))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Traveler.com Service Fee</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(periodProviderRevenue))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Airline Revenue (net)</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(periodCancelledAmount))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Cancelled Booking Amount</p></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '10px', borderTop: `1px solid ${COLORS.border}` }}>
            <div><p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(avgTicketPrice))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Avg Ticket Price</p></div>
            <div><p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(avgBookingValue))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Avg Booking Value</p></div>
          </div>
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '10px' }}>Refund amounts aren't tracked as a separate field in the current booking data, so they're not shown here. See the Revenue tab on Flight Performance above for the trend over time.</p>
        </SectionCard>

        {/* Booking Analytics */}
        <SectionCard title="Booking Analytics">
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
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '10px' }}>Traveler.com doesn't currently track a separate "Pending" or "Failed" booking status.</p>
        </SectionCard>

        {/* Cancellation Analytics */}
        <SectionCard title="Cancellation Analytics">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{cancellationRate}%</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Cancellation Rate</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{cancelledBookingsCount}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Cancelled Bookings</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{noShowRate}%</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>No-show Rate (estimated)</p></div>
            <div><p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(periodCancelledAmount))}</p><p style={{ fontSize: '10px', color: COLORS.textMuted }}>Cancelled Amount</p></div>
          </div>
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '10px' }}>Traveler.com doesn't currently distinguish airline-initiated from customer-initiated cancellations.</p>
        </SectionCard>

        {/* Flight Schedule Analytics */}
        <SectionCard title="Flight Schedule Analytics">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: todaysDepartures.length > 0 ? '12px' : 0 }}>
            {[
              ["Today's Departures", todaysDepartures.length],
              ['Upcoming Departures', upcomingDepartures.length],
              ['Completed (period)', periodFlightsCompleted],
              ['Cancelled (period)', periodFlightsCancelled],
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
                <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>{t.departure_time ? new Date(t.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} · {t.vehicle_info || 'Aircraft not set'}</p>
              </div>
              <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{sold[t.id] || 0} sold</p>
            </div>
          ))}
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '10px' }}>Delay data isn't tracked in the current booking data, so delay metrics aren't shown.</p>
        </SectionCard>

        {/* Aircraft Analytics */}
        <SectionCard title="Aircraft Analytics">
          {aircraftStats.length < 2 ? (
            <EmptyNote text="Aircraft performance data is not available yet." />
          ) : (
            aircraftStats.map((v, i) => (
              <div key={v.aircraft} style={{ padding: '10px 0', borderBottom: i === aircraftStats.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
                <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{v.aircraft}</p>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{v.flights} flights · {v.passengers} passengers · {fmtOrLocked(formatNaira(v.revenue))} · {v.occupancyPct}% occupancy</p>
              </div>
            ))
          )}
        </SectionCard>

        {/* Cabin Class Analytics */}
        <SectionCard title="Cabin Class Analytics">
          <EmptyNote text="Cabin class isn't stored on flight listings in the current booking data, so this section isn't available. Adding a cabin_class field to services would be needed to support it." />
        </SectionCard>

        {/* Customer Analytics */}
        <SectionCard title="Customer Analytics">
          <EmptyNote text="Customer identity isn't linked to bookings in a way this page can read yet, so new/returning passenger counts aren't available. Flagging this as a data-architecture gap rather than estimating it." />
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
