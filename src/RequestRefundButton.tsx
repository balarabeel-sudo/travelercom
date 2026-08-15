import { useState } from 'react'
import { supabase } from './supabaseClient'

const COLORS = {
  primary: '#0EA5E9',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  orange: '#F97316',
  red: '#DC2626',
}

type Props = {
  bookingId: string
  amountPaid: number
  departureTime: string | null
  bookingStatus: string
  requesterType: 'customer' | 'company'
  onRequested?: () => void
  forceEligible?: boolean
}

export default function RequestRefundButton({ bookingId, amountPaid, departureTime, bookingStatus, requesterType, onRequested, forceEligible }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const beforeDeparture = departureTime ? new Date(departureTime).getTime() > Date.now() : true
  const eligible = forceEligible !== undefined ? forceEligible : (beforeDeparture && bookingStatus === 'confirmed')

  if (!eligible) return null

  async function submit() {
    if (!reason.trim()) {
      setError('Da fatan za a rubuta dalili.')
      return
    }
    setSubmitting(true)
    setError('')

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    const { error } = await supabase.from('refund_requests').insert({
      booking_id: bookingId,
      requested_by: userId,
      requester_type: requesterType,
      reason: reason.trim(),
      amount: amountPaid,
    })

    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }
    setDone(true)
    onRequested?.()
  }

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{
          marginTop: '10px', textAlign: 'center' as const, padding: '10px', borderRadius: '10px',
          border: `1px solid ${COLORS.orange}`, color: COLORS.orange, fontSize: '12px', fontWeight: 700,
          cursor: 'pointer', background: 'white',
        }}
      >
        Nemi Refund
      </div>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }}
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: COLORS.card, borderTopLeftRadius: '18px', borderTopRightRadius: '18px', padding: '20px', width: '100%', maxWidth: '480px' }}
          >
            {done ? (
              <>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>An aika buƙatar refund</p>
                <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '6px' }}>
                  Za a sanar da kai bayan an duba ta.
                </p>
                <div
                  onClick={() => setOpen(false)}
                  style={{ marginTop: '14px', textAlign: 'center' as const, padding: '11px', borderRadius: '10px', background: COLORS.orange, color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}
                >
                  Rufe
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '10px' }}>Nemi Refund</p>
                <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: '10px' }}>
                  Adadin: ₦{amountPaid.toLocaleString()}
                </p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Dalilin neman refund..."
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', minHeight: '70px', color: COLORS.text }}
                />
                {error && <p style={{ color: COLORS.red, fontSize: '12px', marginTop: '6px' }}>{error}</p>}
                <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                  <div
                    onClick={() => !submitting && submit()}
                    style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', background: COLORS.orange, color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}
                  >
                    {submitting ? '...' : 'Aika Buƙata'}
                  </div>
                  <div
                    onClick={() => !submitting && setOpen(false)}
                    style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontSize: '13.5px', cursor: 'pointer' }}
                  >
                    Soke
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
