// Shared building blocks for category-specific company analytics pages
// (HotelAnalytics.tsx, TransportAnalytics.tsx, and future ones).
// Keeping these in one place is what lets each category page reuse the
// same professional trend-chart engine instead of rebuilding it.
import { useRef, useState } from 'react'

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

// ---------- Trend chart (TradingView-style interaction: crosshair, tooltip, touch) ----------
// Generic over any set of named metric series so every category page can
// plug in its own metrics without rebuilding the chart engine.
export function TrendChart({
  buckets, series, allSeries, activeMetric, valueFormatter, renderTooltipRows,
}: {
  buckets: Bucket[]
  series: number[]
  allSeries: Record<string, number[]>
  activeMetric: string
  valueFormatter: (key: string, v: number) => string
  renderTooltipRows: (idx: number) => { label: string; value: string }[]
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (buckets.length < 2) return <EmptyNote text="Not enough data to display this trend." />
  if (series.every((v) => v === 0)) return <EmptyNote text="No data available for this period." />

  const W = 340, H = 170, PAD_TOP = 16, PAD_BOTTOM = 26, PAD_LEFT = 4, PAD_RIGHT = 4
  const plotW = W - PAD_LEFT - PAD_RIGHT
  const plotH = H - PAD_TOP - PAD_BOTTOM
  const n = series.length

  const maxVal = Math.max(...series, activeMetric === 'occupancy' ? 100 : 1) * 1.08
  const minVal = 0
  const range = maxVal - minVal || 1

  const xFor = (i: number) => PAD_LEFT + (n <= 1 ? 0 : (i / (n - 1)) * plotW)
  const yFor = (v: number) => PAD_TOP + plotH - ((v - minVal) / range) * plotH

  const linePoints = series.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ')
  const areaPoints = `${xFor(0)},${yFor(minVal)} ${linePoints} ${xFor(n - 1)},${yFor(minVal)}`
  const gridFracs = [0, 0.33, 0.66, 1]
  const labelStep = Math.max(1, Math.ceil(n / 5))

  const handlePointer = (clientX: number) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = ((clientX - rect.left) / rect.width) * W
    const t = Math.max(0, Math.min(1, (relX - PAD_LEFT) / plotW))
    setHoverIdx(Math.round(t * (n - 1)))
  }

  const hi = hoverIdx !== null ? Math.max(0, Math.min(n - 1, hoverIdx)) : null
  const leftPct = hi !== null ? (xFor(hi) / W) * 100 : 50
  const tooltipTransform = leftPct < 18 ? 'translateX(0%)' : leftPct > 82 ? 'translateX(-100%)' : 'translateX(-50%)'

  return (
    <div style={{ position: 'relative' as const }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={(e) => handlePointer(e.clientX)}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); handlePointer(e.clientX) }}
        onPointerLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="analyticsTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.primary} stopOpacity="0.28" />
            <stop offset="100%" stopColor={COLORS.primary} stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridFracs.map((f) => {
          const y = PAD_TOP + plotH * f
          const val = maxVal - range * f
          return (
            <g key={f}>
              <line x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={y} y2={y} stroke={COLORS.border} strokeWidth="1" strokeDasharray="3,3" />
              <text x={PAD_LEFT} y={y - 3} fontSize="8" fill={COLORS.textMuted}>{valueFormatter(activeMetric, val)}</text>
            </g>
          )
        })}

        {buckets.map((bk, i) => (
          i % labelStep === 0 ? <text key={i} x={xFor(i)} y={H - 8} fontSize="8" fill={COLORS.textMuted} textAnchor="middle">{bk.label}</text> : null
        ))}

        <polygon points={areaPoints} fill="url(#analyticsTrendFill)" />
        <polyline points={linePoints} fill="none" stroke={COLORS.primary} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {hi !== null && (
          <g>
            <line x1={xFor(hi)} x2={xFor(hi)} y1={PAD_TOP} y2={PAD_TOP + plotH} stroke={COLORS.textMuted} strokeWidth="1" strokeDasharray="2,2" />
            <circle cx={xFor(hi)} cy={yFor(series[hi])} r="4" fill={COLORS.primary} stroke="white" strokeWidth="2" />
          </g>
        )}
      </svg>

      {hi !== null && (
        <div style={{
          position: 'absolute' as const, top: '4px', left: `${leftPct}%`, transform: tooltipTransform,
          background: COLORS.text, color: 'white', borderRadius: '9px', padding: '9px 11px', fontSize: '11px',
          minWidth: '132px', pointerEvents: 'none' as const, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', zIndex: 5,
        }}>
          <p style={{ fontWeight: 700, marginBottom: '5px', opacity: 0.85 }}>{buckets[hi].fullLabel}</p>
          {renderTooltipRows(hi).map((row) => (
            <p key={row.label}>{row.label}: <b>{row.value}</b></p>
          ))}
        </div>
      )}
    </div>
  )
}
