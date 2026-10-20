import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'

// Founder Command Center: the founder's overview page.
// Data comes from ONE read-only database function: founder_command_center(p_days).
// It only works for super admins, so staff never receive these numbers.

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  red: '#dc2626',
  navy: '#0F172A',
  purple: '#7C3AED',
}

type CategoryRow = { category: string; gross: number; bookings: number }
type CompanyRow = { company_id: string; name: string | null; gross: number; bookings: number }
type DayRow = { day: string; gross: number; bookings: number }

type Overview = {
  period_days: number
  generated_at: string
  gross_booking_value: number
  gross_booking_value_prev: number
  bookings_count: number
  bookings_count_prev: number
  cancelled_count: number
  commission_earned: number
  commission_earned_prev: number
  commission_earned_all_time: number
  escrow_held: number
  escrow_held_count: number
  refunded_amount: number
  wallet_total_balance: number
  pending_withdrawal_requests_count: number
  pending_withdrawal_requests_amount: number
  pending_withdrawal_transactions_count: number
  pending_withdrawal_transactions_amount: number
  users_total: number
  users_new: number
  users_new_prev: number
  personal_total: number
  company_accounts_total: number
  companies_total: number
  companies_approved: number
  companies_awaiting_approval: number
  companies_business_suite: number
  open_support_tickets: number
  by_category: CategoryRow[]
  top_companies: CompanyRow[]
  daily: DayRow[]
}

const CATEGORY_LABELS: Record<string, string> = {
  hotel: 'Hotels',
  flight: 'Flights',
  tour: 'Tours',
  event_center: 'Event centers',
  bus: 'Buses',
  train: 'Trains',
  vehicle_rental: 'Vehicle rental',
}

const PERIODS = [7, 30, 90]

const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG')
const count = (n: number) => (n || 0).toLocaleString('en-NG')

function formatDay(day: string): string {
  const d = new Date(day + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Shows the change against the previous period of the same length.
function Delta({ current, previous }: { current: number; previous: number }) {
  let label = ''
  let color = COLORS.textMuted
  if (previous === 0 && current === 0) {
    label = 'No change'
  } else if (previous === 0) {
    label = 'New this period'
    color = COLORS.green
  } else {
    const pct = ((current - previous) / previous) * 100
    const rounded = Math.round(Math.abs(pct))
    if (rounded === 0) {
      label = 'No change'
    } else if (pct > 0) {
      label = `Up ${rounded}% on previous period`
      color = COLORS.green
    } else {
      label = `Down ${rounded}% on previous period`
      color = COLORS.red
    }
  }
  return <span style={{ fontSize: '11px', fontWeight: 600, color }}>{label}</span>
}

function KpiCard(props: {
  label: string
  value: string
  icon: string
  iconColor: string
  footer: ReactNode
}) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px 14px 12px 14px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: props.iconColor + '1A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={props.icon} size={15} color={props.iconColor} />
        </div>
        <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted }}>{props.label}</span>
      </div>
      <p style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text, marginBottom: '4px', wordBreak: 'break-word' as const }}>{props.value}</p>
      <div style={{ minHeight: '16px' }}>{props.footer}</div>
    </div>
  )
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '16px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '14px' }}>
        <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

function DailyChart({ data }: { data: DayRow[] }) {
  const W = 600
  const H = 140
  const max = Math.max(1, ...data.map((d) => d.gross))
  const gap = data.length > 45 ? 1 : 3
  const barW = data.length > 0 ? Math.max(1, (W - gap * (data.length - 1)) / data.length) : W
  const peak = data.reduce((best, d) => (d.gross > best.gross ? d : best), data[0] || { day: '', gross: 0, bookings: 0 })

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '140px', display: 'block' }} role="img" aria-label="Daily booking value">
        {data.map((d, i) => {
          const h = d.gross > 0 ? Math.max(3, (d.gross / max) * (H - 4)) : 2
          return (
            <rect key={d.day} x={i * (barW + gap)} y={H - h} width={barW} height={h} rx={1} fill={d.gross > 0 ? COLORS.primary : COLORS.border}>
              <title>{`${formatDay(d.day)}: ${naira(d.gross)} (${d.bookings} bookings)`}</title>
            </rect>
          )
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '8px', fontSize: '11px', color: COLORS.textMuted }}>
        <span>{data.length > 0 ? formatDay(data[0].day) : ''}</span>
        {peak && peak.gross > 0 && <span>Best day: {formatDay(peak.day)}, {naira(peak.gross)}</span>}
        <span>{data.length > 0 ? formatDay(data[data.length - 1].day) : ''}</span>
      </div>
    </div>
  )
}

