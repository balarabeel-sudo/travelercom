import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  primary: '#0EA5E9',
  purple: '#6B21A8',
  text: '#0F172A',
  textMuted: '#64748B',
  amber: '#D97706',
  green: '#16a34a',
  red: '#dc2626',
}

const SUPPORT_EMAIL = 'travelercom12@gmail.com'

const FAQS = [
  {
    q: 'How do I get my company approved on TravelerCom?',
    a: 'After signing up as a company, upload your CAC document from the "Upload CAC" prompt on your dashboard. Our team reviews it manually — you\'ll see your status change to "Approved" once verified.',
  },
  {
    q: 'How does the Escrow payment system work?',
    a: 'When a customer books, the payment is deducted from their wallet and held in escrow. Once you confirm the customer\'s check-in using their ticket code, the funds (minus commission) are released to your company wallet.',
  },
  {
    q: 'What are the commission rates?',
    a: '5% commission applies to Bus and Train bookings. Hotel, Flight, Tour, and Event Center bookings carry a 3% commission. Commission is automatically deducted when funds are released from escrow.',
  },
  {
    q: 'How do wallet withdrawals work?',
    a: 'From your Wallet page, submit a withdrawal request. Your request will show as "Pending" until processed by our team. You\'ll be able to track the status directly from your Wallet page.',
  },
  {
    q: 'What is Business Suite and what do I get with it?',
    a: 'Business Suite is our premium plan for companies. It unlocks Inventory management (room/seat tracking with real-time availability), Analytics, Promotions, Add Guest (offline bookings), and priority support.',
  },
  {
    q: 'How do I set up Inventory (Room/Seat Types)?',
    a: 'Go to Inventory from your Quick Actions, tap the + button to create a Room/Seat Type with a total quantity and price. The app automatically generates individual unit numbers you can track, reserve, or mark under maintenance.',
  },
  {
    q: 'How do I create a Promotion?',
    a: 'Go to Promotions, tap Create, choose a listing, set a discount (percentage or fixed amount), and an optional date range. Active promotions automatically show a discount badge to customers on that listing.',
  },
  {
    q: 'How do I record a walk-in (offline) guest booking?',
    a: 'Use Add Guest from your Quick Actions. Select the listing and room/seat type, enter the guest\'s details, choose a payment method (Cash, Transfer, or POS), and save — it will appear in your booking history alongside online bookings.',
  },
]

const CATEGORIES = ['Booking', 'Payment', 'Refund', 'Hotel', 'Bus', 'Flight', 'Visa', 'Account', 'Wallet', 'Other']

const COMPANY_CATEGORIES = ['Account & Company', 'Verification', 'Bookings', 'Payments & Settlement', 'Refunds', 'Listings', 'Inventory', 'Staff & Permissions', 'Technical Issue', 'Partnership', 'Compliance', 'Other']

type Ticket = {
  id: string
  subject: string
  message: string
  category: string | null
  priority: string
  status: string
  created_at: string
}

type Msg = {
  id: string
  sender_type: string
  message: string
  created_at: string
}

type TabKey = 'open' | 'waiting' | 'resolved' | 'all'

