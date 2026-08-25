import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
}

const SEVERITY_COLOR: Record<string, string> = {
  info: '#0EA5E9',
  action_required: '#2563EB',
  important: '#F97316',
  critical: '#DC2626',
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

function timeAgo(dateString: string) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(dateString).toLocaleDateString()
}

function NotificationBell({ iconColor = COLORS.text }: { iconColor?: string }) {
  const navigate = useNavigate()
  const [userId, setUserId] = useState<string | null>(null)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const unreadCount = items.filter(n => !n.is_read).length

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      if (!uid) return
      setUserId(uid)

      const { data: rows } = await supabase
        .from('notifications')
        .select('id, category, severity, title, body, action_url, is_read, created_at')
        .eq('recipient_id', uid)
        .order('created_at', { ascending: false })
        .limit(20)
      setItems(rows || [])

      const channel = supabase
        .channel(`notifications-${uid}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${uid}` },
          (payload) => {
            setItems(prev => [payload.new as NotificationRow, ...prev].slice(0, 20))
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleItemClick = async (n: NotificationRow) => {
    if (!n.is_read) {
      setItems(prev => prev.map(i => i.id === n.id ? { ...i, is_read: true } : i))
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    }
    setOpen(false)
    if (n.action_url) {
      const path = n.action_url.startsWith('/#') ? n.action_url.slice(2) : n.action_url
      navigate(path)
    }
  }

  const handleMarkAllRead = async () => {
    if (!userId || unreadCount === 0) return
    setItems(prev => prev.map(i => ({ ...i, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', userId).eq('is_read', false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ cursor: 'pointer', display: 'flex', position: 'relative' }}>
        <Icon name="bell" size={19} color={iconColor} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-6px',
            background: '#DC2626', color: 'white', fontSize: '9px', fontWeight: 700,
            borderRadius: '999px', minWidth: '15px', height: '15px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', lineHeight: 1
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: '30px',
            right: 0,
            width: '300px',
            maxHeight: '400px',
            overflowY: 'auto',
            background: COLORS.card,
            borderRadius: '14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            border: `1px solid ${COLORS.border}`,
            zIndex: 50,
          }}>
          <div style={{
            padding: '12px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: `1px solid ${COLORS.border}`,
          }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>Notifications</span>
            {unreadCount > 0 && (
              <span
                onClick={handleMarkAllRead}
                style={{ fontSize: '11px', fontWeight: 600, color: COLORS.primary, cursor: 'pointer' }}>
                Mark all read
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div style={{ padding: '24px 14px', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: COLORS.textMuted }}>No notifications yet</p>
            </div>
          ) : (
            items.map(n => (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                style={{
                  padding: '12px 14px',
                  display: 'flex', gap: '8px',
                  borderBottom: `1px solid ${COLORS.border}`,
                  background: n.is_read ? 'transparent' : '#F0F9FF',
                  cursor: 'pointer',
                }}>
                <div style={{
                  width: '7px', height: '7px', borderRadius: '50%', marginTop: '5px', flexShrink: 0,
                  background: SEVERITY_COLOR[n.severity] || COLORS.textMuted,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '12.5px', fontWeight: n.is_read ? 500 : 700, color: COLORS.text }}>
                    {n.title}
                  </p>
                  <p style={{
                    fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px',
                    overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
                  }}>
                    {n.body}
                  </p>
                  <p style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '3px' }}>
                    {timeAgo(n.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
