import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import useIsDesktop from './useIsDesktop'

const COLORS = {
  primary: '#0EA5E9',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  red: '#dc2626',
  orange: '#F97316',
}

type Booking = {
  id: string
  ticket_code: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  amount_paid: number
  commission_amount: number | null
  booking_status: string | null
  assigned_unit_number: string | null
  check_in_date: string | null
  check_out_date: string | null
  created_at: string
  services: { title: string; category: string } | null
  companies: { business_name: string } | null
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  confirmed: { bg: '#F0FDF4', color: COLORS.green },
  completed: { bg: '#EFF6FF', color: COLORS.primary },
  pending: { bg: '#FFF7ED', color: COLORS.orange },
  cancelled: { bg: '#FEF2F2', color: COLORS.red },
  refunded: { bg: '#FEF2F2', color: COLORS.red },
}

const CATEGORY_ICON: Record<string, string> = {
  hotel: 'hotel',
  bus: 'bus',
  train: 'train',
  flight: 'plane',
  tour: 'map',
  event_center: 'tent',
  vehicle_rental: 'car',
}

const PAGE_SIZE = 30

function formatNaira(n: number | null | undefined) {
  return '₦' + Number(n || 0).toLocaleString()
}

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLE[status] || STATUS_STYLE.pending
  return (
    <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', background: style.bg, color: style.color, whiteSpace: 'nowrap' as const }}>
      {status.toUpperCase()}
    </span>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '14px 16px' }}>
      <p style={{ fontSize: '10.5px', color: COLORS.textMuted, fontWeight: 700, letterSpacing: '0.4px' }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text, marginTop: '4px' }}>{value}</p>
    </div>
  )
}

