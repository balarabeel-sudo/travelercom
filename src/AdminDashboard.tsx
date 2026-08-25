import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import NotificationBell from './NotificationBell'
import AdminUsers from './AdminUsers'
import AdminCompanies from './AdminCompanies'
import AdminBookings from './AdminBookings'
import AdminFinance from './AdminFinance'
import AdminWallet from './AdminWallet'
import AdminRefunds from './AdminRefunds'
import AdminWithdrawals from './AdminWithdrawals'
import AdminSupport from './AdminSupport'
import AdminAnalytics from './AdminAnalytics'
import AdminMarketing from './AdminMarketing'
import AdminPlatform from './AdminPlatform'
import AdminStaff from './AdminStaff'
import AdminAuditLogs from './AdminAuditLogs'
import AdminSettings from './AdminSettings'
import AdminApprovals from './AdminApprovals'

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

const CATEGORY_COLORS: Record<string, string> = {
  hotel: '#0EA5E9',
  bus: '#16a34a',
  train: '#7C3AED',
  flight: '#F97316',
  tour: '#DB2777',
  event_center: '#64748B',
}

const CATEGORY_LABELS: Record<string, string> = {
  hotel: 'Hotels',
  bus: 'Bus',
  train: 'Train',
  flight: 'Flights',
  tour: 'Tours',
  event_center: 'Event Centers',
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F97316',
  confirmed: '#16a34a',
  completed: '#0EA5E9',
  cancelled: '#dc2626',
}

type SectionKey =
  | 'overview' | 'users' | 'companies' | 'hotels' | 'transport' | 'flights' | 'bookings'
  | 'finance' | 'wallet' | 'refunds' | 'withdrawals' | 'approvals'
  | 'support' | 'analytics' | 'marketing'
  | 'platform' | 'staff' | 'audit' | 'notifications' | 'settings'

type NavItem = { key: SectionKey; label: string; icon: string }
type NavGroup = { title: string; items: NavItem[] }

const NAV: NavGroup[] = [
  { title: '', items: [{ key: 'overview', label: 'Overview', icon: 'barChart' }] },
  {
    title: 'Operations', items: [
      { key: 'users', label: 'Users', icon: 'users' },
      { key: 'companies', label: 'Companies & Partners', icon: 'building' },
      { key: 'hotels', label: 'Hotels', icon: 'hotel' },
      { key: 'transport', label: 'Transport', icon: 'bus' },
      { key: 'flights', label: 'Flights', icon: 'plane' },
      { key: 'bookings', label: 'Bookings', icon: 'ticket' },
    ]
  },
  {
    title: 'Money', items: [
      { key: 'finance', label: 'Finance', icon: 'cash' },
      { key: 'wallet', label: 'Wallet & Transactions', icon: 'wallet' },
      { key: 'refunds', label: 'Refunds', icon: 'refresh' },
      { key: 'withdrawals', label: 'Withdrawals', icon: 'arrowUpRight' },
      { key: 'approvals', label: 'Approvals', icon: 'check' },
    ]
  },
  {
    title: 'Growth', items: [
      { key: 'support', label: 'Support', icon: 'chat' },
      { key: 'analytics', label: 'Analytics', icon: 'trendingUp' },
      { key: 'marketing', label: 'Marketing', icon: 'megaphone' },
    ]
  },
  {
    title: 'System', items: [
      { key: 'platform', label: 'Platform Management', icon: 'globe' },
      { key: 'staff', label: 'Staff & Permissions', icon: 'userPlus' },
      { key: 'audit', label: 'Audit Logs', icon: 'clipboard' },
      { key: 'notifications', label: 'Notifications', icon: 'bell' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ]
  },
]

const ALL_ITEMS: NavItem[] = NAV.flatMap((g) => g.items)

const SECTION_PERMISSION: Partial<Record<SectionKey, string | string[]>> = {
  users: 'users.view',
  companies: ['companies.view', 'verification.view'],
  hotels: ['companies.view', 'verification.view'],
  transport: ['companies.view', 'verification.view'],
  flights: ['companies.view', 'verification.view'],
  bookings: 'bookings.view',
  finance: 'finance.view',
  wallet: 'wallet.view',
  refunds: 'refunds.view',
  withdrawals: 'withdrawals.view',
  support: 'support.view',
  marketing: 'marketing.view',
  platform: 'platform.view',
  staff: 'staff.view',
  audit: 'audit.view',
}

function canSeeSection(key: SectionKey, isSuperAdmin: boolean, perms: Set<string>): boolean {
  if (isSuperAdmin) return true
  if (key === 'approvals') return false
  const required = SECTION_PERMISSION[key]
  if (!required) return true
  const list = Array.isArray(required) ? required : [required]
  return list.some((p) => perms.has(p))
}

function ComingSoonPanel({ label }: { label: string }) {
  return (
    <div style={{ padding: '50px 20px', textAlign: 'center' as const }}>
      <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
        <Icon name="hourglass" size={24} color={COLORS.textMuted} />
      </div>
      <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text, marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '12px', color: COLORS.textMuted }}>This section is being built next.</p>
    </div>
  )
}

