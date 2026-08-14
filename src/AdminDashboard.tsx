import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import AdminUsers from './AdminUsers'
import AdminCompanies from './AdminCompanies'
import AdminBookings from './AdminBookings'
import AdminFinance from './AdminFinance'
import AdminWallet from './AdminWallet'

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
}

type SectionKey =
  | 'overview' | 'users' | 'companies' | 'hotels' | 'transport' | 'flights' | 'bookings'
  | 'finance' | 'wallet' | 'refunds' | 'withdrawals'
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

function MetricCard({ icon, label, value, pending }: { icon: string; label: string; value: string | number; pending?: boolean }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}`, padding: '14px', flex: '1 1 45%', minWidth: '140px' }}>
      <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
        <Icon name={icon} size={14} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '3px' }}>{label}</p>
      {pending ? (
        <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted }}>Pending setup</p>
      ) : (
        <p style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text }}>{value}</p>
      )}
    </div>
  )
}

function OverviewPanel() {
  const [companyCount, setCompanyCount] = useState<number | null>(null)
  const [listingCount, setListingCount] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      const { count: companies } = await supabase.from('companies').select('*', { count: 'exact', head: true })
      setCompanyCount(companies ?? 0)
      const { count: listings } = await supabase.from('services').select('*', { count: 'exact', head: true })
      setListingCount(listings ?? 0)
    }
    load()
  }, [])

  return (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>PLATFORM AT A GLANCE</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <MetricCard icon="building" label="Registered Companies" value={companyCount ?? '—'} />
        <MetricCard icon="ticket" label="Total Listings" value={listingCount ?? '—'} />
        <MetricCard icon="users" label="Total Users" value="" pending />
        <MetricCard icon="cash" label="Total Bookings" value="" pending />
      </div>
      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '14px', padding: '14px' }}>
        <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#9A3412', marginBottom: '4px' }}>Some metrics need setup</p>
        <p style={{ fontSize: '11.5px', color: '#9A3412', lineHeight: 1.6 }}>
          Total Users and Total Bookings require an admin-level database policy that doesn't exist yet — we'll add it when we build the Users and Bookings sections, rather than showing a made-up number.
        </p>
      </div>
    </div>
  )
}

function AdminDashboard() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [section, setSection] = useState<SectionKey>('overview')
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const checkAccess = async () => {
      const { data: userData, error } = await supabase.auth.getUser()
      if (error || !userData.user) {
        navigate('/login')
        return
      }

      const { data: adminRow } = await supabase
        .from('admins')
        .select('is_super_admin')
        .eq('user_id', userData.user.id)
        .maybeSingle()

      if (!adminRow || !adminRow.is_super_admin) {
        navigate('/home')
        return
      }

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

  if (!isAdmin) {
    return null
  }

  const currentLabel = ALL_ITEMS.find((i) => i.key === section)?.label || 'Overview'

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
        <div onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="x" size={20} color={COLORS.textMuted} />
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
            {NAV.map((group, gi) => (
              <div key={gi} style={{ marginBottom: '10px' }}>
                {group.title && (
                  <p style={{ fontSize: '10.5px', fontWeight: 700, color: COLORS.textMuted, padding: '8px 18px 4px 18px', letterSpacing: '0.4px' }}>
                    {group.title.toUpperCase()}
                  </p>
                )}
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    onClick={() => { setSection(item.key); setDrawerOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '11px 18px', cursor: 'pointer',
                      background: section === item.key ? '#EFF6FF' : 'transparent',
                      borderRight: section === item.key ? `3px solid ${COLORS.primary}` : '3px solid transparent',
                    }}>
                    <Icon name={item.icon} size={16} color={section === item.key ? COLORS.primary : COLORS.text} />
                    <span style={{ fontSize: '13px', fontWeight: section === item.key ? 700 : 500, color: section === item.key ? COLORS.primary : COLORS.text }}>{item.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {section === 'overview' && <OverviewPanel />}
        {section === 'users' && <AdminUsers />}
        {section === 'companies' && <AdminCompanies />}
        {section === 'bookings' && <AdminBookings />}
        {section === 'finance' && <AdminFinance />}
        {section === 'wallet' && <AdminWallet />}
        {section !== 'overview' && section !== 'users' && section !== 'companies' && section !== 'bookings' && section !== 'finance' && section !== 'wallet' && <ComingSoonPanel label={currentLabel} />}
      </div>
    </div>
  )
}

export default AdminDashboard
