import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

const COLORS = {
  navy: '#0F172A',
  navyLight: '#1E293B',
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

type Stats = {
  totalBookings: number
  revenue: number
  pending: number
  completed: number
  activeListings: number
  walletBalance: number
}

type RecentBooking = {
  id: string
  ticket_code: string
  customer_name: string | null
  amount_paid: number
  checked_in: boolean
  booking_status: string
  created_at: string
}

function BusinessSuite() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [businessName, setBusinessName] = useState('')
  const [approvalStatus, setApprovalStatus] = useState('pending')
  const [stats, setStats] = useState<Stats>({
    totalBookings: 0, revenue: 0, pending: 0, completed: 0, activeListings: 0, walletBalance: 0,
  })
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([])
  const [trend, setTrend] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        navigate('/login')
        return
      }

      const { data: company } = await supabase
        .from('companies')
        .select('id, business_name, approval_status')
        .eq('owner_id', userData.user.id)
        .maybeSingle()

      if (!company) {
        setLoading(false)
        return
      }

      setBusinessName(company.business_name || 'My Business')
      setApprovalStatus(company.approval_status)

      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userData.user.id)
        .maybeSingle()

      const { data: allBookings } = await supabase
        .from('bookings')
        .select('id, ticket_code, customer_name, amount_paid, checked_in, booking_status, created_at, services(commission_rate)')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })

      const bookings = allBookings || []
      const totalBookings = bookings.length
      const pending = bookings.filter((b: any) => !b.checked_in && b.booking_status === 'confirmed').length
      const completed = bookings.filter((b: any) => b.checked_in).length
      const revenue = bookings
        .filter((b: any) => b.checked_in)
        .reduce((sum: number, b: any) => {
          const rate = Number(b.services?.commission_rate ?? 3)
          return sum + Number(b.amount_paid) * (1 - rate / 100)
        }, 0)

      const { count: activeListings } = await supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .eq('status', 'active')

      setStats({
        totalBookings,
        revenue,
        pending,
        completed,
        activeListings: activeListings || 0,
        walletBalance: wallet ? Number(wallet.balance) : 0,
      })

      setRecentBookings(bookings.slice(0, 5) as any)

      const days: number[] = new Array(7).fill(0)
      const today = new Date()
      bookings.forEach((b: any) => {
        const d = new Date(b.created_at)
        const diffDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays >= 0 && diffDays < 7) {
          days[6 - diffDays] += 1
        }
      })
      setTrend(days)

      setLoading(false)
    }
    load()
  }, [navigate])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted, background: COLORS.bg }}>
        Loading...
      </div>
    )
  }

  const maxTrend = Math.max(...trend, 1)

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyLight})`,
        padding: '20px',
        color: 'white',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <span onClick={() => navigate('/home')} style={{ fontSize: '18px', cursor: 'pointer' }}>←</span>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#38bdf8' }}>BUSINESS SUITE</span>
          <span style={{ fontSize: '18px' }}>🔔</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800
          }}>
            {businessName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: '16px', fontWeight: 800 }}>{businessName}</p>
            <p style={{ fontSize: '11px', color: approvalStatus === 'approved' ? '#4ade80' : '#fbbf24' }}>
              {approvalStatus === 'approved' ? '✓ Verified Business' : '⏳ Pending Verification'}
            </p>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px' }}>
          <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Wallet Balance</p>
          <p style={{ fontSize: '26px', fontWeight: 800 }}>₦{stats.walletBalance.toLocaleString()}</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <MetricCard icon="📦" label="Total Bookings" value={stats.totalBookings.toString()} />
          <MetricCard icon="💰" label="Revenue" value={`₦${stats.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
          <MetricCard icon="⏳" label="Pending" value={stats.pending.toString()} />
          <MetricCard icon="✅" label="Completed" value={stats.completed.toString()} />
        </div>

        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
          <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, marginBottom: '14px' }}>Bookings — Last 7 Days</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '70px' }}>
            {trend.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{
                  width: '100%',
                  height: `${Math.max((v / maxTrend) * 100, 4)}%`,
                  background: `linear-gradient(180deg, ${COLORS.primary}, ${COLORS.navy})`,
                  borderRadius: '4px',
                }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          <QuickAction icon="➕" label="Add Listing" onClick={() => navigate('/add-listing')} />
          <QuickAction icon="📷" label="Verify" onClick={() => navigate('/verify-booking')} />
          <QuickAction icon="📋" label="Listings" onClick={() => navigate('/listings-management')} />
          <QuickAction icon="🎫" label="Bookings" onClick={() => navigate('/bookings-management')} />
          <QuickAction icon="💳" label="Wallet" onClick={() => navigate('/wallet')} />
          <QuickAction icon="👥" label="Guests" onClick={() => navigate('/guests')} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>Recent Bookings</p>
          <span onClick={() => navigate('/bookings-management')} style={{ fontSize: '12px', color: COLORS.primary, fontWeight: 700, cursor: 'pointer' }}>
            View all →
          </span>
        </div>

        {recentBookings.length === 0 ? (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '24px', textAlign: 'center', color: COLORS.textMuted, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '13px' }}>No bookings yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentBookings.map((b) => (
              <div key={b.id} style={{
                background: COLORS.card, borderRadius: '12px', padding: '12px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{b.customer_name || 'Unknown'}</p>
                  <p style={{ fontSize: '10.5px', color: COLORS.textMuted, fontFamily: 'monospace' }}>{b.ticket_code}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.primary }}>₦{Number(b.amount_paid).toLocaleString()}</p>
                  <span style={{
                    fontSize: '9.5px', fontWeight: 700,
                    color: b.checked_in ? COLORS.green : '#c2410c',
                  }}>
                    {b.checked_in ? 'Completed' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: '18px', marginBottom: '6px' }}>{icon}</div>
      <p style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>{value}</p>
      <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>{label}</p>
    </div>
  )
}

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: COLORS.card, borderRadius: '14px', padding: '14px 6px', textAlign: 'center',
        cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
      }}>
      <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
      <p style={{ fontSize: '10.5px', fontWeight: 700, color: COLORS.text }}>{label}</p>
    </div>
  )
}

export default BusinessSuite
