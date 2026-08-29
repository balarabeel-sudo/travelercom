import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  greenBg: '#F0FDF4',
  red: '#dc2626',
  redBg: '#FEF2F2',
}

type Listing = {
  id: string
  title: string
  category: string
  price: number
  photo_url: string | null
  status: string | null
  destination: string | null
  created_at: string
}

const CATEGORY_ICON: Record<string, string> = {
  hotel: 'hotel',
  bus: 'bus',
  train: 'bus',
  flight: 'plane',
  tour: 'map',
  event_center: 'tent',
}

function formatNaira(n: number) {
  return '₦' + n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export default function MyListings() {
  const navigate = useNavigate()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) { setLoading(false); return }
    const { data: company } = await supabase.from('companies').select('id').eq('owner_id', userData.user.id).maybeSingle()
    if (!company) { setLoading(false); return }
    setCompanyId(company.id)

    const { data } = await supabase
      .from('services')
      .select('id, title, category, price, photo_url, status, destination, created_at')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })

    setListings((data as Listing[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (listing: Listing) => {
    if (!window.confirm(`Delete "${listing.title}"? This cannot be undone.`)) return
    setDeletingId(listing.id)
    const { error } = await supabase.from('services').delete().eq('id', listing.id)
    if (error) {
      alert('Could not delete: ' + error.message)
      setDeletingId(null)
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user && companyId) {
      await supabase.rpc('log_audit', {
        p_action: 'deleted_listing',
        p_module: 'listings',
        p_target_type: 'service',
        p_target_id: listing.id,
        p_previous: { title: listing.title },
        p_new: null,
        p_company_id: companyId,
      })
    }
    setDeletingId(null)
    load()
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>
      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={20} color={COLORS.text} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>My Listings</p>
          <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{listings.length} listing{listings.length === 1 ? '' : 's'}</p>
        </div>
        <div onClick={() => navigate('/add-listing')} style={{
          width: '38px', height: '38px', borderRadius: '10px', background: COLORS.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <Icon name="plus" size={18} color="white" />
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: COLORS.textMuted, padding: '40px 0', fontSize: '13px' }}>Loading…</p>
        ) : listings.length === 0 ? (
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '30px', textAlign: 'center' as const }}>
            <p style={{ fontSize: '13px', color: COLORS.textMuted, marginBottom: '12px' }}>You haven't added any listings yet.</p>
            <div onClick={() => navigate('/add-listing')} style={{
              display: 'inline-block', padding: '10px 18px', background: COLORS.primary, color: 'white',
              borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
            }}>
              + Add Your First Listing
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {listings.map((l) => (
              <div key={l.id} style={{ background: COLORS.card, borderRadius: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div
                  onClick={() => navigate(`/add-listing?edit=${l.id}`)}
                  style={{
                    height: '90px', cursor: 'pointer',
                    background: l.photo_url ? undefined : 'linear-gradient(135deg, #F97316, #0EA5E9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  {l.photo_url ? (
                    <img src={l.photo_url} alt={l.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Icon name={CATEGORY_ICON[l.category] || 'box'} size={26} color="white" />
                  )}
                </div>
                <div style={{ padding: '10px' }}>
                  <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                    {l.title}
                  </p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>{formatNaira(l.price)}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                      background: l.status === 'active' ? COLORS.greenBg : COLORS.redBg,
                      color: l.status === 'active' ? COLORS.green : COLORS.red,
                    }}>
                      {l.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <div onClick={() => navigate(`/add-listing?edit=${l.id}`)} style={{ cursor: 'pointer', padding: '4px' }}>
                        <Icon name="edit" size={14} color={COLORS.textMuted} />
                      </div>
                      <div onClick={() => handleDelete(l)} style={{ cursor: deletingId === l.id ? 'default' : 'pointer', padding: '4px', opacity: deletingId === l.id ? 0.4 : 1 }}>
                        <Icon name="trash" size={14} color={COLORS.red} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