function FounderOverview({ onNavigate }: { onNavigate: (key: string) => void }) {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (period: number) => {
    setLoading(true)
    setError('')
    const { data: result, error: rpcError } = await supabase.rpc('founder_command_center', { p_days: period })
    if (rpcError) {
      setError(rpcError.message || 'Could not load the overview.')
      setLoading(false)
      return
    }
    setData(result as Overview)
    setLoading(false)
  }, [])

  useEffect(() => {
    load(days)
  }, [days, load])

  const wrap: CSSProperties = { padding: '18px 20px 40px 20px' }
  const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '14px' }
  const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '12px', marginBottom: '14px' }

  if (error) {
    return (
      <div style={{ ...wrap, textAlign: 'center' as const, paddingTop: '60px' }}>
        <Icon name="alertCircle" size={28} color={COLORS.red} />
        <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.red, marginTop: '12px', marginBottom: '6px' }}>The overview could not be loaded</p>
        <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.6, marginBottom: '16px' }}>{error}</p>
        <span onClick={() => load(days)} style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Try again</span>
      </div>
    )
  }

  if (!data) {
    return <div style={{ ...wrap, color: COLORS.textMuted, fontSize: '13px', textAlign: 'center' as const, paddingTop: '60px' }}>Loading overview...</div>
  }

  // The withdrawal request queue and the transaction ledger are reported separately by the
  // database. The ledger is the larger source today, so it is the headline number.
  const withdrawalCount = Math.max(data.pending_withdrawal_transactions_count, data.pending_withdrawal_requests_count)
  const withdrawalAmount = Math.max(data.pending_withdrawal_transactions_amount, data.pending_withdrawal_requests_amount)

  const attention = [
    { key: 'withdrawals', label: 'Withdrawals waiting', value: withdrawalCount, detail: withdrawalCount > 0 ? naira(withdrawalAmount) : '', icon: 'arrowUpRight', color: COLORS.secondary },
    { key: 'companies', label: 'Companies awaiting approval', value: data.companies_awaiting_approval, detail: '', icon: 'building', color: COLORS.purple },
    { key: 'support', label: 'Open support tickets', value: data.open_support_tickets, detail: '', icon: 'chat', color: COLORS.primary },
    { key: 'bookings', label: 'Cancelled bookings this period', value: data.cancelled_count, detail: data.refunded_amount > 0 ? `${naira(data.refunded_amount)} refunded` : '', icon: 'refresh', color: COLORS.red },
  ].filter((a) => a.value > 0)

  const maxCategory = Math.max(1, ...data.by_category.map((c) => c.gross))
  const maxCompany = Math.max(1, ...data.top_companies.map((c) => c.gross))

  return (
    <div style={{ ...wrap, opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' as const, marginBottom: '16px' }}>
        <div>
          <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Founder command center</p>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>Last {data.period_days} days, compared with the {data.period_days} days before</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {PERIODS.map((p) => (
            <span
              key={p}
              onClick={() => setDays(p)}
              style={{
                padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                background: days === p ? COLORS.navy : COLORS.card,
                color: days === p ? '#fff' : COLORS.text,
                border: `1px solid ${days === p ? COLORS.navy : COLORS.border}`,
              }}>
              {p} days
            </span>
          ))}
          <span onClick={() => load(days)} title="Refresh" style={{ display: 'flex', cursor: 'pointer', padding: '6px' }}>
            <Icon name="refresh" size={16} color={COLORS.textMuted} />
          </span>
        </div>
      </div>

      <div style={grid}>
        <KpiCard label="Booking value" value={naira(data.gross_booking_value)} icon="cash" iconColor={COLORS.primary}
          footer={<Delta current={data.gross_booking_value} previous={data.gross_booking_value_prev} />} />
        <KpiCard label="Commission earned" value={naira(data.commission_earned)} icon="trendingUp" iconColor={COLORS.green}
          footer={<Delta current={data.commission_earned} previous={data.commission_earned_prev} />} />
        <KpiCard label="Held in escrow" value={naira(data.escrow_held)} icon="clipboard" iconColor={COLORS.secondary}
          footer={<span style={{ fontSize: '11px', color: COLORS.textMuted }}>{count(data.escrow_held_count)} bookings not yet checked in</span>} />
        <KpiCard label="Wallet balances" value={naira(data.wallet_total_balance)} icon="wallet" iconColor={COLORS.purple}
          footer={<span style={{ fontSize: '11px', color: COLORS.textMuted }}>All users and companies</span>} />
      </div>

      <div style={{ marginBottom: '14px' }}>
        <Panel title="Needs your attention">
          {attention.length === 0 ? (
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Nothing is waiting for you right now.</p>
          ) : (
            <div>
              {attention.map((a, i) => (
                <div
                  key={a.key}
                  onClick={() => onNavigate(a.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 0', cursor: 'pointer', borderTop: i === 0 ? 'none' : `1px solid ${COLORS.border}` }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: a.color + '1A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={a.icon} size={15} color={a.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.text }}>{a.label}</p>
                    {a.detail && <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>{a.detail}</p>}
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{count(a.value)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div style={grid}>
        <KpiCard label="Bookings" value={count(data.bookings_count)} icon="ticket" iconColor={COLORS.primary}
          footer={<Delta current={data.bookings_count} previous={data.bookings_count_prev} />} />
        <KpiCard label="New users" value={count(data.users_new)} icon="users" iconColor={COLORS.green}
          footer={<Delta current={data.users_new} previous={data.users_new_prev} />} />
        <KpiCard label="Total users" value={count(data.users_total)} icon="userPlus" iconColor={COLORS.purple}
          footer={<span style={{ fontSize: '11px', color: COLORS.textMuted }}>{count(data.personal_total)} personal, {count(data.company_accounts_total)} company</span>} />
        <KpiCard label="Companies" value={count(data.companies_approved)} icon="building" iconColor={COLORS.secondary}
          footer={<span style={{ fontSize: '11px', color: COLORS.textMuted }}>{count(data.companies_business_suite)} on Business Suite, {count(data.companies_total)} registered</span>} />
      </div>

      <div style={{ marginBottom: '14px' }}>
        <Panel title="Booking value each day">
          <DailyChart data={data.daily} />
        </Panel>
      </div>

      <div style={grid2}>
        <Panel title="Booking value by category" action={<span onClick={() => onNavigate('analytics')} style={{ fontSize: '12px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Open analytics</span>}>
          {data.by_category.length === 0 ? (
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>No bookings in this period yet.</p>
          ) : (
            data.by_category.map((c) => (
              <div key={c.category} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: COLORS.text }}>{CATEGORY_LABELS[c.category] || c.category}</span>
                  <span style={{ fontSize: '12px', color: COLORS.textMuted }}>{naira(c.gross)}, {count(c.bookings)} bookings</span>
                </div>
                <div style={{ height: '6px', borderRadius: '999px', background: '#F1F5F9' }}>
                  <div style={{ height: '6px', borderRadius: '999px', background: COLORS.primary, width: `${Math.max(2, (c.gross / maxCategory) * 100)}%` }} />
                </div>
              </div>
            ))
          )}
        </Panel>

        <Panel title="Top companies" action={<span onClick={() => onNavigate('companies')} style={{ fontSize: '12px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>All companies</span>}>
          {data.top_companies.length === 0 ? (
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>No bookings in this period yet.</p>
          ) : (
            data.top_companies.map((c) => (
              <div key={c.company_id} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: COLORS.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{c.name || 'Unnamed company'}</span>
                  <span style={{ fontSize: '12px', color: COLORS.textMuted, flexShrink: 0 }}>{naira(c.gross)}</span>
                </div>
                <div style={{ height: '6px', borderRadius: '999px', background: '#F1F5F9' }}>
                  <div style={{ height: '6px', borderRadius: '999px', background: COLORS.secondary, width: `${Math.max(2, (c.gross / maxCompany) * 100)}%` }} />
                </div>
              </div>
            ))
          )}
        </Panel>
      </div>

      <p style={{ fontSize: '11px', color: COLORS.textMuted, lineHeight: 1.6 }}>
        Booking value counts confirmed and completed bookings. Commission is recorded when a ticket is checked in, so it trails booking value. Escrow is money from confirmed bookings that have not been checked in yet. All time commission earned: {naira(data.commission_earned_all_time)}.
      </p>
    </div>
  )
}

export default FounderOverview
