import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16A34A',
}

function Profile() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { navigate('/login'); return }
      setEmail(userData.user.email || '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', userData.user.id)
        .maybeSingle()

      if (profile) {
        setFullName(profile.full_name || '')
        setPhone(profile.phone || '')
      }
      setLoading(false)
    }
    load()
  }, [navigate])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { navigate('/login'); return }

    const { error: err } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() })
      .eq('id', userData.user.id)

    setSaving(false)
    if (err) {
      setError('Could not save your changes. Please try again.')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted, fontSize: '14px' }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={20} color={COLORS.text} />
        </div>
        <h1 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Profile & Personal Information</h1>
      </div>

      <div style={{ margin: '16px', background: COLORS.card, borderRadius: '14px', padding: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted }}>Full Name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            style={{ width: '100%', marginTop: '6px', padding: '11px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13.5px', color: COLORS.text, boxSizing: 'border-box' as const }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted }}>Email</label>
          <input
            value={email}
            disabled
            style={{ width: '100%', marginTop: '6px', padding: '11px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13.5px', color: COLORS.textMuted, background: COLORS.bg, boxSizing: 'border-box' as const }}
          />
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '4px' }}>Your email is tied to your account and can't be changed here.</p>
        </div>

        <div style={{ marginBottom: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted }}>Phone Number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 08012345678"
            style={{ width: '100%', marginTop: '6px', padding: '11px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13.5px', color: COLORS.text, boxSizing: 'border-box' as const }}
          />
        </div>
      </div>

      {error && (
        <div style={{ margin: '0 16px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '10px 12px' }}>
          <p style={{ fontSize: '12px', color: '#b91c1c' }}>{error}</p>
        </div>
      )}

      <div style={{ margin: '0 16px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', padding: '15px', borderRadius: '12px', border: 'none',
            background: saved ? COLORS.green : COLORS.primary, color: 'white', fontSize: '14px', fontWeight: 800,
            cursor: saving ? 'default' : 'pointer',
          }}>
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

export default Profile
