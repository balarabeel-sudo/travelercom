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
  green: '#16A34A',
  red: '#DC2626',
  orange: '#F97316',
}

const CATEGORY_ICON: Record<string, string> = {
  hotel: '🏨', bus: '🚌', train: '🚆', flight: '✈️', tour: '🗺️', event_center: '🎪',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  confirmed: { bg: '#DCFCE7', color: COLORS.green },
  completed: { bg: '#DCFCE7', color: COLORS.green },
  pending: { bg: '#FEF3C7', color: COLORS.orange },
  cancelled: { bg: '#FEE2E2', color: COLORS.red },
}

type BookingRow = {
  id: string
  ticket_code: string | null
  booking_status: string | null
  amount_paid: number
  assigned_unit_number: string | null
  created_at: string | null
  company_id: string
  service_id: string
  services: {
    title: string
    origin: string | null
    destination: string
    departure_time: string | null
    category: string | null
    photo_url: string | null
    companies: { business_name: string } | null
  } | null
}

function MyBookings() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'completed' | 'cancelled'>('all')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [reviewsMap, setReviewsMap] = useState<Record<string, { rating: number; comment: string | null }>>({})
  const [openReviewId, setOpenReviewId] = useState<string | null>(null)
  const [draftRating, setDraftRating] = useState(0)
  const [draftComment, setDraftComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: userData, error } = await supabase.auth.getUser()
      if (error || !userData.user) { navigate('/login'); return }

      const { data, error: qErr } = await supabase
        .from('bookings')
        .select('id, ticket_code, booking_status, amount_paid, assigned_unit_number, created_at, company_id, service_id, services(title, origin, destination, departure_time, category, photo_url, companies(business_name))')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })

      if (!qErr) setBookings((data as any) || [])

      const { data: reviewRows } = await supabase
        .from('reviews')
        .select('booking_id, rating, comment')
        .eq('user_id', userData.user.id)
      const map: Record<string, { rating: number; comment: string | null }> = {}
      ;(reviewRows || []).forEach((r: any) => { if (r.booking_id) map[r.booking_id] = { rating: r.rating, comment: r.comment } })
      setReviewsMap(map)

      setLoading(false)
    }
    load()
  }, [navigate])

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => (b.booking_status || '').toLowerCase() === filter)

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted }}>Loading your bookings...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, paddingBottom: '30px' }}>
      <div style={{ background: 'white', padding: '18px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
        <span onClick={() => navigate(-1)} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
        <p style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text, marginTop: '8px' }}>My Bookings</p>
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', overflowX: 'auto' as const }}>
          {(['all', 'confirmed', 'completed', 'cancelled'] as const).map((f) => (
            <span key={f} onClick={() => setFilter(f)}
              style={{
                padding: '7px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const,
                border: `1px solid ${filter === f ? COLORS.primary : COLORS.border}`,
                background: filter === f ? COLORS.primary : 'white',
                color: filter === f ? 'white' : COLORS.textMuted,
              }}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </span>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center' as const, padding: '60px 20px', color: COLORS.textMuted }}>
            <p style={{ fontSize: '32px', marginBottom: '10px' }}>🧳</p>
            <p style={{ fontSize: '13.5px' }}>No bookings here yet.</p>
          </div>
        )}

        {filtered.map((b) => {
          const status = (b.booking_status || 'pending').toLowerCase()
          const style = STATUS_STYLE[status] || { bg: '#F1F5F9', color: COLORS.textMuted }
          const category = b.services?.category || 'hotel'
          const bookedAt = b.created_at ? new Date(b.created_at).getTime() : 0
          const minutesSince = (now - bookedAt) / 60000
          const canCancel = status === 'confirmed' && minutesSince < 15

          const handleCancel = async () => {
            if (!confirm('Cancel this booking? Your payment will be refunded to your wallet.')) return
            setCancellingId(b.id)
            const { error } = await supabase.rpc('cancel_booking', { p_booking_id: b.id })
            setCancellingId(null)
            if (error) {
              alert('Failed to cancel: ' + error.message)
              return
            }
            setBookings((prev) => prev.map((x) => x.id === b.id ? { ...x, booking_status: 'cancelled' } : x))
          }

          const handleSubmitReview = async () => {
            if (draftRating === 0 || submittingReview) return
            setSubmittingReview(true)
            const { data: userData } = await supabase.auth.getUser()
            if (!userData.user) { setSubmittingReview(false); return }
            const { error } = await supabase.from('reviews').insert({
              user_id: userData.user.id,
              company_id: b.company_id,
              service_id: b.service_id,
              booking_id: b.id,
              rating: draftRating,
              comment: draftComment.trim() || null,
            })
            setSubmittingReview(false)
            if (error) {
              alert('Could not submit review: ' + error.message)
              return
            }
            setReviewsMap((prev) => ({ ...prev, [b.id]: { rating: draftRating, comment: draftComment.trim() || null } }))
            setOpenReviewId(null)
            setDraftRating(0)
            setDraftComment('')
          }

          return (
            <div key={b.id} style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text }}>
                  {CATEGORY_ICON[category] || '📍'} {b.services?.title || 'Booking'}
                </p>
                <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '4px 9px', borderRadius: '20px', background: style.bg, color: style.color, textTransform: 'capitalize' as const }}>
                  {status}
                </span>
              </div>

              {b.services?.origin ? (
                <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '4px' }}>{b.services.origin} → {b.services.destination}</p>
              ) : (
                <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '4px' }}>{b.services?.destination}</p>
              )}

              {b.services?.departure_time && (
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '4px' }}>{new Date(b.services.departure_time).toLocaleString()}</p>
              )}

              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '8px' }}>{b.services?.companies?.business_name || 'Traveler.com Partner'}</p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: `1px solid ${COLORS.border}` }}>
                <div>
                  <p style={{ fontSize: '10px', color: COLORS.textMuted }}>Ticket Code</p>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{b.ticket_code || '—'}{b.assigned_unit_number ? ` · Seat ${b.assigned_unit_number}` : ''}</p>
                </div>
                <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.secondary }}>₦{Number(b.amount_paid).toLocaleString()}</p>
              </div>

              {canCancel && (
                <div
                  onClick={() => cancellingId !== b.id && handleCancel()}
                  style={{
                    marginTop: '10px', textAlign: 'center' as const, padding: '10px', borderRadius: '10px',
                    border: `1px solid ${COLORS.red}`, color: COLORS.red, fontSize: '12px', fontWeight: 700,
                    cursor: cancellingId === b.id ? 'not-allowed' : 'pointer',
                    background: cancellingId === b.id ? '#f1f5f9' : 'white',
                  }}>
                  {cancellingId === b.id ? 'Cancelling...' : `Cancel Booking (${Math.max(0, Math.ceil(15 - minutesSince))} min left)`}
                </div>
              )}

              {status === 'completed' && (
                reviewsMap[b.id] ? (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${COLORS.border}` }}>
                    <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>Your review</p>
                    <div style={{ display: 'flex', gap: '2px', marginBottom: reviewsMap[b.id].comment ? '4px' : 0 }}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Icon key={i} name="star" size={14} color={i <= reviewsMap[b.id].rating ? '#F59E0B' : COLORS.border} />
                      ))}
                    </div>
                    {reviewsMap[b.id].comment && <p style={{ fontSize: '12px', color: COLORS.text }}>{reviewsMap[b.id].comment}</p>}
                  </div>
                ) : openReviewId === b.id ? (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${COLORS.border}` }}>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>Rate this trip</p>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span key={i} onClick={() => setDraftRating(i)} style={{ cursor: 'pointer', display: 'flex' }}>
                          <Icon name="star" size={22} color={i <= draftRating ? '#F59E0B' : COLORS.border} />
                        </span>
                      ))}
                    </div>
                    <textarea
                      value={draftComment}
                      onChange={(e) => setDraftComment(e.target.value)}
                      placeholder="Share your experience (optional)"
                      style={{ width: '100%', minHeight: '60px', padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', resize: 'vertical' as const, boxSizing: 'border-box' as const, marginBottom: '8px', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => { setOpenReviewId(null); setDraftRating(0); setDraftComment('') }}
                        style={{ flex: 1, padding: '9px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: 'white', color: COLORS.textMuted, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitReview}
                        disabled={draftRating === 0 || submittingReview}
                        style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', background: (draftRating === 0 || submittingReview) ? '#94a3b8' : COLORS.primary, color: 'white', fontSize: '12px', fontWeight: 700, cursor: (draftRating === 0 || submittingReview) ? 'not-allowed' : 'pointer' }}>
                        {submittingReview ? 'Submitting...' : 'Submit Review'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => { setOpenReviewId(b.id); setDraftRating(0); setDraftComment('') }}
                    style={{ marginTop: '10px', textAlign: 'center' as const, padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.primary}`, color: COLORS.primary, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    Rate this trip
                  </div>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MyBookings
