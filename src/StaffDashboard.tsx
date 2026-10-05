import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import NotificationBell from './NotificationBell'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  bg: '#F1F5F9',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  greenBg: '#DCFCE7',
  red: '#dc2626',
  redBg: '#FEF2F2',
  amber: '#D97706',
  amberBg: '#FFF7ED',
  navy: '#0F172A',
  navySoft: '#1E293B',
  purple: '#7C3AED',
  purpleBg: '#F5F3FF',
}

// ---------------------------------------------------------------------------
// Navigation. Everything the sidebar shows is decided here, from the staff
// member's real permissions:
//   requires -> the page needs one of these exact permission keys
//   modules  -> the item shows when the staff member has any permission in
//               one of these modules (company_permissions.module)
//   kind 'section' = page built into this dashboard
//   kind 'route'   = an existing app page, opened via navigate()
// Every permission module now has a page: Operations, Company and Platform are
// built into this dashboard and use permission-checked database functions.
// ---------------------------------------------------------------------------
type NavItem = {
  key: string
  label: string
  icon: string
  group: 'Workspace' | 'Company' | 'Account'
  kind: 'section' | 'route'
  route?: string
  requires?: string[]
  modules?: string[]
}

const NAV: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: 'home', group: 'Workspace', kind: 'section' },
  { key: 'tasks', label: 'My Tasks', icon: 'checkCircle', group: 'Workspace', kind: 'section' },
  { key: 'bookings', label: 'Bookings', icon: 'ticket', group: 'Workspace', kind: 'section', requires: ['bookings.view'] },
  { key: 'tickets', label: 'Tickets & Check-in', icon: 'clipboard', group: 'Workspace', kind: 'route', route: '/verify-booking', modules: ['tickets', 'verification'] },
  { key: 'guests', label: 'Guests', icon: 'users', group: 'Workspace', kind: 'route', route: '/guests', modules: ['customers'] },
  { key: 'support', label: 'Support', icon: 'headphones', group: 'Workspace', kind: 'section', requires: ['support.view'] },

  { key: 'finance', label: 'Finance', icon: 'cash', group: 'Company', kind: 'section', requires: ['finance.view', 'finance.transactions'] },
  { key: 'refunds', label: 'Refunds', icon: 'refresh', group: 'Company', kind: 'section', requires: ['refunds.view'] },
  { key: 'analytics', label: 'Analytics', icon: 'barChart', group: 'Company', kind: 'route', route: '/analytics', requires: ['finance.view'] },
  { key: 'marketing', label: 'Marketing', icon: 'megaphone', group: 'Company', kind: 'route', route: '/promotions', modules: ['marketing'] },
  { key: 'team', label: 'Team', icon: 'users', group: 'Company', kind: 'section', requires: ['staff.view'] },
  { key: 'operations', label: 'Operations', icon: 'calendar', group: 'Company', kind: 'section', requires: ['operations.view', 'operations.manage', 'availability.manage', 'schedules.manage'] },
  { key: 'company', label: 'Company Profile', icon: 'briefcase', group: 'Company', kind: 'section', requires: ['company.view', 'company.edit', 'company.settings'] },
  { key: 'platform', label: 'Platform Settings', icon: 'settings', group: 'Company', kind: 'section', requires: ['platform.view', 'platform.edit', 'platform.manage'] },

  { key: 'access', label: 'My Access', icon: 'shield', group: 'Account', kind: 'section' },
  { key: 'profile', label: 'Profile', icon: 'user', group: 'Account', kind: 'section' },
]

const MODULE_LABELS: Record<string, string> = {
  bookings: 'Bookings', tickets: 'Tickets', customers: 'Guests', finance: 'Finance', refunds: 'Refunds',
  support: 'Support', platform: 'Platform', staff: 'Team', marketing: 'Marketing', operations: 'Operations',
  verification: 'Verification', company: 'Company',
}
function moduleLabel(mod: string) {
  return MODULE_LABELS[mod] || mod.charAt(0).toUpperCase() + mod.slice(1)
}
// Modules that have no page in the app yet (none at the moment).
const MODULES_WITHOUT_PAGE = new Set<string>()

type PermRow = { key: string; module: string; description: string; risk_level: string }
type StaffInfo = {
  id: string
  company_id: string
  template_id: string | null
  role_label: string | null
  status: string
  joined_at: string | null
  last_active_at: string | null
}
type Task = { id: string; title: string; priority: string; status: string; created_at: string }
type ActivityRow = { id: string; action: string; module: string; created_at: string }

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function useIsDesktop(breakpoint = 900) {
  const [desktop, setDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= breakpoint : false)
  useEffect(() => {
    const onResize = () => setDesktop(window.innerWidth >= breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return desktop
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fmtMoney = (n: number | string | null | undefined) =>
  `₦${Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`
const prettify = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

function Avatar({ label, size = 40 }: { label: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: COLORS.primary,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.4, fontWeight: 700, flexShrink: 0,
    }}>
      {(label[0] || '?').toUpperCase()}
    </div>
  )
}

function Pill({ status, label }: { status: string; label?: string }) {
  const v = status.toLowerCase()
  let color = COLORS.textMuted
  let bg = '#F1F5F9'
  if (['confirmed', 'completed', 'active', 'success', 'successful', 'approved', 'resolved', 'done', 'paid'].includes(v)) { color = COLORS.green; bg = COLORS.greenBg }
  else if (['cancelled', 'rejected', 'failed', 'suspended', 'declined'].includes(v)) { color = COLORS.red; bg = COLORS.redBg }
  else if (['pending', 'open', 'in_progress', 'waiting', 'processing'].includes(v)) { color = COLORS.amber; bg = COLORS.amberBg }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, padding: '3px 9px', borderRadius: 6, whiteSpace: 'nowrap' as const }}>
      {label || prettify(status)}
    </span>
  )
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div style={{ padding: '36px 16px', textAlign: 'center' as const }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
        <Icon name={icon} size={20} color={COLORS.textMuted} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{title}</p>
      <p style={{ fontSize: 12.5, color: COLORS.textMuted }}>{subtitle}</p>
    </div>
  )
}

