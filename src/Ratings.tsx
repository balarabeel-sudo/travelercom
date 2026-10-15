import { useEffect, useState } from 'react'
import useIsDesktop from './useIsDesktop'
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
  gold: '#F59E0B',
}

type Review = {
  id: string
  rating: number | null
  comment: string | null
  created_at: string
  profiles: { full_name: string | null } | null
  services: { title: string } | null
}

export default function Ratings() {
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState<Review[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { navigate('/login'); return }

      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', userData.user.id)
        .maybeSingle()

      if (!company) { setLoading(false); return }

      const { data: rows } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, profiles(full_name), services(title)')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })

      setReviews((rows || []) as any)
      setLoading(false)
    }
    load()
  }, [navigate])

  if (loading) {
    return (
      <div style={{ minHeight: isDesktop ? '60vh' : '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, color: COLORS.textMuted }}>
        Loading Reviews...
      </div>
    )
  }

  const rated = reviews.filter((r) => r.rating != null)
  const avgRating = rated.length > 0 ? rated.reduce((sum, r) => sum + Number(r.rating), 0) / rated.length : 0

  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = rated.filter((r) => Number(r.rating) === star).length
    const pct = rated.length > 0 ? Math.round((count / rated.length) * 100) : 0
    return { star, count, pct }
  })

  const renderStars = (rating: number, size = 13) => (
    <div style={{ display: 'flex', gap: '1px' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={size} color={i <= Math.round(rating) ? COLORS.gold : '#E2E8F0'} />
      ))}
    </div>
  )


  // ------------------------------------------------------------------
  // Desktop layout
  // ------------------------------------------------------------------
  if (isDesktop) {
    return (
      <div>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Ratings &amp; Reviews</h1>
          <p style={{ fontSize: '14px', color: COLORS.textMuted, margin: '4px 0 0' }}>What travelers are saying about your business.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px', padding: '28px', position: 'sticky', top: '0' }}>
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <p style={{ fontSize: '56px', fontWeight: 800, color: COLORS.text, lineHeight: 1, margin: 0 }}>
                {rated.length > 0 ? avgRating.toFixed(1) : '—'}
              </p>
              {rated.length > 0 && <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>{renderStars(avgRating, 20)}</div>}
              <p style={{ fontSize: '14px', color: COLORS.textMuted, margin: '8px 0 0' }}>
                {rated.length} review{rated.length !== 1 ? 's' : ''}
              </p>
            </div>
            {distribution.map((d) => (
              <div key={d.star} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <p style={{ fontSize: '13px', color: COLORS.textMuted, width: '12px', margin: 0 }}>{d.star}</p>
                <div style={{ flex: 1, height: '8px', background: '#F1F5F9', borderRadius: '4px' }}>
                  <div style={{ width: `${d.pct}%`, height: '100%', background: COLORS.gold, borderRadius: '4px' }} />
                </div>
                <p style={{ fontSize: '12.5px', color: COLORS.textMuted, width: '56px', textAlign: 'right', margin: 0 }}>{d.count} ({d.pct}%)</p>
              </div>
            ))}
          </div>

          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text, margin: '0 0 14px' }}>All Reviews</h2>
            {reviews.length === 0 ? (
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '48px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '14px' }}>
                No reviews yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {reviews.map((rv) => (
                  <div key={rv.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: COLORS.purple, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, flexShrink: 0 }}>
                          {(rv.profiles?.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '14.5px', fontWeight: 700, color: COLORS.text, margin: 0 }}>{rv.profiles?.full_name || 'Traveler'}</p>
                          {rv.services?.title && (
                            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rv.services.title}</p>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: '12.5px', color: COLORS.textMuted, whiteSpace: 'nowrap', margin: 0 }}>
                        {new Date(rv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    {rv.rating != null && <div style={{ marginBottom: '10px' }}>{renderStars(Number(rv.rating), 15)}</div>}
                    {rv.comment && <p style={{ fontSize: '14px', color: COLORS.text, lineHeight: 1.55, margin: 0 }}>{rv.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Ratings & Reviews</h1>
      </div>

      <div style={{ padding: '16px' }}>

        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <p style={{ fontSize: '36px', fontWeight: 800, color: COLORS.text, lineHeight: 1 }}>
                {rated.length > 0 ? avgRating.toFixed(1) : '—'}
              </p>
              {rated.length > 0 && renderStars(avgRating, 14)}
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px' }}>
                {rated.length} review{rated.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ flex: 1 }}>
              {distribution.map((d) => (
                <div key={d.star} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <p style={{ fontSize: '10.5px', color: COLORS.textMuted, width: '10px' }}>{d.star}</p>
                  <div style={{ flex: 1, height: '6px', background: '#F1F5F9', borderRadius: '3px' }}>
                    <div style={{ width: `${d.pct}%`, height: '100%', background: COLORS.gold, borderRadius: '3px' }} />
                  </div>
                  <p style={{ fontSize: '10px', color: COLORS.textMuted, width: '28px', textAlign: 'right' }}>{d.pct}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text, marginBottom: '12px' }}>All Reviews</p>

        {reviews.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted }}>
            No reviews yet.
          </div>
        ) : (
          reviews.map((r) => (
            <div key={r.id} style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', background: COLORS.purple,
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800
                  }}>
                    {(r.profiles?.full_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{r.profiles?.full_name || 'Traveler'}</p>
                    {r.services?.title && (
                      <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{r.services.title}</p>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: '10.5px', color: COLORS.textMuted, whiteSpace: 'nowrap' }}>
                  {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
              </div>
              {r.rating != null && <div style={{ marginBottom: '8px' }}>{renderStars(Number(r.rating))}</div>}
              {r.comment && <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.5 }}>{r.comment}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
