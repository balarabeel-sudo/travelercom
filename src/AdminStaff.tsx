import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
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
  purple: '#7c3aed',
  purpleBg: '#F5F3FF',
  orange: '#d97706',
  orangeBg: '#FFFBEB',
}

type Role = { id: string; name: string; description: string | null }
type StaffMember = { user_id: string; role_id: string | null; invited_at: string | null; suspended: boolean; email: string | null; full_name: string | null; is_super_admin?: boolean }
type Invite = { id: string; email: string; role_id: string; status: 'pending' | 'accepted' | 'revoked'; created_at: string }
type Permission = { id: string; module: string; action: string; description: string | null }
type RolePermission = { role_id: string; permission_id: string }
type Override = { permission_id: string; granted: boolean; note: string | null }
type AuditLog = { id: string; action: string; module: string; target_type: string | null; target_id: string | null; created_at: string }

const AVATAR_COLORS = [
  { bg: '#DBEAFE', text: '#1D4ED8' }, { bg: '#DCFCE7', text: '#15803D' }, { bg: '#F3E8FF', text: '#7C3AED' },
  { bg: '#FEF3C7', text: '#B45309' }, { bg: '#FEE2E2', text: '#B91C1C' }, { bg: '#E0F2FE', text: '#0369A1' },
]
function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h]
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