function Card({ title, action, children, pad = 20 }: { title?: string; action?: React.ReactNode; children: React.ReactNode; pad?: number }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: pad }}>
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          {title && <p style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{title}</p>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

function Kpi({ label, value, icon, note }: { label: string; value: string; icon: string; note?: string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={20} color={COLORS.primary} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, lineHeight: 1.1 }}>{value}</p>
        <p style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 3 }}>{label}</p>
        {note && <p style={{ fontSize: 10.5, color: COLORS.textMuted, marginTop: 2 }}>{note}</p>}
      </div>
    </div>
  )
}

type Col = { label: string; render: (r: any) => React.ReactNode; align?: 'left' | 'right' }
function DataTable({ cols, rows, emptyIcon, emptyTitle, emptyText }: {
  cols: Col[]; rows: any[]; emptyIcon: string; emptyTitle: string; emptyText: string
}) {
  if (rows.length === 0) return <EmptyState icon={emptyIcon} title={emptyTitle} subtitle={emptyText} />
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' as const, minWidth: 560 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.label} style={{
                textAlign: c.align || 'left', fontSize: 11, fontWeight: 800, color: COLORS.textMuted,
                letterSpacing: 0.4, padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}`, whiteSpace: 'nowrap' as const,
              }}>{c.label.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i}>
              {cols.map((c) => (
                <td key={c.label} style={{
                  textAlign: c.align || 'left', fontSize: 13, color: COLORS.text, padding: '12px',
                  borderBottom: `1px solid ${COLORS.border}`, verticalAlign: 'middle' as const,
                }}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LinkButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <span onClick={onClick} style={{
      fontSize: 12.5, fontWeight: 700, color: COLORS.primary, cursor: 'pointer',
      border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: '7px 13px', background: '#fff', whiteSpace: 'nowrap' as const,
    }}>{label}</span>
  )
}

function FilterChips({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
      {options.map(([k, label]) => (
        <span key={k} onClick={() => onChange(k)} style={{
          fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
          color: value === k ? COLORS.primary : COLORS.textMuted,
          background: value === k ? '#EFF6FF' : '#fff',
          border: `1px solid ${value === k ? COLORS.primary : COLORS.border}`,
        }}>{label}</span>
      ))}
    </div>
  )
}

const searchInput: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: 13,
  background: '#fff', outline: 'none', minWidth: 220, color: COLORS.text,
}

// ---------------------------------------------------------------------------
// Pages. Each one loads its own data when opened, so staff only ever request
// what their permissions allow. Row-level security in the database is the real
// gate; these pages simply never ask for data the role cannot see.
// ---------------------------------------------------------------------------
function BookingsPage({ companyId, canSeeAmounts, canManage, go }: {
  companyId: string; canSeeAmounts: boolean; canManage: boolean; go: (route: string) => void
}) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from('bookings')
        .select('id, ticket_code, customer_name, booking_status, amount_paid, created_at, check_in_date, checked_in, services(title, category)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (err) setError(err.message)
      setRows(data || [])
      setLoading(false)
    })()
  }, [companyId])

  const filtered = rows.filter((r) => {
    if (status !== 'all' && r.booking_status !== status) return false
    if (q.trim()) {
      const s = q.toLowerCase()
      return (r.customer_name || '').toLowerCase().includes(s) || (r.ticket_code || '').toLowerCase().includes(s)
    }
    return true
  })

  const cols: Col[] = [
    { label: 'Ticket', render: (r) => <span style={{ fontWeight: 700 }}>{r.ticket_code || '—'}</span> },
    { label: 'Customer', render: (r) => r.customer_name || '—' },
    { label: 'Service', render: (r) => (
      <span>{r.services?.title || '—'}{r.services?.category && <span style={{ color: COLORS.textMuted }}> · {prettify(r.services.category)}</span>}</span>
    ) },
    { label: 'Date', render: (r) => fmtDate(r.check_in_date || r.created_at) },
    { label: 'Status', render: (r) => <Pill status={r.booking_status || 'unknown'} /> },
    { label: 'Checked in', render: (r) => r.checked_in ? <Icon name="check" size={15} color={COLORS.green} /> : <span style={{ color: COLORS.textMuted }}>—</span> },
    ...(canSeeAmounts
      ? [{ label: 'Amount', align: 'right' as const, render: (r: any) => <span style={{ fontWeight: 700 }}>{fmtMoney(r.amount_paid)}</span> }]
      : []),
  ]

  return (
    <Card pad={0}>
      <div style={{ padding: 18, display: 'flex', gap: 12, flexWrap: 'wrap' as const, alignItems: 'center', justifyContent: 'space-between' }}>
        <FilterChips
          value={status} onChange={setStatus}
          options={[['all', 'All'], ['confirmed', 'Confirmed'], ['completed', 'Completed'], ['cancelled', 'Cancelled']]}
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as const }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer or ticket" style={searchInput} />
          {canManage && <LinkButton label="Open Bookings Management" onClick={() => go('/bookings-management')} />}
        </div>
      </div>
      {loading ? (
        <p style={{ padding: 24, fontSize: 13, color: COLORS.textMuted }}>Loading bookings...</p>
      ) : error ? (
        <p style={{ padding: 24, fontSize: 13, color: COLORS.red }}>{error}</p>
      ) : (
        <DataTable cols={cols} rows={filtered} emptyIcon="ticket" emptyTitle="No bookings found" emptyText="Bookings for your company will appear here." />
      )}
      {!loading && !error && rows.length >= 100 && (
        <p style={{ padding: '10px 18px 16px', fontSize: 11.5, color: COLORS.textMuted }}>Showing the latest 100 bookings.</p>
      )}
    </Card>
  )
}

function SupportPage({ companyId, go }: { companyId: string; go: (route: string) => void }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from('support_tickets')
        .select('id, ticket_code, subject, category, status, created_at')
        .eq('company_id', companyId)
        .eq('requester_type', 'company')
        .order('created_at', { ascending: false })
        .limit(100)
      if (err) setError(err.message)
      setRows(data || [])
      setLoading(false)
    })()
  }, [companyId])

  const statusLabel = (s: string) => s === 'waiting' ? 'Waiting for You' : prettify(s)

  return (
    <Card pad={0}>
      <div style={{ padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const }}>
        <p style={{ fontSize: 13, color: COLORS.textMuted }}>Your company's tickets with TravelerCom support.</p>
        <LinkButton label="Open Support Centre" onClick={() => go('/support')} />
      </div>
      {loading ? (
        <p style={{ padding: 24, fontSize: 13, color: COLORS.textMuted }}>Loading tickets...</p>
      ) : error ? (
        <p style={{ padding: 24, fontSize: 13, color: COLORS.red }}>{error}</p>
      ) : (
        <DataTable
          cols={[
            { label: 'Ticket', render: (r) => <span style={{ fontWeight: 700 }}>{r.ticket_code || '—'}</span> },
            { label: 'Subject', render: (r) => r.subject },
            { label: 'Category', render: (r) => r.category || 'General' },
            { label: 'Status', render: (r) => <Pill status={r.status} label={statusLabel(r.status)} /> },
            { label: 'Opened', render: (r) => fmtDate(r.created_at) },
          ]}
          rows={rows} emptyIcon="headphones" emptyTitle="No support tickets" emptyText="Tickets raised for your company will appear here."
        />
      )}
    </Card>
  )
}

function FinancePage({ companyId, canWallet, canTransactions }: { companyId: string; canWallet: boolean; canTransactions: boolean }) {
  const [wallet, setWallet] = useState<{ id: string; balance: number } | null>(null)
  const [tx, setTx] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')

  useEffect(() => {
    (async () => {
      // The company wallet belongs to the company owner.
      const { data: company } = await supabase.from('companies').select('owner_id').eq('id', companyId).maybeSingle()
      if (!company?.owner_id) {
        setNote('Company wallet details are not available yet.')
        setLoading(false)
        return
      }
      const { data: w } = await supabase.from('wallets').select('id, balance').eq('user_id', company.owner_id).maybeSingle()
      if (w && canWallet) setWallet(w as any)
      if (w && canTransactions) {
        const { data: t } = await supabase
          .from('transactions')
          .select('id, transaction_type, amount, status, payment_reference, created_at')
          .eq('wallet_id', w.id)
          .order('created_at', { ascending: false })
          .limit(100)
        setTx(t || [])
      }
      if (!w) setNote('No company wallet found yet.')
      setLoading(false)
    })()
  }, [companyId, canWallet, canTransactions])

  if (loading) return <p style={{ fontSize: 13, color: COLORS.textMuted }}>Loading finance...</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
      {note && <Card><p style={{ fontSize: 13, color: COLORS.textMuted }}>{note}</p></Card>}
      {canWallet && wallet && (
        <div style={{ maxWidth: 360 }}>
          <Kpi label="Company wallet balance" value={fmtMoney(wallet.balance)} icon="cash" />
        </div>
      )}
      {canTransactions && (
        <Card title="Recent Transactions" pad={0}>
          <DataTable
            cols={[
              { label: 'Type', render: (r) => prettify(r.transaction_type || 'transaction') },
              { label: 'Reference', render: (r) => <span style={{ color: COLORS.textMuted }}>{r.payment_reference || '—'}</span> },
              { label: 'Status', render: (r) => <Pill status={r.status || 'unknown'} /> },
              { label: 'Date', render: (r) => fmtDate(r.created_at) },
              { label: 'Amount', align: 'right', render: (r) => <span style={{ fontWeight: 700 }}>{fmtMoney(r.amount)}</span> },
            ]}
            rows={tx} emptyIcon="cash" emptyTitle="No transactions yet" emptyText="Wallet transactions will appear here."
          />
        </Card>
      )}
      {!canTransactions && canWallet && (
        <p style={{ fontSize: 12, color: COLORS.textMuted }}>Your role does not include transaction history.</p>
      )}
    </div>
  )
}

function RefundsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      // Row-level security limits this to refunds on this company's bookings.
      const { data, error: err } = await supabase
        .from('refund_requests')
        .select('id, reason, amount, status, created_at, resolved_at, bookings(ticket_code, customer_name)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (err) setError(err.message)
      setRows(data || [])
      setLoading(false)
    })()
  }, [])

  return (
    <Card pad={0}>
      {loading ? (
        <p style={{ padding: 24, fontSize: 13, color: COLORS.textMuted }}>Loading refunds...</p>
      ) : error ? (
        <p style={{ padding: 24, fontSize: 13, color: COLORS.red }}>{error}</p>
      ) : (
        <DataTable
          cols={[
            { label: 'Booking', render: (r) => <span style={{ fontWeight: 700 }}>{r.bookings?.ticket_code || '—'}</span> },
            { label: 'Customer', render: (r) => r.bookings?.customer_name || '—' },
            { label: 'Reason', render: (r) => <span style={{ color: COLORS.textMuted }}>{r.reason || '—'}</span> },
            { label: 'Status', render: (r) => <Pill status={r.status || 'unknown'} /> },
            { label: 'Requested', render: (r) => fmtDate(r.created_at) },
            { label: 'Amount', align: 'right', render: (r) => <span style={{ fontWeight: 700 }}>{fmtMoney(r.amount)}</span> },
          ]}
          rows={rows} emptyIcon="refresh" emptyTitle="No refund requests" emptyText="Refund requests for your company will appear here."
        />
      )}
    </Card>
  )
}

function TeamPage({ companyId, canManage, go }: { companyId: string; canManage: boolean; go: (route: string) => void }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      const { data: staffRows, error: err } = await supabase
        .from('company_staff')
        .select('id, user_id, template_id, role_label, status, joined_at, last_active_at')
        .eq('company_id', companyId)
        .order('joined_at', { ascending: true })
      if (err) { setError(err.message); setLoading(false); return }
      const list = staffRows || []
      const userIds = list.map((s: any) => s.user_id)
      const [{ data: profs }, { data: templates }] = await Promise.all([
        userIds.length ? supabase.from('profiles').select('id, full_name').in('id', userIds) : Promise.resolve({ data: [] } as any),
        supabase.from('company_role_templates').select('id, name'),
      ])
      const nameById: Record<string, string> = {}
      for (const p of (profs || []) as any[]) nameById[p.id] = p.full_name
      const tplById: Record<string, string> = {}
      for (const t of (templates || []) as any[]) tplById[t.id] = t.name
      setRows(list.map((s: any) => ({
        ...s,
        name: nameById[s.user_id] || 'Team member',
        role: (s.template_id && tplById[s.template_id]) || s.role_label || 'Staff',
      })))
      setLoading(false)
    })()
  }, [companyId])

  return (
    <Card pad={0}>
      {canManage && (
        <div style={{ padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const }}>
          <p style={{ fontSize: 13, color: COLORS.textMuted }}>Manage roles, permissions and invitations.</p>
          <LinkButton label="Open Staff & Access" onClick={() => go(`/staff?company=${companyId}`)} />
        </div>
      )}
      {loading ? (
        <p style={{ padding: 24, fontSize: 13, color: COLORS.textMuted }}>Loading team...</p>
      ) : error ? (
        <p style={{ padding: 24, fontSize: 13, color: COLORS.red }}>{error}</p>
      ) : (
        <DataTable
          cols={[
            { label: 'Name', render: (r) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar label={r.name} size={30} />
                <span style={{ fontWeight: 700 }}>{r.name}</span>
              </div>
            ) },
            { label: 'Role', render: (r) => r.role },
            { label: 'Status', render: (r) => <Pill status={r.status} /> },
            { label: 'Joined', render: (r) => fmtDate(r.joined_at) },
            { label: 'Last active', render: (r) => fmtDate(r.last_active_at) },
          ]}
          rows={rows} emptyIcon="users" emptyTitle="No team members" emptyText="Staff added to your company will appear here."
        />
      )}
    </Card>
  )
}

const fieldLabel: React.CSSProperties = { fontSize: 11.5, fontWeight: 800, color: COLORS.textMuted, letterSpacing: 0.4, marginBottom: 5, display: 'block' }
const fieldInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
  border: `1px solid ${COLORS.border}`, fontSize: 13, background: '#fff', outline: 'none', color: COLORS.text,
}
const primaryBtn: React.CSSProperties = {
  border: 'none', background: COLORS.primary, color: '#fff', borderRadius: 10,
  padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}

const toLocalInput = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

// Operations: availability and schedules for the company's listings.
function OperationsPage({ companyId, canAvailability, canSchedule }: { companyId: string; canAvailability: boolean; canSchedule: boolean }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [seats, setSeats] = useState('')
  const [status, setStatus] = useState('active')
  const [departure, setDeparture] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data, error: err } = await supabase.rpc('staff_list_services', { p_company_id: companyId })
    if (err) setError(err.message)
    setRows((data as any[]) || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [companyId])

  const startEdit = (r: any) => {
    setEditing(r.id)
    setSeats(r.seats_available == null ? '' : String(r.seats_available))
    setStatus(r.status === 'active' ? 'active' : 'inactive')
    setDeparture(toLocalInput(r.departure_time))
    setError('')
  }

  const save = async (r: any) => {
    setSaving(true)
    setError('')
    const { error: err } = await supabase.rpc('staff_update_service', {
      p_company_id: companyId,
      p_service_id: r.id,
      p_seats_available: canAvailability && seats !== '' ? Number(seats) : null,
      p_status: canAvailability ? status : null,
      p_departure_time: canSchedule && departure ? new Date(departure).toISOString() : null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setEditing(null)
    await load()
  }

  const canEdit = canAvailability || canSchedule

  return (
    <Card pad={0}>
      {loading ? (
        <p style={{ padding: 24, fontSize: 13, color: COLORS.textMuted }}>Loading listings...</p>
      ) : (
        <>
          {error && <p style={{ padding: '16px 18px 0', fontSize: 13, color: COLORS.red }}>{error}</p>}
          <DataTable
            cols={[
              { label: 'Listing', render: (r) => (
                <span><span style={{ fontWeight: 700 }}>{r.title || '—'}</span>{r.category && <span style={{ color: COLORS.textMuted }}> · {prettify(r.category)}</span>}</span>
              ) },
              { label: 'Route', render: (r) => (r.origin ? `${r.origin} → ${r.destination || ''}` : (r.destination || '—')) },
              { label: 'Departure', render: (r) => editing === r.id && canSchedule
                ? <input type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)} style={{ ...fieldInput, minWidth: 190 }} />
                : (r.departure_time ? new Date(r.departure_time).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—') },
              { label: 'Seats', render: (r) => editing === r.id && canAvailability
                ? <input type="number" min={0} value={seats} onChange={(e) => setSeats(e.target.value)} style={{ ...fieldInput, width: 90 }} />
                : (r.seats_available ?? '—') },
              { label: 'Status', render: (r) => editing === r.id && canAvailability
                ? (
                  <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...fieldInput, width: 110 }}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                )
                : <Pill status={r.status || 'unknown'} /> },
              ...(canEdit ? [{ label: 'Action', align: 'right' as const, render: (r: any) => editing === r.id ? (
                <span style={{ display: 'inline-flex', gap: 8 }}>
                  <button disabled={saving} onClick={() => save(r)} style={{ ...primaryBtn, padding: '7px 14px', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
                  <LinkButton label="Cancel" onClick={() => setEditing(null)} />
                </span>
              ) : <LinkButton label="Edit" onClick={() => startEdit(r)} /> }] : []),
            ]}
            rows={rows} emptyIcon="calendar" emptyTitle="No listings yet" emptyText="Your company's listings will appear here."
          />
          {!canEdit && <p style={{ padding: '10px 18px 16px', fontSize: 11.5, color: COLORS.textMuted }}>Your role can view operations but not change them.</p>}
        </>
      )}
    </Card>
  )
}

// Company: profile details. Name, bank details, plan and approval stay owner/admin-only.
function CompanyPage({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const [info, setInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ description: '', phone: '', email: '', address: '', city: '', opening_time: '', closing_time: '' })

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase.rpc('staff_get_company_profile', { p_company_id: companyId })
      if (err) { setError(err.message); setLoading(false); return }
      setInfo(data)
      setForm({
        description: data?.description || '', phone: data?.phone || '', email: data?.email || '',
        address: data?.address || '', city: data?.city || '',
        opening_time: data?.opening_time || '', closing_time: data?.closing_time || '',
      })
      setLoading(false)
    })()
  }, [companyId])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setSaving(true); setError(''); setSaved(false)
    const { error: err } = await supabase.rpc('staff_update_company_profile', {
      p_company_id: companyId,
      p_description: form.description, p_phone: form.phone, p_email: form.email,
      p_address: form.address, p_city: form.city,
      p_opening_time: form.opening_time, p_closing_time: form.closing_time,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
  }

  if (loading) return <p style={{ fontSize: 13, color: COLORS.textMuted }}>Loading company profile...</p>
  if (error && !info) return <Card><p style={{ fontSize: 13, color: COLORS.red }}>{error}</p></Card>

  const field = (label: string, key: keyof typeof form, multiline = false) => (
    <div style={{ marginBottom: 14 }}>
      <label style={fieldLabel}>{label.toUpperCase()}</label>
      {canEdit ? (
        multiline
          ? <textarea value={form[key]} onChange={set(key)} rows={4} style={{ ...fieldInput, resize: 'vertical' as const, fontFamily: 'inherit' }} />
          : <input value={form[key]} onChange={set(key)} style={fieldInput} />
      ) : (
        <p style={{ fontSize: 13.5, color: COLORS.text }}>{form[key] || '—'}</p>
      )}
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
      <Card title="Business">
        {[
          ['Business name', info?.business_name || '—'],
          ['Business type', info?.business_type ? prettify(info.business_type) : '—'],
          ['Approval', info?.approval_status ? prettify(info.approval_status) : '—'],
          ['Verification', info?.verification_status ? prettify(info.verification_status) : '—'],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: 13, color: COLORS.textMuted }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{value}</span>
          </div>
        ))}
        <p style={{ fontSize: 11.5, color: COLORS.textMuted, marginTop: 12 }}>The business name, bank details and approval can only be changed by the company owner.</p>
      </Card>
      <Card title="Contact & hours">
        {field('Description', 'description', true)}
        {field('Phone', 'phone')}
        {field('Email', 'email')}
        {field('Address', 'address')}
        {field('City', 'city')}
        {field('Opening time', 'opening_time')}
        {field('Closing time', 'closing_time')}
        {error && <p style={{ fontSize: 12.5, color: COLORS.red, marginBottom: 10 }}>{error}</p>}
        {saved && <p style={{ fontSize: 12.5, color: COLORS.green, marginBottom: 10 }}>Saved.</p>}
        {canEdit
          ? <button disabled={saving} onClick={save} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save changes'}</button>
          : <p style={{ fontSize: 11.5, color: COLORS.textMuted }}>Your role can view the company profile but not edit it.</p>}
      </Card>
    </div>
  )
}

// Platform: how the company is set up on TravelerCom.
function PlatformPage({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const [info, setInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase.rpc('staff_get_platform_settings', { p_company_id: companyId })
      if (err) setError(err.message)
      setInfo(data)
      setLoading(false)
    })()
  }, [companyId])

  const toggleUnits = async () => {
    if (!info) return
    setSaving(true); setError('')
    const next = !info.allow_unit_selection
    const { error: err } = await supabase.rpc('staff_set_unit_selection', { p_company_id: companyId, p_allow: next })
    setSaving(false)
    if (err) { setError(err.message); return }
    setInfo({ ...info, allow_unit_selection: next })
  }

  if (loading) return <p style={{ fontSize: 13, color: COLORS.textMuted }}>Loading platform settings...</p>
  if (error && !info) return <Card><p style={{ fontSize: 13, color: COLORS.red }}>{error}</p></Card>

  return (
    <div style={{ maxWidth: 560 }}>
      <Card title="Plan & status">
        {[
          ['Plan', info?.plan ? prettify(info.plan) : 'Free'],
          ['Plan expires', fmtDate(info?.plan_expires_at)],
          ['Approval', info?.approval_status ? prettify(info.approval_status) : '—'],
          ['Verification', info?.verification_status ? prettify(info.verification_status) : '—'],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: 13, color: COLORS.textMuted }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{value}</span>
          </div>
        ))}
      </Card>
      <div style={{ height: 16 }} />
      <Card title="Booking options">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text }}>Let guests choose their unit</p>
            <p style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>Guests can pick a specific room, seat or unit when booking.</p>
          </div>
          {canEdit ? (
            <button disabled={saving} onClick={toggleUnits} style={{
              border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: '7px 16px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
              background: info?.allow_unit_selection ? COLORS.greenBg : '#fff',
              color: info?.allow_unit_selection ? COLORS.green : COLORS.textMuted, opacity: saving ? 0.6 : 1,
            }}>{info?.allow_unit_selection ? 'On' : 'Off'}</button>
          ) : (
            <Pill status={info?.allow_unit_selection ? 'active' : 'pending'} label={info?.allow_unit_selection ? 'On' : 'Off'} />
          )}
        </div>
        {error && <p style={{ fontSize: 12.5, color: COLORS.red, marginTop: 10 }}>{error}</p>}
        {!canEdit && <p style={{ fontSize: 11.5, color: COLORS.textMuted, marginTop: 12 }}>Your role can view platform settings but not change them.</p>}
      </Card>
    </div>
  )
}

function TasksList({ tasks, onDone, limit }: { tasks: Task[]; onDone: (id: string) => void; limit?: number }) {
  const list = limit ? tasks.slice(0, limit) : tasks
  if (list.length === 0) return <EmptyState icon="checkCircle" title="You're all caught up" subtitle="You have no pending tasks right now." />
  return (
    <div>
      {list.map((t) => {
        const priorityColor = t.priority === 'high' ? COLORS.red : t.priority === 'medium' ? '#F59E0B' : COLORS.textMuted
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
            borderBottom: `1px solid ${COLORS.border}`, opacity: t.status === 'done' ? 0.5 : 1,
          }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: priorityColor, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: COLORS.text, textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</span>
            <span style={{ fontSize: 11, color: COLORS.textMuted }}>{fmtDate(t.created_at)}</span>
            {t.status === 'open' ? (
              <button onClick={() => onDone(t.id)} style={{
                border: `1px solid ${COLORS.border}`, background: '#fff', borderRadius: 8,
                padding: '6px 12px', fontSize: 12, fontWeight: 700, color: COLORS.primary, cursor: 'pointer',
              }}>Done</button>
            ) : (
              <Icon name="checkCircle" size={16} color={COLORS.green} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function StaffDashboard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const companyParam = searchParams.get('company')
  const isDesktop = useIsDesktop()
  const [multiCompany, setMultiCompany] = useState(false)
  const [checking, setChecking] = useState(true)
  const [accessError, setAccessError] = useState('')
  const [section, setSection] = useState('overview')
  const [drawer, setDrawer] = useState(false)

  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [staff, setStaff] = useState<StaffInfo | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [roleName, setRoleName] = useState('')

  const [catalog, setCatalog] = useState<PermRow[]>([])
  const [effective, setEffective] = useState<Set<string>>(new Set())

  const [bookingsToday, setBookingsToday] = useState<number | null>(null)
  const [openTickets, setOpenTickets] = useState<number | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])

  useEffect(() => {
    (async () => {
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userData.user) { navigate('/login'); return }
      const user = userData.user
      setUserEmail(user.email || '')
      setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'there')

      // A person can be staff in more than one company, so load all memberships and pick
      // the one requested in the URL (?company=...), otherwise the first active one.
      const { data: staffRows, error: staffErr } = await supabase
        .from('company_staff')
        .select('id, company_id, template_id, role_label, status, joined_at, last_active_at')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: true })

      if (staffErr) { setAccessError(`Database error checking staff access: ${staffErr.message}`); setChecking(false); return }
      const memberships = staffRows || []
      const staffRow =
        (companyParam && memberships.find((m: any) => m.company_id === companyParam)) ||
        memberships.find((m: any) => m.status === 'active') ||
        memberships[0]
      setMultiCompany(memberships.filter((m: any) => m.status === 'active').length > 1)
      if (!staffRow) { setAccessError('No staff access found for this account.'); setChecking(false); return }
      if (staffRow.status === 'suspended') {
        setAccessError('Your staff access has been suspended. Contact your company admin.')
        setChecking(false)
        return
      }

      setStaff(staffRow)
      setRoleName(staffRow.role_label || 'Staff')

      const [companyRes, templateRes, catalogRes, permsRes] = await Promise.all([
        supabase.from('companies').select('business_name, owner_id').eq('id', staffRow.company_id).maybeSingle(),
        staffRow.template_id
          ? supabase.from('company_role_templates').select('name').eq('id', staffRow.template_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase.from('company_permissions').select('key, module, description, risk_level'),
        // Single source of truth: the same rule the database enforces (template + overrides).
        supabase.rpc('get_my_company_permissions', { p_company_id: staffRow.company_id }),
      ])

      if (companyRes.data?.business_name) setCompanyName(companyRes.data.business_name)
      if (templateRes?.data?.name) setRoleName(templateRes.data.name)
      setCatalog(catalogRes.data || [])

      if (permsRes.error) {
        setAccessError(`Could not load your permissions: ${permsRes.error.message}`)
        setChecking(false)
        return
      }
      const perms = new Set<string>((permsRes.data as string[]) || [])
      setEffective(perms)

      if (perms.has('bookings.view')) {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        const { count } = await supabase
          .from('bookings').select('id', { count: 'exact', head: true })
          .eq('company_id', staffRow.company_id).gte('created_at', todayStart.toISOString())
        setBookingsToday(count ?? 0)
      }

      if (perms.has('support.view')) {
        const { count } = await supabase
          .from('support_tickets').select('id', { count: 'exact', head: true })
          .eq('company_id', staffRow.company_id).eq('requester_type', 'company')
          .in('status', ['open', 'in_progress', 'waiting'])
        setOpenTickets(count ?? 0)
      }

      if (perms.has('finance.view') && companyRes.data?.owner_id) {
        const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', companyRes.data.owner_id).maybeSingle()
        if (w) setWalletBalance(Number(w.balance))
      }

      const { data: taskRows } = await supabase
        .from('staff_tasks')
        .select('id, title, priority, status, created_at')
        .eq('assigned_to', staffRow.id)
        .order('status', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(50)
      setTasks(taskRows || [])

      const { data: activityRows } = await supabase
        .from('audit_logs')
        .select('id, action, module, created_at')
        .eq('actor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      setActivity(activityRows || [])

      setChecking(false)
    })()
  }, [navigate, companyParam])

  const markTaskDone = async (taskId: string) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'done' } : t))
    const { error } = await supabase
      .from('staff_tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', taskId)
    if (error) {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'open' } : t))
      alert('Could not update task: ' + error.message)
      return
    }
    if (staff) {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        await supabase.from('audit_logs').insert({
          actor_id: userData.user.id, action: 'completed_task', module: 'tasks',
          target_type: 'staff_task', target_id: taskId, company_id: staff.company_id,
        })
        setActivity((prev) => [{ id: `local-${taskId}`, action: 'completed_task', module: 'tasks', created_at: new Date().toISOString() }, ...prev])
      }
    }
  }

  // Which modules this staff member has at least one permission in.
  const effectiveModules = useMemo(() => {
    const mods = new Set<string>()
    for (const p of catalog) if (effective.has(p.key)) mods.add(p.module)
    return mods
  }, [catalog, effective])

  const canSee = (item: NavItem) => {
    if (item.requires) return item.requires.some((k) => effective.has(k))
    if (item.modules) return item.modules.some((m) => effectiveModules.has(m))
    return true
  }

  const visibleNav = NAV.filter(canSee)
  const current = visibleNav.find((n) => n.key === section && n.kind === 'section') || visibleNav[0]
  const activeKey = current?.key || 'overview'

  const selectNav = (item: NavItem) => {
    setDrawer(false)
    if (item.kind === 'route' && item.route) {
      // Tell the page which workspace we came from so its back arrow returns here.
      navigate(item.route, { state: { backTo: `/staff-dashboard?company=${staff?.company_id || ''}`, companyId: staff?.company_id } })
      return
    }
    setSection(item.key)
  }

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted, fontSize: 13 }}>
        Loading your workspace...
      </div>
    )
  }

  if (accessError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center' as const }}>
        <Icon name="alertCircle" size={28} color={COLORS.red} />
        <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginTop: 12, marginBottom: 6 }}>We couldn't load your workspace</p>
        <p style={{ fontSize: 12.5, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 18 }}>{accessError}</p>
        <span onClick={() => navigate('/login')} style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Back to Login</span>
      </div>
    )
  }

  const groupedCatalog = catalog.reduce((acc: Record<string, PermRow[]>, p) => {
    (acc[p.module] = acc[p.module] || []).push(p)
    return acc
  }, {})

  const openTaskCount = tasks.filter((t) => t.status === 'open').length
  const go = (route: string) => navigate(route)

  // ------------------------------- Sidebar -------------------------------
  const sidebar = (
    <div style={{ display: 'flex', flexDirection: 'column' as const, height: '100%', color: '#fff' }}>
      <div style={{ padding: '24px 22px 18px 22px' }}>
        <p style={{ fontSize: 18, fontWeight: 800 }}>
          <span style={{ color: COLORS.primary }}>TRAVELER</span><span style={{ color: COLORS.secondary }}>.COM</span>
        </p>
        <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 10, fontWeight: 600 }}>{companyName || 'Your company'}</p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, background: COLORS.navySoft, borderRadius: 8, padding: '5px 10px' }}>
          <Icon name="briefcase" size={12} color="#FBBF24" />
          <span style={{ fontSize: 11.5, fontWeight: 700 }}>{roleName}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' as const, padding: '6px 12px' }}>
        {(['Workspace', 'Company', 'Account'] as const).map((group) => {
          const items = visibleNav.filter((n) => n.group === group)
          if (items.length === 0) return null
          return (
            <div key={group} style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 10.5, fontWeight: 800, color: '#64748B', letterSpacing: 0.8, padding: '0 10px', marginBottom: 6 }}>{group.toUpperCase()}</p>
              {items.map((item) => {
                const active = item.kind === 'section' && item.key === activeKey
                return (
                  <div key={item.key} onClick={() => selectNav(item)} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 2,
                    background: active ? 'rgba(14,165,233,0.18)' : 'transparent',
                    color: active ? '#fff' : '#CBD5E1',
                  }}>
                    <Icon name={item.icon} size={18} color={active ? COLORS.primary : '#94A3B8'} />
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: active ? 700 : 500 }}>{item.label}</span>
                    {item.kind === 'route' && <Icon name="chevronRight" size={14} color="#64748B" />}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div style={{ padding: 14, borderTop: `1px solid ${COLORS.navySoft}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Avatar label={userName} size={34} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{userName}</p>
            <p style={{ fontSize: 10.5, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{userEmail}</p>
          </div>
        </div>
        <div onClick={() => navigate('/account')} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
          background: COLORS.navySoft, color: '#CBD5E1', fontSize: 13, fontWeight: 700, marginBottom: 8,
        }}>
          <Icon name="arrowLeft" size={16} color="#CBD5E1" />
          Back to my account
        </div>
        {multiCompany && (
          <div onClick={() => navigate('/account')} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
            background: COLORS.navySoft, color: '#CBD5E1', fontSize: 13, fontWeight: 700, marginBottom: 8,
          }}>
            <Icon name="refresh" size={16} color="#CBD5E1" />
            Switch workspace
          </div>
        )}
        <div onClick={async () => { await supabase.auth.signOut(); navigate('/login') }} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
          background: COLORS.navySoft, color: '#FCA5A5', fontSize: 13, fontWeight: 700,
        }}>
          <Icon name="logOut" size={16} color="#FCA5A5" />
          Log Out
        </div>
      </div>
    </div>
  )

  // ------------------------------- Pages -------------------------------
  const pageTitle: Record<string, { title: string; subtitle: string }> = {
    overview: { title: `${greeting()}, ${userName}`, subtitle: companyName || '' },
    tasks: { title: 'My Tasks', subtitle: 'Tasks assigned to you' },
    bookings: { title: 'Bookings', subtitle: 'Latest bookings for your company' },
    support: { title: 'Support', subtitle: 'Your company tickets with TravelerCom support' },
    finance: { title: 'Finance', subtitle: 'Only the parts your role allows' },
    refunds: { title: 'Refunds', subtitle: 'Refund requests on your company bookings' },
    team: { title: 'Team', subtitle: 'People with access to your company' },
    operations: { title: 'Operations', subtitle: 'Availability and schedules for your listings' },
    company: { title: 'Company Profile', subtitle: 'Contact details and opening hours' },
    platform: { title: 'Platform Settings', subtitle: 'How your company is set up on TravelerCom' },
    access: { title: 'My Access', subtitle: 'Exactly what your role and overrides allow' },
    profile: { title: 'Profile', subtitle: 'Your staff account' },
  }

  const companyId = staff?.company_id || ''
  const kpiGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, marginBottom: 18 } as const

  const renderPage = () => {
    switch (activeKey) {
      case 'overview':
        return (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' as const }}>
              <div style={{ background: COLORS.navy, borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="briefcase" size={13} color="#FBBF24" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{roleName}</span>
              </div>
              <div style={{ background: COLORS.greenBg, borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: COLORS.green }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.green }}>Active</span>
              </div>
            </div>

            <div style={kpiGrid}>
              <Kpi label="Open tasks" value={String(openTaskCount)} icon="checkCircle" />
              {bookingsToday !== null && <Kpi label="Bookings today" value={String(bookingsToday)} icon="ticket" />}
              {openTickets !== null && <Kpi label="Open support tickets" value={String(openTickets)} icon="headphones" />}
              {walletBalance !== null && <Kpi label="Company wallet" value={fmtMoney(walletBalance)} icon="cash" />}
              <Kpi label="Permissions" value={String(effective.size)} icon="shield" />
            </div>

            {effective.size === 0 && (
              <div style={{ marginBottom: 18 }}>
                <Card><p style={{ fontSize: 13, color: COLORS.textMuted }}>No permissions have been assigned to your role yet. Contact your company admin.</p></Card>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1.5fr 1fr' : '1fr', gap: 16 }}>
              <Card title="My Tasks" action={openTaskCount > 0 ? <LinkButton label="View all" onClick={() => setSection('tasks')} /> : undefined}>
                <TasksList tasks={tasks} onDone={markTaskDone} limit={5} />
              </Card>
              <Card title="Recent Activity">
                {activity.length === 0 ? (
                  <EmptyState icon="clock" title="Nothing yet" subtitle="Your recent activity will appear here." />
                ) : activity.map((a) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                    <Icon name="clock" size={14} color={COLORS.textMuted} />
                    <span style={{ flex: 1, fontSize: 13, color: COLORS.text }}>{a.action.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: 11.5, color: COLORS.textMuted }}>{fmtDate(a.created_at)}</span>
                  </div>
                ))}
              </Card>
            </div>
          </>
        )

      case 'tasks':
        return (
          <Card><TasksList tasks={tasks} onDone={markTaskDone} /></Card>
        )

      case 'bookings':
        return (
          <BookingsPage
            companyId={companyId}
            canSeeAmounts={effective.has('finance.view')}
            canManage={effective.has('bookings.edit') || effective.has('bookings.create') || effective.has('bookings.cancel')}
            go={go}
          />
        )

      case 'support':
        return <SupportPage companyId={companyId} go={go} />

      case 'finance':
        return <FinancePage companyId={companyId} canWallet={effective.has('finance.view')} canTransactions={effective.has('finance.transactions')} />

      case 'refunds':
        return <RefundsPage />

      case 'team':
        return <TeamPage companyId={companyId} canManage={effective.has('staff.edit') || effective.has('staff.invite')} go={go} />

      case 'operations':
        return (
          <OperationsPage
            companyId={companyId}
            canAvailability={effective.has('availability.manage') || effective.has('operations.manage')}
            canSchedule={effective.has('schedules.manage') || effective.has('operations.manage')}
          />
        )

      case 'company':
        return <CompanyPage companyId={companyId} canEdit={effective.has('company.edit')} />

      case 'platform':
        return <PlatformPage companyId={companyId} canEdit={effective.has('platform.edit') || effective.has('platform.manage')} />

      case 'access':
        return (
          <>
            {Object.keys(groupedCatalog).length === 0 ? (
              <Card><EmptyState icon="shield" title="No permissions found" subtitle="Contact your company admin if this looks wrong." /></Card>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {Object.keys(groupedCatalog).map((mod) => {
                  const hasAny = groupedCatalog[mod].some((p) => effective.has(p.key))
                  return (
                    <Card key={mod} title={moduleLabel(mod)} action={
                      !hasAny ? undefined : MODULES_WITHOUT_PAGE.has(mod)
                        ? <span style={{ fontSize: 10.5, color: COLORS.textMuted }}>Page coming soon</span>
                        : undefined
                    }>
                      {groupedCatalog[mod].map((p) => {
                        const has = effective.has(p.key)
                        return (
                          <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                            <Icon name={has ? 'check' : 'x'} size={15} color={has ? COLORS.green : COLORS.textMuted} />
                            <span style={{ fontSize: 12.5, color: has ? COLORS.text : COLORS.textMuted }}>{p.description}</span>
                          </div>
                        )
                      })}
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )

      case 'profile':
        return staff ? (
          <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 16, alignItems: 'start' }}>
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', textAlign: 'center' as const, padding: '8px 0 18px 0' }}>
                <Avatar label={userName} size={72} />
                <p style={{ fontSize: 16, fontWeight: 800, color: COLORS.text, marginTop: 12 }}>{userName}</p>
                <p style={{ fontSize: 12.5, color: COLORS.textMuted }}>{userEmail}</p>
              </div>
              {[
                ['Company', companyName || '—'],
                ['Role', roleName],
                ['Account Status', 'Active'],
                ['Joined', fmtDate(staff.joined_at)],
                ['Last Active', fmtDate(staff.last_active_at)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderTop: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: 13, color: COLORS.textMuted }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{value}</span>
                </div>
              ))}
            </Card>
            <Card title="Account">
              <div onClick={() => setSection('access')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', cursor: 'pointer', borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 13.5, color: COLORS.text }}>My Access</span>
                <Icon name="chevronRight" size={16} color={COLORS.textMuted} />
              </div>
              <div onClick={async () => { await supabase.auth.signOut(); navigate('/login') }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', cursor: 'pointer' }}>
                <span style={{ fontSize: 13.5, color: COLORS.red, fontWeight: 700 }}>Log Out</span>
                <Icon name="logOut" size={16} color={COLORS.red} />
              </div>
            </Card>
          </div>
        ) : null

      default:
        return null
    }
  }

  const header = pageTitle[activeKey] || { title: '', subtitle: '' }

  // ------------------------------- Shell -------------------------------
  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex' }}>
      {isDesktop && (
        <aside style={{ width: 268, flexShrink: 0, background: COLORS.navy, position: 'sticky' as const, top: 0, height: '100vh' }}>
          {sidebar}
        </aside>
      )}

      {!isDesktop && drawer && (
        <div style={{ position: 'fixed' as const, inset: 0, zIndex: 50, display: 'flex' }}>
          <div style={{ width: 284, maxWidth: '85%', background: COLORS.navy, height: '100%' }}>{sidebar}</div>
          <div onClick={() => setDrawer(false)} style={{ flex: 1, background: 'rgba(15,23,42,0.55)' }} />
        </div>
      )}

      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          position: 'sticky' as const, top: 0, zIndex: 10, background: COLORS.card, borderBottom: `1px solid ${COLORS.border}`,
          padding: isDesktop ? '16px 32px' : '12px 16px', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          {!isDesktop && (
            <span onClick={() => navigate('/account')} style={{
              border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: '7px 9px', cursor: 'pointer', display: 'inline-flex',
            }}><Icon name="arrowLeft" size={16} color={COLORS.text} /></span>
          )}
          {!isDesktop && (
            <span onClick={() => setDrawer(true)} style={{
              fontSize: 12.5, fontWeight: 700, color: COLORS.text, border: `1px solid ${COLORS.border}`,
              borderRadius: 9, padding: '7px 12px', cursor: 'pointer',
            }}>Menu</span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: isDesktop ? 20 : 16, fontWeight: 800, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{header.title}</p>
            {header.subtitle && isDesktop && <p style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 2 }}>{header.subtitle}</p>}
          </div>
          <NotificationBell iconColor={COLORS.text} />
          {isDesktop && <Avatar label={userName} size={36} />}
        </div>

        <div style={{ padding: isDesktop ? '28px 32px 48px 32px' : '16px 14px 40px 14px' }}>
          {renderPage()}
        </div>
      </main>
    </div>
  )
}
