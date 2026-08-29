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
  red: '#DC2626',
}

export default function Settings() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyPlan, setCompanyPlan] = useState<'free' | 'business_suite'>('free')

  const [openingTime, setOpeningTime] = useState('')
  const [closingTime, setClosingTime] = useState('')
  const [allowUnitSelection, setAllowUnitSelection] = useState(true)
  const [savingHours, setSavingHours] = useState(false)
  const [hoursSaved, setHoursSaved] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { navigate('/login'); return }

      const { data: company } = await supabase
        .from('companies')
        .select('id, plan, opening_time, closing_time, allow_unit_selection')
        .eq('owner_id', userData.user.id)
        .maybeSingle()

      if (company) {
        setCompanyId(company.id)
        setCompanyPlan(company.plan || 'free')
        setOpeningTime(company.opening_time || '')
        setClosingTime(company.closing_time || '')
        setAllowUnitSelection(company.allow_unit_selection ?? true)
      }
      setLoading(false)
    }
    load()
  }, [navigate])

  const saveHours = async () => {
    if (!companyId) return
    setSavingHours(true)
    await supabase.from('companies').update({
      opening_time: openingTime || null,
      closing_time: closingTime || null,
    }).eq('id', companyId)
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      await supabase.rpc('log_audit', {
        p_action: 'updated_settings',
        p_module: 'settings',
        p_target_type: 'company',
        p_target_id: companyId,
        p_previous: null,
        p_new: { opening_time: openingTime || null, closing_time: closingTime || null },
        p_company_id: companyId,
      })
    }
    setSavingHours(false)
    setHoursSaved(true)
    setTimeout(() => setHoursSaved(false), 2000)
  }

  const toggleUnitSelection = async () => {
    if (!companyId) return
    const newVal = !allowUnitSelection
    setAllowUnitSelection(newVal)
    await supabase.from('companies').update({ allow_unit_selection: newVal }).eq('id', companyId)
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      await supabase.rpc('log_audit', {
        p_action: 'updated_settings',
        p_module: 'settings',
        p_target_type: 'company',
        p_target_id: companyId,
        p_previous: { allow_unit_selection: !newVal },
        p_new: { allow_unit_selection: newVal },
        p_company_id: companyId,
      })
    }
  }

  const handleChangePassword = async () => {
    setPasswordMessage(null)
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) {
      setPasswordMessage({ type: 'error', text: error.message })
    } else {
      setPasswordMessage({ type: 'success', text: 'Password updated successfully.' })
      setNewPassword('')
      setConfirmPassword('')
    }
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
        padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Settings</h1>
      </div>

      <div style={{ padding: '16px' }}>

        <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.textMuted, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Account</p>
        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '18px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text, marginBottom: '4px' }}>Change Password</p>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>Choose a new password for your account.</p>

          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            type="password"
            placeholder="New password"
            style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }}
          />
          <input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type="password"
            placeholder="Confirm new password"
            style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box' }}
          />

          {passwordMessage && (
            <p style={{ fontSize: '12px', color: passwordMessage.type === 'success' ? COLORS.green : COLORS.red, marginBottom: '10px' }}>
              {passwordMessage.text}
            </p>
          )}

          <div
            onClick={savingPassword ? undefined : handleChangePassword}
            style={{ background: COLORS.purple, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: savingPassword ? 0.6 : 1 }}>
            {savingPassword ? 'Updating...' : 'Update Password'}
          </div>
        </div>

        <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.textMuted, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Business</p>
        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '18px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text, marginBottom: '4px' }}>Business Hours</p>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>Let customers know when you're open.</p>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '6px' }}>Opens</p>
              <input value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} type="time" style={{ width: '100%', padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '6px' }}>Closes</p>
              <input value={closingTime} onChange={(e) => setClosingTime(e.target.value)} type="time" style={{ width: '100%', padding: '9px 10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div onClick={savingHours ? undefined : saveHours} style={{ background: COLORS.purple, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: savingHours ? 0.6 : 1 }}>
            {savingHours ? 'Saving...' : hoursSaved ? '✓ Saved' : 'Save Business Hours'}
          </div>
        </div>

        {companyPlan === 'business_suite' && (
          <>
            <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.purple, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Icon name="crown" size={13} color={COLORS.purple} /> Business Suite
            </p>
            <div style={{ background: COLORS.card, borderRadius: '16px', padding: '18px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, marginRight: '12px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>Let Customers Choose Room/Seat Number</p>
                  <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '3px' }}>
                    When enabled, customers can pick a specific number (e.g. Room 102) instead of getting one assigned automatically.
                  </p>
                </div>
                <div
                  onClick={toggleUnitSelection}
                  style={{
                    width: '46px', height: '26px', borderRadius: '13px', flexShrink: 0, cursor: 'pointer',
                    background: allowUnitSelection ? COLORS.purple : '#E2E8F0', position: 'relative', transition: 'background 0.2s'
                  }}>
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%', background: 'white', position: 'absolute',
                    top: '3px', left: allowUnitSelection ? '23px' : '3px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
