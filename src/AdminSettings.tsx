import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import useIsDesktop from './useIsDesktop'

const COLORS = {
  primary: '#0EA5E9',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  red: '#dc2626',
}

export default function AdminSettings() {
  const isDesktop = useIsDesktop()
  const [email, setEmail] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [roleName, setRoleName] = useState('')
  const [loading, setLoading] = useState(true)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    setEmail(userData?.user?.email || '')

    const { data: me } = await supabase.from('admins').select('is_super_admin, role_id').eq('user_id', userData?.user?.id).single()
    setIsSuperAdmin(!!me?.is_super_admin)

    if (me?.role_id) {
      const { data: role } = await supabase.from('roles').select('name').eq('id', me.role_id).single()
      setRoleName(role?.name || me.role_id)
    }
    setLoading(false)
  }

  async function changePassword() {
    setError('')
    setSaved(false)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Cika dukkan fannoni.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Sabon password bai dace ba.')
      return
    }
    if (newPassword.length < 6) {
      setError('Sabon password dole ya kai haruffa 6.')
      return
    }

    setSaving(true)

    // Re-authenticate with the current password before allowing the change
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
    if (reauthError) {
      setSaving(false)
      setError('Kalmar sirri ta yanzu ba daidai ba ce.')
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSaved(true)
  }

  const pagePadding = isDesktop ? '24px 28px' : '16px'

  if (loading) return <div style={{ padding: pagePadding }}><p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p></div>

  const inputStyle = { width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', color: COLORS.text, boxSizing: 'border-box' as const }

  return (
    <div style={{ padding: pagePadding, maxWidth: isDesktop ? '1000px' : undefined, margin: '0 auto' }}>
      {isDesktop && (
        <div style={{ marginBottom: '18px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text }}>Settings</h2>
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>Your admin account and password.</p>
        </div>
      )}

      <div style={isDesktop ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '20px', alignItems: 'start' } : undefined}>
        <div>
          <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>ACCOUNT</p>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px', marginBottom: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
              <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Email</span>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: COLORS.text, wordBreak: 'break-all' as const, textAlign: 'right' as const }}>{email}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Role</span>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: COLORS.text }}>{isSuperAdmin ? 'Founder' : roleName || '—'}</span>
            </div>
          </div>
        </div>

        <div>
          <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>CHANGE PASSWORD</p>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px' }}>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              style={{ ...inputStyle, marginBottom: '10px' }}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              style={{ ...inputStyle, marginBottom: '10px' }}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              style={{ ...inputStyle, marginBottom: '12px' }}
            />

            {error && <p style={{ fontSize: '12px', color: COLORS.red, marginBottom: '10px' }}>{error}</p>}
            {saved && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <Icon name="check" size={14} color={COLORS.green} />
                <p style={{ fontSize: '12px', color: COLORS.green }}>Password changed successfully.</p>
              </div>
            )}

            <div
              onClick={() => !saving && changePassword()}
              style={{ textAlign: 'center' as const, padding: '12px', borderRadius: '10px', background: COLORS.primary, color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
            >
              {saving ? 'Saving...' : 'Update Password'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
