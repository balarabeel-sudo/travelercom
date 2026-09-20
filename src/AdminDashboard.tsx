import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import NotificationBell from './NotificationBell'
import AdminUsers from './AdminUsers'
import AdminCompanies from './AdminCompanies'
import AdminHotels from './AdminHotels'
import AdminVehicleRentals from './AdminVehicleRentals'
import AdminTransport from './AdminTransport'
import AdminFlights from './AdminFlights'
import AdminTours from './AdminTours'
import AdminEventCenters from './AdminEventCenters'
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
import AdminReviews from './AdminReviews'
import StaffOverview from './StaffOverview'

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

type SectionKey =
  | 'overview' | 'users' | 'companies' | 'hotels' | 'transport' | 'flights' | 'tours' | 'events' | 'vehicle_rental' | 'bookings' | 'reviews'
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
      { key: 'tours', label: 'Tours', icon: 'map' },
      { key: 'events', label: 'Event Centers', icon: 'tent' },
      { key: 'vehicle_rental', label: 'Vehicle Rental', icon: 'car' },
      { key: 'bookings', label: 'Bookings', icon: 'ticket' },
      { key: 'reviews', label: 'Reviews & Ratings', icon: 'star' },
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

// Only sections with no real component wired up yet show "Coming Soon".
// Keep this in sync with the sectionContent JSX below — every other
// SectionKey must have a matching component there.
const NO_COMPONENT_YET = new Set<SectionKey>(['notifications'])

const SECTION_PERMISSION: Partial<Record<SectionKey, string | string[]>> = {
  users: 'users.view',
  companies: ['companies.view', 'verification.view'],
  hotels: ['companies.view', 'verification.view'],
  transport: ['companies.view', 'verification.view'],
  flights: ['companies.view', 'verification.view'],
  tours: ['companies.view', 'verification.view'],
  events: ['companies.view', 'verification.view'],
  vehicle_rental: ['companies.view', 'verification.view'],
  bookings: 'bookings.view',
  reviews: 'reviews.manage',
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
      {section === 'overview' && <StaffOverview isSuperAdmin={isSuperAdmin} permissions={permissions} onNavigate={(key) => setSection(key as SectionKey)} />}
      {section === 'users' && <AdminUsers />}
      {section === 'companies' && <AdminCompanies />}
      {section === 'hotels' && <AdminHotels />}
      {section === 'vehicle_rental' && <AdminVehicleRentals />}
      {section === 'transport' && <AdminTransport />}
      {section === 'flights' && <AdminFlights />}
      {section === 'tours' && <AdminTours />}
      {section === 'events' && <AdminEventCenters />}
      {section === 'bookings' && <AdminBookings />}
      {section === 'reviews' && <AdminReviews />}
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
      {NO_COMPONENT_YET.has(section) && <ComingSoonPanel label={currentLabel} />}
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
