import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  red: '#dc2626',
  orange: '#9A3412',
}

type Role = { id: string; name: string; description: string | null }
type StaffMember = { user_id: string; role_id: string | null; invited_at: string | null; suspended: boolean }
type Invite = { id: string; email: string; role_id: string; status: 'pending' | 'accepted' | 'revoked'; created_at: string }
type Permission = { id: string; module: string; action: string; description: string | null }
type Override = { permission_id: string; granted: boolean; note: string | null }

export default function AdminStaff() {
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [sending, setSending] = useState(false)
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null)
  const [newRoleId, setNewRoleId] = useState('')
  const [changing, setChanging] = useState(false)
  const [overridesFor, setOverridesFor] = useState<string | null>(null)
  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
  const [rolePermissionIds, setRolePermissionIds] = useState<Set<string>>(new Set())
  const [overrides, setOverrides] = useState<Record<string, Override>>({})
  const [loadingOverrides, setLoadingOverrides] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')

    const { data: userData } = await supabase.auth.getUser()
    const { data: me } = await supabase.from('admins').select('is_super_admin').eq('user_id', userData?.user?.id).single()
    setIsSuperAdmin(!!me?.is_super_admin)

    const [{ data: rolesData, error: rolesErr }, { data: staffData, error: staffErr }, { data: invitesData, error: invitesErr }] = await Promise.all([
      supabase.from('roles').select('id, name, description').neq('id', 'founder').order('name'),
      supabase.from('admins').select('user_id, role_id, invited_at, suspended').eq('is_super_admin', false),
      supabase.from('staff_invites').select('id, email, role_id, status, created_at').order('created_at', { ascending: false }),
    ])

    if (rolesErr || staffErr || invitesErr) setError((rolesErr || staffErr || invitesErr)?.message || 'Error loading data')
    setRoles(rolesData || [])
    setStaff(staffData || [])
    setInvites(invitesData || [])
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
    if (!confirm('Revoke this staff member\'s admin access?')) return
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

  function roleName(id: string | null) {
    return roles.find((r) => r.id === id)?.name || id || 'Unknown role'
  }

  async function openOverrides(s: StaffMember) {
    setOverridesFor(s.user_id)
    setLoadingOverrides(true)
    setError('')

    const [{ data: permsData, error: permsErr }, { data: rpData, error: rpErr }, { data: ovData, error: ovErr }] = await Promise.all([
      supabase.from('permissions').select('id, module, action, description').order('module').order('action'),
      supabase.from('role_permissions').select('permission_id').eq('role_id', s.role_id || ''),
      supabase.from('admin_permission_overrides').select('permission_id, granted, note').eq('user_id', s.user_id),
    ])

    if (permsErr || rpErr || ovErr) {
      setError((permsErr || rpErr || ovErr)?.message || 'Error loading permissions')
      setLoadingOverrides(false)
      return
    }

    setAllPermissions(permsData || [])
    setRolePermissionIds(new Set((rpData || []).map((r) => r.permission_id)))
    const ovMap: Record<string, Override> = {}
    ;(ovData || []).forEach((o) => { ovMap[o.permission_id] = o })
    setOverrides(ovMap)
    setLoadingOverrides(false)
  }

  async function setOverride(permissionId: string, granted: boolean) {
    if (!overridesFor) return
    const { error } = await supabase.rpc('set_permission_override', { p_user_id: overridesFor, p_permission_id: permissionId, p_granted: granted, p_note: null })
    if (error) { setError(error.message); return }
    setOverrides({ ...overrides, [permissionId]: { permission_id: permissionId, granted, note: null } })
  }

  async function clearOverride(permissionId: string) {
    if (!overridesFor) return
    const { error } = await supabase.rpc('clear_permission_override', { p_user_id: overridesFor, p_permission_id: permissionId })
    if (error) { setError(error.message); return }
    const next = { ...overrides }
    delete next[permissionId]
    setOverrides(next)
  }

  if (loading) return <div style={{ padding: '16px' }}><p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p></div>

  if (isSuperAdmin === false) {
    return (
      <div style={{ padding: '16px' }}>
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '14px', padding: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.red, marginBottom: '4px' }}>Founder only</p>
          <p style={{ fontSize: '12px', color: COLORS.red }}>Staff & Permissions can only be managed by the Founder account.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.4px' }}>ACTIVE STAFF</p>
        <div onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', background: COLORS.primary, cursor: 'pointer' }}>
          <Icon name="plus" size={13} color="#fff" />
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff' }}>Invite Staff</span>
        </div>
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px', marginBottom: '12px' }}><p style={{ fontSize: '12px', color: COLORS.red }}>{error}</p></div>}

      {staff.length === 0 ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: '22px' }}>No staff yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginBottom: '22px' }}>
          {staff.map((s) => (
            <div key={s.user_id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{roleName(s.role_id)}</p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>
                    {s.invited_at ? `Since ${new Date(s.invited_at).toLocaleDateString()}` : ''}
                  </p>
                </div>
                {s.suspended && (
                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: COLORS.orange, background: '#FFF7ED', padding: '3px 8px', borderRadius: '6px' }}>
                    SUSPENDED
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' as const }}>
                <div
                  onClick={() => { setChangingRoleFor(s.user_id); setNewRoleId(s.role_id || roles[0]?.id || '') }}
                  style={{ flex: 1, minWidth: '90px', textAlign: 'center' as const, padding: '7px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12px', fontWeight: 600, color: COLORS.text, cursor: 'pointer' }}
                >
                  Change Role
                </div>
                <div
                  onClick={() => openOverrides(s)}
                  style={{ flex: 1, minWidth: '90px', textAlign: 'center' as const, padding: '7px 10px', borderRadius: '8px', border: `1px solid ${COLORS.primary}`, fontSize: '12px', fontWeight: 600, color: COLORS.primary, cursor: 'pointer' }}
                >
                  Overrides
                </div>
                <div
                  onClick={() => toggleSuspend(s)}
                  style={{ flex: 1, minWidth: '90px', textAlign: 'center' as const, padding: '7px 10px', borderRadius: '8px', border: `1px solid ${COLORS.orange}`, fontSize: '12px', fontWeight: 600, color: COLORS.orange, cursor: 'pointer' }}
                >
                  {s.suspended ? 'Reactivate' : 'Suspend'}
                </div>
                <div
                  onClick={() => revokeAccess(s.user_id)}
                  style={{ flex: 1, minWidth: '90px', textAlign: 'center' as const, padding: '7px 10px', borderRadius: '8px', border: `1px solid ${COLORS.red}`, fontSize: '12px', fontWeight: 600, color: COLORS.red, cursor: 'pointer' }}
                >
                  Revoke
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>INVITES</p>
      {invites.length === 0 ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>No invites sent yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
          {invites.map((inv) => (
            <div key={inv.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{inv.email}</p>
                  <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>{roleName(inv.role_id)}</p>
                </div>
                <span style={{
                  fontSize: '10.5px', fontWeight: 700,
                  color: inv.status === 'pending' ? COLORS.orange : inv.status === 'accepted' ? COLORS.green : COLORS.textMuted,
                  background: inv.status === 'pending' ? '#FFF7ED' : inv.status === 'accepted' ? '#F0FDF4' : '#F1F5F9',
                  padding: '3px 8px', borderRadius: '6px',
                }}>
                  {inv.status.toUpperCase()}
                </span>
              </div>
              {inv.status === 'pending' && (
                <div onClick={() => revokeInvite(inv.id)} style={{ marginTop: '10px', textAlign: 'center' as const, padding: '8px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12px', fontWeight: 600, color: COLORS.text, cursor: 'pointer' }}>
                  Revoke Invite
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }} onClick={() => !sending && setShowForm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, borderTopLeftRadius: '18px', borderTopRightRadius: '18px', padding: '20px', width: '100%', maxWidth: '480px' }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>Invite Staff</p>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px', color: COLORS.text }} />
            <label style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '6px', display: 'block' }}>Role</label>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', marginBottom: '10px' }}>
              {roles.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setRoleId(r.id)}
                  style={{
                    padding: '10px', borderRadius: '10px', cursor: 'pointer',
                    border: `1px solid ${roleId === r.id ? COLORS.primary : COLORS.border}`,
                    background: roleId === r.id ? '#EFF6FF' : 'transparent',
                  }}
                >
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

      {changingRoleFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }} onClick={() => !changing && setChangingRoleFor(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, borderTopLeftRadius: '18px', borderTopRightRadius: '18px', padding: '20px', width: '100%', maxWidth: '480px' }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>Change Role</p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', marginBottom: '10px' }}>
              {roles.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setNewRoleId(r.id)}
                  style={{
                    padding: '10px', borderRadius: '10px', cursor: 'pointer',
                    border: `1px solid ${newRoleId === r.id ? COLORS.primary : COLORS.border}`,
                    background: newRoleId === r.id ? '#EFF6FF' : 'transparent',
                  }}
                >
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

      {overridesFor && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }}
          onClick={() => setOverridesFor(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: COLORS.card, borderTopLeftRadius: '18px', borderTopRightRadius: '18px', padding: '20px', width: '100%', maxWidth: '520px', maxHeight: '80vh', overflowY: 'auto' as const }}
          >
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>Permission Overrides</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px', lineHeight: 1.5 }}>
              Grant or revoke a SPECIFIC permission for this one staff member, beyond what their role normally allows. Doesn't affect anyone else with the same role.
            </p>

            {error && <p style={{ color: COLORS.red, fontSize: '12px', marginBottom: '10px' }}>{error}</p>}

            {loadingOverrides ? (
              <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                {allPermissions.map((p) => {
                  const fromRole = rolePermissionIds.has(p.id)
                  const override = overrides[p.id]
                  const effective = override ? override.granted : fromRole

                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: '8px', background: effective ? '#F0FDF4' : '#F9FAFB', border: `1px solid ${COLORS.border}` }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '12.5px', fontWeight: 600, color: COLORS.text }}>{p.id}</p>
                        <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>
                          {fromRole ? 'From role' : 'Not in role'}
                          {override ? ` · Override: ${override.granted ? 'GRANTED' : 'REVOKED'}` : ''}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <div
                          onClick={() => setOverride(p.id, true)}
                          style={{ padding: '5px 9px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer', border: `1px solid ${COLORS.green}`, color: override?.granted === true ? '#fff' : COLORS.green, background: override?.granted === true ? COLORS.green : 'transparent' }}
                        >
                          Grant
                        </div>
                        <div
                          onClick={() => setOverride(p.id, false)}
                          style={{ padding: '5px 9px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer', border: `1px solid ${COLORS.red}`, color: override?.granted === false ? '#fff' : COLORS.red, background: override?.granted === false ? COLORS.red : 'transparent' }}
                        >
                          Revoke
                        </div>
                        {override && (
                          <div
                            onClick={() => clearOverride(p.id)}
                            style={{ padding: '5px 9px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer', border: `1px solid ${COLORS.border}`, color: COLORS.textMuted }}
                          >
                            Reset
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div
              onClick={() => setOverridesFor(null)}
              style={{ marginTop: '16px', textAlign: 'center' as const, padding: '10px', border: `1px solid ${COLORS.border}`, borderRadius: '10px', color: COLORS.textMuted, fontSize: '13px', cursor: 'pointer' }}
            >
              Done
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
