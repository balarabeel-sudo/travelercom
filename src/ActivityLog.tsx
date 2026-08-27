import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

const COLORS = {
  primary: '#7c3aed', bg: '#F8FAFC', card: '#FFFFFF', text: '#1A1A1A',
  textMuted: '#64748B', border: '#E2E8F0', green: '#16a34a', greenBg: '#F0FDF4',
  red: '#dc2626', redBg: '#FEF2F2', blue: '#0EA5E9', blueBg: '#EFF6FF',
  orange: '#d97706', orangeBg: '#FFFBEB', purple: '#7c3aed', purpleBg: '#F5F3FF',
}

type LogRow = {
  id: string
  action: string
  module: string
  target_type: string
  target_id: string | null
  created_at: string
  actor_id: string
  actor_name?: string | null
  actor_email?: string | null
}

// Modules the Company Activity Log covers. Add new module keys here as
// new parts of the company dashboard start calling log_audit().
const MODULES: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'company_staff', label: 'Staff' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'finance', label: 'Finance' },
  { key: 'support', label: 'Support' },
  { key: 'settings', label: 'Settings' },
]

const ACTION_ICONS: Record<string, string> = {
  // Staff & Access
  invite: '✉', resend_invite: '↻', cancel_invite: '✕', accept_invite: '✓',
  change_role: '🔄', grant_permission: '➕', revoke_permission: '➖',
  clear_override: '↩', suspend: '⏸', activate: '▶', revoke_access: '🚫',
  // Bookings
  assigned_task: '📋', completed_task: '✅', cancelled_booking: '✕',
  verified_ticket: '🎫',
  // Marketing
  created_promotion: '🏷', updated_promotion: '✎', deleted_promotion: '🗑',
  // Finance
  requested_refund: '↩', requested_withdrawal: '💵',
  // Support
  replied_ticket: '💬', resolved_ticket: '✅',
  // Settings
  updated_settings: '⚙',
}

// Fallback: turn an unknown snake_case action into readable text,
// so newly-logged actions from other modules show something sensible
// even before a hand-written label is added below.
function humanize(a: string) {
  return a.replace(/_/g, ' ')
}

function actionLabel(a: string) {
  const map: Record<string, string> = {
    invite: 'invited a staff member',
    resend_invite: 'resent an invitation',
    cancel_invite: 'cancelled an invitation',
    accept_invite: 'accepted an invitation',
    change_role: "changed a staff member's role",
    grant_permission: 'granted a permission',
    revoke_permission: 'revoked a permission',
    clear_override: 'cleared a permission override',
    suspend: 'suspended a staff member',
    activate: 'reactivated a staff member',
    revoke_access: "revoked a staff member's access",
    assigned_task: 'assigned a task',
    completed_task: 'completed a task',
    cancelled_booking: 'cancelled a booking',
    verified_ticket: 'verified a ticket',
    created_promotion: 'created a promotion',
    updated_promotion: 'updated a promotion',
    deleted_promotion: 'deleted a promotion',
    requested_refund: 'requested a refund',
    requested_withdrawal: 'requested a withdrawal',
    replied_ticket: 'replied to a support ticket',
    resolved_ticket: 'resolved a support ticket',
    updated_settings: 'updated company settings',
  }
  return map[a] || humanize(a)
}

export default function ActivityLog({ companyId, onBack }: { companyId?: string; onBack?: () => void }) {
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(companyId || null)
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState<string>('all')

  useEffect(() => {
    if (companyId) { setResolvedCompanyId(companyId); return }
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('companies').select('id').eq('owner_id', user.id).maybeSingle()
      if (data) setResolvedCompanyId(data.id)
    })()
  }, [companyId])

  const load = useCallback(async () => {
    if (!resolvedCompanyId) return
    setLoading(true)
    // No module filter here — this page now shows activity across the
    // whole company, not just Staff & Access. Filtering by module happens
    // client-side via the chips below.
    const { data: logRows } = await supabase
      .from('audit_logs')
      .select('id, action, module, target_type, target_id, created_at, actor_id')
      .eq('company_id', resolvedCompanyId)
      .order('created_at', { ascending: false })
      .limit(300)

    const rows = logRows || []
    const actorIds = [...new Set(rows.map((r) => r.actor_id))]
    let profileMap: Record<string, { full_name: string | null; email: string | null }> = {}
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', actorIds)
      for (const p of profiles || []) profileMap[p.id] = { full_name: p.full_name, email: p.email }
    }

    setLogs(
      rows.map((r) => ({
        ...r,
        actor_name: profileMap[r.actor_id]?.full_name,
        actor_email: profileMap[r.actor_id]?.email,
      })),
    )
    setLoading(false)
  }, [resolvedCompanyId])

  useEffect(() => { load() }, [load])

  const filtered = logs.filter((l) => {
    if (moduleFilter !== 'all' && l.module !== moduleFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const actorText = (l.actor_name || l.actor_email || '').toLowerCase()
      if (
        !actorText.includes(q) &&
        !l.action.toLowerCase().includes(q) &&
        !l.target_type.toLowerCase().includes(q) &&
        !l.module.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // group by day
  const groups: Record<string, LogRow[]> = {}
  for (const l of filtered) {
    const day = new Date(l.created_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    if (!groups[day]) groups[day] = []
    groups[day].push(l)
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: 32 }}>
      <div style={{ background: COLORS.card, padding: '16px', borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={iconBtn}>‹</button>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: COLORS.text }}>Activity Log</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>Full history of activity across your company</div>
          </div>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by staff name, action, or module…"
          style={{ width: '100%', marginTop: 14, padding: 11, borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: 13.5 }}
        />
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 10, paddingBottom: 2 }}>
          {MODULES.map((m) => (
            <button
              key={m.key}
              onClick={() => setModuleFilter(m.key)}
              style={{
                whiteSpace: 'nowrap',
                padding: '7px 12px',
                borderRadius: 999,
                border: `1px solid ${moduleFilter === m.key ? COLORS.purple : COLORS.border}`,
                background: moduleFilter === m.key ? COLORS.purpleBg : '#fff',
                color: moduleFilter === m.key ? COLORS.purple : COLORS.textMuted,
                fontSize: 11.5,
                fontWeight: 700,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {loading && <div style={{ textAlign: 'center', color: COLORS.textMuted, padding: 30 }}>Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: COLORS.textMuted, padding: 40, fontSize: 13 }}>No activity found.</div>
        )}
        {Object.entries(groups).map(([day, rows]) => (
          <div key={day} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.textMuted, marginBottom: 8, textTransform: 'uppercase' }}>{day}</div>
            {rows.map((l) => (
              <div
                key={l.id}
                style={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: COLORS.purpleBg, color: COLORS.purple,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                  }}
                >
                  {ACTION_ICONS[l.action] || '•'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: COLORS.text }}>
                    <b>{l.actor_name || l.actor_email || 'Someone'}</b> {actionLabel(l.action)}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span>{new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span style={{ opacity: 0.5 }}>•</span>
                    <span style={{ textTransform: 'capitalize' }}>{MODULES.find((m) => m.key === l.module)?.label || l.module}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 12, border: `1px solid ${COLORS.border}`,
  background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
}
