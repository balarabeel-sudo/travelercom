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

type Approval = {
  id: string
  request_type: 'refund' | 'withdrawal'
  request_id: string
  submitted_by: string
  status: 'pending' | 'approved' | 'rejected'
  founder_note: string | null
  created_at: string
  resolved_at: string | null
}

type FilterKey = 'pending' | 'approved' | 'rejected' | 'all'

export default function AdminApprovals() {
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null)
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [filter, setFilter] = useState<FilterKey>('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Approval | null>(null)
  const [note, setNote] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => { load() }, [filter])

  async function load() {
    setLoading(true)
    setError('')

    const { data: userData } = await supabase.auth.getUser()
    const { data: me } = await supabase.from('admins').select('is_super_admin').eq('user_id', userData?.user?.id).single()
    setIsSuperAdmin(!!me?.is_super_admin)

    let query = supabase.from('pending_approvals').select('*').order('created_at', { ascending: false })
    if (filter !== 'all') query = query.eq('status', filter)

    const { data, error } = await query
    if (error) setError(error.message)
    else setApprovals(data || [])
    setLoading(false)
  }

  async function decide(approve: boolean) {
    if (!selected) return

    if (!approve && !note.trim()) {
      setError('Da fatan za a rubuta dalilin ki (reject).')
      return
    }

    setProcessing(true)
    setError('')

    const { error } = await supabase.rpc('resolve_pending_approval', {
      p_approval_id: selected.id,
      p_approve: approve,
      p_note: note || null,
    })

    setProcessing(false)
    if (error) { setError(error.message); return }
    setSelected(null)
    setNote('')
    load()
  }

  const tabs: Array<{ key: FilterKey; label: string }> = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ]

  if (loading) return <div style={{ padding: '16px' }}><p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p></div>

  if (isSuperAdmin === false) {
    return (
      <div style={{ padding: '16px' }}>
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '14px', padding: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.red, marginBottom: '4px' }}>Founder only</p>
          <p style={{ fontSize: '12px', color: COLORS.red }}>Final approvals can only be given by the Founder account.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>
        FINANCE APPROVAL QUEUE
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' as const }}>
        {tabs.map((t) => (
          <div
            key={t.key}
            onClick={() => setFilter(t.key)}
            style={{
              padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
              border: `1px solid ${filter === t.key ? COLORS.primary : COLORS.border}`,
              background: filter === t.key ? '#EFF6FF' : COLORS.card,
              fontSize: '12.5px', fontWeight: 700,
              color: filter === t.key ? COLORS.primary : COLORS.textMuted,
            }}
          >
            {t.label}
          </div>
        ))}
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px', marginBottom: '12px' }}><p style={{ fontSize: '12px', color: COLORS.red }}>{error}</p></div>}

      {approvals.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
            <Icon name="hourglass" size={22} color={COLORS.textMuted} />
          </div>
          <p style={{ fontSize: '13px', color: COLORS.textMuted }}>No {filter !== 'all' ? filter : ''} approvals.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
          {approvals.map((a) => (
            <div
              key={a.id}
              onClick={() => { setSelected(a); setNote(a.founder_note || ''); setError('') }}
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, textTransform: 'capitalize' as const }}>
                  {a.request_type} request
                </p>
                <span style={{
                  fontSize: '10.5px', fontWeight: 700,
                  color: a.status === 'pending' ? COLORS.orange : a.status === 'approved' ? COLORS.green : COLORS.red,
                  background: a.status === 'pending' ? '#FFF7ED' : a.status === 'approved' ? '#F0FDF4' : '#FEF2F2',
                  padding: '3px 8px', borderRadius: '6px',
                }}>
                  {a.status.toUpperCase()}
                </span>
              </div>
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '6px' }}>
                Request ID: {a.request_id.slice(0, 8)}... · Submitted by: {a.submitted_by.slice(0, 8)}...
              </p>
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px' }}>
                {new Date(a.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }}
          onClick={() => !processing && setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: COLORS.card, borderTopLeftRadius: '18px', borderTopRightRadius: '18px', padding: '20px', width: '100%', maxWidth: '480px' }}
          >
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '10px', textTransform: 'capitalize' as const }}>
              {selected.request_type} Request
            </p>
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: '4px' }}>Request ID: {selected.request_id}</p>
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: '4px' }}>Submitted by: {selected.submitted_by}</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '8px' }}>
              Open {selected.request_type === 'refund' ? 'Refunds' : 'Withdrawals'} in another tab to see the full request details (amount, reason, bank info) before deciding.
            </p>

            {selected.status === 'pending' ? (
              <>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason (required for Reject, optional for Approve)"
                  style={{ width: '100%', marginTop: '12px', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', minHeight: '60px', color: COLORS.text }}
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                  <div
                    onClick={() => !processing && decide(true)}
                    style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', background: COLORS.green, color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}
                  >
                    {processing ? '...' : 'Approve'}
                  </div>
                  <div
                    onClick={() => !processing && decide(false)}
                    style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', background: COLORS.red, color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}
                  >
                    {processing ? '...' : 'Reject'}
                  </div>
                </div>
              </>
            ) : (
              <p style={{ marginTop: '12px', fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.5 }}>
                Resolved {selected.resolved_at ? new Date(selected.resolved_at).toLocaleString() : '—'}
                {selected.founder_note ? ` — Note: ${selected.founder_note}` : ''}
              </p>
            )}

            <div
              onClick={() => setSelected(null)}
              style={{ marginTop: '14px', textAlign: 'center' as const, padding: '10px', border: `1px solid ${COLORS.border}`, borderRadius: '10px', color: COLORS.textMuted, fontSize: '13px', cursor: 'pointer' }}
            >
              Close
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
