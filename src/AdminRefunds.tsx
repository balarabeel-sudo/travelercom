import { useEffect, useState } from 'react'
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

type RefundRequest = {
  id: string
  booking_id: string
  requested_by: string
  requester_type: 'customer' | 'company'
  reason: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
  resolved_at: string | null
}

type FilterKey = 'pending' | 'approved' | 'rejected' | 'all'

function StatusBadge({ status }: { status: RefundRequest['status'] }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: '#FFF7ED', color: '#9A3412', label: 'PENDING' },
    approved: { bg: '#F0FDF4', color: COLORS.green, label: 'APPROVED' },
    rejected: { bg: '#FEF2F2', color: COLORS.red, label: 'REJECTED' },
  }
  const s = styles[status]
  return (
    <span style={{
      fontSize: '10.5px', fontWeight: 700, color: s.color, background: s.bg,
      padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.3px',
    }}>
      {s.label}
    </span>
  )
}

export default function AdminRefunds() {
  const [requests, setRequests] = useState<RefundRequest[]>([])
  const [filter, setFilter] = useState<FilterKey>('pending')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RefundRequest | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchRequests()
  }, [filter])

  async function fetchRequests() {
    setLoading(true)
    setError('')
    let query = supabase.from('refund_requests').select('*').order('created_at', { ascending: false })
    if (filter !== 'all') query = query.eq('status', filter)

    const { data, error } = await query
    if (error) setError(error.message)
    else setRequests(data || [])
    setLoading(false)
  }

  async function handleDecision(approve: boolean) {
    if (!selected) return
    setProcessing(true)
    setError('')

    const { error } = await supabase.rpc('process_refund_request', {
      p_request_id: selected.id,
      p_approve: approve,
      p_admin_note: adminNote || null,
    })

    setProcessing(false)

    if (error) {
      setError(error.message)
      return
    }
    setSelected(null)
    setAdminNote('')
    fetchRequests()
  }

  const tabs: Array<{ key: FilterKey; label: string }> = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ]

  return (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>
        REFUND REQUESTS
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' as const }}>
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

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px', marginBottom: '12px' }}>
          <p style={{ fontSize: '12px', color: COLORS.red }}>{error}</p>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p>
      ) : requests.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
            <Icon name="refresh" size={22} color={COLORS.textMuted} />
          </div>
          <p style={{ fontSize: '13px', color: COLORS.textMuted }}>No {filter !== 'all' ? filter : ''} refund requests.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
          {requests.map((r) => (
            <div
              key={r.id}
              onClick={() => { setSelected(r); setAdminNote(r.admin_note || ''); setError('') }}
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: '14.5px', fontWeight: 800, color: COLORS.text }}>
                    ₦{r.amount.toLocaleString()}
                  </p>
                  <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>
                    {r.requester_type === 'customer' ? 'Customer' : 'Company'} request
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <p style={{ fontSize: '12.5px', color: COLORS.text, marginTop: '8px', lineHeight: 1.5 }}>{r.reason}</p>
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '6px' }}>
                {new Date(r.created_at).toLocaleString()}
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
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '10px' }}>Refund Request</p>
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: '3px' }}>Booking ID: {selected.booking_id}</p>
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: '3px' }}>
              Requested by ({selected.requester_type}): {selected.requested_by}
            </p>
            <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text, marginTop: '8px' }}>
              ₦{selected.amount.toLocaleString()}
            </p>
            <p style={{ fontSize: '13px', color: COLORS.text, marginTop: '8px', lineHeight: 1.5 }}>{selected.reason}</p>

            {selected.status === 'pending' ? (
              <>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Admin note (optional)"
                  style={{ width: '100%', marginTop: '12px', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', minHeight: '64px', color: COLORS.text }}
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                  <div
                    onClick={() => !processing && handleDecision(true)}
                    style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', background: COLORS.green, color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}
                  >
                    {processing ? '...' : 'Approve'}
                  </div>
                  <div
                    onClick={() => !processing && handleDecision(false)}
                    style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', background: COLORS.red, color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}
                  >
                    {processing ? '...' : 'Reject'}
                  </div>
                </div>
              </>
            ) : (
              <p style={{ marginTop: '12px', fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.5 }}>
                Resolved {selected.resolved_at ? new Date(selected.resolved_at).toLocaleString() : '—'}
                {selected.admin_note ? ` — Note: ${selected.admin_note}` : ''}
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
