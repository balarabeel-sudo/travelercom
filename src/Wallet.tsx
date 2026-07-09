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

declare global {
  interface Window {
    PaystackPop: any
  }
}

type Transaction = {
  id: string
  transaction_type: string
  amount: number
  status: string
  created_at: string
}

function Wallet() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')

  const [amount, setAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadWallet = async (uid: string) => {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', uid)
      .maybeSingle()

    setBalance(wallet ? Number(wallet.balance) : 0)

    const { data: txs } = await supabase
      .from('transactions')
      .select('id, transaction_type, amount, status, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(20)

    setTransactions(txs || [])
  }

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        navigate('/login')
        return
      }
      setUserId(data.user.id)
      setUserEmail(data.user.email || '')
      await loadWallet(data.user.id)
      setLoading(false)
    }
    load()
  }, [navigate])

  const verifyPayment = async (reference: string) => {
    setProcessing(true)
    setMessage(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    const { data, error } = await supabase.functions.invoke('verify-paystack-payment', {
      body: { reference },
      headers: { Authorization: `Bearer ${token}` },
    })

    setProcessing(false)

    if (error || data?.error) {
      setMessage({ type: 'error', text: data?.error || 'Payment verification failed. Please contact support.' })
      return
    }

    setMessage({ type: 'success', text: 'Wallet topped up successfully!' })
    setAmount('')
    await loadWallet(userId)
  }

  const handleTopUp = () => {
    setMessage(null)
    const amt = parseFloat(amount)
    if (!amt || amt < 100) {
      setMessage({ type: 'error', text: 'Please enter a valid amount (minimum ₦100).' })
      return
    }

    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY

    if (!publicKey) {
      setMessage({ type: 'error', text: 'Payment setup is incomplete. Please try again later.' })
      return
    }

    const handler = window.PaystackPop.setup({
      key: publicKey,
      email: userEmail,
      amount: Math.round(amt * 100),
      currency: 'NGN',
      ref: 'TRV-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
      metadata: { user_id: userId },
      callback: (response: any) => {
        verifyPayment(response.reference)
      },
      onClose: () => {},
    })
    handler.openIframe()
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted }}>
        Loading...
      </div>
    )
  }

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
        <span onClick={() => navigate('/account')} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Wallet</h1>
      </div>

      <div style={{ padding: '20px 16px' }}>

        <div style={{
          background: `linear-gradient(135deg, ${COLORS.primary}, #0369a1)`,
          borderRadius: '18px',
          padding: '24px',
          color: 'white',
          marginBottom: '20px',
          boxShadow: '0 8px 24px rgba(14,165,233,0.25)'
        }}>
          <p style={{ fontSize: '12px', opacity: 0.9, marginBottom: '6px' }}>Available Balance</p>
          <p style={{ fontSize: '30px', fontWeight: 800 }}>₦{balance.toLocaleString()}</p>
        </div>

        <div style={{
          background: COLORS.card,
          borderRadius: '14px',
          padding: '16px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
          marginBottom: '20px'
        }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '10px' }}>Top Up Wallet</p>

          {message && (
            <div style={{
              background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
              borderRadius: '8px',
              padding: '10px',
              marginBottom: '12px'
            }}>
              <p style={{ fontSize: '12px', color: message.type === 'success' ? COLORS.green : COLORS.red }}>
                {message.text}
              </p>
            </div>
          )}

          <input
            type="number"
            placeholder="Amount (₦)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '10px',
              fontSize: '15px',
              marginBottom: '12px',
              boxSizing: 'border-box'
            }}
          />
          <button
            onClick={handleTopUp}
            disabled={processing}
            style={{
              width: '100%',
              padding: '13px',
              background: processing ? '#94a3b8' : COLORS.secondary,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: processing ? 'not-allowed' : 'pointer'
            }}>
            {processing ? 'Verifying Payment...' : '💳 Top Up'}
          </button>
        </div>

        <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '10px' }}>Recent Transactions</p>
        {transactions.length === 0 ? (
          <div style={{
            background: COLORS.card,
            borderRadius: '14px',
            padding: '20px',
            textAlign: 'center',
            color: COLORS.textMuted,
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
          }}>
            <p style={{ fontSize: '13px' }}>No transactions yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {transactions.map((tx) => (
              <div key={tx.id} style={{
                background: COLORS.card,
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, textTransform: 'capitalize' as const }}>
                    {tx.transaction_type.replace('_', ' ')}
                  </p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted }}>
                    {new Date(tx.created_at).toLocaleDateString()} • {tx.status}
                  </p>
                </div>
                <p style={{
                  fontSize: '14px',
                  fontWeight: 800,
                  color: tx.transaction_type === 'topup' || tx.transaction_type === 'refund' ? COLORS.green : COLORS.red
                }}>
                  {tx.transaction_type === 'topup' || tx.transaction_type === 'refund' ? '+' : '-'}₦{Number(tx.amount).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Wallet
