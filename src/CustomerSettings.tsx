import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  red: '#dc2626',
}

// ── Reusable pieces ──────────────────────────────────────────

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '0 16px 22px 16px' }}>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '8px', paddingLeft: '4px', letterSpacing: '0.4px' }}>
        {title.toUpperCase()}
      </p>
      <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}` }}>
        {children}
      </div>
    </div>
  )
}

function SettingsRow({ icon, label, desc, onClick, isLast, danger, right }: {
  icon: string; label: string; desc?: string; onClick?: () => void; isLast?: boolean; danger?: boolean; right?: React.ReactNode
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '13px',
        padding: '13px 15px',
        cursor: onClick ? 'pointer' : 'default',
        borderBottom: isLast ? 'none' : `1px solid ${COLORS.border}`,
      }}>
      <div style={{
        width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
        background: danger ? '#FEF2F2' : '#F1F5F9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={16} color={danger ? COLORS.red : COLORS.text} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13.5px', fontWeight: 600, color: danger ? COLORS.red : COLORS.text }}>{label}</p>
        {desc && <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '1px' }}>{desc}</p>}
      </div>
      {right !== undefined ? right : (onClick && !danger && <Icon name="chevronRight" size={16} color={COLORS.textMuted} />)}
    </div>
  )
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <div
      onClick={disabled ? undefined : onChange}
      style={{
        width: '40px', height: '23px', borderRadius: '20px', flexShrink: 0,
        background: disabled ? '#E2E8F0' : on ? COLORS.primary : '#CBD5E1',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        transition: 'background 0.15s',
      }}>
      <div style={{
        width: '17px', height: '17px', borderRadius: '50%', background: 'white',
        position: 'absolute', top: '3px', left: on ? '20px' : '3px',
        transition: 'left 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  )
}

function ComingSoonBadge() {
  return (
    <span style={{ fontSize: '9.5px', fontWeight: 700, color: COLORS.textMuted, background: '#F1F5F9', padding: '3px 8px', borderRadius: '6px' }}>
      COMING SOON
    </span>
  )
}

// ── Notification preferences ─────────────────────────────────

type NotifPrefs = {
  booking_confirmation: boolean
  booking_changes: boolean
  cancellation_updates: boolean
  refund_updates: boolean
  departure_reminders: boolean
  checkin_reminders: boolean
  hotel_checkin_reminders: boolean
  travel_deals: boolean
  referral_notifications: boolean
  marketing_consent: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  booking_confirmation: true,
  booking_changes: true,
  cancellation_updates: true,
  refund_updates: true,
  departure_reminders: true,
  checkin_reminders: true,
  hotel_checkin_reminders: true,
  travel_deals: false,
  referral_notifications: false,
  marketing_consent: false,
}

function Settings() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const [prefsLoaded, setPrefsLoaded] = useState(false)

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteRequested, setDeleteRequested] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        navigate('/login')
        return
      }
      setUserId(data.user.id)
      setEmail(data.user.email || '')
      setPhone(data.user.user_metadata?.phone || data.user.phone || '')

      // Notification preferences — best-effort load; if the table/row doesn't
      // exist yet this just falls back to sensible defaults (nothing breaks).
      const { data: prefRow } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', data.user.id)
        .maybeSingle()
      if (prefRow) {
        setPrefs({ ...DEFAULT_PREFS, ...prefRow })
      }
      setPrefsLoaded(true)
    }
    load()
  }, [navigate])

  const togglePref = async (key: keyof NotifPrefs) => {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    if (!userId) return
    await supabase.from('notification_preferences').upsert({ user_id: userId, ...updated })
  }

  const handleChangePassword = async () => {
    setPwMessage(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwMessage({ type: 'error', text: 'Please fill in all password fields.' })
      return
    }
    if (newPassword.length < 8) {
      setPwMessage({ type: 'error', text: 'New password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'error', text: 'New passwords do not match.' })
      return
    }

    setPwSaving(true)

    // Re-authenticate with current password before allowing the change.
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
    if (reauthErr) {
      setPwSaving(false)
      setPwMessage({ type: 'error', text: 'Current password is incorrect.' })
      return
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
    setPwSaving(false)
    if (updateErr) {
      setPwMessage({ type: 'error', text: 'Could not update password: ' + updateErr.message })
      return
    }
    setPwMessage({ type: 'success', text: 'Password updated successfully.' })
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleDeleteRequest = async () => {
    setDeleting(true)
    // Records the request rather than deleting anything directly — an admin/
    // backend process handles the actual account removal.
    await supabase.from('account_deletion_requests').insert({ user_id: userId, status: 'pending' })
    setDeleting(false)
    setDeleteRequested(true)
    setShowDeleteModal(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: COLORS.card,
        borderBottom: `1px solid ${COLORS.border}`
      }}>
        <span onClick={() => navigate('/account')} style={{ display: 'flex', cursor: 'pointer' }}><Icon name="arrowLeft" size={20} color={COLORS.text} /></span>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Settings</h1>
      </div>

      <div style={{ paddingTop: '16px' }}>

        {/* ACCOUNT */}
        <SettingsSection title="Account">
          <SettingsRow icon="user" label="Profile & Personal Information" desc="Name, photo, email, phone" onClick={() => navigate('/profile')} />
          <SettingsRow
            icon="lock"
            label="Password & Security"
            desc="Change your password"
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            isLast
          />
        </SettingsSection>

        {showPasswordForm && (
          <div style={{ margin: '-12px 16px 22px 16px', background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}`, padding: '14px' }}>
            <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>Current password</p>
            <input type={showPw ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 11px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px', boxSizing: 'border-box' }} />
            <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>New password</p>
            <input type={showPw ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 11px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px', boxSizing: 'border-box' }} />
            <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>Confirm new password</p>
            <input type={showPw ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 11px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px', boxSizing: 'border-box' }} />

            <div onClick={() => setShowPw(!showPw)} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', cursor: 'pointer' }}>
              <Icon name={showPw ? 'eyeOff' : 'eye'} size={14} color={COLORS.textMuted} />
              <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>{showPw ? 'Hide' : 'Show'} passwords</span>
            </div>

            {pwMessage && (
              <p style={{ fontSize: '12px', color: pwMessage.type === 'success' ? COLORS.green : COLORS.red, marginBottom: '10px' }}>{pwMessage.text}</p>
            )}

            <button
              onClick={handleChangePassword}
              disabled={pwSaving}
              style={{ width: '100%', padding: '11px', background: pwSaving ? '#94a3b8' : COLORS.primary, color: 'white', border: 'none', borderRadius: '9px', fontWeight: 'bold', fontSize: '13px', cursor: pwSaving ? 'not-allowed' : 'pointer' }}>
              {pwSaving ? 'Updating...' : 'Update Password'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '13px', paddingTop: '14px', marginTop: '14px', borderTop: `1px solid ${COLORS.border}` }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="shield" size={16} color={COLORS.text} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.text }}>Sign out of all devices</p>
                <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '1px' }}>Log out everywhere except here</p>
              </div>
              <ComingSoonBadge />
            </div>
          </div>
        )}

        {/* NOTIFICATIONS */}
        <SettingsSection title="Booking Updates">
          <SettingsRow icon="checkCircle" label="Booking confirmation" onClick={() => {}} right={<Toggle on={prefs.booking_confirmation} onChange={() => togglePref('booking_confirmation')} disabled={!prefsLoaded} />} />
          <SettingsRow icon="edit" label="Booking changes" onClick={() => {}} right={<Toggle on={prefs.booking_changes} onChange={() => togglePref('booking_changes')} disabled={!prefsLoaded} />} />
          <SettingsRow icon="x" label="Cancellation updates" onClick={() => {}} right={<Toggle on={prefs.cancellation_updates} onChange={() => togglePref('cancellation_updates')} disabled={!prefsLoaded} />} />
          <SettingsRow icon="cash" label="Refund updates" onClick={() => {}} right={<Toggle on={prefs.refund_updates} onChange={() => togglePref('refund_updates')} disabled={!prefsLoaded} />} isLast />
        </SettingsSection>

        <SettingsSection title="Travel Reminders">
          <SettingsRow icon="clock" label="Departure reminders" onClick={() => {}} right={<Toggle on={prefs.departure_reminders} onChange={() => togglePref('departure_reminders')} disabled={!prefsLoaded} />} />
          <SettingsRow icon="ticket" label="Check-in reminders" onClick={() => {}} right={<Toggle on={prefs.checkin_reminders} onChange={() => togglePref('checkin_reminders')} disabled={!prefsLoaded} />} />
          <SettingsRow icon="hotel" label="Hotel check-in reminders" onClick={() => {}} right={<Toggle on={prefs.hotel_checkin_reminders} onChange={() => togglePref('hotel_checkin_reminders')} disabled={!prefsLoaded} />} isLast />
        </SettingsSection>

        <SettingsSection title="Promotions">
          <SettingsRow icon="tag" label="Travel deals & offers" onClick={() => {}} right={<Toggle on={prefs.travel_deals} onChange={() => togglePref('travel_deals')} disabled={!prefsLoaded} />} />
          <SettingsRow icon="userPlus" label="Referral notifications" onClick={() => {}} right={<Toggle on={prefs.referral_notifications} onChange={() => togglePref('referral_notifications')} disabled={!prefsLoaded} />} isLast />
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, padding: '0 15px 12px 15px', lineHeight: 1.5 }}>
            Marketing messages are only sent if you opt in below.
          </p>
        </SettingsSection>

        <SettingsSection title="Marketing">
          <SettingsRow icon="mail" label="Marketing emails & SMS" desc="Requires your consent" onClick={() => {}} right={<Toggle on={prefs.marketing_consent} onChange={() => togglePref('marketing_consent')} disabled={!prefsLoaded} />} isLast />
        </SettingsSection>

        {/* APP PREFERENCES */}
        <SettingsSection title="App Preferences">
          <SettingsRow icon="globe" label="Language" desc="English" right={<ComingSoonBadge />} />
          <SettingsRow icon="cash" label="Currency" desc="Nigerian Naira (₦)" right={<span />} />
          <SettingsRow icon="sun" label="Appearance" desc="System default" right={<ComingSoonBadge />} isLast />
        </SettingsSection>

        {/* PRIVACY */}
        <SettingsSection title="Privacy">
          <SettingsRow icon="mapPin" label="Location permission" right={<ComingSoonBadge />} />
          <SettingsRow icon="user" label="Personalization" right={<ComingSoonBadge />} />
          <SettingsRow icon="chat" label="Data sharing preferences" right={<ComingSoonBadge />} isLast />
        </SettingsSection>

        <SettingsSection title="Account Data">
          <SettingsRow icon="fileText" label="Download my data" right={<ComingSoonBadge />} />
          <SettingsRow icon="trash" label="Request account deletion" onClick={() => setShowDeleteModal(true)} isLast danger />
        </SettingsSection>

        {/* SECURITY */}
        <SettingsSection title="Security">
          <SettingsRow icon="lock" label="Two-factor authentication" right={<ComingSoonBadge />} />
          <SettingsRow icon="clock" label="Login activity" right={<ComingSoonBadge />} />
          <SettingsRow icon="shield" label="Trusted devices" right={<ComingSoonBadge />} />
          <SettingsRow icon="alertCircle" label="Security alerts" right={<ComingSoonBadge />} isLast />
        </SettingsSection>

        {/* SUPPORT */}
        <SettingsSection title="Support">
          <SettingsRow icon="chat" label="Help & Support" onClick={() => navigate('/support')} />
          <SettingsRow icon="mail" label="Contact Traveler.com" onClick={() => navigate('/support')} />
          <SettingsRow icon="alertCircle" label="Report a Problem" onClick={() => navigate('/support')} isLast />
        </SettingsSection>

        {/* LEGAL */}
        <SettingsSection title="Legal">
          <SettingsRow icon="fileText" label="Terms & Conditions" onClick={() => navigate('/customer-terms')} />
          <SettingsRow icon="lock" label="Privacy Policy" onClick={() => navigate('/customer-privacy')} />
          <SettingsRow icon="info" label="About Traveler.com" onClick={() => navigate('/about')} isLast />
        </SettingsSection>

        {/* DANGER ZONE */}
        {deleteRequested && (
          <div style={{ margin: '0 16px 22px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '14px', padding: '14px' }}>
            <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.red, marginBottom: '4px' }}>Deletion request received</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, lineHeight: 1.5 }}>Our team will review and process your request. This may take a few business days.</p>
          </div>
        )}
      </div>

      {showDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'flex-end', justifyContent: 'center', zIndex: 100
        }}>
          <div style={{ background: COLORS.card, borderRadius: '20px 20px 0 0', padding: '22px 20px', width: '100%', maxWidth: '480px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              <Icon name="alertCircle" size={22} color={COLORS.red} />
            </div>
            <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginBottom: '8px' }}>Delete your account?</p>
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.6, marginBottom: '10px' }}>
              This will submit a request to permanently delete your Traveler.com account. Once processed:
            </p>
            <ul style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.8, marginBottom: '14px', paddingLeft: '18px' }}>
              <li>Your profile and saved data will be removed</li>
              <li>Your booking history may no longer be accessible</li>
              <li>This action cannot be undone</li>
            </ul>
            <button
              onClick={handleDeleteRequest}
              disabled={deleting}
              style={{ width: '100%', padding: '13px', background: deleting ? '#94a3b8' : COLORS.red, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', cursor: deleting ? 'not-allowed' : 'pointer', marginBottom: '10px' }}>
              {deleting ? 'Submitting...' : 'Yes, delete my account'}
            </button>
            <button
              onClick={() => setShowDeleteModal(false)}
              style={{ width: '100%', padding: '13px', background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings
