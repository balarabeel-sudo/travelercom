import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'

// Founder-only notification center. Reads ONLY from `founder_notifications`
// (row-level security limits it to the signed-in Founder). It never reads or
// writes the personal `notifications` table used by NotificationBell.

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  red: '#dc2626',
  navy: '#0F172A',
}

type FounderNotification = {
  id: string
  category: string
  event_type: string
  priority: string
  title: string
  body: string
  entity_type: string | null
  entity_id: string | null
  entity_label: string | null
  reference: unknown
  action_label: string | null
  target_section: string | null
  is_read: boolean
  created_at: string
}

const SELECT_COLUMNS =
  'id, category, event_type, priority, title, body, entity_type, entity_id, entity_label, reference, action_label, target_section, is_read, created_at'

const PRIORITY: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#DC2626', bg: '#FEF2F2' },
  high: { label: 'High', color: '#EA580C', bg: '#FFF7ED' },
  normal: { label: 'Normal', color: '#0284C7', bg: '#F0F9FF' },
  info: { label: 'Informational', color: '#64748B', bg: '#F1F5F9' },
}

const CATEGORY: Record<string, { label: string; icon: string }> = {
  booking: { label: 'Booking', icon: 'ticket' },
  company: { label: 'Company', icon: 'building' },
  payment: { label: 'Payment', icon: 'cash' },
  platform: { label: 'Platform', icon: 'trendingUp' },
  system: { label: 'System', icon: 'settings' },
  report: { label: 'Report', icon: 'clipboard' },
  security: { label: 'Security', icon: 'alertCircle' },
}

type FilterKey =
  | 'all' | 'unread' | 'critical' | 'high'
  | 'booking' | 'company' | 'payment' | 'report' | 'system' | 'security'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High Priority' },
  { key: 'booking', label: 'Bookings' },
  { key: 'company', label: 'Companies' },
  { key: 'payment', label: 'Payments' },
  { key: 'report', label: 'Reports' },
  { key: 'system', label: 'System' },
  { key: 'security', label: 'Security' },
]

function matchesFilter(n: FounderNotification, f: FilterKey): boolean {
  if (f === 'all') return true
  if (f === 'unread') return !n.is_read
  if (f === 'critical') return n.priority === 'critical'
  if (f === 'high') return n.priority === 'high'
  return n.category === f
}

function pluralize(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'} ago`
}

