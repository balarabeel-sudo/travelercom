import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

const COLORS = {
  primary: '#0EA5E9', bg: '#F8FAFC', card: '#FFFFFF', text: '#1A1A1A',
  textMuted: '#64748B', border: '#E2E8F0',
}

type Guest = { name: string; bookings: number; totalSpent: number; lastBooking: string }

function GuestList() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [guests, setGuests] = useState<Guest[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { navigate('/login'); return }

      const { data: company } = await supabase
        .from('companies').select('id').eq('owner_id', userData.user.id).maybeSingle()
      if (!company) { setLoading(false); return }

      const { data: bookings } = await supabase
        .from('bookings')
        .select('customer_name, amount_paid, created_at')
        .eq('company_id', company.id)
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
  }, [navigate])

  const filtered = guests.filter((g) => g.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <span onClick={() => navigate('/business-suite')} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Guests</h1>
      </div>

      <div style={{ padding: '16px' }}>
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
                <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.primary }}>₦{g.totalSpent.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default GuestList
