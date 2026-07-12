import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

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

type Listing = {
  id: string
  title: string
  destination: string
  price: number
  seats_available: number | null
  status: string
}

function ListingsManagement() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [listings, setListings] = useState<Listing[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadListings = async () => {
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

    if (!company) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('services')
      .select('id, title, destination, price, seats_available, status')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })

    setListings(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadListings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToggleStatus = async (listing: Listing) => {
    setBusyId(listing.id)
    const newStatus = listing.status === 'active' ? 'inactive' : 'active'
    await supabase.from('services').update({ status: newStatus }).eq('id', listing.id)
    setBusyId(null)
    await loadListings()
  }

  const handleDelete = async (listing: Listing) => {
    if (!window.confirm(`Delete "${listing.title}"? This cannot be undone.`)) return
    setBusyId(listing.id)
    await supabase.from('services').delete().eq('id', listing.id)
    setBusyId(null)
    await loadListings()
  }

  const filtered = listings.filter((l) => filter === 'all' || l.status === filter)

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: COLORS.card,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span onClick={() => navigate('/home')} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>My Listings</h1>
        </div>
        <span
          onClick={() => navigate('/add-listing')}
          style={{ fontSize: '13px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>
          + Add
        </span>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <div
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                background: filter === f ? COLORS.primary : COLORS.card,
                color: filter === f ? 'white' : COLORS.textMuted,
                fontSize: '12.5px',
                fontWeight: 700,
                textTransform: 'capitalize' as const,
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
              }}>
              {f}
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
            <p style={{ fontSize: '13px' }}>No listings found</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map((l) => (
              <div key={l.id} style={{
                background: COLORS.card,
                borderRadius: '14px',
                padding: '14px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>{l.title}</p>
                    <p style={{ fontSize: '12px', color: COLORS.textMuted }}>{l.destination}</p>
                  </div>
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    color: l.status === 'active' ? COLORS.green : COLORS.textMuted,
                    background: l.status === 'active' ? '#f0fdf4' : '#f1f5f9',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    textTransform: 'capitalize' as const
                  }}>
                    {l.status}
                  </span>
                </div>

                <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.primary, marginBottom: '10px' }}>
                  ₦{Number(l.price).toLocaleString()}
                  {l.seats_available !== null && (
                    <span style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 400 }}> • {l.seats_available} available</span>
                  )}
                </p>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => navigate(`/add-listing?edit=${l.id}`)}
                    disabled={busyId === l.id}
                    style={{
                      flex: 1, padding: '9px', background: COLORS.bg, color: COLORS.text,
                      border: `1px solid ${COLORS.border}`, borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                    }}>
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleToggleStatus(l)}
                    disabled={busyId === l.id}
                    style={{
                      flex: 1, padding: '9px', background: COLORS.bg, color: COLORS.text,
                      border: `1px solid ${COLORS.border}`, borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                    }}>
                    {l.status === 'active' ? '⏸ Pause' : '▶️ Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(l)}
                    disabled={busyId === l.id}
                    style={{
                      flex: 1, padding: '9px', background: '#fef2f2', color: COLORS.red,
                      border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                    }}>
                    🗑 Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ListingsManagement
