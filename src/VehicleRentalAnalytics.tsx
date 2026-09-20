import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import {
  COLORS, DAY_MS, RangeKey, RANGE_OPTIONS, windowForRange, buildBuckets,
  sum, pctChange, formatNaira, formatCompactNaira, KpiCard, SectionCard, EmptyNote, TrendChart,
} from './AnalyticsUI'

type RentalBooking = {
  id: string
  created_at: string
  booking_status: string
  amount_paid: number
  quantity: number
  checked_in: boolean
  promotion_id: string | null
  service_id: string | null
  check_in_date: string | null
  check_out_date: string | null
}

type Vehicle = {
  id: string
  title: string | null
  brand: string | null
  model: string | null
  destination: string | null
  price: number
  seats_available: number | null
  rental_mode: string | null
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

type MetricKey = 'revenue' | 'bookings' | 'rentalDays'
const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'rentalDays', label: 'Rental Days' },
]

function formatMetricValue(key: string, v: number) {
  if (key === 'revenue') return formatCompactNaira(v)
  return Math.round(v).toLocaleString()
}

function rentalDaysOf(b: RentalBooking): number {
  if (!b.check_in_date || !b.check_out_date) return 0
  const ms = new Date(b.check_out_date).getTime() - new Date(b.check_in_date).getTime()
  return ms > 0 ? Math.round(ms / DAY_MS) : 0
}

// ---------- Aggregation: booking-creation-date attribution ----------
function aggregateByCreated(bookings: RentalBooking[], buckets: { start: Date; end: Date }[]) {
  const n = buckets.length
  const revenue = new Array(n).fill(0)
  const bookingsCount = new Array(n).fill(0)
  const rentalDays = new Array(n).fill(0)
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
      rentalDays[idx] += rentalDaysOf(b)
    }
  })
  return { revenue, bookingsCount, rentalDays }
}

