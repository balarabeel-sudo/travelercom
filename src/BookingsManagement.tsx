import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  orange: '#c2410c',
}

type Booking = {
  id: string
  ticket_code: string
  customer_name: string | null
  customer_phone: string | null
  booking_status: string
  checked_in: boolean
  amount_paid: number
  created_at: string
  check_in_date: string | null
  check_out_date: string | null
  payment_method: string | null
  booking_source: string | null
  assigned_unit_number: string | null
  services: { title: string; category: string } | null
  inventory_items: { name: string } | null
}

type FilterTab = 'all' | 'pending' | 'completed' | 'cancelled'

function BookingsManagement() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterTab>('all')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [staffList, setStaffList] = useState<{ id: string; role_label: string | null; full_name: string }[]>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignTo, setAssignTo] = useState('')
  const [assignTitle, setAssignTitle] = useState('')
  const [assignPriority, setAssignPriority] = useState<'high' | 'medium' | 'normal' | 'low'>('normal')
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignDone, setAssignDone] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        navigate('/login')
        return
      }

      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', userData.user.id)
        .maybeSingle()

      let companyId: string | null = company?.id || null
      if (!companyId) {
        const { data: staffRow } = await supabase
          .from('company_staff')
          .select('company_id')
          .eq('user_id', userData.user.id)
          .eq('status', 'active')
          .maybeSingle()
        if (staffRow) companyId = staffRow.company_id
      }

      if (!companyId) {
        setLoading(false)
        return
      }

      setCompanyId(companyId)
      setCurrentUserId(userData.user.id)

      const { data: staffRows } = await supabase
        .from('company_staff')
        .select('id, role_label, user_id')
        .eq('company_id', companyId)
        .eq('status', 'active')

      if (staffRows && staffRows.length > 0) {
        const userIds = staffRows.map((s: any) => s.user_id)
        // Best-effort: try to resolve a display name for each staff member.
        // Falls back to their role label if no name source is available.
        setStaffList(staffRows.map((s: any) => ({
          id: s.id,
          role_label: s.role_label,
          full_name: s.role_label || 'Staff member',
        })))
      }

      const { data } = await supabase
        .from('bookings')
        .select('id, ticket_code, customer_name, customer_phone, booking_status, checked_in, amount_paid, created_at, check_in_date, check_out_date, payment_method, booking_source, assigned_unit_number, services(title, category), inventory_items(name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      setBookings((data as any) || [])
      setLoading(false)
    }
    load()
  }, [navigate])

  const getTab = (b: Booking): FilterTab => {
    if (b.booking_status === 'cancelled') return 'cancelled'
    if (b.checked_in) return 'completed'
    return 'pending'
  }

  const filtered = bookings.filter((b) => {
    const matchesFilter = filter === 'all' || getTab(b) === filter
    const q = search.trim().toLowerCase()
    const matchesSearch = !q ||
      (b.customer_name || '').toLowerCase().includes(q) ||
      b.ticket_code.toLowerCase().includes(q)
    return matchesFilter && matchesSearch
  })

  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => getTab(b) === 'pending').length,
    completed: bookings.filter((b) => getTab(b) === 'completed').length,
    cancelled: bookings.filter((b) => getTab(b) === 'cancelled').length,
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'pending', label: `Pending (${counts.pending})` },
    { key: 'completed', label: `Completed (${counts.completed})` },
    { key: 'cancelled', label: `Cancelled (${counts.cancelled})` },
  ]

  const statusBadge = (b: Booking) => {
    const tab = getTab(b)
    if (tab === 'completed') return { text: 'Completed', bg: '#f0fdf4', color: COLORS.green }
    if (tab === 'cancelled') return { text: 'Cancelled', bg: '#fef2f2', color: COLORS.red }
    return { text: 'Pending', bg: '#fff7ed', color: COLORS.orange }
  }

  const handleCancelBooking = async () => {
    if (!selectedBooking) return
    setCancelling(true)
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: selectedBooking.id })
    setCancelling(false)
    if (error) {
      alert('Failed to cancel: ' + error.message)
      return
    }
    setBookings((prev) => prev.map((b) => b.id === selectedBooking.id ? { ...b, booking_status: 'cancelled' } : b))
    if (currentUserId && companyId) {
      await supabase.from('audit_logs').insert({
        actor_id: currentUserId,
        action: 'cancelled_booking',
        module: 'bookings',
        target_type: 'booking',
        target_id: selectedBooking.id,
        company_id: companyId,
      })
    }
    setSelectedBooking(null)
  }

  const openAssignPanel = () => {
    setAssignTo(staffList[0]?.id || '')
    setAssignTitle(selectedBooking ? `Follow up: ${selectedBooking.customer_name || selectedBooking.ticket_code}` : '')
    setAssignPriority('normal')
    setAssignDone(false)
    setAssignOpen(true)
  }

  const handleAssignTask = async () => {
    if (!companyId || !currentUserId || !assignTo || !assignTitle.trim() || !selectedBooking) return
    setAssignSaving(true)
    const { error } = await supabase.from('staff_tasks').insert({
      company_id: companyId,
      assigned_to: assignTo,
      assigned_by: currentUserId,
      title: assignTitle.trim(),
      related_booking_id: selectedBooking.id,
      priority: assignPriority,
      status: 'open',
    })
    setAssignSaving(false)
    if (error) {
      alert('Failed to assign task: ' + error.message)
      return
    }
    await supabase.from('audit_logs').insert({
      actor_id: currentUserId,
      action: 'assigned_task',
      module: 'bookings',
      target_type: 'booking',
      target_id: selectedBooking.id,
      company_id: companyId,
    })
    setAssignDone(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: COLORS.card,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <span onClick={() => navigate('/home')} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Bookings Management</h1>
      </div>

      <div style={{ padding: '16px' }}>
        <input
          type="text"
          placeholder="Search by customer or ticket code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '11px',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '10px',
            fontSize: '13.5px',
            marginBottom: '12px',
            boxSizing: 'border-box',
            background: COLORS.card,
          }}
        />

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px' }}>
          {tabs.map((t) => (
            <div
              key={t.key}
              onClick={() => setFilter(t.key)}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                background: filter === t.key ? COLORS.primary : COLORS.card,
                color: filter === t.key ? 'white' : COLORS.textMuted,
                fontSize: '12.5px',
                fontWeight: 700,
                whiteSpace: 'nowrap' as const,
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
              }}>
              {t.label}
            </div>
          ))}
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: COLORS.textMuted, fontSize: '13px', padding: '30px 0' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={{
            background: COLORS.card,
            borderRadius: '16px',
            padding: '30px',
            textAlign: 'center',
            color: COLORS.textMuted,
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
          }}>
            <p style={{ fontSize: '13px' }}>No bookings found</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map((b) => {
              const badge = statusBadge(b)
              const tab = getTab(b)
              const roomType = b.inventory_items?.name || b.services?.title || '—'
              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedBooking(b)}
                  style={{
                    background: COLORS.card,
                    borderRadius: '14px',
                    padding: '14px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                    cursor: 'pointer'
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{b.customer_name || 'Unknown Customer'}</p>
                      <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>{roomType}</p>
                    </div>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: badge.color,
                      background: badge.bg,
                      padding: '4px 10px',
                      borderRadius: '8px'
                    }}>
                      {badge.text}
                    </span>
                  </div>

                  {tab === 'pending' ? (
                    <p style={{ fontSize: '11px', color: COLORS.textMuted }}>
                      Booked {new Date(b.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '11px', color: COLORS.textMuted, fontFamily: 'monospace' }}>{b.ticket_code}</p>
                        <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{new Date(b.created_at).toLocaleDateString()}</p>
                      </div>
                      <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.primary }}>₦{Number(b.amount_paid).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedBooking && (
        <div
          onClick={() => setSelectedBooking(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: COLORS.card, borderRadius: '20px 20px 0 0', padding: '20px',
              width: '100%', maxWidth: '480px', boxSizing: 'border-box'
            }}>
            <div style={{ width: '36px', height: '4px', background: COLORS.border, borderRadius: '2px', margin: '0 auto 16px' }} />

            <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginBottom: '2px' }}>{selectedBooking.customer_name || 'Unknown Customer'}</p>
            {selectedBooking.customer_phone && (
              <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: '14px' }}>{selectedBooking.customer_phone}</p>
            )}

            <DetailRow label="Ticket Code" value={selectedBooking.ticket_code} mono />
            <DetailRow label="Listing" value={selectedBooking.services?.title || '—'} />
            {selectedBooking.inventory_items?.name && (
              <DetailRow label="Room / Seat" value={`${selectedBooking.inventory_items.name}${selectedBooking.assigned_unit_number ? ` #${selectedBooking.assigned_unit_number}` : ''}`} />
            )}
            {(selectedBooking.check_in_date || selectedBooking.check_out_date) && (
              <DetailRow
                label="Dates"
                value={`${selectedBooking.check_in_date ? new Date(selectedBooking.check_in_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'} → ${selectedBooking.check_out_date ? new Date(selectedBooking.check_out_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}`}
              />
            )}
            <DetailRow label="Amount Paid" value={`₦${Number(selectedBooking.amount_paid).toLocaleString()}`} />
            <DetailRow label="Source" value={selectedBooking.booking_source === 'offline' ? 'Offline (Add Guest)' : 'Online'} />
            {selectedBooking.payment_method && (
              <DetailRow label="Payment Method" value={selectedBooking.payment_method.toUpperCase()} />
            )}
            <DetailRow label="Booked On" value={new Date(selectedBooking.created_at).toLocaleString()} />

            {getTab(selectedBooking) === 'pending' && (
              <div
                onClick={() => !cancelling && confirm('Cancel this booking and refund the customer?') && handleCancelBooking()}
                style={{
                  marginTop: '14px', background: cancelling ? '#94a3b8' : '#fef2f2', color: COLORS.red, textAlign: 'center',
                  padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: cancelling ? 'not-allowed' : 'pointer',
                  border: `1px solid ${COLORS.red}`
                }}>
                {cancelling ? 'Cancelling...' : 'Cancel Booking & Refund Customer'}
              </div>
            )}

            {staffList.length > 0 && !assignOpen && (
              <div
                onClick={openAssignPanel}
                style={{
                  marginTop: '10px', background: '#F5F3FF', color: '#7C3AED', textAlign: 'center',
                  padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                  border: '1px solid #DDD6FE'
                }}>
                Assign to Staff
              </div>
            )}

            {assignOpen && !assignDone && (
              <div style={{ marginTop: '10px', background: '#F8FAFC', borderRadius: '10px', padding: '12px', border: `1px solid ${COLORS.border}` }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '8px' }}>Assign to Staff</p>

                <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} style={{
                  width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`,
                  fontSize: '12.5px', marginBottom: '8px', background: '#fff',
                }}>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>

                <input value={assignTitle} onChange={(e) => setAssignTitle(e.target.value)} placeholder="Task title"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', marginBottom: '8px' }} />

                <select value={assignPriority} onChange={(e) => setAssignPriority(e.target.value as any)} style={{
                  width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`,
                  fontSize: '12.5px', marginBottom: '10px', background: '#fff',
                }}>
                  <option value="high">High priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="normal">Normal priority</option>
                  <option value="low">Low priority</option>
                </select>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <div onClick={() => setAssignOpen(false)} style={{
                    flex: 1, textAlign: 'center', padding: '10px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700,
                    color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, cursor: 'pointer',
                  }}>Cancel</div>
                  <div onClick={() => !assignSaving && handleAssignTask()} style={{
                    flex: 1, textAlign: 'center', padding: '10px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700,
                    color: '#fff', background: assignSaving ? '#94a3b8' : '#7C3AED', cursor: assignSaving ? 'not-allowed' : 'pointer',
                  }}>{assignSaving ? 'Assigning...' : 'Assign'}</div>
                </div>
              </div>
            )}

            {assignDone && (
              <div style={{ marginTop: '10px', background: '#DCFCE7', color: COLORS.green, textAlign: 'center', padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Icon name="checkCircle" size={15} color={COLORS.green} /> Task assigned
              </div>
            )}

            <div
              onClick={() => { setSelectedBooking(null); setAssignOpen(false); setAssignDone(false) }}
              style={{
                marginTop: '10px', background: COLORS.primary, color: 'white', textAlign: 'center',
                padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer'
              }}>
              Close
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
      <p style={{ fontSize: '12px', color: COLORS.textMuted }}>{label}</p>
      <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</p>
    </div>
  )
}

export default BookingsManagement
