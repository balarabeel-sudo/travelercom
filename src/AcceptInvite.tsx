import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  bg: '#F8FAFC', card: '#FFFFFF', text: '#1A1A1A', textMuted: '#64748B',
  border: '#E2E8F0', red: '#dc2626', redBg: '#FEF2F2', green: '#16a34a',
  purple: '#7c3aed', purpleBg: '#F5F3FF',
}

async function resolveEdgeError(data: any, error: any): Promise<string> {
  if (data && data.error) return data.error
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.clone().json()
      if (body?.error) return body.error
    } catch {}
  }
  return error?.message || 'Something went wrong'
}

type Status = 'checking' | 'accepting' | 'set_password' | 'success' | 'already_done' | 'error' | 'no_invite'

export default function AcceptInvite() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [error, setError] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setStatus('no_invite')
        return
      }
      setUserEmail(user.email || '')

      const inviteId = user.user_metadata?.company_invite_id
      const companyId = user.user_metadata?.company_id

      if (!inviteId || !companyId) {
        // Signed in normally, not via an invite link
        setStatus('no_invite')
        return
      }

      // Already a staff member of this company? then it's already accepted.
      const { data: existingStaff } = await supabase
        .from('company_staff')
        .select('id')
        .eq('company_id', companyId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingStaff) {
        const { data: co } = await supabase.from('companies').select('business_name').eq('id', companyId).maybeSingle()
        setCompanyName(co?.business_name || '')
        setStatus('already_done')
        // This invite was already accepted in the past, but the metadata
        // flag was never cleared — that's what keeps redirecting this
        // account back here on every login. Clear it now.
        await supabase.auth.updateUser({ data: { company_invite_id: null, company_id: null } })
        return
      }

      setStatus('accepting')
      const { data, error: err } = await supabase.functions.invoke('company-manage-staff', {
        body: { action: 'accept_invite', company_id: companyId, invitation_id: inviteId },
      })

      if (err || (data && data.error)) {
        setError(await resolveEdgeError(data, err))
        setStatus('error')
        return
      }

      const { data: co } = await supabase.from('companies').select('business_name').eq('id', companyId).maybeSingle()
      setCompanyName(co?.business_name || '')
      // Staff access is granted, but this account was created via a one-time
      // invite link with no password. Require them to set one before they
      // can use the account normally — this also gives them a fresh,
      // fully-established login session instead of the fragile invite session.
      setStatus('set_password')
    })()
  }, [])

  const submitPassword = async () => {
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSavingPassword(true)

    const { error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) {
      setSavingPassword(false)
      setError(updateErr.message)
      return
    }

    // Establish a fresh, standard session using the new credentials —
    // more reliable than the original invite-link session going forward.
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: userEmail, password })
    // Clear the invite flag now that setup is fully complete — otherwise
    // every future login for this account would redirect back here again.
    await supabase.auth.updateUser({ data: { company_invite_id: null, company_id: null } })
    setSavingPassword(false)
    if (signInErr) {
      // Password was saved even if this re-login hiccups — not fatal.
      setStatus('success')
      return
    }
    setStatus('success')
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: COLORS.card, borderRadius: 18, padding: 28, maxWidth: 380, width: '100%', textAlign: 'center', border: `1px solid ${COLORS.border}` }}>
        {(status === 'checking' || status === 'accepting') && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Icon name="clock" size={34} color={COLORS.purple} /></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>Setting up your access…</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 6 }}>This will only take a moment.</div>
          </>
        )}

        {status === 'set_password' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Icon name="lock" size={34} color={COLORS.purple} /></div>
            <div style={{ fontSize: 17, fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>Secure your account</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 18, textAlign: 'left' }}>
              You're joining {companyName ? <b>{companyName}</b> : 'this company'} as staff. Set a password so you can log in normally next time.
            </div>
            {error && <div style={{ background: COLORS.redBg, color: COLORS.red, padding: 10, borderRadius: 10, fontSize: 12.5, marginBottom: 12, textAlign: 'left' }}>{error}</div>}
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: COLORS.textMuted, display: 'block', marginBottom: 6 }}>New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                placeholder="At least 6 characters"
              />
              <label style={{ fontSize: 12, fontWeight: 700, color: COLORS.textMuted, display: 'block', margin: '12px 0 6px' }}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
                placeholder="Re-enter your password"
              />
            </div>
            <button onClick={submitPassword} disabled={savingPassword} style={{ ...btn, width: '100%', marginTop: 18 }}>
              {savingPassword ? 'Saving…' : 'Set Password & Continue'}
            </button>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Icon name="party" size={38} color={COLORS.green} /></div>
            <div style={{ fontSize: 17, fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>Welcome aboard!</div>
            <div style={{ fontSize: 13.5, color: COLORS.textMuted, marginBottom: 20 }}>
              You now have staff access {companyName ? <>to <b>{companyName}</b></> : 'to this company'} on TravelerCom.
            </div>
            <button onClick={() => navigate('/')} style={btn}>Go to Dashboard</button>
          </>
        )}

        {status === 'already_done' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Icon name="checkCircle" size={38} color={COLORS.green} /></div>
            <div style={{ fontSize: 17, fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>You're already set up</div>
            <div style={{ fontSize: 13.5, color: COLORS.textMuted, marginBottom: 20 }}>
              You already have staff access {companyName ? <>to <b>{companyName}</b></> : 'to this company'}.
            </div>
            <button onClick={() => navigate('/')} style={btn}>Go to Dashboard</button>
          </>
        )}

        {status === 'no_invite' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Icon name="info" size={34} color={COLORS.textMuted} /></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>Nothing to accept here</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 6, marginBottom: 20 }}>
              This page is for staff invitations. If you followed an invite link, try opening it again.
            </div>
            <button onClick={() => navigate('/')} style={btn}>Go Home</button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Icon name="alertCircle" size={34} color={COLORS.red} /></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginBottom: 6 }}>Couldn't complete this</div>
            <div style={{ background: COLORS.redBg, color: COLORS.red, padding: 10, borderRadius: 10, fontSize: 12.5, marginBottom: 16 }}>{error}</div>
            <button onClick={() => navigate('/')} style={btn}>Go Home</button>
          </>
        )}
      </div>
    </div>
  )
}

const btn: React.CSSProperties = {
  padding: '12px 24px', borderRadius: 12, border: 'none', background: COLORS.purple,
  color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: 14, background: '#fff',
}
