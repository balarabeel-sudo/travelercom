import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  primary: '#0EA5E9',
  purple: '#6B21A8',
  text: '#0F172A',
  textMuted: '#64748B',
  green: '#16A34A',
  amber: '#D97706',
  red: '#DC2626',
}

type Alert = {
  id: string
  icon: string
  iconBg: string
  iconColor: string
  title: string
  text: string
  time: string
}

export default function Notifications() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { navigate('/login'); return }

      const { data: company } = await supabase
        .from('companies')
        .select('id, business_name, approval_status, plan')
        .eq('owner_id', userData.user.id)
        .maybeSingle()

      if (!company) { setLoading(false); return }

      const list: Alert[] = []
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

      if (company.approval_status !== 'approved') {
        list.push({
          id: 'approval',
          icon: company.approval_status === 'rejected' ? 'alertCircle' : 'clock',
          iconBg: company.approval_status === 'rejected' ? '#FEE2E2' : '#FFF7ED',
          iconColor: company.approval_status === 'rejected' ? COLORS.red : COLORS.amber,
          title: company.approval_status === 'rejected' ? 'Application Rejected' : 'Approval Pending',
          text: company.approval_status === 'rejected' ? 'Please contact support for more information.' : 'Your account is being reviewed. Upload your CAC to speed things up.',
          time: 'Ongoing',
        })
      }

      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, customer_name, created_at, check_in_date, check_out_date, checked_in, amount_paid')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })

      const rows = bookings || []

      if (company.plan === 'business_suite') {
        const checkoutToday = rows.filter((b: any) => b.check_out_date === today && b.checked_in)
        const checkoutTomorrow = rows.filter((b: any) => b.check_out_date === tomorrow && b.checked_in)
        const checkinTomorrow = rows.filter((b: any) => b.check_in_date === tomorrow)

        if (checkoutToday.length > 0) {
          list.push({
            id: 'checkout-today', icon: 'checkCircle', iconBg: '#DCFCE7', iconColor: COLORS.green,
            title: `${checkoutToday.length} Room${checkoutToday.length > 1 ? 's' : ''} Checking Out Today`,
            text: 'Make sure housekeeping is ready for turnover.', time: 'Today',
          })
        }
        if (checkoutTomorrow.length > 0) {
          list.push({
            id: 'checkout-tomorrow', icon: 'calendar', iconBg: '#DBEAFE', iconColor: COLORS.primary,
            title: `${checkoutTomorrow.length} Room${checkoutTomorrow.length > 1 ? 's' : ''} Checking Out Tomorrow`,
            text: 'Plan ahead for upcoming turnovers.', time: 'Tomorrow',
          })
        }
        if (checkinTomorrow.length > 0) {
          list.push({
            id: 'checkin-tomorrow', icon: 'users', iconBg: '#F3E8FF', iconColor: COLORS.purple,
            title: `${checkinTomorrow.length} Guest${checkinTomorrow.length > 1 ? 's' : ''} Expected Tomorrow`,
            text: 'Prepare rooms and staff for incoming guests.', time: 'Tomorrow',
          })
        }

        // Weekly performance motivation
        const weekAgo = Date.now() - 7 * 86400000
        const twoWeeksAgo = Date.now() - 14 * 86400000
        const thisWeekRevenue = rows.filter((b: any) => b.checked_in && new Date(b.created_at).getTime() >= weekAgo)
          .reduce((s: number, b: any) => s + Number(b.amount_paid), 0)
        const lastWeekRevenue = rows.filter((b: any) => b.checked_in && new Date(b.created_at).getTime() >= twoWeeksAgo && new Date(b.created_at).getTime() < weekAgo)
          .reduce((s: number, b: any) => s + Number(b.amount_paid), 0)

        if (thisWeekRevenue > 0 || lastWeekRevenue > 0) {
          const up = thisWeekRevenue >= lastWeekRevenue
          const pct = lastWeekRevenue > 0 ? Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100) : 100
          list.push({
            id: 'weekly-performance', icon: 'trendingUp', iconBg: up ? '#DCFCE7' : '#FEF2F2', iconColor: up ? COLORS.green : COLORS.red,
            title: up ? `Revenue up ${Math.abs(pct)}% this week 🎉` : `Revenue down ${Math.abs(pct)}% this week`,
            text: up ? 'Great momentum — keep it going!' : 'Check Analytics for insights on what changed.',
            time: 'This week',
          })
        }
      }

      const recentBookings = rows.slice(0, 5)
      recentBookings.forEach((b: any) => {
        list.push({
          id: `booking-${b.id}`, icon: 'box', iconBg: '#EFF6FF', iconColor: COLORS.primary,
          title: 'New Booking', text: `${b.customer_name || 'A customer'} booked — ₦${Number(b.amount_paid).toLocaleString()}`,
          time: new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        })
      })

      setAlerts(list)
      setLoading(false)
    }
    load()
  }, [navigate])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, color: COLORS.textMuted }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Notifications</h1>
      </div>

      <div style={{ padding: '16px' }}>
        {alerts.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '40px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted }}>
            <p style={{ fontSize: '30px', marginBottom: '10px' }}>🔔</p>
            <p style={{ fontSize: '13px' }}>You're all caught up — no notifications right now.</p>
          </div>
        ) : (
          alerts.map((a) => (
            <div key={a.id} style={{ display: 'flex', gap: '12px', background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: a.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={a.icon} size={17} color={a.iconColor} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{a.title}</p>
                  <p style={{ fontSize: '10px', color: COLORS.textMuted, whiteSpace: 'nowrap' }}>{a.time}</p>
                </div>
                <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '3px' }}>{a.text}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
