import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import {
  COLORS, DAY_MS, RangeKey, RANGE_OPTIONS, windowForRange, Bucket, buildBuckets,
  sum, pctChange, formatNaira, formatCompactNaira, KpiCard, SectionCard, EmptyNote, TrendChart,
} from './AnalyticsUI'

type HotelBooking = {
  id: string
  created_at: string
  check_in_date: string | null
  check_out_date: string | null
  checked_in: boolean
  booking_status: string
  amount_paid: number
  quantity: number
  inventory_item_id: string | null
  promotion_id: string | null
  inventory_items: { name: string } | null
}

type RoomType = {
  id: string
  name: string
  price: number
  total_quantity: number
  occupied_quantity: number
  available_quantity: number
  reserved_quantity: number
  maintenance_quantity: number
}

type PromoRow = {
  id: string
  service_id: string
  title: string
  discount_type: string
  discount_value: number
  start_date: string | null
  end_date: string | null
  active: boolean
  usage_limit: number | null
  services: { title: string } | null
}
type MetricKey = 'revenue' | 'bookings' | 'occupancy' | 'roomNights'
const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'occupancy', label: 'Occupancy' },
  { key: 'roomNights', label: 'Room Nights' },
]

function formatMetricValue(key: string, v: number) {
  if (key === 'revenue') return formatCompactNaira(v)
  if (key === 'occupancy') return Math.round(v) + '%'
  return Math.round(v).toLocaleString()
}
type AggResult = { revenue: number[]; bookingsCount: number[]; roomNights: number[]; occupiedRoomDays: number[]; capacity: number[] }

function aggregate(bookings: HotelBooking[], buckets: { start: Date; end: Date }[], totalRooms: number): AggResult {
  const n = buckets.length
  const revenue = new Array(n).fill(0)
  const bookingsCount = new Array(n).fill(0)
  const roomNights = new Array(n).fill(0)
  const occupiedRoomDays = new Array(n).fill(0)
  const capacity = buckets.map((bk) => {
    const days = Math.max(1, (bk.end.getTime() - bk.start.getTime()) / DAY_MS)
    return totalRooms * days
  })

  const indexFor = (d: Date) => {
    for (let i = 0; i < n; i++) if (d >= buckets[i].start && d < buckets[i].end) return i
    return -1
  }

  bookings.forEach((b) => {
    const created = new Date(b.created_at)
    const idx = indexFor(created)
    if (idx >= 0) {
      bookingsCount[idx] += 1
      if (b.booking_status !== 'cancelled') {
        revenue[idx] += Number(b.amount_paid) || 0
        if (b.check_in_date && b.check_out_date) {
          const nights = Math.max(0, (new Date(b.check_out_date).getTime() - new Date(b.check_in_date).getTime()) / DAY_MS)
          roomNights[idx] += nights * (b.quantity || 1)
        }
      }
    }
    if ((b.booking_status === 'confirmed' || b.booking_status === 'completed') && b.check_in_date && b.check_out_date) {
      let cursor = new Date(b.check_in_date)
      const stayEnd = new Date(b.check_out_date)
      let guard = 0
      while (cursor < stayEnd && guard < 400) {
        const bi = indexFor(cursor)
        if (bi >= 0) occupiedRoomDays[bi] += (b.quantity || 1)
        cursor = new Date(cursor.getTime() + DAY_MS)
        guard++
      }
    }
  })

  return { revenue, bookingsCount, roomNights, occupiedRoomDays, capacity }
}

