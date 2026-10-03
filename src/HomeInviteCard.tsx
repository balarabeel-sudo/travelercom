import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

// Invite card shown on the Home page for a signed-in user who has a pending admin/staff invite.
// Data comes from the SECURITY DEFINER function get_my_pending_invites(), which only returns
// invites addressed to the caller's own confirmed email. Accepting is re-checked on the server.

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

export default function HomeInviteCard() {
  const navigate = useNavigate()
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error: rpcErr } = await supabase.rpc('get_my_pending_invites')
    if (rpcErr) {
      console.error('get_my_pending_invites failed:', rpcErr.message)
      return
    }
    setInvites((data as PendingInvite[]) || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const invite = invites[0]
  if (!invite) return null

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
      } else {
        const { data, error: fnErr } = await supabase.functions.invoke('company-manage-staff', {
          body: { action: 'accept_invite', company_id: invite.company_id, invitation_id: invite.invite_id },
        })
        if (fnErr) throw new Error(fnErr.message)
        if (data?.error) throw new Error(data.error)
      }
      // After accepting, the new team member lands on their profile.
      navigate('/profile', { replace: true })
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
        margin: '16px',
        padding: '16px',
        borderRadius: '16px',
        background: '#FFFFFF',
        border: '1px solid #BAE6FD',
        boxShadow: '0 2px 10px rgba(14,165,233,0.12)',
      }}
    >
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: 0.6, color: '#0EA5E9', textTransform: 'uppercase' }}>
        {isAdmin ? 'Team invitation' : 'Company invitation'}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: '14px', fontWeight: 800, color: '#1A1A1A' }}>
        {isAdmin ? 'You have been invited to join the TravelerCom team' : `You have been invited to join ${invite.company_name || 'a company'}`}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#64748B', lineHeight: 1.5 }}>
        Invited by <strong style={{ color: '#1A1A1A', wordBreak: 'break-all' }}>{inviterLabel}</strong> as{' '}
        <strong style={{ color: '#1A1A1A' }}>{roleLabel}</strong>.
      </p>

      {invites.length > 1 && (
        <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: '#64748B' }}>
          {invites.length - 1} more pending invitation{invites.length - 1 > 1 ? 's' : ''} after this one.
        </p>
      )}

      {error && <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: '#dc2626' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
        <button
          onClick={handleDecline}
          disabled={busy}
          style={{
            flex: 1, padding: '10px 0', borderRadius: '10px', border: '1px solid #E2E8F0',
            background: '#fff', color: '#334155', fontSize: '13px', fontWeight: 600, opacity: busy ? 0.6 : 1,
          }}
        >
          Decline
        </button>
        <button
          onClick={handleAccept}
          disabled={busy}
          style={{
            flex: 1, padding: '10px 0', borderRadius: '10px', border: 'none',
            background: '#0EA5E9', color: '#fff', fontSize: '13px', fontWeight: 700, opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Please wait...' : 'Accept'}
        </button>
      </div>
    </div>
  )
}