export default function AdminBookings() {
  const isDesktop = useIsDesktop()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'completed' | 'pending' | 'cancelled'>('all')
  const [selected, setSelected] = useState<Booking | null>(null)

  const fetchBookings = async () => {
    setLoading(true)
    setNotFound(false)
    let query = supabase
      .from('bookings')
      .select('id, ticket_code, customer_name, customer_phone, customer_email, amount_paid, commission_amount, booking_status, assigned_unit_number, check_in_date, check_out_date, created_at, services(title, category), companies(business_name)')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (search.trim()) {
      query = query.or(`ticket_code.ilike.%${search.trim()}%,customer_name.ilike.%${search.trim()}%`)
    }
    if (statusFilter !== 'all') query = query.eq('booking_status', statusFilter)

    const { data, error } = await query
    setLoading(false)
    if (error) {
      setNotFound(true)
      return
    }
    setBookings((data as any[]) || [])
  }

  useEffect(() => {
    fetchBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  if (notFound) {
    return (
      <div style={{ padding: '30px 20px', textAlign: 'center' as const }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.red, marginBottom: '6px' }}>Couldn't load bookings</p>
        <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.6 }}>
          Make sure <code>admin_companies_setup.sql</code> has been run — it adds the admin read policy for bookings.
        </p>
      </div>
    )
  }

  const totalValue = bookings.reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0)
  const totalCommission = bookings.reduce((sum, b) => sum + (Number(b.commission_amount) || 0), 0)

  const searchBox = (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '9px', background: COLORS.card,
        border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '10px 13px',
        marginBottom: isDesktop ? 0 : '12px',
        flex: isDesktop ? 1 : undefined, maxWidth: isDesktop ? '440px' : undefined,
      }}>
      <Icon name="search" size={15} color={COLORS.textMuted} />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && fetchBookings()}
        placeholder="Search ticket code or customer..."
        style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', background: 'transparent' }}
      />
      {search && <span onClick={fetchBookings} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Search</span>}
    </div>
  )

  const filterChips = (
    <div style={{ display: 'flex', gap: '7px', marginBottom: isDesktop ? 0 : '14px', overflowX: 'auto' as const }}>
      {(['all', 'confirmed', 'completed', 'pending', 'cancelled'] as const).map((f) => (
        <span
          key={f}
          onClick={() => setStatusFilter(f)}
          style={{
            flexShrink: 0, padding: '7px 13px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
            background: statusFilter === f ? COLORS.primary : COLORS.card,
            color: statusFilter === f ? 'white' : COLORS.text,
            border: `1px solid ${statusFilter === f ? COLORS.primary : COLORS.border}`,
          }}>
          {f.charAt(0).toUpperCase() + f.slice(1)}
        </span>
      ))}
    </div>
  )

  const cellBase = { padding: '13px 14px', fontSize: '12.5px', color: COLORS.text, borderBottom: `1px solid ${COLORS.border}`, verticalAlign: 'middle' as const }
  const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const

  const headers: Array<{ label: string; align: 'left' | 'right' }> = [
    { label: 'TICKET', align: 'left' },
    { label: 'LISTING', align: 'left' },
    { label: 'COMPANY', align: 'left' },
    { label: 'CUSTOMER', align: 'left' },
    { label: 'BOOKED ON', align: 'left' },
    { label: 'AMOUNT', align: 'right' },
    { label: 'COMMISSION', align: 'right' },
    { label: 'STATUS', align: 'left' },
  ]

  return (
    <div style={{ padding: isDesktop ? '24px 28px' : '16px', maxWidth: isDesktop ? '1400px' : undefined, margin: '0 auto' }}>
      {isDesktop && (
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text }}>Bookings</h2>
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>All bookings across the platform.</p>
        </div>
      )}

      {isDesktop ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' as const }}>
          {searchBox}
          {filterChips}
        </div>
      ) : (
        <>
          {searchBox}
          {filterChips}
        </>
      )}

      {isDesktop && !loading && bookings.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
          <SummaryCard label="Bookings shown" value={bookings.length.toLocaleString()} />
          <SummaryCard label="Total value (shown)" value={formatNaira(totalValue)} />
          <SummaryCard label="Commission (shown)" value={formatNaira(totalCommission)} />
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>Loading bookings...</p>
      ) : bookings.length === 0 ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>No bookings found.</p>
      ) : isDesktop ? (
        <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' as const }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, minWidth: '820px' }}>
              <thead>
                <tr style={{ background: COLORS.bg }}>
                  {headers.map((h) => (
                    <th
                      key={h.label}
                      style={{ textAlign: h.align, padding: '11px 14px', fontSize: '10.5px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.4px', borderBottom: `1px solid ${COLORS.border}`, whiteSpace: 'nowrap' as const }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const status = b.booking_status || 'pending'
                  return (
                    <tr
                      key={b.id}
                      onClick={() => setSelected(b)}
                      onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.bg }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      style={{ cursor: 'pointer' }}>
                      <td style={{ ...cellBase, fontWeight: 700, whiteSpace: 'nowrap' as const }}>{b.ticket_code || '—'}</td>
                      <td style={{ ...cellBase, maxWidth: '220px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon name={CATEGORY_ICON[b.services?.category || ''] || 'ticket'} size={14} color={COLORS.text} />
                          </div>
                          <span style={{ ...ellipsis, fontWeight: 600 }}>{b.services?.title || 'Deleted listing'}</span>
                        </div>
                      </td>
                      <td style={{ ...cellBase, maxWidth: '180px', color: COLORS.textMuted }}>
                        <div style={ellipsis}>{b.companies?.business_name || 'Unknown company'}</div>
                      </td>
                      <td style={{ ...cellBase, maxWidth: '180px' }}>
                        <div style={ellipsis}>{b.customer_name || 'Unknown customer'}</div>
                      </td>
                      <td style={{ ...cellBase, color: COLORS.textMuted, whiteSpace: 'nowrap' as const }}>{new Date(b.created_at).toLocaleDateString()}</td>
                      <td style={{ ...cellBase, textAlign: 'right' as const, fontWeight: 800, whiteSpace: 'nowrap' as const }}>{formatNaira(b.amount_paid)}</td>
                      <td style={{ ...cellBase, textAlign: 'right' as const, color: COLORS.textMuted, whiteSpace: 'nowrap' as const }}>{formatNaira(b.commission_amount)}</td>
                      <td style={cellBase}><StatusPill status={status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}` }}>
          {bookings.map((b, idx) => {
            const status = b.booking_status || 'pending'
            return (
              <div
                key={b.id}
                onClick={() => setSelected(b)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 15px', cursor: 'pointer',
                  borderBottom: idx === bookings.length - 1 ? 'none' : `1px solid ${COLORS.border}`,
                }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={CATEGORY_ICON[b.services?.category || ''] || 'ticket'} size={15} color={COLORS.text} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{b.services?.title || 'Deleted listing'}</p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '1px' }}>{b.customer_name || 'Unknown customer'} · {b.ticket_code || '—'}</p>
                </div>
                <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                  <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.text }}>{formatNaira(b.amount_paid)}</p>
                  <StatusPill status={status} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {bookings.length === PAGE_SIZE && (
        <p style={{ fontSize: '11px', color: COLORS.textMuted, textAlign: 'center' as const, marginTop: '12px' }}>
          Showing first {PAGE_SIZE} — refine your search to narrow results.
        </p>
      )}

      {selected && (
        <div
          onClick={() => isDesktop && setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center', zIndex: 100, padding: isDesktop ? '20px' : 0 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: COLORS.card, borderRadius: isDesktop ? '16px' : '20px 20px 0 0', padding: '22px 20px', width: '100%', maxWidth: isDesktop ? '520px' : '480px', maxHeight: '85vh', overflowY: 'auto' as const }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>{selected.services?.title || 'Deleted listing'}</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '18px' }}>{selected.companies?.business_name || 'Unknown company'}</p>

            <div style={{ marginBottom: '16px' }}>
              {[
                ['Ticket code', selected.ticket_code || '—'],
                ['Customer', selected.customer_name || '—'],
                ['Phone', selected.customer_phone || '—'],
                ['Email', selected.customer_email || '—'],
                ['Amount paid', formatNaira(selected.amount_paid)],
                ['Commission', formatNaira(selected.commission_amount)],
                ['Unit/Seat', selected.assigned_unit_number || '—'],
                ['Check-in', selected.check_in_date ? new Date(selected.check_in_date).toLocaleDateString() : '—'],
                ['Check-out', selected.check_out_date ? new Date(selected.check_out_date).toLocaleDateString() : '—'],
                ['Booked on', new Date(selected.created_at).toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: '12px', color: COLORS.textMuted }}>{label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text, textAlign: 'right' as const, maxWidth: '60%' }}>{value}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelected(null)}
              style={{ width: '100%', padding: '13px', background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
