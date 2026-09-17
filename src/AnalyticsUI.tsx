// Shared building blocks for category-specific company analytics pages
// (HotelAnalytics.tsx, TransportAnalytics.tsx, and future ones).
// Keeping these in one place is what lets each category page reuse the
// same professional trend-chart engine instead of rebuilding it.
import { useEffect, useRef, useState } from 'react'
import { createChart, AreaSeries, ColorType, type IChartApi, type ISeriesApi } from 'lightweight-charts'

export const COLORS = {
  primary: '#0EA5E9',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  greenBg: '#F0FDF4',
  red: '#dc2626',
  redBg: '#FEF2F2',
  orange: '#d97706',
  orangeBg: '#FFFBEB',
  purple: '#7c3aed',
  purpleBg: '#F5F3FF',
}

export const DAY_MS = 86400000

export function formatNaira(n: number) {
  return '₦' + Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 })
}
export function formatCompactNaira(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return '₦' + (n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1) + 'M'
  if (abs >= 1_000) return '₦' + (n / 1_000).toFixed(abs >= 10_000 ? 0 : 1) + 'K'
  return '₦' + Math.round(n).toLocaleString()
}
export function pctChange(curr: number, prev: number) {
  if (prev > 0) return Math.round(((curr - prev) / prev) * 100)
  return curr > 0 ? 100 : 0
}
export function sum(arr: number[]) { return arr.reduce((a, b) => a + b, 0) }
export function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }

// ---------- Date range ----------
export type RangeKey = 'today' | '7d' | '30d' | '3m' | '6m' | '1y'
export const RANGE_OPTIONS: { key: RangeKey; label: string; days: number }[] = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '3m', label: '3M', days: 90 },
  { key: '6m', label: '6M', days: 180 },
  { key: '1y', label: '1Y', days: 365 },
]

export function windowForRange(range: RangeKey, now: Date): { start: Date; end: Date } {
  if (range === 'today') return { start: startOfDay(now), end: now }
  const opt = RANGE_OPTIONS.find((r) => r.key === range)!
  return { start: new Date(now.getTime() - opt.days * DAY_MS), end: now }
}

export type Bucket = { start: Date; end: Date; label: string; fullLabel: string }

