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
  orange: '#9A3412',
}

type Ticket = {
  id: string
  user_id: string | null
  subject: string
  message: string
  status: 'open' | 'resolved'
  admin_reply: string | null
  created_at: string
  resolved_at: string | null
}

type FilterKey = 'open' | 'resolved' | 'all'

export default function AdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [filter, setFilter] = useState<FilterKey>('open')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [reply, setReply] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTickets()
  }, [filter])

  async function fetchTickets() {
    setLoading(true)
    setError('')
    let query = supabase.from('support_tickets').select('*').order('created_at', { ascending: false })
    if (filter !== 'all') query = query.eq('status', filter)

    const { data, error } = await query
    if (error) setError(error.message)
    else setTickets(data || [])
    setLoading(false)
  }

  async function markResolved() {
    if (!selected) return
    setProcessing(true)
    setError('')

    const { data: userData } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('support_tickets')
      .update({
        status: 'resolved',
        admin_reply: reply || null,
        resolved_at: new Date().toISOString(),
        resolved_by: userData?.user?.id,
      })
      .eq('id', selected.id)

    setProcessing(false)

    if (error) {
      setError(error.message)
      return
    }
    setSelected(null)
    setReply('')
    fetchTickets()
  }

  const tabs: Array<{ key: FilterKey; label: string }> = [
    { key: 'open', label: 'Open' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'all', label: 'All' },
  ]

  return (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>
        SUPPORT TICKETS
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
          <p style={{ fontSize: '12px', color: '#dc2626' }}>{error}</p>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p>
      ) : tickets.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
            <Icon name="chat" size={22} color={COLORS.textMuted} />
          </div>
          <p style={{ fontSize: '13px', color: COLORS.textMuted }}>No {filter !== 'all' ? filter : ''} tickets.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
          {tickets.map((t) => (
            <div
              key={t.id}
              onClick={() => { setSelected(t); setReply(t.admin_reply || ''); setError('') }}
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{t.subject}</p>
                <span style={{
                  fontSize: '10.5px', fontWeight: 700,
                  color: t.status === 'open' ? COLORS.orange : COLORS.green,
                  background: t.status === 'open' ? '#FFF7ED' : '#F0FDF4',
                  padding: '3px 8px', borderRadius: '6px',
                }}>
                  {t.status.toUpperCase()}
                </span>
              </div>
              <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '6px', lineHeight: 1.4 }}>
                {t.message.length > 80 ? t.message.slice(0, 80) + '...' : t.message}
              </p>
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '6px' }}>
                {new Date(t.created_at).toLocaleString()}
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
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '10px' }}>{selected.subject}</p>
            <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.5 }}>{selected.message}</p>
            <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '8px' }}>
              {new Date(selected.created_at).toLocaleString()}
            </p>

            {selected.status === 'open' ? (
              <>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Reply / resolution note (optional)"
                  style={{ width: '100%', marginTop: '12px', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', minHeight: '64px', color: COLORS.text }}
                />
                <div
                  onClick={() => !processing && markResolved()}
                  style={{ marginTop: '14px', textAlign: 'center' as const, padding: '11px', borderRadius: '10px', background: COLORS.green, color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}
                >
                  {processing ? '...' : 'Mark Resolved'}
                </div>
              </>
            ) : (
              <p style={{ marginTop: '12px', fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.5 }}>
                Resolved {selected.resolved_at ? new Date(selected.resolved_at).toLocaleString() : '—'}
                {selected.admin_reply ? ` — Reply: ${selected.admin_reply}` : ''}
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
