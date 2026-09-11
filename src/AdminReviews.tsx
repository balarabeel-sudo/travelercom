import { useEffect, useState } from 'react'
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
  red: '#dc2626',
  amber: '#F59E0B',
}

type ReviewRow = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  company_id: string
  companies: { business_name: string } | null
  profiles: { full_name: string | null; email: string | null } | null
}

function Stars({ value, editable, onChange }: { value: number; editable?: boolean; onChange?: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          onClick={editable ? () => onChange?.(n) : undefined}
          style={{ cursor: editable ? 'pointer' : 'default', display: 'flex' }}>
          <Icon name="star" size={16} color={n <= value ? COLORS.amber : COLORS.border} filled={n <= value} />
        </div>
      ))}
    </div>
  )
}

function AdminReviews() {
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftRating, setDraftRating] = useState(0)
  const [draftComment, setDraftComment] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, company_id, companies(business_name), profiles(full_name, email)')
      .order('created_at', { ascending: false })

    if (err) {
      setError('Failed to load reviews. Please try again.')
      setLoading(false)
      return
    }
    setReviews((data as any) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const startEdit = (r: ReviewRow) => {
    setEditingId(r.id)
    setDraftRating(r.rating)
    setDraftComment(r.comment || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraftRating(0)
    setDraftComment('')
  }

  const saveEdit = async (id: string) => {
    setSavingId(id)
    const { error: err } = await supabase
      .from('reviews')
      .update({ rating: draftRating, comment: draftComment.trim() || null })
      .eq('id', id)

    if (err) {
      setSavingId(null)
      setError('Failed to save changes. Please try again.')
      return
    }
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, rating: draftRating, comment: draftComment.trim() || null } : r)))
    setSavingId(null)
    cancelEdit()
  }

  const doDelete = async (id: string) => {
    setDeletingId(id)
    const { error: err } = await supabase.from('reviews').delete().eq('id', id)
    if (err) {
      setDeletingId(null)
      setError('Failed to delete review. Please try again.')
      return
    }
    setReviews((prev) => prev.filter((r) => r.id !== id))
    setDeletingId(null)
    setConfirmDeleteId(null)
  }

  const filtered = reviews.filter((r) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (r.companies?.business_name || '').toLowerCase().includes(q) ||
      (r.profiles?.full_name || '').toLowerCase().includes(q) ||
      (r.comment || '').toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ padding: '20px', maxWidth: '900px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '10px 14px' }}>
        <Icon name="search" size={16} color={COLORS.textMuted} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by company, customer or comment..."
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', color: COLORS.text, background: 'transparent' }}
        />
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon name="alertCircle" size={16} color={COLORS.red} />
          <p style={{ fontSize: '12.5px', color: '#b91c1c' }}>{error}</p>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading reviews...</p>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Icon name="star" size={26} color={COLORS.textMuted} />
          <p style={{ fontSize: '13px', color: COLORS.textMuted, marginTop: '10px' }}>
            {search ? 'No reviews match your search.' : 'No reviews yet.'}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map((r) => {
          const isEditing = editingId === r.id
          return (
            <div key={r.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '10px' }}>
                <div>
                  <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{r.companies?.business_name || 'Unknown company'}</p>
                  <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>
                    {r.profiles?.full_name || r.profiles?.email || 'Unknown customer'} · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                {isEditing ? (
                  <Stars value={draftRating} editable onChange={setDraftRating} />
                ) : (
                  <Stars value={r.rating} />
                )}
              </div>

              {isEditing ? (
                <textarea
                  value={draftComment}
                  onChange={(e) => setDraftComment(e.target.value)}
                  rows={3}
                  style={{ width: '100%', border: `1px solid ${COLORS.border}`, borderRadius: '8px', padding: '8px 10px', fontSize: '12.5px', color: COLORS.text, resize: 'vertical' as const, marginBottom: '10px', fontFamily: 'inherit' }}
                />
              ) : (
                r.comment && <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.5, marginBottom: '10px' }}>{r.comment}</p>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                {isEditing ? (
                  <>
                    <span onClick={cancelEdit} style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer', padding: '6px 10px' }}>Cancel</span>
                    <span
                      onClick={() => savingId !== r.id && saveEdit(r.id)}
                      style={{ fontSize: '12px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer', padding: '6px 10px' }}>
                      {savingId === r.id ? 'Saving...' : 'Save'}
                    </span>
                  </>
                ) : confirmDeleteId === r.id ? (
                  <>
                    <span style={{ fontSize: '12px', color: COLORS.textMuted, alignSelf: 'center' }}>Delete this review?</span>
                    <span onClick={() => setConfirmDeleteId(null)} style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer', padding: '6px 10px' }}>No</span>
                    <span
                      onClick={() => deletingId !== r.id && doDelete(r.id)}
                      style={{ fontSize: '12px', fontWeight: 700, color: COLORS.red, cursor: 'pointer', padding: '6px 10px' }}>
                      {deletingId === r.id ? 'Deleting...' : 'Yes, delete'}
                    </span>
                  </>
                ) : (
                  <>
                    <span onClick={() => startEdit(r)} style={{ fontSize: '12px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer', padding: '6px 10px' }}>Edit</span>
                    <span onClick={() => setConfirmDeleteId(r.id)} style={{ fontSize: '12px', fontWeight: 700, color: COLORS.red, cursor: 'pointer', padding: '6px 10px' }}>Delete</span>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default AdminReviews
