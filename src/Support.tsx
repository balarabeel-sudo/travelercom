import { useEffect, useState } from 'react'
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
}

const SUPPORT_EMAIL = 'travelercom12@gmail.com'

const FAQS = [
  {
    q: 'How do I get my company approved on TravelerCom?',
    a: 'After signing up as a company, upload your CAC document from the "Upload CAC" prompt on your dashboard. Our team reviews it manually — you\'ll see your status change to "Approved" once verified.',
  },
  {
    q: 'How does the Escrow payment system work?',
    a: 'When a customer books, the payment is deducted from their wallet and held in escrow. Once you confirm the customer\'s check-in using their ticket code, the funds (minus commission) are released to your company wallet.',
  },
  {
    q: 'What are the commission rates?',
    a: '5% commission applies to Bus and Train bookings. Hotel, Flight, Tour, and Event Center bookings carry a 3% commission. Commission is automatically deducted when funds are released from escrow.',
  },
  {
    q: 'How do wallet withdrawals work?',
    a: 'From your Wallet page, submit a withdrawal request. Your request will show as "Pending" until processed by our team. You\'ll be able to track the status directly from your Wallet page.',
  },
  {
    q: 'What is Business Suite and what do I get with it?',
    a: 'Business Suite is our premium plan for companies. It unlocks Inventory management (room/seat tracking with real-time availability), Analytics, Promotions, Add Guest (offline bookings), and priority support.',
  },
  {
    q: 'How do I set up Inventory (Room/Seat Types)?',
    a: 'Go to Inventory from your Quick Actions, tap the + button to create a Room/Seat Type with a total quantity and price. The app automatically generates individual unit numbers you can track, reserve, or mark under maintenance.',
  },
  {
    q: 'How do I create a Promotion?',
    a: 'Go to Promotions, tap Create, choose a listing, set a discount (percentage or fixed amount), and an optional date range. Active promotions automatically show a discount badge to customers on that listing.',
  },
  {
    q: 'How do I record a walk-in (offline) guest booking?',
    a: 'Use Add Guest from your Quick Actions. Select the listing and room/seat type, enter the guest\'s details, choose a payment method (Cash, Transfer, or POS), and save — it will appear in your booking history alongside online bookings.',
  },
]

export default function Support() {
  const navigate = useNavigate()
  const [companyPlan, setCompanyPlan] = useState<'free' | 'business_suite'>('free')
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return
      const { data: company } = await supabase
        .from('companies')
        .select('plan')
        .eq('owner_id', userData.user.id)
        .maybeSingle()
      if (company) setCompanyPlan(company.plan || 'free')
    }
    load()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Help & Support</h1>
      </div>

      <div style={{ padding: '16px' }}>

        <div style={{ background: `linear-gradient(135deg, ${COLORS.purple}, #4C1D95)`, borderRadius: '18px', padding: '20px', color: 'white', marginBottom: '18px' }}>
          {companyPlan === 'business_suite' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F59E0B', color: '#2E1065', fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '7px', marginBottom: '10px' }}>
              <Icon name="crown" size={11} color="#2E1065" /> PRIORITY SUPPORT
            </span>
          )}
          <p style={{ fontSize: '15px', fontWeight: 800, marginBottom: '6px' }}>
            {companyPlan === 'business_suite' ? "You're on our priority queue" : "We're here to help"}
          </p>
          <p style={{ fontSize: '12px', color: '#DDD6FE', marginBottom: '16px', lineHeight: 1.5 }}>
            {companyPlan === 'business_suite'
              ? 'As a Business Suite member, your emails are handled with priority by our team.'
              : 'Reach out anytime — our team typically responds within 24-48 hours.'}
          </p>
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ textDecoration: 'none' }}>
            <div style={{ background: 'white', color: COLORS.purple, textAlign: 'center', padding: '12px', borderRadius: '12px', fontWeight: 800, fontSize: '13.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Icon name="fileText" size={16} color={COLORS.purple} /> {SUPPORT_EMAIL}
            </div>
          </a>
        </div>

        <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>Frequently Asked Questions</p>

        <div style={{ background: COLORS.card, borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {FAQS.map((f, i) => (
            <div key={f.q} style={{ borderBottom: i < FAQS.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
              <div
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '15px 16px', cursor: 'pointer' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, flex: 1 }}>{f.q}</p>
                <Icon name={openIndex === i ? 'minus' : 'plus'} size={15} color={COLORS.purple} />
              </div>
              {openIndex === i && (
                <p style={{ fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.6, padding: '0 16px 16px' }}>{f.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
