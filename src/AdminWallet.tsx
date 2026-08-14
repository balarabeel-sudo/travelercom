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

type Txn = {
  id: string
  user_id: string
  transaction_type: string | null
  amount: number
  status: string | null
  created_at: string
  profiles: { full_name: string | null; email: string | null } | null
}

const TYPE_ICON: Record<string, string> = {
  deposit: 'arrowUpRight',
  payment: 'ticket',
  refund: 'refresh',
  cashback: 'star',
  adjustment: 'wrench',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  successful: { bg: '#F0FDF4', color: COLORS.green },
  completed: { bg: '#F0FDF4', color: COLORS.green },
  pending: { bg: '#FFF7ED', color: COLORS.orange },
  failed: { bg: '#FEF2F2', color: COLORS.red },
  reversed: { bg: '#FEF2F2', color: COLORS.red },
}

const PAGE_SIZE = 30

export default function AdminWallet() {
  const [search, setSearch] = useState('')
  const [txns, setTxns] = useState<Txn[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'all' | 'deposit' | 'payment' | 'refund'>('all')

  const fetchTxns = async () => {
    setLoading(true)
    setNotFound(false)
    let query = supabase
      .from('transactions')
      .select('id, user_id, transaction_type, amount, status, created_at, profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (typeFilter !== 'all') query = query.eq('transaction_type', typeFilter)

    const { data, error } = await query
    setLoading(false)
    if (error) {
      setNotFound(true)
      return
    }
    let rows = (data as any[]) || []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter((r) => r.profiles?.full_name?.toLowerCase().includes(q) || r.profiles?.email?.toLowerCase().includes(q))
    }
    setTxns(rows)
  }

  useEffect(() => {
    fetchTxns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter])

  if (notFound) {
    return (
      <div style={{ padding: '30px 20px', textAlign: 'center' as const }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.red, marginBottom: '6px' }}>Couldn't load transactions</p>
        <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.6 }}>
          Run <code>admin_wallet_setup.sql</code> in Supabase first — it adds the admin read policy for wallets and transactions.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '10px 13px', marginBottom: '12px' }}>
        <Icon name="search" size={15} color={COLORS.textMuted} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchTxns()}
          placeholder="Filter by name or email..."
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', background: 'transparent' }}
        />
        {search && <span onClick={fetchTxns} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Filter</span>}
      </div>

      <div style={{ display: 'flex', gap: '7px', marginBottom: '14px', overflowX: 'auto' as const }}>
        {(['all', 'deposit', 'payment', 'refund'] as const).map((f) => (
          <span
            key={f}
            onClick={() => setTypeFilter(f)}
            style={{
              flexShrink: 0, padding: '7px 13px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
              background: typeFilter === f ? COLORS.primary : COLORS.card,
              color: typeFilter === f ? 'white' : COLORS.text,
              border: `1px solid ${typeFilter === f ? COLORS.primary : COLORS.border}`,
            }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </span>
        ))}
      </div>

      {loading ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>Loading transactions...</p>
      ) : txns.length === 0 ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>No transactions found.</p>
      ) : (
        <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}` }}>
          {txns.map((t, idx) => {
            const status = t.status || 'pending'
            const style = STATUS_STYLE[status] || STATUS_STYLE.pending
            const isCredit = t.transaction_type === 'deposit' || t.transaction_type === 'refund' || t.transaction_type === 'cashback'
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 15px', borderBottom: idx === txns.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={TYPE_ICON[t.transaction_type || ''] || 'wallet'} size={15} color={COLORS.text} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{t.profiles?.full_name || t.profiles?.email || 'Unknown user'}</p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '1px', textTransform: 'capitalize' as const }}>{t.transaction_type || 'transaction'} · {new Date(t.created_at).toLocaleDateString()}</p>
                </div>
                <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                  <p style={{ fontSize: '12.5px', fontWeight: 800, color: isCredit ? COLORS.green : COLORS.text }}>{isCredit ? '+' : ''}₦{Number(t.amount || 0).toLocaleString()}</p>
                  <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', background: style.bg, color: style.color }}>{status.toUpperCase()}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {txns.length === PAGE_SIZE && (
        <p style={{ fontSize: '11px', color: COLORS.textMuted, textAlign: 'center' as const, marginTop: '12px' }}>
          Showing most recent {PAGE_SIZE} — search narrows within this page only (full search coming later).
        </p>
      )}
    </div>
  )
}
