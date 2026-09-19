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

const CATEGORY_ICON: Record<string, string> = {
  booking: 'box', account: 'building', refund: 'cash', withdrawal: 'withdraw', support: 'chat',
}
const CATEGORY_LABEL: Record<string, string> = {
  booking: 'Bookings', account: 'Account', refund: 'Refunds', withdrawal: 'Withdrawals', support: 'Support',
}
const SEVERITY_COLOR: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#FEE2E2', color: COLORS.red },
  important: { bg: '#FFF7ED', color: COLORS.amber },
  action_required: { bg: '#F3E8FF', color: COLORS.purple },
  info: { bg: '#DBEAFE', color: COLORS.primary },
}

type NotificationRow = {
  id: string
  category: string
  severity: string
  title: string
  body: string
  action_url: string | null
  is_read: boolean
  created_at: string
}

const FILTERS = ['all', 'booking', 'account', 'refund', 'withdrawal', 'support'] as const
type Filter = typeof FILTERS[number]

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function Notifications() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [filter, setFilter] = useState<Filter>('all')

  // Live account-status banner — a persistent status, not a discrete stored
  // event, so it's computed here rather than read from `notifications`.
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null)

  // Kept as a lightweight computed insight, separate from the real
  // notification list below — not backed by a stored event yet.
  const [weeklyInsight, setWeeklyInsight] = useState<{ up: boolean; pct: number } | null>(null)

  const load = async () => {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { navigate('/login'); return }

    const { data: notifRows, error } = await supabase
      .from('notifications')
      .select('id, category, severity, title, body, action_url, is_read, created_at')
      .eq('recipient_id', userData.user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error) setNotifications(notifRows || [])

    const { data: company } = await supabase
      .from('companies')
      .select('id, approval_status, plan')
      .eq('owner_id', userData.user.id)
      .maybeSingle()

    if (company) {
      setApprovalStatus(company.approval_status)

      if (company.plan === 'business_suite') {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('amount_paid, created_at, checked_in')
          .eq('company_id', company.id)
          .eq('checked_in', true)

        const rows = bookings || []
        const weekAgo = Date.now() - 7 * 86400000
        const twoWeeksAgo = Date.now() - 14 * 86400000
        const thisWeek = rows.filter((b: any) => new Date(b.created_at).getTime() >= weekAgo)
          .reduce((s: number, b: any) => s + Number(b.amount_paid), 0)
        const lastWeek = rows.filter((b: any) => new Date(b.created_at).getTime() >= twoWeeksAgo && new Date(b.created_at).getTime() < weekAgo)
          .reduce((s: number, b: any) => s + Number(b.amount_paid), 0)

        if (thisWeek > 0 || lastWeek > 0) {
          const up = thisWeek >= lastWeek
          const pct = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 100
          setWeeklyInsight({ up, pct: Math.abs(pct) })
        }
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  const unreadCount = notifications.filter((n) => !n.is_read).length
  const visible = filter === 'all' ? notifications : notifications.filter((n) => n.category === filter)

  const openNotification = async (n: NotificationRow) => {
    if (!n.is_read) {
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x))
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    }
    if (n.action_url) {
      navigate(n.action_url.replace(/^\/#/, ''))
    }
  }

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
  }

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
        padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="arrowLeft" size={22} color={COLORS.text} />
          </div>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>
            Notifications{unreadCount > 0 && <span style={{ color: COLORS.primary }}> ({unreadCount})</span>}
          </h1>
        </div>
        {unreadCount > 0 && (
          <span onClick={markAllRead} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Mark all read</span>
        )}
      </div>

      <div style={{ padding: '16px' }}>
        {approvalStatus && approvalStatus !== 'approved' && (
          <div style={{ display: 'flex', gap: '12px', background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: approvalStatus === 'rejected' ? '#FEE2E2' : '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={approvalStatus === 'rejected' ? 'alertTriangle' : 'clock'} size={17} color={approvalStatus === 'rejected' ? COLORS.red : COLORS.amber} />
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{approvalStatus === 'rejected' ? 'Application Rejected' : 'Approval Pending'}</p>
              <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '3px' }}>
                {approvalStatus === 'rejected' ? 'Please contact support for more information.' : 'Your account is being reviewed. Upload your CAC to speed things up.'}
              </p>
            </div>
          </div>
        )}

        {weeklyInsight && (
          <div style={{ display: 'flex', gap: '12px', background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: weeklyInsight.up ? '#DCFCE7' : '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="trendingUp" size={17} color={weeklyInsight.up ? COLORS.green : COLORS.red} />
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{weeklyInsight.up ? `Revenue up ${weeklyInsight.pct}% this week` : `Revenue down ${weeklyInsight.pct}% this week`}</p>
              <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '3px' }}>{weeklyInsight.up ? 'Great momentum — keep it going!' : 'Check Analytics for insights on what changed.'}</p>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '12px' }}>
          {FILTERS.map((f) => (
            <span key={f} onClick={() => setFilter(f)} style={{
              flexShrink: 0, fontSize: '12px', fontWeight: 700, padding: '8px 14px', borderRadius: '20px', cursor: 'pointer',
              background: filter === f ? COLORS.primary : COLORS.card,
              color: filter === f ? 'white' : COLORS.textMuted,
              border: `1px solid ${filter === f ? COLORS.primary : COLORS.border}`,
            }}>
              {f === 'all' ? 'All' : CATEGORY_LABEL[f]}
            </span>
          ))}
        </div>

        {visible.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '40px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}><Icon name="bell" size={28} color={COLORS.textMuted} /></div>
            <p style={{ fontSize: '13px' }}>You're all caught up — no notifications right now.</p>
          </div>
        ) : (
          visible.map((n) => {
            const sev = SEVERITY_COLOR[n.severity] || SEVERITY_COLOR.info
            return (
              <div key={n.id} onClick={() => openNotification(n)} style={{
                display: 'flex', gap: '12px', background: n.is_read ? COLORS.card : '#F0F9FF',
                borderRadius: '14px', padding: '14px', marginBottom: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', cursor: 'pointer',
                border: n.is_read ? 'none' : `1px solid #BAE6FD`,
              }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: sev.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                  <Icon name={CATEGORY_ICON[n.category] || 'bell'} size={17} color={sev.color} />
                  {!n.is_read && <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '9px', height: '9px', borderRadius: '50%', background: COLORS.primary, border: '2px solid white' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <p style={{ fontSize: '13px', fontWeight: n.is_read ? 600 : 800, color: COLORS.text }}>{n.title}</p>
                    <p style={{ fontSize: '10px', color: COLORS.textMuted, whiteSpace: 'nowrap' }}>{timeAgo(n.created_at)}</p>
                  </div>
                  <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '3px' }}>{n.body}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