export function buildBuckets(range: RangeKey, now: Date): Bucket[] {
  const today0 = startOfDay(now)
  const buckets: Bucket[] = []
  if (range === '7d' || range === '30d') {
    const n = range === '7d' ? 7 : 30
    for (let i = n - 1; i >= 0; i--) {
      const start = new Date(today0.getTime() - i * DAY_MS)
      const end = new Date(start.getTime() + DAY_MS)
      buckets.push({
        start, end,
        label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullLabel: start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      })
    }
  } else if (range === '3m' || range === '6m') {
    const weeks = range === '3m' ? 13 : 26
    for (let i = weeks - 1; i >= 0; i--) {
      const end = new Date(today0.getTime() - i * 7 * DAY_MS + DAY_MS)
      const start = new Date(end.getTime() - 7 * DAY_MS)
      buckets.push({
        start, end,
        label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullLabel: `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      })
    }
  } else if (range === '1y') {
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      buckets.push({
        start, end,
        label: start.toLocaleDateString('en-US', { month: 'short' }),
        fullLabel: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      })
    }
  }
  return buckets
}

// ---------- Small UI atoms ----------
export function KpiCard({ label, value, delta, deltaGood, sub }: { label: string; value: string; delta?: string; deltaGood?: boolean; sub?: string }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '13px', flex: '1 1 45%', minWidth: '135px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '6px' }}>{label}</p>
      <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text, lineHeight: 1.1 }}>{value}</p>
      {delta && <p style={{ fontSize: '10.5px', fontWeight: 700, color: deltaGood ? COLORS.green : COLORS.red, marginTop: '5px' }}>{delta}</p>}
      {sub && <p style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '3px' }}>{sub}</p>}
    </div>
  )
}

export function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '16px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

export function EmptyNote({ text }: { text: string }) {
  return <p style={{ fontSize: '12px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '18px 0' }}>{text}</p>
}

// ---------- Trend chart ----------
// Built on TradingView's own `lightweight-charts` library (npm: lightweight-charts)
// per Rabeel's explicit choice, instead of the earlier hand-built SVG version.
// Note: the library's free/open-source usage requires keeping its small
// attribution logo visible in the chart corner (layout.attributionLogo) —
// this isn't optional styling, it's a license condition, so it's left on.
function timeKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function TrendChart({
  buckets, series, activeMetric, valueFormatter, renderTooltipRows,
}: {
  buckets: Bucket[]
  series: number[]
  allSeries: Record<string, number[]>
  activeMetric: string
  valueFormatter: (key: string, v: number) => string
  renderTooltipRows: (idx: number) => { label: string; value: string }[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const timeIndexRef = useRef<Record<string, number>>({})
  const [tooltip, setTooltip] = useState<{ x: number; y: number; idx: number } | null>(null)

  const hasData = buckets.length >= 2 && !series.every((v) => v === 0)

  // Create the chart once.
  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 220,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: COLORS.textMuted, fontSize: 10, attributionLogo: true },
      grid: { vertLines: { visible: false }, horzLines: { color: COLORS.border, style: 1 } },
      rightPriceScale: { borderColor: COLORS.border },
      timeScale: { borderColor: COLORS.border, fixLeftEdge: true, fixRightEdge: true },
      crosshair: {
        vertLine: { color: COLORS.textMuted, width: 1, style: 2, labelVisible: false },
        horzLine: { visible: false, labelVisible: false },
      },
      handleScroll: false,
      handleScale: false,
    })
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: COLORS.primary,
      topColor: 'rgba(14,165,233,0.28)',
      bottomColor: 'rgba(14,165,233,0)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    chartRef.current = chart
    seriesRef.current = areaSeries

    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time) { setTooltip(null); return }
      const idx = timeIndexRef.current[String(param.time)]
      if (idx === undefined) { setTooltip(null); return }
      setTooltip({ x: param.point.x, y: param.point.y, idx })
    })

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.resize(containerRef.current.clientWidth, 220)
    })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; seriesRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Push new data whenever the buckets/series/metric change.
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || !hasData) return
    const idxMap: Record<string, number> = {}
    const points = buckets.map((bk, i) => {
      const key = timeKey(bk.start)
      idxMap[key] = i
      return { time: key as any, value: series[i] }
    })
    timeIndexRef.current = idxMap
    seriesRef.current.setData(points)
    chartRef.current.applyOptions({
      localization: { priceFormatter: (v: number) => valueFormatter(activeMetric, v) },
    })
    chartRef.current.timeScale().fitContent()
    setTooltip(null)
  }, [buckets, series, activeMetric, valueFormatter, hasData])

  if (buckets.length < 2) return <EmptyNote text="Not enough data to display this trend." />
  if (!hasData) return <EmptyNote text="No data available for this period." />

  return (
    <div style={{ position: 'relative' as const }}>
      <div ref={containerRef} style={{ width: '100%', touchAction: 'pan-y' }} />
      {tooltip && (
        <div style={{
          position: 'absolute' as const, top: '4px',
          left: `${Math.max(4, Math.min(66, (tooltip.x / (containerRef.current?.clientWidth || 340)) * 100))}%`,
          transform: tooltip.x > (containerRef.current?.clientWidth || 340) * 0.66 ? 'translateX(-100%)' : 'translateX(0%)',
          background: COLORS.text, color: 'white', borderRadius: '9px', padding: '9px 11px', fontSize: '11px',
          minWidth: '132px', pointerEvents: 'none' as const, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', zIndex: 5,
        }}>
          <p style={{ fontWeight: 700, marginBottom: '5px', opacity: 0.85 }}>{buckets[tooltip.idx].fullLabel}</p>
          {renderTooltipRows(tooltip.idx).map((row) => (
            <p key={row.label}>{row.label}: <b>{row.value}</b></p>
          ))}
        </div>
      )}
    </div>
  )
}