type OverviewData = {
  totals: { total_users: number; total_companies: number; hotels: number; transport: number; flights: number; total_bookings: number }
  bookings_by_status: { status: string; count: number }[]
  today_activity: { new_users: number; new_companies: number; new_bookings: number; new_hotels: number; new_transport: number; new_flights: number }
  bookings_last_7_days: { day: string; booking_status: string; count: number }[]
  bookings_by_category: { category: string; bookings: number; revenue: number }[]
  partners_by_status: { status: string; count: number }[]
}

function SummaryCard({ icon, label, value, todayDelta }: { icon: string; label: string; value: number; todayDelta?: number }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}`, padding: '16px', flex: '1 1 180px', minWidth: '160px' }}>
      <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
        <Icon name={icon} size={16} color={COLORS.primary} />
      </div>
      <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text }}>{value.toLocaleString()}</p>
      {todayDelta !== undefined && (
        <p style={{ fontSize: '11px', color: COLORS.green, marginTop: '4px', fontWeight: 600 }}>+{todayDelta} today</p>
      )}
    </div>
  )
}

function StatusCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}`, padding: '16px', flex: '1 1 140px', minWidth: '130px' }}>
      <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: color + '1A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
      </div>
      <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text }}>{value.toLocaleString()}</p>
    </div>
  )
}

