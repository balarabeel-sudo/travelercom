import { useState } from 'react'
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
  greenBg: '#f0fdf4',
  red: '#dc2626',
  redBg: '#fef2f2',
}

type BookingResult = {
  id: string
  ticket_code: string
  customer_name: string | null
  booking_status: string
  checked_in: boolean
  created_at: string
  category: string
} | null

function VerifyBooking() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [result, setResult] = useState<BookingResult>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [confirming, setConfirming] = useState(false)

  const handleSearch = async () => {
    if (!code.trim()) return
    setLoading(true)
    setSearched(false)
    setErrorMsg('')
    setResult(null)

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
      setErrorMsg('Company profile not found.')
      setLoading(false)
      setSearched(true)
      return
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, ticket_code, customer_name, booking_status, checked_in, created_at, services(category)')
      .eq('ticket_code', code.trim().toUpperCase())
      .eq('company_id', company.id)
      .maybeSingle()

    setLoading(false)
    setSearched(true)

    if (!booking) {
      setResult(null)
      return
    }

    setResult({
      id: booking.id,
      ticket_code: booking.ticket_code,
      customer_name: booking.customer_name,
      booking_status: booking.booking_status,
      checked_in: booking.checked_in,
      created_at: booking.created_at,
      category: (booking as any).services?.category || '—',
    })
  }

  const handleConfirmCheckIn = async () => {
    if (!result) return
    setConfirming(true)
    const { error } = await supabase
      .from('bookings')
      .update({ checked_in: true, checked_in_at: new Date().toISOString() })
      .eq('id', result.id)

    setConfirming(false)
    if (!error) {
      setResult({ ...result, checked_in: true })
    }
  }

  const isValid = result && result.booking_status === 'confirmed' && !result.checked_in

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: COLORS.card,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <span onClick={() => navigate('/home')} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Verify Booking</h1>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <p style={{ fontSize: '13px', color: COLORS.textMuted, marginBottom: '16px' }}>
          Enter the customer's ticket serial number to verify their booking.
        </p>

        <div style={{
          background: COLORS.card,
          borderRadius: '14px',
          padding: '14px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
          marginBottom: '20px'
        }}>
          <input
            type="text"
            placeholder="e.g. BUS-2026-8X4K9P"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '10px',
              fontSize: '15px',
              marginBottom: '12px',
              boxSizing: 'border-box',
              textTransform: 'uppercase'
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading || !code.trim()}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#94a3b8' : COLORS.secondary,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}>
            {loading ? 'Searching...' : '🔍 Verify Ticket'}
          </button>
        </div>

        {searched && !result && (
          <div style={{
            background: COLORS.redBg,
            border: `1px solid #fca5a5`,
            borderRadius: '14px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>❌</div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.red }}>Ticket Not Found</p>
            <p style={{ fontSize: '12px', color: '#991b1b', marginTop: '4px' }}>
              This code doesn't match any booking with your company.
            </p>
          </div>
        )}

        {result && (
          <div style={{
            background: isValid ? COLORS.greenBg : COLORS.redBg,
            border: `1px solid ${isValid ? '#86efac' : '#fca5a5'}`,
            borderRadius: '14px',
            padding: '20px'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '32px', marginBottom: '6px' }}>
                {isValid ? '✅' : result.checked_in ? '⚠️' : '❌'}
              </div>
              <p style={{ fontSize: '15px', fontWeight: 800, color: isValid ? COLORS.green : COLORS.red }}>
                {result.checked_in ? 'Already Checked In' : result.booking_status !== 'confirmed' ? `Booking ${result.booking_status}` : 'Valid Ticket'}
              </p>
            </div>

            <div style={{ background: 'white', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Row label="Customer Name" value={result.customer_name || '—'} />
              <Row label="Booking ID" value={result.id.slice(0, 8).toUpperCase()} />
              <Row label="Service Type" value={result.category} />
              <Row label="Status" value={result.booking_status} />
              <Row label="Booked On" value={new Date(result.created_at).toLocaleDateString()} />
            </div>

            {isValid && (
              <button
                onClick={handleConfirmCheckIn}
                disabled={confirming}
                style={{
                  width: '100%',
                  marginTop: '16px',
                  padding: '12px',
                  background: COLORS.green,
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  cursor: confirming ? 'not-allowed' : 'pointer'
                }}>
                {confirming ? 'Confirming...' : '✅ Confirm Check-In'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '12px', color: COLORS.textMuted }}>{label}</span>
      <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{value}</span>
    </div>
  )
}

export default VerifyBooking
