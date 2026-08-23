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
  red: '#dc2626',
  amber: '#D97706',
  purple: '#6B21A8',
  bg: '#F8FAFC',
}

type Ticket = {
  id: string
  user_id: string | null
  company_id: string | null
  requester_type: 'customer' | 'company' | 'staff'
  subject: string
  message: string
  category: string | null
  priority: 'urgent' | 'high' | 'normal' | 'low'
  status: string
  assigned_staff_id: string | null
  created_at: string
  resolved_at: string | null
}

type Msg = {
  id: string
  sender_id: string
  sender_type: string
  message: string
  is_internal: boolean
  created_at: string
}

type Admin = { id: string; full_name: string | null; email: string | null }

type FilterKey = 'all' | 'customer' | 'company' | 'open' | 'waiting' | 'resolved'

function priorityMeta(p: string) {
  if (p === 'urgent') return { label: 'URGENT', color: COLORS.red, bg: '#FEF2F2' }
  if (p === 'high') return { label: 'HIGH', color: COLORS.amber, bg: '#FFF7ED' }
  if (p === 'low') return { label: 'LOW', color: COLORS.textMuted, bg: '#F1F5F9' }
  return { label: 'NORMAL', color: COLORS.primary, bg: '#EFF6FF' }
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function AdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [filter, setFilter] = useState<FilterKey>('open')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [admins, setAdmins] = useState<Admin[]>([])
  const [requesterNames, setRequesterNames] = useState<Record<string, string>>({})

  const [selected, setSelected] = useState<Ticket | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [reply, setReply] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentAdminId(data.user?.id || null))
    supabase.from('admins').select('id, full_name, email').then(({ data }) => setAdmins(data || []))
  }, [])

  useEffect(() => { fetchTickets() }, [filter])

  async function fetchTickets() {
    setLoading(true)
    setError('')
    let query = supabase.from('support_tickets').select('*').order('created_at', { ascending: false })

    if (filter === 'customer') query = query.eq('requester_type', 'customer')
    else if (filter === 'company') query = query.eq('requester_type', 'company')
    else if (filter === 'open') query = query.eq('status', 'open')
    else if (filter === 'waiting') query = query.eq('status', 'waiting')
    else if (filter === 'resolved') query = query.eq('status', 'resolved')

    const { data, error } = await query
    if (error) { setError(error.message); setLoading(false); return }
    setTickets((data as any) || [])

    const names: Record<string, string> = { ...requesterNames }
    const custIds = Array.from(new Set((data || []).filter((t: any) => t.requester_type === 'customer' && t.user_id).map((t: any) => t.user_id)))
    const compIds = Array.from(new Set((data || []).filter((t: any) => t.requester_type === 'company' && t.company_id).map((t: any) => t.company_id)))
    if (custIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', custIds)
      for (const p of profiles || []) names[`u-${p.id}`] = p.full_name || 'Customer'
    }
    if (compIds.length) {
      const { data: companies } = await supabase.from('companies').select('id, business_name').in('id', compIds)
      for (const c of companies || []) names[`c-${c.id}`] = c.business_name || 'Company'
    }
    setRequesterNames(names)
    setLoading(false)
  }

  const requesterLabel = (t: Ticket) => {
    if (t.requester_type === 'company' && t.company_id) return requesterNames[`c-${t.company_id}`] || 'Company'
    if (t.user_id) return requesterNames[`u-${t.user_id}`] || 'Customer'
    return 'Unknown'
  }

  const adminName = (id: string | null) => {
    if (!id) return null
    const a = admins.find((x) => x.id === id)
    return a?.full_name || a?.email || 'Staff'
  }

  const openTicket = async (t: Ticket) => {
    setSelected(t)
    setMsgs([])
    setReply('')
    setIsInternal(false)
    const { data } = await supabase
      .from('support_messages')
      .select('id, sender_id, sender_type, message, is_internal, created_at')
      .eq('ticket_id', t.id)
      .order('created_at', { ascending: true })
    setMsgs(data || [])
  }

  const sendMessage = async () => {
    if (!selected || !reply.trim() || !currentAdminId) return
    setSending(true)
    const { error } = await supabase.from('support_messages').insert({
      ticket_id: selected.id,
      sender_id: currentAdminId,
      sender_type: 'staff',
      message: reply.trim(),
      is_internal: isInternal,
    })
    if (!error && !isInternal && selected.status === 'open') {
      await supabase.from('support_tickets').update({ status: 'waiting' }).eq('id', selected.id)
      setSelected({ ...selected, status: 'waiting' })
    }
    setSending(false)
    if (error) { alert('Failed to send: ' + error.message); return }
    setMsgs((prev) => [...prev, { id: `local-${Date.now()}`, sender_id: currentAdminId, sender_type: 'staff', message: reply.trim(), is_internal: isInternal, created_at: new Date().toISOString() }])
    setReply('')
  }

  const updateTicket = async (fields: Partial<Ticket>) => {
    if (!selected) return
    const { error } = await supabase.from('support_tickets').update(fields as any).eq('id', selected.id)
    if (error) { alert('Update failed: ' + error.message); return }
    setSelected({ ...selected, ...fields })
    setTickets((prev) => prev.map((t) => t.id === selected.id ? { ...t, ...fields } : t))
  }

  const closeTicket = async () => {
    if (!selected || !currentAdminId) return
    await updateTicket({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: currentAdminId } as any)
  }

  const tabs: Array<{ key: FilterKey; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'customer', label: 'Customer' },
    { key: 'company', label: 'Company' },
    { key: 'open', label: 'Open' },
    { key: 'waiting', label: 'Waiting' },
    { key: 'resolved', label: 'Resolved' },
  ]

  if (selected) {
    const pm = priorityMeta(selected.priority)
    return (
      <div style={{ padding: '16px' }}>
        <div onClick={() => setSelected(null)} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', cursor: 'pointer' }}>
          <Icon name="arrowLeft" size={18} color={COLORS.text} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>Back to Support Center</span>
        </div>

        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '16px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, flex: 1 }}>{selected.subject}</p>
            <span style={{ fontSize: '10px', fontWeight: 800, color: pm.color, background: pm.bg, padding: '4px 9px', borderRadius: '6px' }}>{pm.label}</span>
          </div>
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '2px' }}>
            {selected.requester_type === 'company' ? 'Company' : 'Customer'}: {requesterLabel(selected)}
          </p>
          {selected.category && <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '2px' }}>Category: {selected.category}</p>}
          <p style={{ fontSize: '12px', color: COLORS.textMuted }}>Assigned: {adminName(selected.assigned_staff_id) || 'Unassigned'}</p>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' as const }}>
            <select value={selected.priority} onChange={(e) => updateTicket({ priority: e.target.value as any })}
              style={{ padding: '7px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12px' }}>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
            <select value={selected.status} onChange={(e) => updateTicket({ status: e.target.value })}
              style={{ padding: '7px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12px' }}>
              <option value="open">Open</option>
              <option value="waiting">Waiting</option>
              <option value="resolved">Resolved</option>
            </select>
            <select value={selected.assigned_staff_id || ''} onChange={(e) => updateTicket({ assigned_staff_id: e.target.value || null })}
              style={{ padding: '7px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12px' }}>
              <option value="">Unassigned</option>
              {admins.map((a) => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px', marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', color: COLORS.red }}>{error}</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginBottom: '14px' }}>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '12px 14px', maxWidth: '90%' }}>
            <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.5 }}>{selected.message}</p>
            <p style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '6px' }}>{new Date(selected.created_at).toLocaleString()}</p>
          </div>
          {msgs.map((m) => (
            <div key={m.id} style={{
              alignSelf: m.sender_type === 'staff' ? 'flex-end' : 'flex-start', maxWidth: '90%',
              background: m.is_internal ? '#FEF3C7' : m.sender_type === 'staff' ? COLORS.primary : COLORS.card,
              border: m.is_internal ? '1px solid #FDE68A' : m.sender_type === 'staff' ? 'none' : `1px solid ${COLORS.border}`,
              borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column' as const,
            }}>
              {m.is_internal && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                  <Icon name="lock" size={11} color="#92400E" />
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#92400E' }}>INTERNAL NOTE</span>
                </div>
              )}
              <p style={{ fontSize: '12.5px', color: m.is_internal ? '#78350F' : m.sender_type === 'staff' ? '#fff' : COLORS.text, lineHeight: 1.5 }}>{m.message}</p>
              <p style={{ fontSize: '10px', color: m.is_internal ? '#92400E' : m.sender_type === 'staff' ? '#DBEAFE' : COLORS.textMuted, marginTop: '6px' }}>{new Date(m.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>

        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '12px' }}>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder={isInternal ? 'Internal note (staff only)...' : 'Reply to requester...'}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '13px', minHeight: '64px', color: COLORS.text, marginBottom: '10px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div onClick={() => setIsInternal(!isInternal)} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <Icon name={isInternal ? 'checkCircle' : 'square'} size={16} color={isInternal ? COLORS.amber : COLORS.textMuted} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: isInternal ? COLORS.amber : COLORS.textMuted }}>Internal Note</span>
            </div>
            <div onClick={() => !sending && sendMessage()} style={{
              padding: '9px 18px', borderRadius: '8px', background: isInternal ? COLORS.amber : COLORS.primary,
              color: '#fff', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer',
            }}>
              {sending ? '...' : isInternal ? 'Add Note' : 'Send Reply'}
            </div>
          </div>
        </div>

        {selected.status !== 'resolved' && (
          <div onClick={closeTicket} style={{ marginTop: '12px', textAlign: 'center' as const, padding: '11px', borderRadius: '10px', background: COLORS.green, color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
            Close Ticket
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>
        SUPPORT CENTER
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' as const }}>
        {tabs.map((t) => (
          <div key={t.key} onClick={() => setFilter(t.key)} style={{
            padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
            border: `1px solid ${filter === t.key ? COLORS.primary : COLORS.border}`,
            background: filter === t.key ? '#EFF6FF' : COLORS.card,
            fontSize: '12.5px', fontWeight: 700,
            color: filter === t.key ? COLORS.primary : COLORS.textMuted,
          }}>{t.label}</div>
        ))}
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px', marginBottom: '12px' }}>
          <p style={{ fontSize: '12px', color: COLORS.red }}>{error}</p>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p>
      ) : tickets.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
            <Icon name="chat" size={22} color={COLORS.textMuted} />
          </div>
          <p style={{ fontSize: '13px', color: COLORS.textMuted }}>No tickets here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
          {tickets.map((t) => {
            const pm = priorityMeta(t.priority)
            return (
              <div key={t.id} onClick={() => openTicket(t)} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: pm.color, background: pm.bg, padding: '3px 8px', borderRadius: '6px' }}>{pm.label}</span>
                  <span style={{
                    fontSize: '10.5px', fontWeight: 700,
                    color: t.status === 'open' ? COLORS.orange : t.status === 'resolved' ? COLORS.green : COLORS.textMuted,
                    background: t.status === 'open' ? '#FFF7ED' : t.status === 'resolved' ? '#F0FDF4' : '#F1F5F9',
                    padding: '3px 8px', borderRadius: '6px',
                  }}>{t.status.toUpperCase()}</span>
                </div>
                <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginTop: '8px' }}>{t.subject}</p>
                <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '4px' }}>
                  {t.requester_type === 'company' ? 'Company' : 'Customer'}: {requesterLabel(t)}
                  {t.category ? ` · ${t.category}` : ''}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Assigned: {adminName(t.assigned_staff_id) || 'Unassigned'}</p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{timeAgo(t.created_at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
