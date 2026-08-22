import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

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

type Status = 'checking' | 'accepting' | 'success' | 'already_done' | 'error' | 'no_invite'

export default function AcceptInvite() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [error, setError] = useState('')
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setStatus('no_invite')
        return
      }

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
      setStatus('success')
    })()
  }, [])

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: COLORS.card, borderRadius: 18, padding: 28, maxWidth: 380, width: '100%', textAlign: 'center', border: `1px solid ${COLORS.border}` }}>
        {(status === 'checking' || status === 'accepting') && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>Setting up your access…</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 6 }}>This will only take a moment.</div>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>Welcome aboard!</div>
            <div style={{ fontSize: 13.5, color: COLORS.textMuted, marginBottom: 20 }}>
              You now have staff access {companyName ? <>to <b>{companyName}</b></> : 'to this company'} on TravelerCom.
            </div>
            <button onClick={() => navigate('/')} style={btn}>Go to Dashboard</button>
          </>
        )}

        {status === 'already_done' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>You're already set up</div>
            <div style={{ fontSize: 13.5, color: COLORS.textMuted, marginBottom: 20 }}>
              You already have staff access {companyName ? <>to <b>{companyName}</b></> : 'to this company'}.
            </div>
            <button onClick={() => navigate('/')} style={btn}>Go to Dashboard</button>
          </>
        )}

        {status === 'no_invite' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>👋</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>Nothing to accept here</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 6, marginBottom: 20 }}>
              This page is for staff invitations. If you followed an invite link, try opening it again.
            </div>
            <button onClick={() => navigate('/')} style={btn}>Go Home</button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
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
