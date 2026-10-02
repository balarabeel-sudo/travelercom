import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

// Shows a card to any signed-in user who has a pending admin/staff invite.
// Data comes from the SECURITY DEFINER function get_my_pending_invites(), which only
// ever returns invites addressed to the caller's own email. Accepting also re-checks
// the email on the server, so nothing here can be forged from the client.

type PendingInvite = {
  kind: 'admin' | 'company'
  invite_id: string
  company_id: string | null
  company_name: string | null
  role_name: string | null
  inviter_email: string | null
  inviter_name: string | null
  created_at: string
}

// Pages where the card must not appear (user is not signed in yet, or is already on the invite page).
const HIDDEN_ON = ['/', '/login', '/register', '/account-type', '/verify-otp', '/accept-invite']

export default function InviteGate() {
  const navigate = useNavigate()
  const location = useLocation()
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setInvites([])
      return
    }
    const { data, error: rpcErr } = await supabase.rpc('get_my_pending_invites')
    if (rpcErr) {
      console.error('get_my_pending_invites failed:', rpcErr.message)
      return
    }
    setInvites((data as PendingInvite[]) || [])
  }, [])

  // Re-check on mount, on every page change, and whenever the auth state changes.
  useEffect(() => {
    load()
  }, [load, location.pathname])

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        load()
      }
      if (event === 'SIGNED_OUT') setInvites([])
    })
    return () => listener.subscription.unsubscribe()
  }, [load])

  const invite = invites[0]
  if (!invite || HIDDEN_ON.includes(location.pathname)) return null

  const isAdmin = invite.kind === 'admin'
  const inviterLabel = invite.inviter_email || invite.inviter_name || 'an administrator'
  const roleLabel = invite.role_name || 'Staff'

  const handleAccept = async () => {
    setBusy(true)
    setError('')
    try {
      if (isAdmin) {
        const { data, error: accErr } = await supabase.rpc('accept_admin_invite', { p_invite_id: invite.invite_id })
        if (accErr || !data) throw new Error(accErr?.message || 'Could not accept this invitation')
        setInvites([])
        navigate('/admin', { replace: true })
      } else {
        const { data, error: fnErr } = await supabase.functions.invoke('company-manage-staff', {
          body: { action: 'accept_invite', company_id: invite.company_id, invitation_id: invite.invite_id },
        })
        if (fnErr) throw new Error(fnErr.message)
        if (data?.error) throw new Error(data.error)
        setInvites([])
        navigate('/staff-dashboard', { replace: true })
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleDecline = async () => {
    setBusy(true)
    setError('')
    try {
      const { error: decErr } = await supabase.rpc('decline_invite', { p_kind: invite.kind, p_invite_id: invite.invite_id })
      if (decErr) throw new Error(decErr.message)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: '#FFFFFF',
          borderRadius: 20,
          padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, color: '#2563eb', textTransform: 'uppercase' }}>
          {isAdmin ? 'Team invitation' : 'Company invitation'}
        </div>
        <h2 style={{ margin: '8px 0 6px', fontSize: 20, color: '#0f172a' }}>
          {isAdmin ? 'Join the TravelerCom team' : `Join ${invite.company_name || 'a company'}`}
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.5 }}>
          You have been invited by <strong style={{ color: '#0f172a', wordBreak: 'break-all' }}>{inviterLabel}</strong>.
        </p>

        <div
          style={{
            marginTop: 16,
            padding: '12px 14px',
            borderRadius: 12,
            background: '#F1F5F9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, color: '#64748b' }}>Role</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{roleLabel}</span>
        </div>

        {invites.length > 1 && (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#64748b' }}>
            {invites.length - 1} more pending invitation{invites.length - 1 > 1 ? 's' : ''} after this one.
          </p>
        )}

        {error && <p style={{ margin: '12px 0 0', fontSize: 13, color: '#dc2626' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={handleDecline}
            disabled={busy}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#334155',
              fontSize: 14,
              fontWeight: 600,
              opacity: busy ? 0.6 : 1,
            }}
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={busy}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Please wait...' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  )
}
