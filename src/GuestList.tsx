import { useEffect, useState } from 'react'
import useIsDesktop from './useIsDesktop'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

const COLORS = {
  primary: '#0EA5E9', bg: '#F8FAFC', card: '#FFFFFF', text: '#1A1A1A',
  textMuted: '#64748B', border: '#E2E8F0',
}

type Guest = { name: string; bookings: number; totalSpent: number; lastBooking: string }

// companyId: when given (staff dashboard), list guests of exactly that company.
// embedded: render inside another layout (no page title, no Add Guest shortcut).
// hideAmounts: hide money figures (for staff without finance access).
function GuestList({ companyId: companyIdProp, embedded = false, hideAmounts = false }: { companyId?: string; embedded?: boolean; hideAmounts?: boolean } = {}) {
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const [loading, setLoading] = useState(true)
  const [guests, setGuests] = useState<Guest[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { navigate('/login'); return }

      let companyId: string | null = companyIdProp || null
      if (!companyId) {
        const { data: company } = await supabase
          .from('companies').select('id').eq('owner_id', userData.user.id).maybeSingle()
        companyId = company?.id || null
      }
      if (!companyId) {
        const { data: staffRow } = await supabase
          .from('company_staff')
          .select('company_id')
          .eq('user_id', userData.user.id)
          .eq('status', 'active')
          .maybeSingle()
        if (staffRow) companyId = staffRow.company_id
      }
      if (!companyId) { setLoading(false); return }

      const { data: bookings } = await supabase
        .from('bookings')
        .select('customer_name, amount_paid, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      const map: Record<string, Guest> = {}
      ;(bookings || []).forEach((b: any) => {
        const name = b.customer_name || 'Unknown Customer'
        if (!map[name]) map[name] = { name, bookings: 0, totalSpent: 0, lastBooking: b.created_at }
        map[name].bookings += 1
        map[name].totalSpent += Number(b.amount_paid)
      })

      setGuests(Object.values(map).sort((a, b) => b.totalSpent - a.totalSpent))
      setLoading(false)
    }
    load()
  }, [navigate, companyIdProp])

  const filtered = guests.filter((g) => g.name.toLowerCase().includes(search.trim().toLowerCase()))


  // ------------------------------------------------------------------
  // Desktop layout
  // ------------------------------------------------------------------
  if (isDesktop) {
    const th = {
      textAlign: 'left' as const, padding: '14px 20px', fontSize: '13px', fontWeight: 600,
      color: COLORS.textMuted, borderBottom: `1px solid ${COLORS.border}`, background: '#F8FAFC',
      whiteSpace: 'nowrap' as const,
    }
    const td = {
      padding: '16px 20px', fontSize: '14px', color: COLORS.text,
      borderBottom: `1px solid ${COLORS.border}`, verticalAlign: 'middle' as const,
    }
    const totalBookings = guests.reduce((sum, x) => sum + x.bookings, 0)
    const totalSpent = guests.reduce((sum, x) => sum + x.totalSpent, 0)
    const summary = [
      { label: 'Total guests', value: guests.length.toLocaleString() },
      { label: 'Total bookings', value: totalBookings.toLocaleString() },
      ...(hideAmounts ? [] : [{ label: 'Total spent', value: '₦' + totalSpent.toLocaleString() }]),
    ]
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            {!embedded && <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Guests</h1>}
            <p style={{ fontSize: '14px', color: COLORS.textMuted, margin: embedded ? 0 : '4px 0 0' }}>Everyone who has booked with your business.</p>
          </div>
          <input
            type="text" placeholder="Search guests" value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: '300px', padding: '12px 14px', border: `1px solid ${COLORS.border}`, borderRadius: '10px', fontSize: '14px', background: COLORS.card, boxSizing: 'border-box' }}
          />
          {!embedded && (
            <button
              type="button"
              onClick={() => navigate('/add-guest')}
              style={{ padding: '12px 20px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Add Guest
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${summary.length}, minmax(0, 1fr))`, gap: '16px', marginBottom: '24px' }}>
          {summary.map((c) => (
            <div key={c.label} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '20px' }}>
              <p style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.value}</p>
              <p style={{ fontSize: '14px', color: COLORS.textMuted, margin: '4px 0 0' }}>{c.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: COLORS.textMuted, fontSize: '14px', padding: '40px 0' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '56px 30px', textAlign: 'center' as const }}>
            <p style={{ fontSize: '14px', color: COLORS.textMuted }}>No guests yet</p>
          </div>
        ) : (
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                <thead>
                  <tr>
                    <th style={th}>Guest</th>
                    <th style={th}>Bookings</th>
                    <th style={th}>Last booking</th>
                    {!hideAmounts && <th style={{ ...th, textAlign: 'right' as const }}>Total spent</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((x) => (
                    <tr key={x.name}>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: COLORS.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '16px', flexShrink: 0 }}>
                            {x.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 700 }}>{x.name}</span>
                        </div>
                      </td>
                      <td style={{ ...td, color: '#475569' }}>{x.bookings}</td>
                      <td style={{ ...td, color: '#475569' }}>{new Date(x.lastBooking).toLocaleDateString()}</td>
                      {!hideAmounts && <td style={{ ...td, textAlign: 'right' as const, fontWeight: 800 }}>₦{x.totalSpent.toLocaleString()}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={embedded ? {} : { minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      {!embedded && <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <span onClick={() => navigate(-1)} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text, flex: 1 }}>Guests</h1>
        <span onClick={() => navigate('/add-guest')} style={{
          fontSize: '12.5px', fontWeight: 700, color: '#fff', background: COLORS.primary,
          padding: '8px 14px', borderRadius: '20px', cursor: 'pointer',
        }}>+ Add Guest</span>
      </div>}

      <div style={{ padding: embedded ? 0 : '16px' }}>
        <input
          type="text" placeholder="Search guests" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '11px', border: `1px solid ${COLORS.border}`, borderRadius: '10px', fontSize: '13.5px', marginBottom: '16px', boxSizing: 'border-box', background: COLORS.card }}
        />

        {loading ? (
          <p style={{ textAlign: 'center', color: COLORS.textMuted, fontSize: '13px', padding: '30px 0' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '30px', textAlign: 'center', color: COLORS.textMuted, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '13px' }}>No guests yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map((g) => (
              <div key={g.name} style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: COLORS.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '16px', flexShrink: 0 }}>
                  {g.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{g.name}</p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{g.bookings} booking{g.bookings > 1 ? 's' : ''} • Last: {new Date(g.lastBooking).toLocaleDateString()}</p>
                </div>
                {!hideAmounts && <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.primary }}>₦{g.totalSpent.toLocaleString()}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default GuestList