export default function AdminStaff() {
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null)
  const [overview, setOverview] = useState<{ total_staff: number; active_staff: number; pending_invites: number; total_roles: number } | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [inviteFilter, setInviteFilter] = useState<'all' | 'pending' | 'accepted' | 'revoked'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [sending, setSending] = useState(false)
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null)
  const [newRoleId, setNewRoleId] = useState('')
  const [changing, setChanging] = useState(false)

  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([])
  const [overridesFor, setOverridesFor] = useState<StaffMember | null>(null)
  const [overrides, setOverrides] = useState<Override[]>([])
  const [overridesLoading, setOverridesLoading] = useState(false)
  const [overrideActionId, setOverrideActionId] = useState<string | null>(null)

  const [activityFor, setActivityFor] = useState<StaffMember | null>(null)
  const [activity, setActivity] = useState<AuditLog[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')

    const { data: userData } = await supabase.auth.getUser()
    const { data: me } = await supabase.from('admins').select('is_super_admin').eq('user_id', userData?.user?.id).single()
    setIsSuperAdmin(!!me?.is_super_admin)

    const [{ data: overviewData, error: overviewErr }, { data: rolesData, error: rolesErr }, { data: staffData, error: staffErr }, { data: invitesData, error: invitesErr }, { data: permsData, error: permsErr }, { data: rolePermsData, error: rolePermsErr }] = await Promise.all([
      supabase.rpc('admin_staff_overview'),
      supabase.from('roles').select('id, name, description').neq('id', 'founder').order('name'),
      supabase.rpc('admin_staff_list'),
      supabase.from('staff_invites').select('id, email, role_id, status, created_at').order('created_at', { ascending: false }),
      supabase.from('permissions').select('id, module, action, description').order('module'),
      supabase.from('role_permissions').select('role_id, permission_id'),
    ])

    if (overviewErr || rolesErr || staffErr || invitesErr || permsErr || rolePermsErr) {
      setError((overviewErr || rolesErr || staffErr || invitesErr || permsErr || rolePermsErr)?.message || 'Error loading data')
    }
    setOverview(overviewData || null)
    setRoles(rolesData || [])
    let staffWithSuperFlag = (staffData as StaffMember[]) || []
    if (staffWithSuperFlag.length > 0) {
      const { data: superFlags } = await supabase
        .from('admins')
        .select('user_id, is_super_admin')
        .in('user_id', staffWithSuperFlag.map((s) => s.user_id))
      const superMap: Record<string, boolean> = {}
      for (const row of superFlags || []) superMap[row.user_id] = !!row.is_super_admin
      staffWithSuperFlag = staffWithSuperFlag.map((s) => ({ ...s, is_super_admin: !!superMap[s.user_id] }))
    }
    setStaff(staffWithSuperFlag)
    setInvites(invitesData || [])
    setAllPermissions(permsData || [])
    setRolePermissions(rolePermsData || [])
    if (rolesData && rolesData.length > 0 && !roleId) setRoleId(rolesData[0].id)
    setLoading(false)
  }

  async function sendInvite() {
    if (!email.trim() || !roleId) { setError('Email da role dole ne.'); return }
    setSending(true)
    setError('')
    const { error } = await supabase.rpc('create_staff_invite', { p_email: email.trim(), p_role_id: roleId })
    setSending(false)
    if (error) { setError(error.message); return }
    setEmail('')
    setShowForm(false)
    load()
  }

  async function revokeInvite(id: string) {
    if (!confirm('Revoke this invite?')) return
    const { error } = await supabase.rpc('revoke_staff_invite', { p_invite_id: id })
    if (error) setError(error.message); else load()
  }

  async function revokeAccess(userId: string) {
    if (!confirm("Revoke this staff member's admin access?")) return
    const { error } = await supabase.rpc('revoke_staff_access', { p_user_id: userId })
    if (error) setError(error.message); else load()
  }

  async function changeRole() {
    if (!changingRoleFor || !newRoleId) return
    setChanging(true)
    setError('')
    const { error } = await supabase.rpc('change_staff_role', { p_user_id: changingRoleFor, p_new_role_id: newRoleId })
    setChanging(false)
    if (error) { setError(error.message); return }
    setChangingRoleFor(null)
    load()
  }

  async function toggleSuspend(s: StaffMember) {
    const action = s.suspended ? 'reactivate' : 'suspend'
    if (!confirm(`${action === 'suspend' ? 'Suspend' : 'Reactivate'} this staff member?`)) return
    const { error } = await supabase.rpc('set_staff_suspended', { p_user_id: s.user_id, p_suspended: !s.suspended })
    if (error) setError(error.message); else load()
  }

  async function openOverrides(s: StaffMember) {
    setOverridesFor(s)
    setOverridesLoading(true)
    const { data, error } = await supabase.from('admin_permission_overrides').select('permission_id, granted, note').eq('user_id', s.user_id)
    setOverridesLoading(false)
    if (error) { setError(error.message); return }
    setOverrides(data || [])
  }

  async function setOverride(permissionId: string, granted: boolean) {
    if (!overridesFor) return
    setOverrideActionId(permissionId)
    const { error } = await supabase.rpc('set_permission_override', { p_user_id: overridesFor.user_id, p_permission_id: permissionId, p_granted: granted })
    setOverrideActionId(null)
    if (error) { setError(error.message); return }
    openOverrides(overridesFor)
  }

  async function resetOverride(permissionId: string) {
    if (!overridesFor) return
    setOverrideActionId(permissionId)
    const { error } = await supabase.rpc('clear_permission_override', { p_user_id: overridesFor.user_id, p_permission_id: permissionId })
    setOverrideActionId(null)
    if (error) { setError(error.message); return }
    openOverrides(overridesFor)
  }

  async function openActivity(s: StaffMember) {
    setActivityFor(s)
    setActivityLoading(true)
    setActivityError('')
    const { data, error } = await supabase.from('audit_logs').select('id, action, module, target_type, target_id, created_at').eq('actor_id', s.user_id).order('created_at', { ascending: false }).limit(25)
    setActivityLoading(false)
    if (error) { setActivityError(error.message); return }
    setActivity(data || [])
  }

  function roleName(s: StaffMember) {
    if (s.is_super_admin) return 'Founder'
    return roleNameById(s.role_id)
  }

  function roleNameById(id: string | null) {
    return roles.find((r) => r.id === id)?.name || id || 'Unknown role'
  }

  function displayName(s: StaffMember) {
    return s.full_name || roleName(s)
  }

  const filteredInvites = invites.filter((i) => inviteFilter === 'all' || i.status === inviteFilter)

  if (loading) return <div style={{ padding: '18px' }}><p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p></div>

  if (isSuperAdmin === false) {
    return (
      <div style={{ padding: '18px' }}>
        <div style={{ background: COLORS.redBg, border: '1px solid #FECACA', borderRadius: '14px', padding: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.red, marginBottom: '4px' }}>Founder only</p>
          <p style={{ fontSize: '12px', color: COLORS.red }}>Staff & Permissions can only be managed by the Founder account.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '18px', maxWidth: '1100px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text, marginBottom: '18px' }}>Staff &amp; Permissions</h2>

      {/* Stat cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Staff', sub: 'Active team members', value: overview?.total_staff ?? 0, icon: 'briefcase', color: COLORS.blue, bg: COLORS.blueBg },
          { label: 'Active Staff', sub: 'Currently active', value: overview?.active_staff ?? 0, icon: 'check', color: COLORS.green, bg: COLORS.greenBg },
          { label: 'Pending Invites', sub: 'Awaiting acceptance', value: overview?.pending_invites ?? 0, icon: 'mail', color: COLORS.orange, bg: COLORS.orangeBg },
          { label: 'Total Roles', sub: 'Defined roles', value: overview?.total_roles ?? 0, icon: 'check', color: COLORS.purple, bg: COLORS.purpleBg },
        ].map((c) => (
          <div key={c.label} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '15px', flex: '1 1 200px', minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={c.icon} size={16} color={c.color} />
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{c.label}</span>
            </div>
            <p style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text }}>{c.value}</p>
            <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '3px' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {error && <div style={{ background: COLORS.redBg, border: '1px solid #FECACA', borderRadius: '10px', padding: '10px', marginBottom: '14px' }}><p style={{ fontSize: '12px', color: COLORS.red }}>{error}</p></div>}

      {/* Active Staff */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.4px' }}>ACTIVE STAFF</p>
        <div onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 15px', borderRadius: '9px', background: COLORS.primary, cursor: 'pointer' }}>
          <Icon name="plus" size={14} color="#fff" />
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff' }}>Invite Staff</span>
        </div>
      </div>

      {staff.length === 0 ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: '24px' }}>No staff yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '12px', marginBottom: '26px' }}>
          {staff.map((s) => {
            const ac = avatarColor(s.user_id)
            const name = displayName(s)
            return (
              <div key={s.user_id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '12px', minWidth: 0 }}>
                    <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: ac.bg, color: ac.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800, flexShrink: 0 }}>
                      {initials(name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const }}>
                        <p style={{ fontSize: '14.5px', fontWeight: 800, color: COLORS.text }}>{name}</p>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 9px', borderRadius: '20px', background: s.suspended ? COLORS.orangeBg : COLORS.greenBg, color: s.suspended ? COLORS.orange : COLORS.green }}>
                          {s.suspended ? 'Suspended' : 'Active'}
                        </span>
                      </div>
                      {s.email && <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>{s.email}</p>}
                      {s.invited_at && (
                        <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Icon name="hourglass" size={11} color={COLORS.textMuted} /> Joined {new Date(s.invited_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '5px 11px', borderRadius: '20px', background: COLORS.blueBg, color: COLORS.blue, whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                    {roleName(s)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '13px', flexWrap: 'wrap' as const }}>
                  <div onClick={() => { setChangingRoleFor(s.user_id); setNewRoleId(s.role_id || roles[0]?.id || '') }}
                    style={{ flex: '1 1 110px', textAlign: 'center' as const, padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '12px', fontWeight: 700, color: COLORS.text, cursor: 'pointer' }}>
                    Change Role
                  </div>
                  <div onClick={() => openOverrides(s)}
                    style={{ flex: '1 1 150px', textAlign: 'center' as const, padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.primary}`, fontSize: '12px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>
                    Permissions (Overrides)
                  </div>
                  <div onClick={() => toggleSuspend(s)}
                    style={{ flex: '1 1 110px', textAlign: 'center' as const, padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.orange}`, fontSize: '12px', fontWeight: 700, color: COLORS.orange, cursor: 'pointer' }}>
                    {s.suspended ? 'Reactivate' : 'Suspend'}
                  </div>
                  <div onClick={() => openActivity(s)}
                    style={{ flex: '1 1 110px', textAlign: 'center' as const, padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '12px', fontWeight: 700, color: COLORS.text, cursor: 'pointer' }}>
                    Activity Log
                  </div>
                </div>
                <div onClick={() => revokeAccess(s.user_id)}
                  style={{ marginTop: '8px', textAlign: 'center' as const, padding: '9px', borderRadius: '9px', border: `1px solid ${COLORS.red}`, fontSize: '12px', fontWeight: 700, color: COLORS.red, cursor: 'pointer' }}>
                  Revoke Access
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Invites */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.4px' }}>INVITES</p>
        <select value={inviteFilter} onChange={(e) => setInviteFilter(e.target.value as any)}
          style={{ padding: '7px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12px', color: COLORS.text, background: COLORS.card }}>
          <option value="all">All Invites</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {filteredInvites.length === 0 ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: '24px' }}>No invites found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginBottom: '26px' }}>
          {filteredInvites.map((inv) => {
            const ac = avatarColor(inv.id)
            return (
              <div key={inv.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '11px', minWidth: 0 }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: ac.bg, color: ac.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, flexShrink: 0 }}>
                      {inv.email.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{inv.email}</p>
                      <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>{roleNameById(inv.role_id)}</p>
                      <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Icon name="mail" size={10} color={COLORS.textMuted} /> Invited on {new Date(inv.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '10.5px', fontWeight: 700,
                    color: inv.status === 'pending' ? COLORS.orange : inv.status === 'accepted' ? COLORS.green : COLORS.textMuted,
                    background: inv.status === 'pending' ? COLORS.orangeBg : inv.status === 'accepted' ? COLORS.greenBg : COLORS.bg,
                    padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap' as const,
                  }}>
                    {inv.status.toUpperCase()}
                  </span>
                </div>
                {inv.status === 'pending' && (
                  <div onClick={() => revokeInvite(inv.id)} style={{ marginTop: '10px', textAlign: 'center' as const, padding: '9px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '12px', fontWeight: 600, color: COLORS.text, cursor: 'pointer' }}>
                    Revoke Invite
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* About Permissions */}
      <div style={{ background: COLORS.blueBg, border: '1px solid #BFDBFE', borderRadius: '14px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
          <Icon name="check" size={16} color={COLORS.blue} />
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#1E3A8A', marginBottom: '4px' }}>About Permissions</p>
            <p style={{ fontSize: '12px', color: '#1E40AF', lineHeight: 1.6 }}>
              Staff members inherit permissions from their role. You can override specific permissions to allow or restrict access beyond their role.
            </p>
          </div>
        </div>
      </div>

      {/* Permissions (Overrides) modal */}
      {overridesFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }} onClick={() => setOverridesFor(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, borderRadius: '16px', padding: '20px', maxWidth: '520px', width: '100%', maxHeight: '85vh', overflowY: 'auto' as const }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>Permissions — {displayName(overridesFor)}</p>
              <span onClick={() => setOverridesFor(null)} style={{ cursor: 'pointer' }}><Icon name="x" size={16} color={COLORS.textMuted} /></span>
            </div>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
              Role: {roleName(overridesFor)}. Grant or revoke a specific permission beyond their role, or reset to the role default.
            </p>

            {overridesLoading ? (
              <p style={{ fontSize: '12px', color: COLORS.textMuted, padding: '10px 0' }}>Loading...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                {allPermissions.map((p) => {
                  const roleHasIt = rolePermissions.some((rp) => rp.role_id === overridesFor.role_id && rp.permission_id === p.id)
                  const ov = overrides.find((o) => o.permission_id === p.id)
                  const busy = overrideActionId === p.id
                  return (
                    <div key={p.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{p.id}</p>
                          {p.description && <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>{p.description}</p>}
                        </div>
                        <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                          <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 7px', borderRadius: '20px', background: roleHasIt ? COLORS.greenBg : COLORS.bg, color: roleHasIt ? COLORS.green : COLORS.textMuted }}>
                            {roleHasIt ? 'Role: Yes' : 'Role: No'}
                          </span>
                          {ov && (
                            <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 7px', borderRadius: '20px', background: ov.granted ? COLORS.blueBg : COLORS.redBg, color: ov.granted ? COLORS.blue : COLORS.red }}>
                              {ov.granted ? 'GRANTED' : 'REVOKED'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        <div onClick={() => !busy && setOverride(p.id, true)} style={{ flex: 1, textAlign: 'center' as const, padding: '6px', borderRadius: '7px', border: `1px solid ${COLORS.green}`, fontSize: '11px', fontWeight: 700, color: COLORS.green, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>Grant</div>
                        <div onClick={() => !busy && setOverride(p.id, false)} style={{ flex: 1, textAlign: 'center' as const, padding: '6px', borderRadius: '7px', border: `1px solid ${COLORS.red}`, fontSize: '11px', fontWeight: 700, color: COLORS.red, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>Revoke</div>
                        {ov && (
                          <div onClick={() => !busy && resetOverride(p.id)} style={{ flex: 1, textAlign: 'center' as const, padding: '6px', borderRadius: '7px', border: `1px solid ${COLORS.border}`, fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>Reset</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity Log modal */}
      {activityFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }} onClick={() => setActivityFor(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, borderRadius: '16px', padding: '20px', maxWidth: '460px', width: '100%', maxHeight: '80vh', overflowY: 'auto' as const }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>Activity Log — {displayName(activityFor)}</p>
              <span onClick={() => setActivityFor(null)} style={{ cursor: 'pointer' }}><Icon name="x" size={16} color={COLORS.textMuted} /></span>
            </div>
            {activityLoading ? (
              <p style={{ fontSize: '12px', color: COLORS.textMuted }}>Loading...</p>
            ) : activityError ? (
              <p style={{ fontSize: '12px', color: COLORS.red }}>{activityError}</p>
            ) : activity.length === 0 ? (
              <p style={{ fontSize: '12px', color: COLORS.textMuted }}>No recorded activity yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '9px' }}>
                {activity.map((a) => (
                  <div key={a.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '10px' }}>
                    <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{a.action}</p>
                    <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>
                      {a.module}{a.target_type ? ` · ${a.target_type}` : ''} · {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Staff modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }} onClick={() => !sending && setShowForm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, borderTopLeftRadius: '18px', borderTopRightRadius: '18px', padding: '20px', width: '100%', maxWidth: '480px' }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>Invite Staff</p>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px', color: COLORS.text }} />
            <label style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '6px', display: 'block' }}>Role</label>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', marginBottom: '10px' }}>
              {roles.map((r) => (
                <div key={r.id} onClick={() => setRoleId(r.id)}
                  style={{ padding: '10px', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${roleId === r.id ? COLORS.primary : COLORS.border}`, background: roleId === r.id ? COLORS.blueBg : 'transparent' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: roleId === r.id ? COLORS.primary : COLORS.text }}>{r.name}</p>
                  {r.description && <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>{r.description}</p>}
                </div>
              ))}
            </div>
            {error && <p style={{ color: COLORS.red, fontSize: '12px', marginBottom: '8px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div onClick={() => !sending && sendInvite()} style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', background: COLORS.primary, color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}>
                {sending ? '...' : 'Send Invite'}
              </div>
              <div onClick={() => !sending && setShowForm(false)} style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontSize: '13.5px', cursor: 'pointer' }}>
                Cancel
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Role modal */}
      {changingRoleFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }} onClick={() => !changing && setChangingRoleFor(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, borderTopLeftRadius: '18px', borderTopRightRadius: '18px', padding: '20px', width: '100%', maxWidth: '480px' }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>Change Role</p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', marginBottom: '10px' }}>
              {roles.map((r) => (
                <div key={r.id} onClick={() => setNewRoleId(r.id)}
                  style={{ padding: '10px', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${newRoleId === r.id ? COLORS.primary : COLORS.border}`, background: newRoleId === r.id ? COLORS.blueBg : 'transparent' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: newRoleId === r.id ? COLORS.primary : COLORS.text }}>{r.name}</p>
                  {r.description && <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>{r.description}</p>}
                </div>
              ))}
            </div>
            {error && <p style={{ color: COLORS.red, fontSize: '12px', marginBottom: '8px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div onClick={() => !changing && changeRole()} style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', background: COLORS.primary, color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}>
                {changing ? '...' : 'Save'}
              </div>
              <div onClick={() => !changing && setChangingRoleFor(null)} style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontSize: '13.5px', cursor: 'pointer' }}>
                Cancel
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