function timeAgo(dateString: string) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return pluralize(minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return pluralize(hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 7) return pluralize(days, 'day')
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatFull(dateString: string) {
  const d = new Date(dateString)
  const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date} \u2014 ${time}`
}

function dayLabel(dateString: string) {
  const d = new Date(dateString)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function humanize(value: string) {
  const text = value.replace(/_/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function parseReference(ref: unknown): [string, string][] {
  if (!Array.isArray(ref)) return []
  const rows: [string, string][] = []
  for (const item of ref) {
    if (Array.isArray(item) && item.length === 2 && item[1] !== null && item[1] !== undefined && String(item[1]).trim() !== '') {
      rows.push([String(item[0]), String(item[1])])
    }
  }
  return rows
}

function PriorityPill({ priority }: { priority: string }) {
  const p = PRIORITY[priority] || PRIORITY.normal
  return (
    <span style={{
      fontSize: '10.5px', fontWeight: 700, color: p.color, background: p.bg,
      padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap',
    }}>
      {p.label}
    </span>
  )
}

function FounderNotifications({
  onNavigate,
  onUnreadChange,
}: {
  onNavigate?: (sectionKey: string) => void
  onUnreadChange?: (count: number) => void
}) {
  const [items, setItems] = useState<FounderNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' ? window.innerWidth < 700 : true)

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('founder_notifications')
      .select(SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(200)
    if (loadError) {
      setError(loadError.message)
    } else {
      setError('')
      setItems((data || []) as FounderNotification[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('founder-notifications-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'founder_notifications' }, () => { load() })
      .subscribe()
    const onFocus = () => { load() }
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      supabase.removeChannel(channel)
    }
  }, [load])

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 700)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const unreadCount = items.filter((n) => !n.is_read).length
  const urgentUnread = items.filter((n) => !n.is_read && n.priority === 'critical').length

  useEffect(() => {
    if (!loading && !error && onUnreadChange) onUnreadChange(unreadCount)
  }, [loading, error, unreadCount, onUnreadChange])

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return
    const readAt = new Date().toISOString()
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)))
    const { error: updateError } = await supabase
      .from('founder_notifications')
      .update({ is_read: true, read_at: readAt })
      .in('id', ids)
    if (updateError) load()
  }

  const markAllRead = async () => {
    if (unreadCount === 0) return
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    const { error: updateError } = await supabase
      .from('founder_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('is_read', false)
    if (updateError) load()
  }

  const openItem = (n: FounderNotification) => {
    setSelectedId(n.id)
    if (!n.is_read) markRead([n.id])
  }

  const runAction = (n: FounderNotification) => {
    if (!n.is_read) markRead([n.id])
    setSelectedId(null)
    if (n.target_section && onNavigate) onNavigate(n.target_section)
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((n) => {
      if (!matchesFilter(n, filter)) return false
      if (!q) return true
      return (
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        (n.entity_label || '').toLowerCase().includes(q)
      )
    })
  }, [items, filter, query])

  const groups = useMemo(() => {
    const result: { label: string; rows: FounderNotification[] }[] = []
    for (const n of visible) {
      const label = dayLabel(n.created_at)
      const last = result[result.length - 1]
      if (last && last.label === label) last.rows.push(n)
      else result.push({ label, rows: [n] })
    }
    return result
  }, [visible])

  const selected = selectedId ? items.find((n) => n.id === selectedId) || null : null

  const canAct = (n: FounderNotification) => !!(n.action_label && n.target_section && onNavigate)

  const summary =
    unreadCount === 0
      ? 'No unread notifications'
      : urgentUnread > 0
        ? `${unreadCount} unread, ${urgentUnread} critical`
        : `${unreadCount} unread`

  return (
    <div style={{ padding: '16px 16px 40px 16px', maxWidth: '860px', margin: '0 auto' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '12px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 600, color: urgentUnread > 0 ? COLORS.red : COLORS.textMuted }}>
          {summary}
        </span>
        {unreadCount > 0 && (
          <span
            onClick={markAllRead}
            style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Mark all as read
          </span>
        )}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search notifications"
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 14px', fontSize: '13px',
          border: `1px solid ${COLORS.border}`, borderRadius: '10px', background: COLORS.card,
          color: COLORS.text, outline: 'none', marginBottom: '10px',
        }}
      />

      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px' }}>
        {FILTERS.map((f) => {
          const active = filter === f.key
          const label = f.key === 'unread' && unreadCount > 0 ? `Unread (${unreadCount})` : f.label
          return (
            <span
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                flexShrink: 0, whiteSpace: 'nowrap', cursor: 'pointer',
                padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                background: active ? COLORS.navy : COLORS.card,
                color: active ? '#FFFFFF' : COLORS.textMuted,
                border: `1px solid ${active ? COLORS.navy : COLORS.border}`,
              }}>
              {label}
            </span>
          )
        })}
      </div>

      {loading && (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center', padding: '40px 0' }}>
          Loading notifications...
        </p>
      )}

      {!loading && error && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '22px 18px', textAlign: 'center' }}>
          <Icon name="alertCircle" size={22} color={COLORS.red} />
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.red, margin: '10px 0 4px 0' }}>Could not load notifications</p>
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '12px' }}>{error}</p>
          <span onClick={() => { setLoading(true); load() }} style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>
            Try again
          </span>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div style={{ padding: '56px 20px', textAlign: 'center' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
            <Icon name="check" size={24} color={COLORS.textMuted} />
          </div>
          <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>You're all caught up.</p>
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.6 }}>
            No critical or important Founder notifications at the moment.
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && visible.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '4px' }}>No notifications match</p>
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '10px' }}>Try a different filter or search term.</p>
          <span
            onClick={() => { setFilter('all'); setQuery('') }}
            style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>
            Clear filters
          </span>
        </div>
      )}

      {!loading && !error && groups.map((group) => (
        <div key={group.label} style={{ marginBottom: '8px' }}>
          <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, margin: '8px 2px 8px 2px' }}>{group.label}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {group.rows.map((n) => {
              const pr = PRIORITY[n.priority] || PRIORITY.normal
              const cat = CATEGORY[n.category] || { label: humanize(n.category), icon: 'bell' }
              return (
                <div
                  key={n.id}
                  onClick={() => openItem(n)}
                  style={{
                    display: 'flex', overflow: 'hidden', cursor: 'pointer',
                    background: n.is_read ? COLORS.card : '#F6FAFF',
                    border: `1px solid ${n.is_read ? COLORS.border : '#BAE6FD'}`,
                    borderRadius: '12px',
                  }}>
                  <div style={{ width: '4px', flexShrink: 0, background: pr.color, opacity: n.is_read ? 0.35 : 1 }} />
                  <div style={{ flex: 1, minWidth: 0, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
                        background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon name={cat.icon} size={16} color={n.is_read ? COLORS.textMuted : COLORS.navy} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <p style={{ flex: 1, fontSize: '13.5px', fontWeight: n.is_read ? 600 : 800, color: COLORS.text }}>
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS.primary, flexShrink: 0 }} />
                          )}
                        </div>
                        <p style={{
                          fontSize: '12.5px', color: COLORS.textMuted, marginTop: '3px', lineHeight: 1.5,
                          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
                        }}>
                          {n.body}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: '8px', marginTop: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: COLORS.textMuted }}>{cat.label}</span>
                          <span style={{ fontSize: '11px', color: COLORS.textMuted }}>{timeAgo(n.created_at)}</span>
                          <PriorityPill priority={n.priority} />
                        </div>
                      </div>
                    </div>

                    {(canAct(n) || !n.is_read) && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', paddingLeft: '44px', gap: '10px' }}>
                        {!n.is_read ? (
                          <span
                            onClick={(e) => { e.stopPropagation(); markRead([n.id]) }}
                            style={{ fontSize: '11.5px', fontWeight: 600, color: COLORS.textMuted, cursor: 'pointer' }}>
                            Mark as read
                          </span>
                        ) : <span />}
                        {canAct(n) && (
                          <span
                            onClick={(e) => { e.stopPropagation(); runAction(n) }}
                            style={{
                              fontSize: '11.5px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer',
                              border: `1px solid ${COLORS.border}`, background: COLORS.card,
                              padding: '5px 12px', borderRadius: '8px', whiteSpace: 'nowrap',
                            }}>
                            {n.action_label}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {selected && (
        <div
          onClick={() => setSelectedId(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,0.45)',
            display: 'flex', justifyContent: 'center', alignItems: isNarrow ? 'flex-end' : 'center',
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: COLORS.card, width: isNarrow ? '100%' : 'min(520px, 92vw)',
              maxHeight: '88vh', overflowY: 'auto' as const,
              borderRadius: isNarrow ? '18px 18px 0 0' : '16px',
              padding: '18px 20px 22px 20px', boxSizing: 'border-box',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <PriorityPill priority={selected.priority} />
              <div
                onClick={() => setSelectedId(null)}
                style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="x" size={14} color={COLORS.textMuted} />
              </div>
            </div>

            <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text, margin: '0 0 8px 0' }}>{selected.title}</h2>
            <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.65, margin: '0 0 16px 0' }}>{selected.body}</p>

            <div style={{ borderTop: `1px solid ${COLORS.border}` }}>
              {([
                ['Event type', humanize(selected.event_type)],
                ['Category', (CATEGORY[selected.category] || { label: humanize(selected.category) }).label],
                ['Priority', (PRIORITY[selected.priority] || PRIORITY.normal).label],
                ['Received', formatFull(selected.created_at)],
                ...(selected.entity_label
                  ? [[selected.entity_type ? humanize(selected.entity_type) : 'Related', selected.entity_label] as [string, string]]
                  : []),
                ...parseReference(selected.reference),
              ] as [string, string][]).map(([label, value], i) => (
                <div
                  key={`${label}-${i}`}
                  style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ width: '112px', flexShrink: 0, fontSize: '12px', color: COLORS.textMuted }}>{label}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '12.5px', fontWeight: 600, color: COLORS.text, wordBreak: 'break-word' as const }}>{value}</span>
                </div>
              ))}
            </div>

            {canAct(selected) && (
              <button
                onClick={() => runAction(selected)}
                style={{
                  width: '100%', marginTop: '18px', padding: '12px', border: 'none', borderRadius: '10px',
                  background: COLORS.primary, color: '#FFFFFF', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer',
                }}>
                {selected.action_label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default FounderNotifications
