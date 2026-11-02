import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import useIsDesktop from './useIsDesktop'

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

function formatNaira(n: number | null | undefined) {
  return '₦' + Number(n || 0).toLocaleString()
}

function isCreditType(type: string | null) {
  return type === 'deposit' || type === 'refund' || type === 'cashback'
}

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLE[status] || STATUS_STYLE.pending
  return (
    <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', background: style.bg, color: style.color, whiteSpace: 'nowrap' as const }}>
      {status.toUpperCase()}
    </span>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '14px 16px' }}>
      <p style={{ fontSize: '10.5px', color: COLORS.textMuted, fontWeight: 700, letterSpacing: '0.4px' }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text, marginTop: '4px' }}>{value}</p>
    </div>
  )
}

export default function AdminWallet() {
  const isDesktop = useIsDesktop()
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

  const moneyIn = txns.filter((t) => isCreditType(t.transaction_type)).reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const otherTotal = txns.filter((t) => !isCreditType(t.transaction_type)).reduce((sum, t) => sum + (Number(t.amount) || 0), 0)

  const searchBox = (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '9px', background: COLORS.card,
        border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '10px 13px',
        marginBottom: isDesktop ? 0 : '12px',
        flex: isDesktop ? 1 : undefined, maxWidth: isDesktop ? '440px' : undefined,
      }}>
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
  )

  const filterChips = (
    <div style={{ display: 'flex', gap: '7px', marginBottom: isDesktop ? 0 : '14px', overflowX: 'auto' as const }}>
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
  )

  const cellBase = { padding: '13px 14px', fontSize: '12.5px', color: COLORS.text, borderBottom: `1px solid ${COLORS.border}`, verticalAlign: 'middle' as const }
  const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const

  const headers: Array<{ label: string; align: 'left' | 'right' }> = [
    { label: 'USER', align: 'left' },
    { label: 'EMAIL', align: 'left' },
    { label: 'TYPE', align: 'left' },
    { label: 'DATE', align: 'left' },
    { label: 'AMOUNT', align: 'right' },
    { label: 'STATUS', align: 'left' },
  ]

  return (
    <div style={{ padding: isDesktop ? '24px 28px' : '16px', maxWidth: isDesktop ? '1400px' : undefined, margin: '0 auto' }}>
      {isDesktop && (
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text }}>Wallet Transactions</h2>
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>Recent wallet activity across all users.</p>
        </div>
      )}

      {isDesktop ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' as const }}>
          {searchBox}
          {filterChips}
        </div>
      ) : (
        <>
          {searchBox}
          {filterChips}
        </>
      )}

      {isDesktop && !loading && txns.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
          <SummaryCard label="Transactions shown" value={txns.length.toLocaleString()} />
          <SummaryCard label="Deposits, refunds, cashback (shown)" value={formatNaira(moneyIn)} />
          <SummaryCard label="Payments and other (shown)" value={formatNaira(otherTotal)} />
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>Loading transactions...</p>
      ) : txns.length === 0 ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>No transactions found.</p>
      ) : isDesktop ? (
        <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' as const }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, minWidth: '760px' }}>
              <thead>
                <tr style={{ background: COLORS.bg }}>
                  {headers.map((h) => (
                    <th
                      key={h.label}
                      style={{ textAlign: h.align, padding: '11px 14px', fontSize: '10.5px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.4px', borderBottom: `1px solid ${COLORS.border}`, whiteSpace: 'nowrap' as const }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => {
                  const status = t.status || 'pending'
                  const isCredit = isCreditType(t.transaction_type)
                  return (
                    <tr key={t.id}>
                      <td style={{ ...cellBase, maxWidth: '220px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon name={TYPE_ICON[t.transaction_type || ''] || 'wallet'} size={14} color={COLORS.text} />
                          </div>
                          <span style={{ ...ellipsis, fontWeight: 600 }}>{t.profiles?.full_name || t.profiles?.email || 'Unknown user'}</span>
                        </div>
                      </td>
                      <td style={{ ...cellBase, maxWidth: '220px', color: COLORS.textMuted }}>
                        <div style={ellipsis}>{t.profiles?.email || '—'}</div>
                      </td>
                      <td style={{ ...cellBase, textTransform: 'capitalize' as const, whiteSpace: 'nowrap' as const }}>{t.transaction_type || 'transaction'}</td>
                      <td style={{ ...cellBase, color: COLORS.textMuted, whiteSpace: 'nowrap' as const }}>{new Date(t.created_at).toLocaleString()}</td>
                      <td style={{ ...cellBase, textAlign: 'right' as const, fontWeight: 800, whiteSpace: 'nowrap' as const, color: isCredit ? COLORS.green : COLORS.text }}>
                        {isCredit ? '+' : ''}{formatNaira(t.amount)}
                      </td>
                      <td style={cellBase}><StatusPill status={status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}` }}>
          {txns.map((t, idx) => {
            const status = t.status || 'pending'
            const isCredit = isCreditType(t.transaction_type)
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
                  <p style={{ fontSize: '12.5px', fontWeight: 800, color: isCredit ? COLORS.green : COLORS.text }}>{isCredit ? '+' : ''}{formatNaira(t.amount)}</p>
                  <StatusPill status={status} />
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
