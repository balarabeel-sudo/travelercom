import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

const COLORS = {
  primary: '#7c3aed',
  primaryBg: '#F5F3FF',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  greenBg: '#F0FDF4',
  red: '#dc2626',
  redBg: '#FEF2F2',
  blue: '#0EA5E9',
  blueBg: '#EFF6FF',
  orange: '#d97706',
  orangeBg: '#FFFBEB',
  purple: '#7c3aed',
  purpleBg: '#F5F3FF',
  pink: '#db2777',
  pinkBg: '#FDF2F8',
}

// supabase-js hides the real Edge Function error body behind a generic
// "non-2xx status code" message. This digs into error.context (the raw
// Response) to surface what the function actually said.
async function resolveEdgeError(data: any, error: any): Promise<string> {
  if (data && data.error) return data.error
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.clone().json()
      if (body?.error) return body.error
    } catch {
      // response wasn't JSON, fall through
    }
  }
  return error?.message || 'Action failed'
}

const AVATAR_COLORS = [
  { bg: '#F5F3FF', fg: '#7c3aed' },
  { bg: '#EFF6FF', fg: '#0EA5E9' },
  { bg: '#F0FDF4', fg: '#16a34a' },
  { bg: '#FFFBEB', fg: '#d97706' },
  { bg: '#FDF2F8', fg: '#db2777' },
]

function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h]
}

