import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import NotificationBell from './NotificationBell'
import Icon from './Icons'

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
  const [loadError, setLoadError] = useState('')

  const [accountType, setAccountType] = useState<'personal' | 'company'>('personal')
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')

  const [companyId, setCompanyId] = useState('')
  const [pendingEscrow, setPendingEscrow] = useState(0)
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [totalWithdrawn, setTotalWithdrawn] = useState(0)
  const [bankName, setBankName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawMsg, setWithdrawMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [amount, setAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [balanceHidden, setBalanceHidden] = useState(false)

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

  const loadCompanyExtras = async (uid: string) => {
    const { data: company } = await supabase
      .from('companies')
      .select('id, bank_name, bank_account_number, bank_account_name')
      .eq('owner_id', uid)
      .maybeSingle()

    if (!company) return

    setCompanyId(company.id)
    setBankName(company.bank_name || '')
    setBankAccountNumber(company.bank_account_number || '')
    setBankAccountName(company.bank_account_name || '')

    const { data: pendingBookings } = await supabase
      .from('bookings')
      .select('amount_paid, services(commission_rate)')
      .eq('company_id', company.id)
      .eq('checked_in', false)
      .eq('booking_status', 'confirmed')

    const pending = (pendingBookings || []).reduce((sum: number, b: any) => {
      const rate = Number(b.services?.commission_rate ?? 3)
      const netAmount = Number(b.amount_paid) * (1 - rate / 100)
      return sum + netAmount
    }, 0)
    setPendingEscrow(pending)

    const { data: earningsTx } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', uid)
      .eq('transaction_type', 'commission_payout')
      .eq('status', 'successful')

    setTotalEarnings((earningsTx || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0))

    const { data: withdrawnTx } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', uid)
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'successful')

    setTotalWithdrawn((withdrawnTx || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0))
  }

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error || !data.user) {
          navigate('/login')
          return
        }
        setUserId(data.user.id)
        setUserEmail(data.user.email || '')

        const isCompany = data.user.user_metadata?.account_type === 'company'
        setAccountType(isCompany ? 'company' : 'personal')

        await loadWallet(data.user.id)
        if (isCompany) {
          await loadCompanyExtras(data.user.id)
        }
        setLoading(false)
      } catch (err) {
        setLoading(false)
        setLoadError('DEBUG load error: ' + String(err))
      }
    }
    load()
  }, [navigate])

  const verifyPayment = async (reference: string) => {
    setProcessing(true)
    setMessage(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    const { data, error } = await supabase.functions.invoke('smooth-task', {
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

  const handleWithdrawRequest = async () => {
    setWithdrawMsg(null)
    const amt = parseFloat(withdrawAmount)

    if (!amt || amt < 500) {
      setWithdrawMsg({ type: 'error', text: 'Please enter a valid amount (minimum ₦500).' })
      return
    }
    if (amt > balance) {
      setWithdrawMsg({ type: 'error', text: 'Insufficient available balance.' })
      return
    }
    if (!bankName.trim() || !bankAccountNumber.trim() || !bankAccountName.trim()) {
      setWithdrawMsg({ type: 'error', text: 'Please fill in all bank details.' })
      return
    }

    setWithdrawing(true)

    await supabase
      .from('companies')
      .update({
        bank_name: bankName.trim(),
        bank_account_number: bankAccountNumber.trim(),
        bank_account_name: bankAccountName.trim(),
      })
      .eq('id', companyId)

    const newBalance = balance - amt
    const { error: walletErr } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', userId)

    if (walletErr) {
      setWithdrawing(false)
      setWithdrawMsg({ type: 'error', text: 'Withdrawal failed: ' + walletErr.message })
      return
    }

    const { data: walletRow } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    await supabase.from('transactions').insert({
      user_id: userId,
      wallet_id: walletRow?.id,
      transaction_type: 'withdrawal',
      amount: amt,
      status: 'pending',
    })

    setWithdrawing(false)
    setBalance(newBalance)
    setWithdrawAmount('')
    setShowWithdraw(false)
    setWithdrawMsg({ type: 'success', text: 'Withdrawal request submitted! Funds will be sent to your bank within 24–48 hours.' })
    await loadWallet(userId)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted }}>
        Loading...
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
        <div>
          <p style={{ color: COLORS.red, fontSize: '13px', marginBottom: '12px', wordBreak: 'break-word' as const }}>{loadError}</p>
          <button onClick={() => navigate('/account')} style={{ padding: '10px 20px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '10px' }}>
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: COLORS.card,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            onClick={() => navigate(accountType === 'company' ? '/home' : '/account')}
            style={{
              width: '36px', height: '36px', borderRadius: '50%', background: '#0B1E3D',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', cursor: 'pointer', flexShrink: 0,
            }}>
            <Icon name="arrowLeft" size={16} color="white" />
          </span>
          <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Wallet</h1>
        </div>
        <NotificationBell iconColor={COLORS.text} />
      </div>

      <div style={{ padding: '20px 16px' }}>

        {accountType === 'company' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <MiniCard label="Available Balance" value={balance} highlight />
              <MiniCard label="Pending (Escrow)" value={pendingEscrow} />
              <MiniCard label="Total Earnings" value={totalEarnings} />
              <MiniCard label="Total Withdrawn" value={totalWithdrawn} />
            </div>

            <button
              onClick={() => { setShowWithdraw(!showWithdraw); setWithdrawMsg(null) }}
              style={{
                width: '100%',
                padding: '13px',
                background: COLORS.secondary,
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer',
                marginBottom: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              }}>
              <Icon name="cash" size={16} color="white" /> {showWithdraw ? 'Cancel' : 'Withdraw Funds'}
            </button>

            {withdrawMsg && !showWithdraw && (
              <div style={{
                background: withdrawMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${withdrawMsg.type === 'success' ? '#86efac' : '#fca5a5'}`,
                borderRadius: '10px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <p style={{ fontSize: '12.5px', color: withdrawMsg.type === 'success' ? COLORS.green : COLORS.red }}>{withdrawMsg.text}</p>
              </div>
            )}

            {showWithdraw && (
              <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '10px' }}>Bank Details</p>

                {withdrawMsg && (
                  <p style={{ fontSize: '12px', color: COLORS.red, marginBottom: '10px' }}>{withdrawMsg.text}</p>
                )}

                <input type="text" placeholder="Bank Name" value={bankName} onChange={(e) => setBankName(e.target.value)} style={inputStyle} />
                <input type="text" placeholder="Account Number" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} style={{ ...inputStyle, marginTop: '10px' }} />
                <input type="text" placeholder="Account Name" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} style={{ ...inputStyle, marginTop: '10px' }} />
                <input type="number" placeholder="Amount to withdraw (₦)" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} style={{ ...inputStyle, marginTop: '10px' }} />

                <button
                  onClick={handleWithdrawRequest}
                  disabled={withdrawing}
                  style={{
                    width: '100%',
                    marginTop: '12px',
                    padding: '12px',
                    background: withdrawing ? '#94a3b8' : COLORS.green,
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    cursor: withdrawing ? 'not-allowed' : 'pointer'
                  }}>
                  {withdrawing ? 'Submitting...' : 'Submit Withdrawal Request'}
                </button>
                <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '8px' }}>
                  Withdrawals are processed manually within 24–48 hours.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{
              background: 'linear-gradient(135deg, #0B1E3D, #14294f)',
              borderRadius: '20px',
              padding: '24px',
              color: 'white',
              marginBottom: '20px',
              boxShadow: '0 8px 24px rgba(11,30,61,0.35)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: '-6px', right: '-6px', opacity: 0.1 }}>
                <Icon name="compass" size={110} color="white" strokeWidth={1} />
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <p style={{ fontSize: '12px', opacity: 0.85 }}>Available Balance</p>
                  <span onClick={() => setBalanceHidden(!balanceHidden)} style={{ cursor: 'pointer', display: 'flex', opacity: 0.85 }}>
                    <Icon name={balanceHidden ? 'eyeOff' : 'eye'} size={14} color="white" />
                  </span>
                </div>
                <p style={{ fontSize: '30px', fontWeight: 800 }}>{balanceHidden ? '₦••••••' : `₦${balance.toLocaleString()}`}</p>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px',
                  background: 'rgba(255,255,255,0.12)', padding: '6px 12px', borderRadius: '20px',
                  fontSize: '11.5px', fontWeight: 600,
                }}>
                  <Icon name="shield" size={13} color="white" /> Traveler.com Wallet
                </div>
              </div>
              <svg viewBox="0 0 400 30" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: '-1px', width: '100%', height: '22px' }}>
                <path d="M0,30 Q200,-6 400,30 L400,30 L0,30 Z" fill={COLORS.secondary} opacity="0.9" />
              </svg>
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
                  <p style={{ fontSize: '12px', color: message.type === 'success' ? COLORS.green : COLORS.red }}>{message.text}</p>
                </div>
              )}

              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '6px' }}>Enter amount</p>
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={inputStyle}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginTop: '10px' }}>
                {[1000, 5000, 10000, 20000].map((preset) => (
                  <span
                    key={preset}
                    onClick={() => setAmount(String(preset))}
                    style={{
                      textAlign: 'center' as const, padding: '9px 4px', borderRadius: '10px',
                      border: `1px solid ${amount === String(preset) ? COLORS.primary : COLORS.border}`,
                      color: amount === String(preset) ? COLORS.primary : COLORS.text,
                      fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    }}>
                    ₦{preset.toLocaleString()}
                  </span>
                ))}
              </div>
              <button
                onClick={handleTopUp}
                disabled={processing}
                style={{
                  width: '100%',
                  marginTop: '14px',
                  padding: '13px',
                  background: processing ? '#94a3b8' : COLORS.secondary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                }}>
                {processing ? 'Verifying Payment...' : (<><Icon name="creditCard" size={15} color="white" /> Top Up Wallet</>)}
              </button>
              <p style={{ fontSize: '11px', color: COLORS.textMuted, textAlign: 'center' as const, marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <Icon name="lock" size={11} color={COLORS.textMuted} /> Your wallet is secure and protected
              </p>
            </div>
          </>
        )}

        <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '10px' }}>Transaction History</p>
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
            {transactions.map((tx) => {
              const isCredit = tx.transaction_type === 'topup' || tx.transaction_type === 'refund' || tx.transaction_type === 'commission_payout'
              const statusColor = tx.status === 'successful' ? { bg: '#dcfce7', fg: COLORS.green }
                : tx.status === 'pending' ? { bg: '#fef3c7', fg: '#b45309' }
                : { bg: '#fee2e2', fg: COLORS.red }
              return (
                <div key={tx.id} style={{
                  background: COLORS.card,
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                    background: isCredit ? '#dcfce7' : '#fff1e6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
                  }}>
                    <Icon name={isCredit ? 'plus' : 'minus'} size={16} color={isCredit ? COLORS.green : COLORS.secondary} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, textTransform: 'capitalize' as const }}>
                      {tx.transaction_type.replace('_', ' ')}
                    </p>
                    <p style={{ fontSize: '11px', color: COLORS.textMuted }}>
                      {new Date(tx.created_at).toLocaleDateString()} • {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                    <p style={{ fontSize: '14px', fontWeight: 800, color: isCredit ? COLORS.green : COLORS.red }}>
                      {isCredit ? '+' : '-'}₦{Number(tx.amount || 0).toLocaleString()}
                    </p>
                    <span style={{
                      display: 'inline-block', marginTop: '4px', padding: '2px 9px', borderRadius: '10px',
                      fontSize: '10px', fontWeight: 700, textTransform: 'capitalize' as const,
                      background: statusColor.bg, color: statusColor.fg,
                    }}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function MiniCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? `linear-gradient(135deg, ${COLORS.primary}, #0369a1)` : COLORS.card,
      borderRadius: '14px',
      padding: '14px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
    }}>
      <p style={{ fontSize: '11px', color: highlight ? 'rgba(255,255,255,0.85)' : COLORS.textMuted, marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '17px', fontWeight: 800, color: highlight ? 'white' : COLORS.text }}>
        ₦{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </p>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '12px',
  border: `1px solid ${COLORS.border}`,
  borderRadius: '10px',
  fontSize: '14px',
  boxSizing: 'border-box' as const,
}

export default Wallet