export default function VehicleRentalAnalytics({ companyId, isOwner }: { companyId: string; isOwner: boolean }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [bookings, setBookings] = useState<RentalBooking[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
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
      .select('id, created_at, booking_status, amount_paid, quantity, checked_in, promotion_id, service_id, check_in_date, check_out_date')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })

    if (bookingErr) { setErrorMsg('Could not load booking data: ' + bookingErr.message); setLoading(false); return }

    const { data: vehicleRows, error: vehicleErr } = await supabase
      .from('services')
      .select('id, title, brand, model, destination, price, seats_available, rental_mode, status, created_at')
      .eq('company_id', companyId)
      .eq('category', 'vehicle_rental')
      .order('created_at', { ascending: false })

    if (vehicleErr) { setErrorMsg('Could not load vehicle data: ' + vehicleErr.message); setLoading(false); return }

    const { data: promoRows } = await supabase
      .from('promotions')
      .select('id, service_id, title, discount_type, discount_value, active, usage_limit, services(title)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    // Booking rows aren't category-scoped by the query, so keep only ones
    // whose service_id belongs to one of this company's vehicle_rental listings.
    const vehicleIds = new Set((vehicleRows || []).map((v) => v.id))
    setBookings(((bookingRows || []) as any[]).filter((b) => b.service_id && vehicleIds.has(b.service_id)))
    setVehicles((vehicleRows || []) as any)
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
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Vehicle Rental Analytics</h2>
        </div>
        <div style={{ background: COLORS.redBg, borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
          <p style={{ fontSize: '13px', color: COLORS.red }}>Unable to load vehicle rental analytics.</p>
        </div>
        <span onClick={load} style={{ display: 'inline-block', padding: '10px 16px', background: COLORS.primary, color: 'white', borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Try Again</span>
      </div>
    )
  }

  const now = new Date()
  const { start: periodStart, end: periodEnd } = windowForRange(range, now)
  const prevStart = new Date(periodStart.getTime() - (periodEnd.getTime() - periodStart.getTime()))
  const prevEnd = periodStart
  const periodDays = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / DAY_MS))

  const periodBookingsList = bookings.filter((b) => { const d = new Date(b.created_at); return d >= periodStart && d < periodEnd })
  const prevBookingsList = bookings.filter((b) => { const d = new Date(b.created_at); return d >= prevStart && d < prevEnd })
  const activePeriod = periodBookingsList.filter((b) => b.booking_status !== 'cancelled')
  const activePrev = prevBookingsList.filter((b) => b.booking_status !== 'cancelled')

  const periodRevenue = sum(activePeriod.map((b) => Number(b.amount_paid) || 0))
  const prevRevenue = sum(activePrev.map((b) => Number(b.amount_paid) || 0))
  const periodRentalDays = sum(activePeriod.map(rentalDaysOf))
  const prevRentalDays = sum(activePrev.map(rentalDaysOf))
  const periodBookingsCount = periodBookingsList.length
  const prevBookingsCount = prevBookingsList.length

  const cancelledCount = periodBookingsList.filter((b) => b.booking_status === 'cancelled').length
  const cancellationRate = periodBookingsCount > 0 ? Math.round((cancelledCount / periodBookingsCount) * 100) : 0
  const avgRentalValue = activePeriod.length > 0 ? periodRevenue / activePeriod.length : 0
  const avgRentalDuration = activePeriod.length > 0 ? periodRentalDays / activePeriod.length : 0

  // Fleet-days available in period — approximated from CURRENT fleet count
  // per active listing (Traveler.com doesn't track historical fleet-size
  // changes, so this is the best real signal available, same approach
  // TransportAnalytics uses for seat capacity).
  const activeFleetVehicles = vehicles.filter((v) => v.status === 'active')
  const fleetDaysAvailable = sum(activeFleetVehicles.map((v) => v.seats_available ?? 0)) * periodDays
  const fleetUtilizationPct = fleetDaysAvailable > 0 ? Math.min(100, (periodRentalDays / fleetDaysAvailable) * 100) : 0
  const prevFleetDaysAvailable = fleetDaysAvailable // fleet size not tracked historically — same approximation for previous period
  const prevFleetUtilizationPct = prevFleetDaysAvailable > 0 ? Math.min(100, (prevRentalDays / prevFleetDaysAvailable) * 100) : 0

  const availableVehiclesNow = sum(activeFleetVehicles.map((v) => v.seats_available ?? 0))

  const chartBuckets = range === 'today' ? [] : buildBuckets(range, now)
  const createdAgg = chartBuckets.length > 0 ? aggregateByCreated(bookings, chartBuckets) : null
  const chartSeries: Record<string, number[]> | null = createdAgg ? {
    revenue: createdAgg.revenue,
    bookings: createdAgg.bookingsCount,
    rentalDays: createdAgg.rentalDays,
  } : null

  // ---------- Pickup / Return activity ----------
  const todayStr = now.toISOString().split('T')[0]
  const todaysPickups = bookings.filter((b) => b.booking_status !== 'cancelled' && b.check_in_date === todayStr)
  const upcomingPickups = bookings.filter((b) => b.booking_status !== 'cancelled' && b.check_in_date && b.check_in_date > todayStr)
    .sort((a, b) => (a.check_in_date! < b.check_in_date! ? -1 : 1))
  const returnsDueToday = bookings.filter((b) => b.booking_status !== 'cancelled' && b.check_out_date === todayStr)

  // ---------- Vehicle Performance (one row per listing) ----------
  const vehicleStats = vehicles.map((v) => {
    const vBookings = periodBookingsList.filter((b) => b.service_id === v.id)
    const activeV = vBookings.filter((b) => b.booking_status !== 'cancelled')
    const vRentalDays = sum(activeV.map(rentalDaysOf))
    const vFleetDays = (v.seats_available ?? 0) * periodDays
    return {
      id: v.id,
      title: v.title || 'Untitled vehicle',
      subtitle: [v.brand, v.model].filter(Boolean).join(' '),
      bookings: vBookings.length,
      rentalDays: vRentalDays,
      revenue: sum(activeV.map((b) => Number(b.amount_paid) || 0)),
      utilizationPct: vFleetDays > 0 ? Math.round(Math.min(100, (vRentalDays / vFleetDays) * 100)) : 0,
    }
  }).sort((a, b) => b.revenue - a.revenue)
  const highestRevenueVehicle = vehicleStats.length > 1 ? vehicleStats.reduce((a, b) => (b.revenue > a.revenue ? b : a), vehicleStats[0]) : null
  const mostBookedVehicle = vehicleStats.length > 1 ? vehicleStats.reduce((a, b) => (b.bookings > a.bookings ? b : a), vehicleStats[0]) : null

  // ---------- Promotions ----------
  const promoBookingsInPeriod = activePeriod.filter((b) => b.promotion_id)
  const promoRevenueInPeriod = sum(promoBookingsInPeriod.map((b) => Number(b.amount_paid) || 0))
  const activePromotions = promotions.filter((p) => p.active)
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
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Vehicle Rental Analytics</h2>
          <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Fleet utilization, rentals and revenue</p>
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
          <KpiCard label="Rental Days" value={periodRentalDays.toLocaleString()}
            delta={`${pctChange(periodRentalDays, prevRentalDays) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodRentalDays, prevRentalDays))}% vs previous period`}
            deltaGood={pctChange(periodRentalDays, prevRentalDays) >= 0} />
          <KpiCard label="Fleet Utilization" value={Math.round(fleetUtilizationPct) + '%'}
            delta={`${pctChange(fleetUtilizationPct, prevFleetUtilizationPct) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(fleetUtilizationPct, prevFleetUtilizationPct))}% vs previous period`}
            deltaGood={pctChange(fleetUtilizationPct, prevFleetUtilizationPct) >= 0} />
          <KpiCard label="Avg Rental Value" value={fmtOrLocked(formatNaira(avgRentalValue))} />
          <KpiCard label="Avg Rental Duration" value={avgRentalDuration.toFixed(1) + ' days'} />
          <KpiCard label="Available Vehicles" value={availableVehiclesNow.toLocaleString()} sub="Right now" />
          <KpiCard label="Cancellation Rate" value={cancellationRate + '%'} />
        </div>

        {/* Trend chart */}
        <SectionCard title="Vehicle Rental Performance">
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
                { label: 'Rental Days', value: String(chartSeries.rentalDays[idx]) },
              ]}
            />
          )}
        </SectionCard>

        {/* Fleet Utilization */}
        <SectionCard title="Fleet Utilization">
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const }}>
            <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{Math.round(fleetDaysAvailable)}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Fleet-Days Available</p>
            </div>
            <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{periodRentalDays}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Booked</p>
            </div>
            <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{Math.max(0, Math.round(fleetDaysAvailable - periodRentalDays))}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Idle</p>
            </div>
            <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{Math.round(fleetUtilizationPct)}%</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Utilization</p>
            </div>
          </div>
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '10px' }}>Based on your current active fleet size — Traveler.com doesn't track historical fleet-count changes.</p>
        </SectionCard>

        {/* Pickup / Return Activity */}
        <SectionCard title="Pickup & Return Activity">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: (todaysPickups.length + returnsDueToday.length) > 0 ? '12px' : 0 }}>
            {[
              ["Today's Pickups", todaysPickups.length],
              ['Upcoming Pickups', upcomingPickups.length],
              ['Returns Due Today', returnsDueToday.length],
            ].map(([label, val]) => (
              <div key={label as string} style={{ background: COLORS.bg, borderRadius: '10px', padding: '11px' }}>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{val as number}</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{label as string}</p>
              </div>
            ))}
          </div>
          {todaysPickups.length === 0 && returnsDueToday.length === 0 ? (
            <EmptyNote text="Nothing scheduled for today." />
          ) : (
            <>
              {todaysPickups.map((b) => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <p style={{ fontSize: '12px', color: COLORS.text }}>Pickup — {b.id.slice(0, 8)}</p>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: COLORS.primary }}>Today</span>
                </div>
              ))}
              {returnsDueToday.map((b) => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <p style={{ fontSize: '12px', color: COLORS.text }}>Return — {b.id.slice(0, 8)}</p>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: COLORS.orange }}>Due today</span>
                </div>
              ))}
            </>
          )}
        </SectionCard>

        {/* Vehicle Performance */}
        <SectionCard title={`Vehicle Performance (${vehicleStats.length})`}>
          {vehicleStats.length === 0 ? (
            <EmptyNote text="No vehicle listings yet." />
          ) : (
            vehicleStats.map((v, i) => (
              <div key={v.id} style={{ padding: '10px 0', borderBottom: i === vehicleStats.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' as const }}>
                  <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{v.title}</p>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {highestRevenueVehicle?.id === v.id && v.revenue > 0 && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.green, background: COLORS.greenBg, padding: '2px 7px', borderRadius: '6px' }}>Highest Revenue</span>}
                    {mostBookedVehicle?.id === v.id && v.bookings > 0 && <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.primary, background: '#E0F2FE', padding: '2px 7px', borderRadius: '6px' }}>Most Booked</span>}
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>
                  {v.bookings} bookings · {v.rentalDays} rental days · {v.utilizationPct}% utilization · {fmtOrLocked(formatNaira(v.revenue))}
                </p>
              </div>
            ))
          )}
        </SectionCard>

        {/* Promotion Performance */}
        <SectionCard title="Promotion Performance" action={
          <span onClick={() => navigate('/promotions')} style={{ fontSize: '11px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Manage →</span>
        }>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
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
