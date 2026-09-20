import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  const bellRef = useRef<HTMLDivElement>(null)

  // Panel is positioned with fixed coords computed from the bell's own on-screen
  // position, rather than a plain absolute right:0 anchor. On a narrow phone,
  // absolute+fixed-width panels either clip off-screen or end up hugging both
  // edges of the app shell, which reads as "a whole new page" instead of a
  // dropdown tied to the bell. Measuring the real position + a dimmed backdrop
  // + an explicit close button fixes that: it now clearly overlays Home.
  const [coords, setCoords] = useState<{ top: number; right: number; width: number } | null>(null)

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

  useLayoutEffect(() => {
    if (!open) return
    const updateCoords = () => {
      const rect = bellRef.current?.getBoundingClientRect()
      if (!rect) return
      const margin = 16
      const maxWidth = 320
      const width = Math.min(maxWidth, window.innerWidth - margin * 2)
      const right = Math.max(margin, window.innerWidth - rect.right)
      const top = rect.bottom + 10
      setCoords({ top, right, width })
    }
    updateCoords()
    window.addEventListener('resize', updateCoords)
    return () => window.removeEventListener('resize', updateCoords)
  }, [open])

  // Lock background scroll while the panel is open, same convention as any
  // other overlay in the app, so it behaves like a real sheet, not a page nav.
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
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
    <div ref={bellRef} style={{ position: 'relative' }}>
      <div
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
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

      {open && coords && (
        <>
          {/* Dimmed backdrop — makes it unmistakable this is an overlay sitting
              on top of Home, not a separate page. Tapping it closes the panel. */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.35)',
              zIndex: 45,
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              right: `${coords.right}px`,
              width: `${coords.width}px`,
              maxHeight: '70vh',
              overflowY: 'auto',
              background: COLORS.card,
              borderRadius: '16px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
              border: `1px solid ${COLORS.border}`,
              zIndex: 50,
            }}>
            <div style={{
              padding: '12px 10px 12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: `1px solid ${COLORS.border}`,
              position: 'sticky', top: 0, background: COLORS.card, borderRadius: '16px 16px 0 0',
            }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>Notifications</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {unreadCount > 0 && (
                  <span
                    onClick={handleMarkAllRead}
                    style={{ fontSize: '11px', fontWeight: 600, color: COLORS.primary, cursor: 'pointer' }}>
                    Mark all read
                  </span>
                )}
                <div
                  onClick={() => setOpen(false)}
                  style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#F1F5F9', cursor: 'pointer', flexShrink: 0,
                  }}>
                  <Icon name="x" size={13} color={COLORS.textMuted} />
                </div>
              </div>
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
        </>
      )}
    </div>
  )
}

export default NotificationBell
