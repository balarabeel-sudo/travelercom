import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  navy: '#0F172A',
  primary: '#6B21A8',
  primaryLight: '#A855F7',
  accent: '#F59E0B',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  green: '#16A34A',
  border: '#E2E8F0',
}

type Stats = {
  totalBookings: number
  revenue: number
  pending: number
  completed: number
  activeListings: number
  walletBalance: number
  avgRating: number
  reviewCount: number
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

type TopListing = {
  title: string
  count: number
}

function BusinessSuite() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [businessName, setBusinessName] = useState('')
  const [approvalStatus, setApprovalStatus] = useState('pending')
  const [stats, setStats] = useState<Stats>({
    totalBookings: 0, revenue: 0, pending: 0, completed: 0, activeListings: 0, walletBalance: 0, avgRating: 0, reviewCount: 0,
  })
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([])
  const [topListings, setTopListings] = useState<TopListing[]>([])
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
        setBusinessName('My Business')
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
        .select('id, ticket_code, customer_name, amount_paid, checked_in, booking_status, created_at, service_id, services(commission_rate, title)')
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

      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('company_id', company.id)

      const reviewList = (reviews || []).filter((r: any) => r.rating != null)
      const reviewCount = reviewList.length
      const avgRating = reviewCount > 0
        ? reviewList.reduce((sum: number, r: any) => sum + Number(r.rating), 0) / reviewCount
        : 0

      setStats({
        totalBookings,
        revenue,
        pending,
        completed,
        activeListings: activeListings || 0,
        walletBalance: wallet ? Number(wallet.balance) : 0,
        avgRating,
        reviewCount,
      })

      setRecentBookings(bookings.slice(0, 5) as RecentBooking[])

      const listingCounts: Record<string, number> = {}
      bookings.forEach((b: any) => {
        const title = b.services?.title
        if (title) listingCounts[title] = (listingCounts[title] || 0) + 1
      })
      const sortedListings = Object.entries(listingCounts)
        .map(([title, count]) => ({ title, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
      setTopListings(sortedListings)

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, color: COLORS.textMuted }}>
        Loading Business Suite...
      </div>
    )
  }

  const maxTrend = Math.max(...trend, 1)

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.primary}, #4C1D95)`,
        padding: '24px 20px',
        color: 'white',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="arrowLeft" size={22} color="white" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
            <Icon name="crown" size={18} color={COLORS.accent} /> BUSINESS SUITE
          </div>
          <Icon name="bell" size={20} color="white" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 800
          }}>
            {businessName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: '20px', fontWeight: 800 }}>{businessName}</p>
            <p style={{ color: '#C4B5FD', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Icon name={approvalStatus === 'approved' ? 'checkCircle' : 'clock'} size={12} color="#C4B5FD" />
              {approvalStatus === 'approved' ? 'Verified • Premium' : 'Pending Verification'}
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <MetricCard icon="box" label="Total Bookings" value={stats.totalBookings.toString()} />
          <MetricCard icon="trendingUp" label="Revenue" value={`₦${stats.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
          <MetricCard icon="clock" label="Pending" value={stats.pending.toString()} />
          <MetricCard icon="checkCircle" label="Completed" value={stats.completed.toString()} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <MetricCard icon="clipboard" label="Active Listings" value={stats.activeListings.toString()} />
          <MetricCard
            icon="star"
            label={stats.reviewCount > 0 ? `${stats.reviewCount} Reviews` : 'No reviews yet'}
            value={stats.reviewCount > 0 ? stats.avgRating.toFixed(1) : '—'}
          />
        </div>

        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '18px', marginBottom: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.07)' }}>
          <p style={{ fontWeight: 700, marginBottom: '12px', color: COLORS.text }}>Performance — Last 7 Days</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '110px' }}>
            {trend.map((value, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                <div style={{
                  width: '100%',
                  height: `${(value / maxTrend) * 100}%`,
                  background: `linear-gradient(to top, ${COLORS.primary}, ${COLORS.primaryLight})`,
                  borderRadius: '6px 6px 0 0',
                }} />
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Quick Actions</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '28px' }}>
          <QuickAction icon="plus" label="Add Listing" onClick={() => navigate('/add-listing')} />
          <QuickAction icon="box" label="Inventory" onClick={() => navigate('/inventory')} />
          <QuickAction icon="camera" label="Verify" onClick={() => navigate('/verify-booking')} />
          <QuickAction icon="barChart" label="Reports" onClick={() => navigate('/reports')} />
          <QuickAction icon="users" label="Staff" onClick={() => navigate('/staff')} />
          <QuickAction icon="megaphone" label="Promotions" onClick={() => navigate('/promotions')} />
          <QuickAction icon="wallet" label="Wallet" onClick={() => navigate('/wallet')} />
          <QuickAction icon="moreHorizontal" label="More" onClick={() => navigate('/company-menu')} />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '16px', fontWeight: 700 }}>Recent Bookings</p>
            <span onClick={() => navigate('/bookings-management')} style={{ color: COLORS.primary, fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
              View all →
            </span>
          </div>

          {recentBookings.length === 0 ? (
            <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '16px', color: COLORS.textMuted }}>
              No recent bookings yet
            </div>
          ) : (
            recentBookings.map((b) => (
              <div key={b.id} style={{
                background: COLORS.card,
                borderRadius: '14px',
                padding: '14px',
                marginBottom: '10px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontWeight: 600 }}>{b.customer_name || 'Customer'}</p>
                    <p style={{ fontSize: '12px', color: COLORS.textMuted }}>{b.ticket_code}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700, color: COLORS.primary }}>₦{Number(b.amount_paid).toLocaleString()}</p>
                    <span style={{ fontSize: '12px', color: b.checked_in ? COLORS.green : '#F59E0B' }}>
                      {b.checked_in ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          <p style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Top Listings</p>
          {topListings.length === 0 ? (
            <div style={{ background: COLORS.card, padding: '24px 20px', textAlign: 'center', borderRadius: '16px', color: COLORS.textMuted }}>
              No bookings yet to rank listings
            </div>
          ) : (
            <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.07)' }}>
              {topListings.map((l, i) => {
                const max = topListings[0].count
                return (
                  <div key={l.title} style={{ marginBottom: i < topListings.length - 1 ? '14px' : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <p style={{ fontSize: '13.5px', fontWeight: 600, color: COLORS.text }}>{l.title}</p>
                      <p style={{ fontSize: '12px', color: COLORS.textMuted }}>{l.count} Bookings</p>
                    </div>
                    <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px' }}>
                      <div style={{
                        width: `${(l.count / max) * 100}%`, height: '100%',
                        background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.primaryLight})`, borderRadius: '3px'
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div style={{
      background: COLORS.card,
      borderRadius: '16px',
      padding: '18px 14px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.07)'
    }}>
      <div style={{ marginBottom: '8px' }}>
        <Icon name={icon} size={22} color={COLORS.primary} />
      </div>
      <p style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text }}>{value}</p>
      <p style={{ fontSize: '12px', color: COLORS.textMuted }}>{label}</p>
    </div>
  )
}

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      background: COLORS.card,
      borderRadius: '14px',
      padding: '14px 6px',
      textAlign: 'center',
      boxShadow: '0 4px 12px rgba(0,0,0,0.07)',
      cursor: 'pointer'
    }}>
      <div style={{
        width: '30px', height: '30px', borderRadius: '9px', background: '#f3e8ff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px'
      }}>
        <Icon name={icon} size={15} color={COLORS.primary} />
      </div>
      <p style={{ fontWeight: 600, fontSize: '10.5px' }}>{label}</p>
    </div>
  )
}

export default BusinessSuite
