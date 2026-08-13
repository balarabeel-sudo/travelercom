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
  orange: '#F97316',
}

type Summary = { gross_booking_value: number; platform_commission: number; refunded_amount: number; total_bookings: number }

type Txn = {
  id: string
  ticket_code: string | null
  customer_name: string | null
  amount_paid: number
  commission_amount: number | null
  booking_status: string | null
  created_at: string
  companies: { business_name: string } | null
}

const PAGE_SIZE = 30

function MetricCard({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}`, padding: '14px', flex: '1 1 45%', minWidth: '140px' }}>
      <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
        <Icon name={icon} size={14} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '3px' }}>{label}</p>
      <p style={{ fontSize: '17px', fontWeight: 800, color: color || COLORS.text }}>{value}</p>
    </div>
  )
}

export default function AdminFinance() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [summaryError, setSummaryError] = useState(false)
  const [txns, setTxns] = useState<Txn[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: s, error: sErr } = await supabase.rpc('admin_finance_summary')
      if (sErr) {
        setSummaryError(true)
      } else if (s && s.length > 0) {
        setSummary(s[0])
      }

      const { data: t } = await supabase
        .from('bookings')
        .select('id, ticket_code, customer_name, amount_paid, commission_amount, booking_status, created_at, companies(business_name)')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)
      setTxns((t as any[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ padding: '16px' }}>
      {summaryError ? (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '14px', padding: '14px', marginBottom: '20px' }}>
          <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.red, marginBottom: '4px' }}>Couldn't load financial totals</p>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, lineHeight: 1.6 }}>
            Run <code>admin_finance_setup.sql</code> in Supabase first — it creates the summary function this panel needs.
          </p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>PLATFORM FINANCE</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
            <MetricCard icon="cash" label="Gross Booking Value" value={summary ? `₦${Number(summary.gross_booking_value).toLocaleString()}` : '—'} />
            <MetricCard icon="trendingUp" label="Platform Commission" value={summary ? `₦${Number(summary.platform_commission).toLocaleString()}` : '—'} color={COLORS.green} />
            <MetricCard icon="refresh" label="Refunded (cancelled)" value={summary ? `₦${Number(summary.refunded_amount).toLocaleString()}` : '—'} color={COLORS.red} />
            <MetricCard icon="ticket" label="Total Bookings" value={summary ? summary.total_bookings.toLocaleString() : '—'} />
          </div>
        </>
      )}

      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '14px', padding: '14px', marginBottom: '20px' }}>
        <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#9A3412', marginBottom: '4px' }}>Withdrawals & Escrow — pending setup</p>
        <p style={{ fontSize: '11.5px', color: '#9A3412', lineHeight: 1.6 }}>
          Company Earnings, Escrow Balance (Pending/Released/Held/Disputed), and Withdrawals aren't tracked as separate ledgers in the database yet — these need their own tables before we can show real numbers here rather than guesses.
        </p>
      </div>

      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>RECENT TRANSACTIONS</p>
      {loading ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>Loading...</p>
      ) : txns.length === 0 ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>No transactions yet.</p>
      ) : (
        <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}` }}>
          {txns.map((t, idx) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 15px', borderBottom: idx === txns.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{t.companies?.business_name || 'Unknown company'}</p>
                <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '1px' }}>{t.customer_name || 'Unknown customer'} · {t.ticket_code || '—'} · {new Date(t.created_at).toLocaleDateString()}</p>
              </div>
              <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.text }}>₦{Number(t.amount_paid || 0).toLocaleString()}</p>
                <p style={{ fontSize: '10px', color: COLORS.green }}>+₦{Number(t.commission_amount || 0).toLocaleString()} fee</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {txns.length === PAGE_SIZE && (
        <p style={{ fontSize: '11px', color: COLORS.textMuted, textAlign: 'center' as const, marginTop: '12px' }}>Showing most recent {PAGE_SIZE}.</p>
      )}
    </div>
  )
}