function occupancyFromAgg(agg: AggResult) {
  const cap = sum(agg.capacity)
  return cap > 0 ? Math.min(100, (sum(agg.occupiedRoomDays) / cap) * 100) : 0
}
export default function HotelAnalytics({ companyId, isOwner }: { companyId: string; isOwner: boolean }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [bookings, setBookings] = useState<HotelBooking[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [promotions, setPromotions] = useState<PromoRow[]>([])
  const [financeAllowed, setFinanceAllowed] = useState(true)
  const [range, setRange] = useState<RangeKey>('30d')
  const [metric, setMetric] = useState<MetricKey>('revenue')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setErrorMsg('')

      if (!isOwner) {
        const { data: userData } = await supabase.auth.getUser()
        if (userData.user) {
          const { data: allowed } = await supabase.rpc('has_permission', {
            p_user_id: userData.user.id,
            p_permission: 'finance.view',
          })
          if (!cancelled) setFinanceAllowed(!!allowed)
        }
      }

      const { data: bookingRows, error: bookingErr } = await supabase
        .from('bookings')
        .select('id, created_at, check_in_date, check_out_date, checked_in, booking_status, amount_paid, quantity, inventory_item_id, promotion_id, inventory_items(name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true })

      if (bookingErr) {
        if (!cancelled) { setErrorMsg('Could not load booking data: ' + bookingErr.message); setLoading(false) }
        return
      }

      const { data: itemRows } = await supabase
        .from('inventory_items')
        .select('id, name, price, total_quantity, occupied_quantity, available_quantity, reserved_quantity, maintenance_quantity')
        .eq('company_id', companyId)

      const { data: promoRows } = await supabase
        .from('promotions')
        .select('id, service_id, title, discount_type, discount_value, start_date, end_date, active, usage_limit, services(title)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (!cancelled) {
        setBookings((bookingRows || []) as any)
        setRoomTypes((itemRows || []) as any)
        setPromotions((promoRows || []) as any)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [companyId, isOwner])

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
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Hotel Analytics</h2>
        </div>
        <div style={{ background: COLORS.redBg, borderRadius: '12px', padding: '16px' }}>
          <p style={{ fontSize: '13px', color: COLORS.red }}>{errorMsg}</p>
        </div>
      </div>
    )
  }

  const now = new Date()
  const { start: periodStart, end: periodEnd } = windowForRange(range, now)
  const prevStart = new Date(periodStart.getTime() - (periodEnd.getTime() - periodStart.getTime()))
  const prevEnd = periodStart

  const totalRooms = sum(roomTypes.map((r) => r.total_quantity || 0))
  const currentOccupiedRooms = sum(roomTypes.map((r) => r.occupied_quantity || 0))
  const currentAvailableRooms = sum(roomTypes.map((r) => r.available_quantity || 0))
  const currentOccupancyPct = totalRooms > 0 ? Math.round((currentOccupiedRooms / totalRooms) * 100) : 0

  const periodAgg = aggregate(bookings, [{ start: periodStart, end: periodEnd }], totalRooms)
  const prevAgg = aggregate(bookings, [{ start: prevStart, end: prevEnd }], totalRooms)

  const periodRevenue = sum(periodAgg.revenue)
  const prevRevenue = sum(prevAgg.revenue)
  const periodBookingsCount = sum(periodAgg.bookingsCount)
  const prevBookingsCount = sum(prevAgg.bookingsCount)
  const periodRoomNights = sum(periodAgg.roomNights)
  const prevRoomNights = sum(prevAgg.roomNights)
  const periodOccupancyPct = occupancyFromAgg(periodAgg)
  const prevOccupancyPct = occupancyFromAgg(prevAgg)

  const periodDays = Math.max(1, (periodEnd.getTime() - periodStart.getTime()) / DAY_MS)
  const adr = periodRoomNights > 0 ? periodRevenue / periodRoomNights : 0
  const revpar = totalRooms > 0 ? periodRevenue / (totalRooms * periodDays) : 0
  const avgBookingValue = periodBookingsCount > 0 ? periodRevenue / periodBookingsCount : 0

  const periodBookingsList = bookings.filter((b) => {
    const d = new Date(b.created_at)
    return d >= periodStart && d < periodEnd
  })
  const confirmedCount = periodBookingsList.filter((b) => b.booking_status === 'confirmed').length
  const completedCount = periodBookingsList.filter((b) => b.booking_status === 'completed').length
  const cancelledCount = periodBookingsList.filter((b) => b.booking_status === 'cancelled').length
  const cancellationRate = periodBookingsList.length > 0 ? Math.round((cancelledCount / periodBookingsList.length) * 100) : 0
  const todayStr = now.toISOString().split('T')[0]
  const noShowCount = periodBookingsList.filter((b) => b.booking_status === 'confirmed' && b.check_in_date && b.check_in_date < todayStr && !b.checked_in).length
  const noShowRate = confirmedCount > 0 ? Math.round((noShowCount / confirmedCount) * 100) : 0

  const tomorrowStr = new Date(now.getTime() + DAY_MS).toISOString().split('T')[0]
  const todaysCheckins = bookings.filter((b) => b.check_in_date === todayStr && b.booking_status !== 'cancelled').length
  const todaysCheckouts = bookings.filter((b) => b.check_out_date === todayStr && b.booking_status !== 'cancelled').length
  const tomorrowCheckins = bookings.filter((b) => b.check_in_date === tomorrowStr && b.booking_status !== 'cancelled').length
  const tomorrowCheckouts = bookings.filter((b) => b.check_out_date === tomorrowStr && b.booking_status !== 'cancelled').length

  const roomStats = roomTypes.map((rt) => {
    const relevant = periodBookingsList.filter((b) => b.inventory_item_id === rt.id && b.booking_status !== 'cancelled')
    return {
      ...rt,
      bookingsCount: relevant.length,
      revenue: sum(relevant.map((b) => Number(b.amount_paid) || 0)),
      occupancyPct: rt.total_quantity > 0 ? Math.round((rt.occupied_quantity / rt.total_quantity) * 100) : 0,
    }
  })
  const highestRevenueRoom = roomStats.length > 1 ? roomStats.reduce((a, b) => (b.revenue > a.revenue ? b : a), roomStats[0]) : null
  const mostBookedRoom = roomStats.length > 1 ? roomStats.reduce((a, b) => (b.bookingsCount > a.bookingsCount ? b : a), roomStats[0]) : null

  const chartBuckets = range === 'today' ? [] : buildBuckets(range, now)
  const chartAgg = chartBuckets.length > 0 ? aggregate(bookings, chartBuckets, totalRooms) : null
  const chartSeries: Record<string, number[]> | null = chartAgg ? {
    revenue: chartAgg.revenue,
    bookings: chartAgg.bookingsCount,
    roomNights: chartAgg.roomNights,
    occupancy: chartBuckets.map((bk, i) => (chartAgg.capacity[i] > 0 ? Math.min(100, (chartAgg.occupiedRoomDays[i] / chartAgg.capacity[i]) * 100) : 0)),
  } : null

  const activePromotions = promotions.filter((p) => p.active)
  const promoBookingsInPeriod = periodBookingsList.filter((b) => b.promotion_id && b.booking_status !== 'cancelled')
  const promoRevenueInPeriod = sum(promoBookingsInPeriod.map((b) => Number(b.amount_paid) || 0))
  const promoAvgValue = promoBookingsInPeriod.length > 0 ? promoRevenueInPeriod / promoBookingsInPeriod.length : 0
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
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Hotel Analytics</h2>
          <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Performance and operations for your hotel</p>
        </div>
      </div>

      <div style={{ padding: '12px 16px 0' }}>
        {/* Date range control */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' as const, marginBottom: '14px', paddingBottom: '2px' }}>
          {RANGE_OPTIONS.map((r) => (
            <span key={r.key} onClick={() => setRange(r.key)}
              style={{
                flexShrink: 0, padding: '7px 13px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                background: range === r.key ? COLORS.primary : COLORS.card, color: range === r.key ? 'white' : COLORS.text,
                border: `1px solid ${range === r.key ? COLORS.primary : COLORS.border}`,
              }}>
              {r.label}
            </span>
          ))}
        </div>

        {!financeAllowed && (
          <div style={{ background: COLORS.orangeBg, borderRadius: '10px', padding: '9px 12px', marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', color: COLORS.orange, fontWeight: 600 }}>Financial figures are hidden — you don't have Finance viewing access.</p>
          </div>
        )}

        {/* KPI cards */}
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px', marginBottom: '14px' }}>
          <KpiCard label="Revenue" value={fmtOrLocked(formatNaira(periodRevenue))}
            delta={`${pctChange(periodRevenue, prevRevenue) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodRevenue, prevRevenue))}% vs previous period`}
            deltaGood={pctChange(periodRevenue, prevRevenue) >= 0} />
          <KpiCard label="Bookings" value={periodBookingsCount.toLocaleString()}
            delta={`${pctChange(periodBookingsCount, prevBookingsCount) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodBookingsCount, prevBookingsCount))}% vs previous period`}
            deltaGood={pctChange(periodBookingsCount, prevBookingsCount) >= 0} />
          <KpiCard label="Occupancy" value={Math.round(periodOccupancyPct) + '%'}
            delta={`${pctChange(periodOccupancyPct, prevOccupancyPct) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodOccupancyPct, prevOccupancyPct))}% vs previous period`}
            deltaGood={pctChange(periodOccupancyPct, prevOccupancyPct) >= 0} />
          <KpiCard label="RevPAR" value={fmtOrLocked(formatNaira(revpar))} sub="Revenue per available room" />
          <KpiCard label="Room Nights" value={Math.round(periodRoomNights).toLocaleString()}
            delta={`${pctChange(periodRoomNights, prevRoomNights) >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(periodRoomNights, prevRoomNights))}% vs previous period`}
            deltaGood={pctChange(periodRoomNights, prevRoomNights) >= 0} />
          <KpiCard label="ADR" value={fmtOrLocked(formatNaira(adr))} sub="Average Daily Rate" />
          <KpiCard label="Cancellation Rate" value={cancellationRate + '%'} />
          <KpiCard label="Avg Booking Value" value={fmtOrLocked(formatNaira(avgBookingValue))} />
        </div>

        {/* Hotel Performance trend chart */}
        <SectionCard title="Hotel Performance">
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto' as const }}>
            {METRIC_OPTIONS.map((m) => (
              <span key={m.key} onClick={() => setMetric(m.key)}
                style={{
                  flexShrink: 0, padding: '6px 11px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  background: metric === m.key ? COLORS.primary : COLORS.bg, color: metric === m.key ? 'white' : COLORS.textMuted,
                }}>
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
              renderTooltipRows={(idx) => {
                const bk = chartBuckets[idx]
                const days = Math.max(1, (bk.end.getTime() - bk.start.getTime()) / DAY_MS)
                const rev = chartSeries.revenue[idx]
                const rn = chartSeries.roomNights[idx]
                const adrV = rn > 0 ? rev / rn : null
                const revparV = totalRooms > 0 ? rev / (totalRooms * days) : null
                const rows = [
                  { label: 'Revenue', value: formatNaira(rev) },
                  { label: 'Bookings', value: String(chartSeries.bookings[idx]) },
                  { label: 'Occupancy', value: Math.round(chartSeries.occupancy[idx]) + '%' },
                  { label: 'Room Nights', value: String(Math.round(rn)) },
                ]
                if (adrV !== null) rows.push({ label: 'ADR', value: formatNaira(adrV) })
                if (revparV !== null) rows.push({ label: 'RevPAR', value: formatNaira(revparV) })
                return rows
              }}
            />
          )}
        </SectionCard>

        {/* Occupancy analytics */}
        <SectionCard title="Occupancy">
          {totalRooms === 0 ? (
            <EmptyNote text="No hotel room data available yet." />
          ) : (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const }}>
              <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
                <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{currentOccupancyPct}%</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Current Occupancy</p>
              </div>
              <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
                <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{Math.round(periodOccupancyPct)}%</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Average ({range === 'today' ? 'Today' : RANGE_OPTIONS.find(r => r.key === range)?.label})</p>
              </div>
              <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
                <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{currentOccupiedRooms}</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Occupied Rooms</p>
              </div>
              <div style={{ flex: '1 1 45%', background: COLORS.bg, borderRadius: '10px', padding: '11px', textAlign: 'center' as const }}>
                <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{currentAvailableRooms}</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Available Rooms</p>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Room performance */}
        <SectionCard title="Room Performance">
          {roomStats.length === 0 ? (
            <EmptyNote text="No room types set up yet." />
          ) : (
            roomStats.map((r, i) => (
              <div key={r.id} style={{ padding: '10px 0', borderBottom: i === roomStats.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{r.name}</p>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {highestRevenueRoom?.id === r.id && r.revenue > 0 && (
                      <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.green, background: COLORS.greenBg, padding: '2px 7px', borderRadius: '6px' }}>Highest Revenue</span>
                    )}
                    {mostBookedRoom?.id === r.id && r.bookingsCount > 0 && (
                      <span style={{ fontSize: '9px', fontWeight: 700, color: COLORS.primary, background: '#E0F2FE', padding: '2px 7px', borderRadius: '6px' }}>Most Booked</span>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>
                  {r.bookingsCount} bookings · {fmtOrLocked(formatNaira(r.revenue))} revenue · {r.occupancyPct}% occupancy
                </p>
              </div>
            ))
          )}
        </SectionCard>

        {/* Booking performance */}
        <SectionCard title="Booking Performance">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              ['Total Bookings', periodBookingsList.length],
              ['Confirmed', confirmedCount],
              ['Completed Stays', completedCount],
              ['Cancelled', cancelledCount],
            ].map(([label, val]) => (
              <div key={label as string} style={{ background: COLORS.bg, borderRadius: '10px', padding: '11px' }}>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{val as number}</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{label as string}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>No-show Rate (estimated)</span>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.text }}>{noShowRate}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>Average Booking Value</span>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.text }}>{fmtOrLocked(formatNaira(avgBookingValue))}</span>
          </div>
        </SectionCard>

        {/* Check-in / Check-out operations */}
        <SectionCard title="Check-in / Check-out Operations">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              ["Today's Check-ins", todaysCheckins],
              ["Today's Check-outs", todaysCheckouts],
              ["Tomorrow's Check-ins", tomorrowCheckins],
              ["Tomorrow's Check-outs", tomorrowCheckouts],
            ].map(([label, val]) => (
              <div key={label as string} style={{ background: COLORS.bg, borderRadius: '10px', padding: '11px' }}>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{val as number}</p>
                <p style={{ fontSize: '10px', color: COLORS.textMuted }}>{label as string}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Revenue analytics */}
        <SectionCard title="Revenue Analytics">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '4px' }}>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(periodRevenue))}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Total Revenue</p>
            </div>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(adr))}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>ADR</p>
            </div>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(revpar))}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>RevPAR</p>
            </div>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(avgBookingValue))}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Avg Booking Value</p>
            </div>
          </div>
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '6px' }}>See the Revenue tab on Hotel Performance above for the trend over time.</p>
        </SectionCard>

        {/* Promotion performance */}
        <SectionCard title="Promotion Performance" action={
          <span onClick={() => navigate('/promotions')} style={{ fontSize: '11px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Manage →</span>
        }>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{activePromotions.length}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Active Promotions</p>
            </div>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{promoBookingsInPeriod.length}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Bookings from Promotions</p>
            </div>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(promoRevenueInPeriod))}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Revenue from Promotions</p>
            </div>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{fmtOrLocked(formatNaira(promoAvgValue))}</p>
              <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Avg Value (Promo Bookings)</p>
            </div>
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