function CustomerSupport({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabKey>('open')
  const [search, setSearch] = useState('')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [bookingCode, setBookingCode] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [selected, setSelected] = useState<Ticket | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [reply, setReply] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  const loadTickets = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('support_tickets')
      .select('id, subject, message, category, priority, status, created_at')
      .eq('requester_type', 'customer')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setTickets(data || [])
    setLoading(false)
  }

  useEffect(() => { loadTickets() }, [])

  const openTicket = async (t: Ticket) => {
    setSelected(t)
    setMsgs([])
    const { data } = await supabase
      .from('support_messages')
      .select('id, sender_type, message, created_at')
      .eq('ticket_id', t.id)
      .order('created_at', { ascending: true })
    setMsgs(data || [])
  }

  const submitTicket = async () => {
    if (!subject.trim() || !message.trim()) return
    setSubmitting(true)

    let bookingId: string | null = null
    if (bookingCode.trim()) {
      const { data: b } = await supabase
        .from('bookings')
        .select('id')
        .eq('ticket_code', bookingCode.trim().toUpperCase())
        .eq('user_id', userId)
        .maybeSingle()
      bookingId = b?.id || null
    }

    const { error } = await supabase.from('support_tickets').insert({
      requester_type: 'customer',
      user_id: userId,
      subject: subject.trim(),
      message: message.trim(),
      category,
      booking_id: bookingId,
      status: 'open',
    })

    setSubmitting(false)
    if (error) {
      alert('Could not submit ticket: ' + error.message)
      return
    }
    setShowNew(false)
    setSubject(''); setCategory(CATEGORIES[0]); setBookingCode(''); setMessage('')
    loadTickets()
  }

  const sendReply = async () => {
    if (!selected || !reply.trim()) return
    setSendingReply(true)
    const { error } = await supabase.from('support_messages').insert({
      ticket_id: selected.id,
      sender_id: userId,
      sender_type: 'customer',
      message: reply.trim(),
    })
    setSendingReply(false)
    if (error) { alert('Could not send: ' + error.message); return }
    setMsgs((prev) => [...prev, { id: `local-${Date.now()}`, sender_type: 'customer', message: reply.trim(), created_at: new Date().toISOString() }])
    setReply('')
  }

  const filtered = tickets.filter((t) => {
    if (search && !t.subject.toLowerCase().includes(search.toLowerCase())) return false
    if (tab === 'all') return true
    return t.status === tab
  })

  if (selected) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column' as const }}>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div onClick={() => setSelected(null)} style={{ cursor: 'pointer' }}><Icon name="arrowLeft" size={20} color={COLORS.text} /></div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14.5px', fontWeight: 800, color: COLORS.text }}>{selected.subject}</p>
            <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{selected.category} · {selected.status}</p>
          </div>
        </div>

        <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column' as const, gap: '10px', overflowY: 'auto' as const }}>
          <div style={{ alignSelf: 'flex-start', maxWidth: '85%', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '12px 14px' }}>
            <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.5 }}>{selected.message}</p>
            <p style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '6px' }}>{new Date(selected.created_at).toLocaleString()}</p>
          </div>
          {msgs.map((m) => (
            <div key={m.id} style={{
              alignSelf: m.sender_type === 'customer' ? 'flex-end' : 'flex-start', maxWidth: '85%',
              background: m.sender_type === 'customer' ? COLORS.primary : COLORS.card,
              border: m.sender_type === 'customer' ? 'none' : `1px solid ${COLORS.border}`,
              borderRadius: '14px', padding: '12px 14px',
            }}>
              <p style={{ fontSize: '12.5px', color: m.sender_type === 'customer' ? '#fff' : COLORS.text, lineHeight: 1.5 }}>{m.message}</p>
              <p style={{ fontSize: '10px', color: m.sender_type === 'customer' ? '#DBEAFE' : COLORS.textMuted, marginTop: '6px' }}>{new Date(m.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>

        {selected.status !== 'resolved' && (
          <div style={{ padding: '12px 16px', background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, display: 'flex', gap: '8px' }}>
            <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a message..."
              style={{ flex: 1, padding: '11px 14px', borderRadius: '20px', border: `1px solid ${COLORS.border}`, fontSize: '13px' }} />
            <div onClick={() => !sendingReply && sendReply()} style={{
              width: '42px', height: '42px', borderRadius: '50%', background: COLORS.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <Icon name="mail" size={17} color="#fff" />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>
      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', background: COLORS.card, position: 'sticky' as const, top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="arrowLeft" size={22} color={COLORS.text} /></div>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text, flex: 1 }}>My Tickets</h1>
        <div onClick={() => setShowNew(true)} style={{
          background: COLORS.primary, color: '#fff', padding: '8px 14px', borderRadius: '20px',
          fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <Icon name="plus" size={13} color="#fff" /> New
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ position: 'relative' as const, marginBottom: '14px' }}>
          <div style={{ position: 'absolute' as const, left: '14px', top: '50%', transform: 'translateY(-50%)' }}>
            <Icon name="search" size={15} color={COLORS.textMuted} />
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets"
            style={{ width: '100%', padding: '11px 14px 11px 38px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, fontSize: '13px', background: COLORS.card }} />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' as const }}>
          {([['open', 'Open'], ['waiting', 'Waiting'], ['resolved', 'Resolved'], ['all', 'All']] as [TabKey, string][]).map(([key, label]) => (
            <div key={key} onClick={() => setTab(key)} style={{
              padding: '7px 13px', borderRadius: '10px', cursor: 'pointer',
              border: `1px solid ${tab === key ? COLORS.primary : COLORS.border}`,
              background: tab === key ? '#EFF6FF' : COLORS.card,
              fontSize: '12px', fontWeight: 700, color: tab === key ? COLORS.primary : COLORS.textMuted,
            }}>{label}</div>
          ))}
        </div>

        {loading ? (
          <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
              <Icon name="chat" size={22} color={COLORS.textMuted} />
            </div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '4px' }}>
              {search ? 'No matching tickets' : "You're all caught up"}
            </p>
            <p style={{ fontSize: '12px', color: COLORS.textMuted }}>
              {search ? 'Try a different search.' : 'If you need help, create a new support ticket.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
            {filtered.map((t) => (
              <div key={t.id} onClick={() => openTicket(t)} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{t.subject}</p>
                  <span style={{
                    fontSize: '10.5px', fontWeight: 700,
                    color: t.status === 'open' ? COLORS.amber : t.status === 'resolved' ? COLORS.green : COLORS.textMuted,
                    background: t.status === 'open' ? '#FFF7ED' : t.status === 'resolved' ? '#F0FDF4' : '#F1F5F9',
                    padding: '3px 8px', borderRadius: '6px',
                  }}>{t.status.toUpperCase()}</span>
                </div>
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '5px' }}>{t.category || 'General'}</p>
                <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '6px' }}>{new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }} onClick={() => !submitting && setShowNew(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, borderTopLeftRadius: '18px', borderTopRightRadius: '18px', padding: '20px', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto' as const }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '14px' }}>New Ticket</p>

            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
              style={{ width: '100%', padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px' }} />

            <select value={category} onChange={(e) => setCategory(e.target.value)}
              style={{ width: '100%', padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px', background: '#fff' }}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <input value={bookingCode} onChange={(e) => setBookingCode(e.target.value)} placeholder="Booking / Ticket Code (optional)"
              style={{ width: '100%', padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px' }} />

            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the issue..."
              style={{ width: '100%', padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', minHeight: '100px', marginBottom: '14px' }} />

            <div style={{ display: 'flex', gap: '8px' }}>
              <div onClick={() => !submitting && setShowNew(false)} style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Cancel</div>
              <div onClick={() => !submitting && submitTicket()} style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', background: COLORS.primary, color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CompanySupport({ userId, companyId }: { userId: string; companyId: string }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabKey>('open')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState(COMPANY_CATEGORIES[0])
  const [bookingCode, setBookingCode] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [selected, setSelected] = useState<Ticket | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [reply, setReply] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  const loadTickets = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('support_tickets')
      .select('id, subject, message, category, priority, status, created_at')
      .eq('requester_type', 'company')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
    setTickets(data || [])
    setLoading(false)
  }

  useEffect(() => { loadTickets() }, [])

  const openTicket = async (t: Ticket) => {
    setSelected(t)
    setMsgs([])
    const { data } = await supabase
      .from('support_messages')
      .select('id, sender_type, message, created_at')
      .eq('ticket_id', t.id)
      .order('created_at', { ascending: true })
    setMsgs(data || [])
  }

  const submitTicket = async () => {
    if (!subject.trim() || !message.trim()) return
    setSubmitting(true)

    let bookingId: string | null = null
    if (bookingCode.trim()) {
      const { data: b } = await supabase
        .from('bookings')
        .select('id')
        .eq('ticket_code', bookingCode.trim().toUpperCase())
        .eq('company_id', companyId)
        .maybeSingle()
      bookingId = b?.id || null
    }

    const { error } = await supabase.from('support_tickets').insert({
      requester_type: 'company',
      user_id: userId,
      company_id: companyId,
      subject: subject.trim(),
      message: message.trim(),
      category,
      booking_id: bookingId,
      status: 'open',
    })

    setSubmitting(false)
    if (error) {
      alert('Could not submit ticket: ' + error.message)
      return
    }
    setShowNew(false)
    setSubject(''); setCategory(COMPANY_CATEGORIES[0]); setBookingCode(''); setMessage('')
    loadTickets()
  }

  const sendReply = async () => {
    if (!selected || !reply.trim()) return
    setSendingReply(true)
    const { error } = await supabase.from('support_messages').insert({
      ticket_id: selected.id,
      sender_id: userId,
      sender_type: 'company',
      message: reply.trim(),
    })
    setSendingReply(false)
    if (error) { alert('Could not send: ' + error.message); return }
    setMsgs((prev) => [...prev, { id: `local-${Date.now()}`, sender_type: 'company', message: reply.trim(), created_at: new Date().toISOString() }])
    setReply('')
  }

  const counts = {
    open: tickets.filter((t) => t.status === 'open').length,
    waiting: tickets.filter((t) => t.status === 'waiting').length,
    waiting_company: tickets.filter((t) => t.status === 'waiting_company').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
  }

  const filtered = tab === 'all' ? tickets : tickets.filter((t) => t.status === tab)

  if (selected) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column' as const }}>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div onClick={() => setSelected(null)} style={{ cursor: 'pointer' }}><Icon name="arrowLeft" size={20} color={COLORS.text} /></div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14.5px', fontWeight: 800, color: COLORS.text }}>{selected.subject}</p>
            <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{selected.category} · {selected.status}</p>
          </div>
        </div>

        <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column' as const, gap: '10px', overflowY: 'auto' as const }}>
          <div style={{ alignSelf: 'flex-start', maxWidth: '85%', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '12px 14px' }}>
            <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.5 }}>{selected.message}</p>
            <p style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '6px' }}>{new Date(selected.created_at).toLocaleString()}</p>
          </div>
          {msgs.map((m) => (
            <div key={m.id} style={{
              alignSelf: m.sender_type === 'company' ? 'flex-end' : 'flex-start', maxWidth: '85%',
              background: m.sender_type === 'company' ? COLORS.primary : COLORS.card,
              border: m.sender_type === 'company' ? 'none' : `1px solid ${COLORS.border}`,
              borderRadius: '14px', padding: '12px 14px',
            }}>
              <p style={{ fontSize: '12.5px', color: m.sender_type === 'company' ? '#fff' : COLORS.text, lineHeight: 1.5 }}>{m.message}</p>
              <p style={{ fontSize: '10px', color: m.sender_type === 'company' ? '#DBEAFE' : COLORS.textMuted, marginTop: '6px' }}>{new Date(m.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>

        {selected.status !== 'resolved' && (
          <div style={{ padding: '12px 16px', background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, display: 'flex', gap: '8px' }}>
            <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a message..."
              style={{ flex: 1, padding: '11px 14px', borderRadius: '20px', border: `1px solid ${COLORS.border}`, fontSize: '13px' }} />
            <div onClick={() => !sendingReply && sendReply()} style={{
              width: '42px', height: '42px', borderRadius: '50%', background: COLORS.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <Icon name="mail" size={17} color="#fff" />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>
      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', background: COLORS.card, position: 'sticky' as const, top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="arrowLeft" size={22} color={COLORS.text} /></div>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text, flex: 1 }}>Support</h1>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          {[
            ['Open', counts.open, COLORS.amber, 'open'],
            ['Waiting for TravelerCom', counts.waiting, COLORS.textMuted, 'waiting'],
            ['Waiting for You', counts.waiting_company, COLORS.primary, 'waiting_company'],
            ['Resolved', counts.resolved, COLORS.green, 'resolved'],
          ].map(([label, count, color, key]) => (
            <div key={key as string} onClick={() => setTab(key as TabKey)} style={{
              background: COLORS.card, border: `1px solid ${tab === key ? color as string : COLORS.border}`,
              borderRadius: '14px', padding: '14px', cursor: 'pointer',
            }}>
              <p style={{ fontSize: '22px', fontWeight: 800, color: color as string }}>{count as number}</p>
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>{label as string}</p>
            </div>
          ))}
        </div>

        <div onClick={() => setShowNew(true)} style={{
          background: COLORS.primary, color: '#fff', textAlign: 'center' as const, padding: '13px', borderRadius: '12px',
          fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '18px',
        }}>
          <Icon name="plus" size={15} color="#fff" /> Create Support Ticket
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' as const }}>
          {[['open', 'Open'], ['waiting', 'Waiting'], ['resolved', 'Resolved'], ['all', 'All']].map(([key, label]) => (
            <div key={key} onClick={() => setTab(key as TabKey)} style={{
              padding: '7px 13px', borderRadius: '10px', cursor: 'pointer',
              border: `1px solid ${tab === key ? COLORS.primary : COLORS.border}`,
              background: tab === key ? '#EFF6FF' : COLORS.card,
              fontSize: '12px', fontWeight: 700, color: tab === key ? COLORS.primary : COLORS.textMuted,
            }}>{label}</div>
          ))}
        </div>

        {loading ? (
          <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
              <Icon name="chat" size={22} color={COLORS.textMuted} />
            </div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '4px' }}>No tickets here</p>
            <p style={{ fontSize: '12px', color: COLORS.textMuted }}>Create a ticket if you need help.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
            {filtered.map((t) => (
              <div key={t.id} onClick={() => openTicket(t)} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{t.subject}</p>
                  <span style={{
                    fontSize: '10.5px', fontWeight: 700,
                    color: t.status === 'open' ? COLORS.amber : t.status === 'resolved' ? COLORS.green : COLORS.textMuted,
                    background: t.status === 'open' ? '#FFF7ED' : t.status === 'resolved' ? '#F0FDF4' : '#F1F5F9',
                    padding: '3px 8px', borderRadius: '6px',
                  }}>{t.status.toUpperCase()}</span>
                </div>
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '5px' }}>{t.category || 'General'}</p>
                <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '6px' }}>{new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }} onClick={() => !submitting && setShowNew(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, borderTopLeftRadius: '18px', borderTopRightRadius: '18px', padding: '20px', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto' as const }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '14px' }}>Create Support Ticket</p>

            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
              style={{ width: '100%', padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px' }} />

            <select value={category} onChange={(e) => setCategory(e.target.value)}
              style={{ width: '100%', padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px', background: '#fff' }}>
              {COMPANY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <input value={bookingCode} onChange={(e) => setBookingCode(e.target.value)} placeholder="Booking ID (optional)"
              style={{ width: '100%', padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px' }} />

            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the issue..."
              style={{ width: '100%', padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', minHeight: '100px', marginBottom: '14px' }} />

            <div style={{ display: 'flex', gap: '8px' }}>
              <div onClick={() => !submitting && setShowNew(false)} style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Cancel</div>
              <div onClick={() => !submitting && submitTicket()} style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', background: COLORS.primary, color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Support() {
  const navigate = useNavigate()
  const [companyPlan, setCompanyPlan] = useState<'free' | 'business_suite'>('free')
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [checking, setChecking] = useState(true)
  const [isCompanyOwner, setIsCompanyOwner] = useState(false)
  const [companyAccessId, setCompanyAccessId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { setChecking(false); return }
      setUserId(userData.user.id)

      const { data: company } = await supabase
        .from('companies')
        .select('id, plan')
        .eq('owner_id', userData.user.id)
        .maybeSingle()

      if (company) {
        setCompanyPlan(company.plan || 'free')
        setIsCompanyOwner(true)
        setCompanyAccessId(company.id)
        setChecking(false)
        return
      }

      // Not an owner — check if they're staff with support.view
      const { data: staffRow } = await supabase
        .from('company_staff')
        .select('company_id')
        .eq('user_id', userData.user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (staffRow) {
        const { data: hasAccess } = await supabase
          .rpc('has_company_permission', {
            p_company_id: staffRow.company_id,
            p_user_id: userData.user.id,
            p_permission_key: 'support.view',
          })
        if (hasAccess) setCompanyAccessId(staffRow.company_id)
      }

      setChecking(false)
    }
    load()
  }, [])

  if (checking) return null

  if (companyAccessId && userId) {
    return <CompanySupport userId={userId} companyId={companyAccessId} />
  }

  if (!isCompanyOwner && userId) {
    return <CustomerSupport userId={userId} />
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Help & Support</h1>
      </div>

      <div style={{ padding: '16px' }}>

        <div style={{ background: `linear-gradient(135deg, ${COLORS.purple}, #4C1D95)`, borderRadius: '18px', padding: '20px', color: 'white', marginBottom: '18px' }}>
          {companyPlan === 'business_suite' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F59E0B', color: '#2E1065', fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '7px', marginBottom: '10px' }}>
              <Icon name="crown" size={11} color="#2E1065" /> PRIORITY SUPPORT
            </span>
          )}
          <p style={{ fontSize: '15px', fontWeight: 800, marginBottom: '6px' }}>
            {companyPlan === 'business_suite' ? "You're on our priority queue" : "We're here to help"}
          </p>
          <p style={{ fontSize: '12px', color: '#DDD6FE', marginBottom: '16px', lineHeight: 1.5 }}>
            {companyPlan === 'business_suite'
              ? 'As a Business Suite member, your emails are handled with priority by our team.'
              : 'Reach out anytime — our team typically responds within 24-48 hours.'}
          </p>
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ textDecoration: 'none' }}>
            <div style={{ background: 'white', color: COLORS.purple, textAlign: 'center', padding: '12px', borderRadius: '12px', fontWeight: 800, fontSize: '13.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Icon name="fileText" size={16} color={COLORS.purple} /> {SUPPORT_EMAIL}
            </div>
          </a>
        </div>

        <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>Frequently Asked Questions</p>

        <div style={{ background: COLORS.card, borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {FAQS.map((f, i) => (
            <div key={f.q} style={{ borderBottom: i < FAQS.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
              <div
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '15px 16px', cursor: 'pointer' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, flex: 1 }}>{f.q}</p>
                <Icon name={openIndex === i ? 'minus' : 'plus'} size={15} color={COLORS.purple} />
              </div>
              {openIndex === i && (
                <p style={{ fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.6, padding: '0 16px 16px' }}>{f.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