function initials(name: string | null, email: string | null) {
  const src = (name && name.trim()) || (email ? email.split('@')[0] : '?')
  const parts = src.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

type StaffRow = {
  id: string
  user_id: string
  status: string
  role_label: string | null
  template_id: string | null
  profiles?: { full_name: string | null; email: string | null } | null
  company_role_templates?: { name: string } | null
  grantedCount?: number
  totalCount?: number
}

type InviteRow = {
  id: string
  email: string
  full_name: string | null
  status: string
  role_label: string | null
  created_at: string
}

type ActivityRow = {
  id: string
  action: string
  target_type: string
  created_at: string
  actor_id: string
  actor_name?: string
}

export default function CompanyStaffAccess({
  companyId: companyIdProp,
  onBack,
}: {
  companyId?: string
  onBack?: () => void
}) {
  const [companyId, setCompanyId] = useState<string | null>(companyIdProp || null)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  // If no companyId was passed in, resolve it from the logged-in user's own company
  useEffect(() => {
    if (companyIdProp) { setCompanyId(companyIdProp); return }
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setErrorMsg('Not signed in'); setLoading(false); return }
      const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()
      if (error || !data) { setErrorMsg('No company found for this account'); setLoading(false); return }
      setCompanyId(data.id)
    })()
  }, [companyIdProp])

  const [totalStaff, setTotalStaff] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [suspendedCount, setSuspendedCount] = useState(0)
  const [overridesCount, setOverridesCount] = useState(0)
  const [totalPermissions, setTotalPermissions] = useState(0)

  const [tab, setTab] = useState<'all' | 'pending' | 'suspended'>('all')
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])

  const [selectedStaff, setSelectedStaff] = useState<StaffRow | null>(null)
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  const loadAll = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    setErrorMsg('')
    try {
      const [
        { count: totalC },
        { count: activeC },
        { count: suspendedC },
        { count: pendingC },
        { data: permsCatalog },
      ] = await Promise.all([
        supabase.from('company_staff').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('company_staff').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'active'),
        supabase.from('company_staff').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'suspended'),
        supabase.from('company_staff_invitations').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pending'),
        supabase.from('company_permissions').select('key'),
      ])
      setTotalStaff(totalC || 0)
      setActiveCount(activeC || 0)
      setSuspendedCount(suspendedC || 0)
      setPendingCount(pendingC || 0)
      setTotalPermissions(permsCatalog?.length || 0)

      const statusFilter = tab === 'all' ? undefined : tab === 'pending' ? undefined : 'suspended'

      let staffQuery = supabase
        .from('company_staff')
        .select('id, user_id, status, role_label, template_id, profiles:user_id(full_name,email), company_role_templates(name)')
        .eq('company_id', companyId)
        .order('joined_at', { ascending: false })

      if (tab === 'suspended') staffQuery = staffQuery.eq('status', 'suspended')
      if (tab === 'all') staffQuery = staffQuery.eq('status', 'active')

      const { data: staffData, error: staffErr } = tab === 'pending' ? { data: [], error: null } : await staffQuery
      if (staffErr) throw staffErr

      const rows: StaffRow[] = staffData || []

      // compute effective permission counts per staff
      const withCounts = await Promise.all(
        rows.map(async (s) => {
          const [{ data: tmplPerms }, { data: overrides }] = await Promise.all([
            s.template_id
              ? supabase.from('company_role_template_permissions').select('permission_key').eq('template_id', s.template_id)
              : Promise.resolve({ data: [] as { permission_key: string }[] }),
            supabase.from('company_staff_permission_overrides').select('permission_key, granted').eq('company_staff_id', s.id),
          ])
          const templateKeys = new Set((tmplPerms || []).map((p) => p.permission_key))
          for (const o of overrides || []) {
            if (o.granted) templateKeys.add(o.permission_key)
            else templateKeys.delete(o.permission_key)
          }
          return { ...s, grantedCount: templateKeys.size, totalCount: permsCatalog?.length || 0 }
        }),
      )
      setStaff(withCounts)

      const { data: overridesAll } = await supabase
        .from('company_staff_permission_overrides')
        .select('id, company_staff:company_staff_id(company_id)')
      const relevantOverrides = (overridesAll || []).filter((o: any) => o.company_staff?.company_id === companyId)
      setOverridesCount(relevantOverrides.length)

      const { data: inviteData } = await supabase
        .from('company_staff_invitations')
        .select('id, email, full_name, status, role_label, created_at')
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5)
      setInvites(inviteData || [])

      const { data: activityData } = await supabase
        .from('audit_logs')
        .select('id, action, target_type, created_at, actor_id')
        .eq('module', 'company_staff')
        .order('created_at', { ascending: false })
        .limit(6)
      setActivity(activityData || [])
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to load staff data')
    } finally {
      setLoading(false)
    }
  }, [companyId, tab])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const runStaffAction = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('company-manage-staff', {
      body: { action, company_id: companyId, ...extra },
    })
    if (error || (data && data.error)) {
      const msg = await resolveEdgeError(data, error)
      alert(msg)
      return false
    }
    await loadAll()
    return true
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ background: COLORS.card, padding: '16px 16px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={onBack} style={iconBtnStyle}>‹</button>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>Staff & Access</div>
              <div style={{ fontSize: 12.5, color: COLORS.textMuted }}>Manage your team and control access</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={iconBtnStyle}>🔍</button>
            <button
              onClick={() => setShowInvite(true)}
              style={{ ...iconBtnStyle, background: COLORS.purple, color: '#fff' }}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div style={{ margin: 16, padding: 12, background: COLORS.redBg, color: COLORS.red, borderRadius: 10, fontSize: 13 }}>
          {errorMsg}
        </div>
      )}

      {/* Summary stats — horizontal scroll on narrow screens */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: 0, padding: '16px', background: COLORS.card, marginBottom: 12 }}>
        <StatCard icon="👥" value={totalStaff} label="Total Staff" color={COLORS.purple} bg={COLORS.purpleBg} />
        <Divider />
        <StatCard icon="✓" value={activeCount} label="Active" color={COLORS.green} bg={COLORS.greenBg} />
        <Divider />
        <StatCard icon="✉" value={pendingCount} label="Pending" color={COLORS.orange} bg={COLORS.orangeBg} />
        <Divider />
        <StatCard icon="⏸" value={suspendedCount} label="Suspended" color={COLORS.red} bg={COLORS.redBg} />
        <Divider />
        <StatCard icon="🛡" value={overridesCount} label="Overrides" color={COLORS.blue} bg={COLORS.blueBg} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', flex: 1, background: COLORS.card, borderRadius: 999, padding: 4, border: `1px solid ${COLORS.border}` }}>
          {(['all', 'pending', 'suspended'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '9px 10px',
                borderRadius: 999,
                border: 'none',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                background: tab === t ? COLORS.purple : 'transparent',
                color: tab === t ? '#fff' : COLORS.textMuted,
              }}
            >
              {t === 'all' ? `All Staff (${activeCount})` : t === 'pending' ? `Pending (${pendingCount})` : `Suspended (${suspendedCount})`}
            </button>
          ))}
        </div>
        <button style={{ ...iconBtnStyle, width: 'auto', padding: '0 14px', fontSize: 12.5, fontWeight: 700, color: COLORS.text }}>
          ⏷ Filter
        </button>
      </div>

      {/* List */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, marginBottom: 10 }}>
          {tab === 'all' && `Active Staff (${activeCount})`}
          {tab === 'pending' && `Pending Invitations (${pendingCount})`}
          {tab === 'suspended' && `Suspended Staff (${suspendedCount})`}
        </div>

        {loading && <div style={{ color: COLORS.textMuted, fontSize: 13, padding: 20, textAlign: 'center' }}>Loading…</div>}

        {!loading && tab !== 'pending' && staff.length === 0 && (
          <EmptyState text={tab === 'all' ? 'No active staff yet.' : 'No suspended staff.'} />
        )}

        {!loading &&
          tab !== 'pending' &&
          staff.slice(0, 5).map((s) => {
            const name = s.profiles?.full_name || s.profiles?.email || 'Unknown'
            const email = s.profiles?.email || ''
            const av = avatarColor(s.id)
            return (
              <div
                key={s.id}
                style={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: av.bg,
                    color: av.fg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  {initials(s.profiles?.full_name ?? null, s.profiles?.email ?? null)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: COLORS.text }}>{name}</div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {email}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: s.status === 'active' ? COLORS.green : COLORS.red,
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ fontSize: 11.5, color: s.status === 'active' ? COLORS.green : COLORS.red, fontWeight: 600 }}>
                      {s.status === 'active' ? 'Active' : 'Suspended'}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: av.fg,
                        background: av.bg,
                        padding: '2px 8px',
                        borderRadius: 999,
                      }}
                    >
                      {s.company_role_templates?.name || s.role_label || 'No role'}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>
                    {s.grantedCount ?? 0} / {s.totalCount ?? totalPermissions}
                  </div>
                  <div style={{ fontSize: 10.5, color: COLORS.textMuted }}>Permissions</div>
                </div>
                <button
                  onClick={() => setMenuOpenFor(menuOpenFor === s.id ? null : s.id)}
                  style={{ background: 'none', border: 'none', fontSize: 18, color: COLORS.textMuted, cursor: 'pointer', padding: 4 }}
                >
                  ⋮
                </button>
                {menuOpenFor === s.id && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: 48,
                      background: COLORS.card,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 10,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      zIndex: 5,
                      minWidth: 170,
                      overflow: 'hidden',
                    }}
                  >
                    <MenuItem label="Manage Access" onClick={() => { setSelectedStaff(s); setMenuOpenFor(null) }} />
                    <MenuItem label="Change Role" onClick={() => setMenuOpenFor(null)} />
                    {s.status === 'active' ? (
                      <MenuItem
                        label="Suspend"
                        danger
                        onClick={async () => {
                          setMenuOpenFor(null)
                          const reason = prompt('Reason for suspension (optional)') || undefined
                          await runStaffAction('suspend', { target_staff_id: s.id, reason })
                        }}
                      />
                    ) : (
                      <MenuItem
                        label="Activate"
                        onClick={async () => {
                          setMenuOpenFor(null)
                          await runStaffAction('activate', { target_staff_id: s.id })
                        }}
                      />
                    )}
                    <MenuItem label="Activity Log" onClick={() => setMenuOpenFor(null)} />
                    <MenuItem
                      label="Revoke Access"
                      danger
                      onClick={async () => {
                        setMenuOpenFor(null)
                        if (confirm(`Revoke ${name}'s access to this company? This cannot be undone.`)) {
                          await runStaffAction('revoke_access', { target_staff_id: s.id })
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}

        {!loading && tab === 'pending' &&
          (invites.length === 0 ? (
            <EmptyState text="No pending invitations." />
          ) : (
            invites.map((inv) => (
              <div
                key={inv.id}
                style={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: COLORS.purpleBg, color: COLORS.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  ✉
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>{inv.full_name || inv.email}</div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted }}>{inv.email}</div>
                </div>
                <button
                  onClick={() => runStaffAction('resend_invite', { invitation_id: inv.id })}
                  style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${COLORS.border}`, background: '#fff', fontSize: 12.5, fontWeight: 700, color: COLORS.text }}
                >
                  Resend
                </button>
              </div>
            ))
          ))}

        {tab === 'all' && staff.length > 0 && (
          <button style={viewAllBtn}>View all active staff  ›</button>
        )}
      </div>

      {/* Pending + Activity (when on "all" tab, condensed view) */}
      {tab === 'all' && (
        <div style={{ padding: '20px 16px 0' }}>
          <PanelCard title={`Pending Invitations (${pendingCount})`} action="View all" onAction={() => setTab('pending')}>
            {invites.length === 0 ? (
              <div style={{ fontSize: 12.5, color: COLORS.textMuted, padding: '8px 0' }}>No pending invitations.</div>
            ) : (
              invites.slice(0, 3).map((inv) => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: COLORS.purpleBg, color: COLORS.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                    {initials(inv.full_name, inv.email)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{inv.full_name || inv.email}</div>
                    <div style={{ fontSize: 11.5, color: COLORS.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</div>
                  </div>
                  <button
                    onClick={() => runStaffAction('resend_invite', { invitation_id: inv.id })}
                    style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', fontSize: 11, fontWeight: 700 }}
                  >
                    Resend
                  </button>
                </div>
              ))
            )}
          </PanelCard>

          <PanelCard title="Recent Activity" action="View all" onAction={() => {}}>
            {activity.length === 0 ? (
              <div style={{ fontSize: 12.5, color: COLORS.textMuted, padding: '8px 0' }}>No recent activity.</div>
            ) : (
              activity.map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: COLORS.greenBg, color: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                    ✓
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: COLORS.text }}>
                      <b>{a.action}</b> · {a.target_type}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted }}>{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </PanelCard>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, marginBottom: 10 }}>Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: 10 }}>
          <QuickAction icon="👤➕" label="Invite Staff" onClick={() => setShowInvite(true)} />
          <QuickAction icon="🛡" label="Create Role" onClick={() => navigate('/staff/create-role')} />
          <QuickAction icon="▦" label="Permission Matrix" onClick={() => navigate('/staff/permission-matrix')} />
          <QuickAction icon="👤" label="Manage Roles" onClick={() => navigate('/staff/manage-roles')} />
          <QuickAction icon="📋" label="Activity Log" onClick={() => navigate('/staff/activity-log')} />
        </div>
      </div>

      {selectedStaff && (
        <ManageAccessSheet
          staff={selectedStaff}
          onClose={() => setSelectedStaff(null)}
          runStaffAction={runStaffAction}
        />
      )}

      {showInvite && (
        <InviteStaffSheet companyId={companyId} onClose={() => setShowInvite(false)} onInvited={loadAll} />
      )}
    </div>
  )
}

function StatCard({ icon, value, label, color, bg }: { icon: string; value: number; label: string; color: string; bg: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '0 8px', minWidth: 62 }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: 14 }}>
        {icon}
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: COLORS.text }}>{value}</div>
      <div style={{ fontSize: 10, color: COLORS.textMuted }}>{label}</div>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, background: COLORS.border, margin: '4px 0' }} />
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: COLORS.textMuted, fontSize: 13 }}>{text}</div>
  )
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '11px 14px',
        border: 'none',
        background: 'none',
        fontSize: 13,
        fontWeight: 600,
        color: danger ? COLORS.red : COLORS.text,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function PanelCard({ title, action, onAction, children }: { title: string; action: string; onAction: () => void; children: React.ReactNode }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: COLORS.text }}>{title}</div>
        <span onClick={onAction} style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.purple, cursor: 'pointer' }}>{action}</span>
      </div>
      {children}
    </div>
  )
}

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: '14px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 12, background: COLORS.purpleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
        {icon}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.text, textAlign: 'center' }}>{label}</div>
    </button>
  )
}

const iconBtnStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  cursor: 'pointer',
}

const viewAllBtn: React.CSSProperties = {
  width: '100%',
  padding: '13px',
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.purpleBg,
  color: COLORS.purple,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  marginTop: 4,
}

// ---------------- Manage Access bottom sheet ----------------
const PERMISSION_MODULES = [
  'bookings', 'tickets', 'finance', 'refunds', 'marketing', 'staff', 'company', 'operations', 'customers', 'support', 'platform',
]
const HIGH_RISK_KEYS = new Set([
  'refunds.approve', 'finance.withdrawals', 'company.settings', 'staff.revoke', 'staff.suspend', 'platform.manage', 'platform.edit', 'marketing.delete',
])

function ManageAccessSheet({
  staff,
  onClose,
  runStaffAction,
}: {
  staff: StaffRow
  onClose: () => void
  runStaffAction: (action: string, extra?: Record<string, unknown>) => Promise<boolean>
}) {
  const [allPerms, setAllPerms] = useState<{ key: string; module: string; description: string; risk_level: string }[]>([])
  const [templateKeys, setTemplateKeys] = useState<Set<string>>(new Set())
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [confirmKey, setConfirmKey] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const [{ data: perms }, { data: tmplPerms }, { data: ov }] = await Promise.all([
        supabase.from('company_permissions').select('key, module, description, risk_level'),
        staff.template_id
          ? supabase.from('company_role_template_permissions').select('permission_key').eq('template_id', staff.template_id)
          : Promise.resolve({ data: [] as { permission_key: string }[] }),
        supabase.from('company_staff_permission_overrides').select('permission_key, granted').eq('company_staff_id', staff.id),
      ])
      setAllPerms(perms || [])
      setTemplateKeys(new Set((tmplPerms || []).map((p) => p.permission_key)))
      const ovMap: Record<string, boolean> = {}
      for (const o of ov || []) ovMap[o.permission_key] = o.granted
      setOverrides(ovMap)
    })()
  }, [staff])

  const isGranted = (key: string) => (key in overrides ? overrides[key] : templateKeys.has(key))
  const source = (key: string) => (key in overrides ? (overrides[key] ? 'Custom Grant' : 'Custom Revoke') : templateKeys.has(key) ? 'Granted by Role' : null)

  const toggle = async (key: string) => {
    const nextGrant = !isGranted(key)
    if (nextGrant && HIGH_RISK_KEYS.has(key) && confirmKey !== key) {
      setConfirmKey(key)
      return
    }
    setConfirmKey(null)
    const action = nextGrant ? 'grant_permission' : 'revoke_permission'
    const ok = await runStaffAction(action, { target_staff_id: staff.id, permission_key: key })
    if (ok) setOverrides((prev) => ({ ...prev, [key]: nextGrant }))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 20, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: COLORS.card, width: '100%', maxHeight: '85vh', overflowY: 'auto', borderRadius: '20px 20px 0 0', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.text }}>Manage Access</div>
          <span onClick={onClose} style={{ cursor: 'pointer', fontSize: 18, color: COLORS.textMuted }}>✕</span>
        </div>

        <div style={{ background: COLORS.bg, borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>{staff.profiles?.full_name || staff.profiles?.email}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>{staff.profiles?.email}</div>
          <div style={{ fontSize: 11.5, color: COLORS.purple, fontWeight: 700, marginTop: 2 }}>
            {staff.company_role_templates?.name || staff.role_label} · {staff.status}
          </div>
        </div>

        {PERMISSION_MODULES.map((mod) => {
          const modPerms = allPerms.filter((p) => p.module === mod)
          if (modPerms.length === 0) return null
          return (
            <div key={mod} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: COLORS.text, textTransform: 'capitalize', marginBottom: 6 }}>{mod}</div>
              {modPerms.map((p) => {
                const granted = isGranted(p.key)
                const src = source(p.key)
                const risky = p.risk_level === 'high'
                return (
                  <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: COLORS.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {p.description}
                        {risky && <span style={{ fontSize: 10, color: COLORS.red, fontWeight: 800 }}>🔴 HIGH RISK</span>}
                      </div>
                      {src && <div style={{ fontSize: 10.5, color: COLORS.textMuted }}>{src}</div>}
                    </div>
                    <input type="checkbox" checked={granted} onChange={() => toggle(p.key)} style={{ width: 20, height: 20 }} />
                  </div>
                )
              })}
            </div>
          )
        })}

        {confirmKey && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30, padding: 24 }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: 20, maxWidth: 320 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>Grant high-risk permission?</div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 16 }}>
                Granting <b>{confirmKey}</b> gives this staff member significant control. Are you sure?
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmKey(null)} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${COLORS.border}`, background: '#fff' }}>Cancel</button>
                <button onClick={() => toggle(confirmKey)} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: COLORS.red, color: '#fff', fontWeight: 700 }}>Grant Permission</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------- Invite Staff bottom sheet ----------------
function InviteStaffSheet({ companyId, onClose, onInvited }: { companyId: string; onClose: () => void; onInvited: () => void }) {
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.from('company_role_templates').select('id, name').order('name').then(({ data }) => setTemplates(data || []))
  }, [])

  const submit = async () => {
    if (!email.trim()) { setError('Email is required'); return }
    if (!templateId) { setError('Please select a role'); return }
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.functions.invoke('company-manage-staff', {
      body: { action: 'invite', company_id: companyId, email: email.trim(), full_name: fullName.trim() || undefined, template_id: templateId },
    })
    setLoading(false)
    if (err || (data && data.error)) {
      setError(await resolveEdgeError(data, err))
      return
    }
    setSuccess(true)
    onInvited()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 20, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: COLORS.card, width: '100%', borderRadius: '20px 20px 0 0', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Invite Staff</div>
          <span onClick={onClose} style={{ cursor: 'pointer', fontSize: 18, color: COLORS.textMuted }}>✕</span>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.green, marginBottom: 6 }}>Invitation sent successfully.</div>
            <button onClick={onClose} style={{ marginTop: 10, padding: '10px 20px', borderRadius: 10, border: 'none', background: COLORS.purple, color: '#fff', fontWeight: 700 }}>Done</button>
          </div>
        ) : (
          <>
            {error && <div style={{ background: COLORS.redBg, color: COLORS.red, padding: 10, borderRadius: 10, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
            <label style={labelStyle}>Full Name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} placeholder="Jane Doe" />
            <label style={labelStyle}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="jane@company.com" />
            <label style={labelStyle}>Select Role</label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={inputStyle}>
              <option value="">Choose a role…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={submit}
              disabled={loading}
              style={{ width: '100%', marginTop: 16, padding: 14, borderRadius: 12, border: 'none', background: COLORS.purple, color: '#fff', fontWeight: 700, fontSize: 14 }}
            >
              {loading ? 'Sending…' : 'Send Invitation'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: COLORS.textMuted, display: 'block', margin: '10px 0 6px' }
const inputStyle: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: 14, background: '#fff' }