function humanizeStatus(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

function BookingsLineChart({ data }: { data: OverviewData['bookings_last_7_days'] }) {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  const statuses = Array.from(new Set(data.map((d) => d.booking_status)))
  const maxVal = Math.max(1, ...data.map((d) => d.count))

  const W = 640, H = 200, padL = 30, padB = 24, padT = 10
  const stepX = (W - padL - 10) / (days.length - 1 || 1)

  function pointsFor(status: string) {
    return days.map((day, i) => {
      const entry = data.find((d) => d.day === day && d.booking_status === status)
      const val = entry ? entry.count : 0
      const x = padL + i * stepX
      const y = padT + (1 - val / maxVal) * (H - padT - padB)
      return `${x},${y}`
    }).join(' ')
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={padL} x2={W - 10} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke="#F1F5F9" strokeWidth={1} />
      ))}
      {statuses.map((s) => (
        <polyline key={s} points={pointsFor(s)} fill="none" stroke={STATUS_COLORS[s] || COLORS.textMuted} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {days.map((day, i) => (
        <text key={day} x={padL + i * stepX} y={H - 4} fontSize={9} fill={COLORS.textMuted} textAnchor="middle">
          {new Date(day).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
        </text>
      ))}
    </svg>
  )
}

function BookingsDonut({ data }: { data: OverviewData['bookings_by_category'] }) {
  const total = data.reduce((s, d) => s + d.bookings, 0) || 1
  let acc = 0
  const stops = data.map((d) => {
    const pct = (d.bookings / total) * 100
    const from = acc
    acc += pct
    return `${CATEGORY_COLORS[d.category] || COLORS.textMuted} ${from}% ${acc}%`
  }).join(', ')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' as const }}>
      <div style={{
        width: '150px', height: '150px', borderRadius: '50%',
        background: data.length > 0 ? `conic-gradient(${stops})` : '#F1F5F9',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <div style={{ width: '92px', height: '92px', borderRadius: '50%', background: COLORS.card, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text }}>{total.toLocaleString()}</p>
          <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Total</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
        {data.map((d) => (
          <div key={d.category} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '9px', height: '9px', borderRadius: '3px', background: CATEGORY_COLORS[d.category] || COLORS.textMuted }} />
            <span style={{ fontSize: '12.5px', color: COLORS.text }}>
              {CATEGORY_LABELS[d.category] || d.category} — {d.bookings.toLocaleString()} ({((d.bookings / total) * 100).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SystemStatusRow({ label, status, note }: { label: string; status: 'checking' | 'healthy' | 'error' | 'unmonitored'; note?: string }) {
  const color = status === 'healthy' ? COLORS.green : status === 'error' ? COLORS.red : status === 'checking' ? COLORS.secondary : COLORS.textMuted
  const text = status === 'healthy' ? 'Operational' : status === 'error' ? 'Error' : status === 'checking' ? 'Checking...' : 'Not monitored'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${COLORS.border}` }}>
      <div>
        <p style={{ fontSize: '13px', color: COLORS.text }}>{label}</p>
        {note && <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '2px' }}>{note}</p>}
      </div>
      <span style={{ fontSize: '11px', fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color }} />
        {text}
      </span>
    </div>
  )
}

function OverviewPanel() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dbStatus, setDbStatus] = useState<'checking' | 'healthy' | 'error'>('checking')
  const [authStatus, setAuthStatus] = useState<'checking' | 'healthy' | 'error'>('checking')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      const { data: result, error } = await supabase.rpc('admin_overview_summary')
      if (error) setError(error.message)
      else setData(result as OverviewData)
      setLoading(false)
    }
    load()

    const checkHealth = async () => {
      try {
        const { error } = await supabase.from('platform_settings').select('id').limit(1)
        setDbStatus(error ? 'error' : 'healthy')
      } catch { setDbStatus('error') }
      try {
        const { error } = await supabase.auth.getSession()
        setAuthStatus(error ? 'error' : 'healthy')
      } catch { setAuthStatus('error') }
    }
    checkHealth()
  }, [])

  if (loading) return <div style={{ padding: '24px' }}><p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p></div>
  if (error) return <div style={{ padding: '24px' }}><p style={{ fontSize: '12.5px', color: COLORS.red }}>{error}</p></div>
  if (!data) return null

  const bookingStatusMap: Record<string, number> = {}
  data.bookings_by_status.forEach((b) => { bookingStatusMap[b.status] = b.count })

  return (
    <div style={{ padding: '20px 24px 60px 24px' }}>

      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>PLATFORM SUMMARY</p>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '12px', marginBottom: '24px' }}>
        <SummaryCard icon="users" label="Total Users" value={data.totals.total_users} todayDelta={data.today_activity.new_users} />
        <SummaryCard icon="building" label="Companies & Partners" value={data.totals.total_companies} todayDelta={data.today_activity.new_companies} />
        <SummaryCard icon="hotel" label="Hotels" value={data.totals.hotels} todayDelta={data.today_activity.new_hotels} />
        <SummaryCard icon="bus" label="Transport (Bus/Train)" value={data.totals.transport} todayDelta={data.today_activity.new_transport} />
        <SummaryCard icon="plane" label="Flights" value={data.totals.flights} todayDelta={data.today_activity.new_flights} />
      </div>

      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>BOOKINGS</p>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '12px', marginBottom: '24px' }}>
        <StatusCard label="Total Bookings" value={data.totals.total_bookings} color={COLORS.primary} />
        {['pending', 'confirmed', 'completed', 'cancelled'].map((s) => (
          <StatusCard key={s} label={humanizeStatus(s)} value={bookingStatusMap[s] || 0} color={STATUS_COLORS[s] || COLORS.textMuted} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' as const, marginBottom: '24px' }}>
        <div style={{ flex: '2 1 420px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px', padding: '18px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '2px' }}>Bookings Overview</p>
          <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '14px' }}>Last 7 days</p>
          <BookingsLineChart data={data.bookings_last_7_days} />
          <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' as const }}>
            {Object.entries(STATUS_COLORS).map(([s, c]) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />
                <span style={{ fontSize: '11px', color: COLORS.textMuted }}>{humanizeStatus(s)}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: '1 1 280px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px', padding: '18px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '14px' }}>Bookings by Service</p>
          <BookingsDonut data={data.bookings_by_category} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' as const }}>
        <div style={{ flex: '1 1 280px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px', padding: '18px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '14px' }}>Partner Overview</p>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px' }}>
            {data.partners_by_status.map((p) => (
              <div key={p.status} style={{ flex: '1 1 45%', background: '#F8FAFC', borderRadius: '10px', padding: '10px' }}>
                <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text }}>{p.count}</p>
                <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{humanizeStatus(p.status)}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: '1 1 280px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px', padding: '18px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '10px' }}>System Status</p>
          <SystemStatusRow label="Database" status={dbStatus} />
          <SystemStatusRow label="Authentication" status={authStatus} />
          <SystemStatusRow label="Payments (Paystack)" status="unmonitored" note="Needs a server-side check — not yet built" />
        </div>
      </div>
    </div>
  )
}

function AdminDashboard() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [permissions, setPermissions] = useState<Set<string>>(new Set())
  const [section, setSection] = useState<SectionKey>('overview')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false)
  const [userEmail, setUserEmail] = useState('')
  const [roleName, setRoleName] = useState('')

  const [accessError, setAccessError] = useState('')

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const checkAccess = async () => {
      const { data: userData, error } = await supabase.auth.getUser()
      if (error || !userData.user) {
        navigate('/login')
        return
      }
      setUserEmail(userData.user.email || '')

      const { data: adminRow, error: adminErr } = await supabase
        .from('admins')
        .select('is_super_admin, suspended, role_id')
        .eq('user_id', userData.user.id)
        .maybeSingle()

      if (adminErr) {
        setAccessError(`Database error checking admin access: ${adminErr.message}`)
        setChecking(false)
        return
      }

      if (!adminRow) {
        setAccessError(`No admin record found for this account (${userData.user.email}). Check the admins table in Supabase.`)
        setChecking(false)
        return
      }

      if (adminRow.suspended) {
        setAccessError('Your admin access has been suspended.')
        setChecking(false)
        return
      }

      setIsSuperAdmin(!!adminRow.is_super_admin)
      setRoleName(adminRow.is_super_admin ? 'Founder' : (adminRow.role_id || ''))

      if (!adminRow.is_super_admin && adminRow.role_id) {
        const { data: roleRow } = await supabase.from('roles').select('name').eq('id', adminRow.role_id).single()
        if (roleRow?.name) setRoleName(roleRow.name)
      }

      const { data: permsData } = await supabase.rpc('get_my_permissions')
      setPermissions(new Set(permsData || []))

      setIsAdmin(true)
      setChecking(false)
    }
    checkAccess()
  }, [navigate])

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted, fontSize: '13px' }}>
        Checking access...
      </div>
    )
  }

  if (accessError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center' as const }}>
        <Icon name="alertCircle" size={28} color={COLORS.red} />
        <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.red, marginTop: '12px', marginBottom: '6px' }}>Access check failed</p>
        <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.6, marginBottom: '18px' }}>{accessError}</p>
        <span onClick={() => navigate('/home')} style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Back to Home</span>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  const currentLabel = ALL_ITEMS.find((i) => i.key === section)?.label || 'Overview'

  const sectionContent = (
    <>
      {section === 'overview' && <OverviewPanel />}
      {section === 'users' && <AdminUsers />}
      {section === 'companies' && <AdminCompanies />}
      {section === 'bookings' && <AdminBookings />}
      {section === 'finance' && <AdminFinance />}
      {section === 'wallet' && <AdminWallet />}
      {section === 'refunds' && <AdminRefunds />}
      {section === 'withdrawals' && <AdminWithdrawals />}
      {section === 'support' && <AdminSupport />}
      {section === 'analytics' && <AdminAnalytics />}
      {section === 'marketing' && <AdminMarketing />}
      {section === 'platform' && <AdminPlatform />}
      {section === 'staff' && <AdminStaff />}
      {section === 'audit' && <AdminAuditLogs />}
      {section === 'settings' && <AdminSettings />}
      {section === 'approvals' && <AdminApprovals />}
      {section !== 'overview' && section !== 'users' && section !== 'companies' && section !== 'bookings' && section !== 'finance' && section !== 'wallet' && section !== 'refunds' && section !== 'withdrawals' && section !== 'support' && section !== 'analytics' && section !== 'marketing' && section !== 'platform' && section !== 'staff' && section !== 'audit' && section !== 'settings' && section !== 'approvals' && <ComingSoonPanel label={currentLabel} />}
    </>
  )

  const navGroups = (
    <>
      {NAV.map((group, gi) => {
        const visibleItems = group.items.filter((item) => canSeeSection(item.key, isSuperAdmin, permissions))
        if (visibleItems.length === 0) return null
        return (
          <div key={gi} style={{ marginBottom: '10px' }}>
            {group.title && (
              <p style={{ fontSize: '10.5px', fontWeight: 700, color: COLORS.textMuted, padding: '8px 18px 4px 18px', letterSpacing: '0.4px' }}>
                {group.title.toUpperCase()}
              </p>
            )}
            {visibleItems.map((item) => (
              <div
                key={item.key}
                onClick={() => { setSection(item.key); setDrawerOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '11px 18px', cursor: 'pointer',
                  background: section === item.key ? '#EFF6FF' : 'transparent',
                  borderRight: !isDesktop && section === item.key ? `3px solid ${COLORS.primary}` : '3px solid transparent',
                  borderRadius: isDesktop ? '10px' : 0,
                  margin: isDesktop ? '0 10px' : 0,
                }}>
                <Icon name={item.icon} size={16} color={section === item.key ? COLORS.primary : COLORS.text} />
                <span style={{ fontSize: '13px', fontWeight: section === item.key ? 700 : 500, color: section === item.key ? COLORS.primary : COLORS.text }}>{item.label}</span>
              </div>
            ))}
          </div>
        )
      })}
    </>
  )

  if (isDesktop) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex' }}>
        <div style={{ width: '250px', flexShrink: 0, background: COLORS.card, borderRight: `1px solid ${COLORS.border}`, height: '100vh', position: 'sticky' as const, top: 0, overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const }}>
          <div style={{ padding: '20px 18px' }}>
            <p style={{ fontSize: '17px', fontWeight: 800 }}>
              <span style={{ color: COLORS.primary }}>TRAVELER</span><span style={{ color: COLORS.secondary }}>.COM</span>
            </p>
          </div>
          <div style={{ padding: '0 18px 14px 18px' }}>
            <div style={{ background: COLORS.navy, borderRadius: '10px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="briefcase" size={14} color="#FBBF24" />
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff' }}>Founder Dashboard</span>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' as const, paddingBottom: '20px' }}>
            {navGroups}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            padding: '14px 28px', display: 'flex', alignItems: 'center', gap: '16px',
            background: COLORS.card, borderBottom: `1px solid ${COLORS.border}`,
            position: 'sticky' as const, top: 0, zIndex: 10,
          }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text }}>{currentLabel}</h1>
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>Platform overview and key metrics</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
              <Icon name="bell" size={19} color={COLORS.text} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: 700 }}>
                  {(userEmail[0] || 'A').toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{userEmail}</p>
                  <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>{roleName}</p>
                </div>
              </div>
            </div>
          </div>
          {sectionContent}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>

      <div style={{
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: '12px',
        background: COLORS.card,
        borderBottom: `1px solid ${COLORS.border}`,
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div onClick={() => setDrawerOpen(true)} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="menu" size={22} color={COLORS.text} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '10.5px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.5px' }}>TRAVELER.COM — FOUNDER</p>
          <h1 style={{ fontSize: '16.5px', fontWeight: 800, color: COLORS.text }}>{currentLabel}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <NotificationBell iconColor={COLORS.text} />
          <div onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="x" size={20} color={COLORS.textMuted} />
          </div>
        </div>
      </div>

      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'flex' }}>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}
          />
          <div style={{
            position: 'relative', width: '78%', maxWidth: '300px',
            background: COLORS.card, height: '100%', overflowY: 'auto' as const,
            padding: '18px 0',
          }}>
            <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, padding: '0 18px 14px 18px', borderBottom: `1px solid ${COLORS.border}`, marginBottom: '10px' }}>
              Founder Dashboard
            </p>
            {navGroups}
          </div>
        </div>
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {sectionContent}
      </div>
    </div>
  )
}

export default AdminDashboard
