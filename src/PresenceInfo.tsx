import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabaseClient'

const COLORS = {
  card: '#FFFFFF',
  bg: '#F8FAFC',
  border: '#E2E8F0',
  text: '#1A1A1A',
  textMuted: '#64748B',
  green: '#16a34a',
  grey: '#94A3B8',
  primary: '#0EA5E9',
}

// A user counts as "online" if the app pinged within this window (the app pings every minute)
const ONLINE_WINDOW_MS = 2 * 60 * 1000
const REFRESH_MS = 30 * 1000

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`
  return new Date(iso).toLocaleDateString()
}

export function PresenceBadge({ lastSeen }: { lastSeen: string | null | undefined }) {
  const online = !!lastSeen && Date.now() - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: online ? COLORS.green : COLORS.textMuted }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: online ? COLORS.green : COLORS.grey, display: 'inline-block' }} />
      {online ? 'Online' : lastSeen ? `Last active ${timeAgo(lastSeen)}` : 'Last active: unknown'}
    </span>
  )
}

// Admin card: online / last active status, plus phone number and email of a user or company owner.
// Pass the company's own phone and email as fallbacks if the profile does not have them.
function PresenceInfo({ userId, phone, email }: { userId: string | null; phone?: string | null; email?: string | null }) {
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [profilePhone, setProfilePhone] = useState<string | null>(null)
  const [profileEmail, setProfileEmail] = useState<string | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!userId) return
      const { data } = await supabase
        .from('profiles')
        .select('last_seen_at, phone, email')
        .eq('id', userId)
        .maybeSingle()
      if (cancelled || !data) return
      setLastSeen(data.last_seen_at || null)
      setProfilePhone(data.phone || null)
      setProfileEmail(data.email || null)
    }
    load()
    const timer = window.setInterval(() => { load(); setTick((t) => t + 1) }, REFRESH_MS)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [userId])

  const shownPhone = phone || profilePhone
  const shownEmail = email || profileEmail

  const row = (label: string, content: ReactNode, last = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: last ? 'none' : `1px solid ${COLORS.border}` }}>
      <span style={{ fontSize: '12px', color: COLORS.textMuted }}>{label}</span>
      <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text, textAlign: 'right', maxWidth: '65%', wordBreak: 'break-all' }}>{content}</span>
    </div>
  )

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '4px 14px', marginBottom: '16px' }}>
      {row('Status', <PresenceBadge lastSeen={lastSeen} />)}
      {row('Phone', shownPhone
        ? <a href={`tel:${shownPhone}`} style={{ color: COLORS.primary, textDecoration: 'none' }}>{shownPhone}</a>
        : 'Not set')}
      {row('Email', shownEmail
        ? <a href={`mailto:${shownEmail}`} style={{ color: COLORS.primary, textDecoration: 'none' }}>{shownEmail}</a>
        : 'Not set', true)}
    </div>
  )
}

export default PresenceInfo
