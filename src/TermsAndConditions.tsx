import { useNavigate } from 'react-router-dom'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
}

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Agreement',
    body: 'By booking or paying through Traveler.com, you confirm you have read, understood and agreed to these terms.',
  },
  {
    title: '2. Booking Confirmation',
    body: 'A booking is confirmed only after it has been processed, payment has been received (where required), and Traveler.com or the provider has confirmed it. An unpaid or unconfirmed booking is not a confirmed reservation.',
  },
  {
    title: '3. Payment',
    body: 'You must provide accurate details and pay using the options provided. The total shown before payment is the amount you authorize by tapping "Pay Securely" or "Confirm & Pay".',
  },
  {
    title: '4. Payment Confirmation',
    body: 'A confirmation is issued after successful payment and booking confirmation. A failed, cancelled, reversed or pending payment does not mean your booking is confirmed.',
  },
  {
    title: '5. Cancellation',
    body: 'Traveler.com does not currently charge a separate cancellation fee. Refund eligibility depends on the service booked, the provider\u2019s terms, and whether the booking has already been used. This policy may be updated as the platform grows.',
  },
  {
    title: '6. Refunds',
    body: 'Eligible refunds are processed per the applicable booking and payment conditions. Processing time varies by payment method and circumstances. Requesting a cancellation does not automatically guarantee a refund.',
  },
  {
    title: '7. Changes to a Booking',
    body: 'Where supported, you may request changes through the app. Changes depend on availability, provider rules, and any price difference.',
  },
  {
    title: '8. Service Provider Terms',
    body: 'Some listings may carry additional provider conditions, shown during booking. You are responsible for reviewing those before you complete a booking.',
  },
  {
    title: '9. Your Information',
    body: 'You are responsible for the accuracy of the details you provide (name, contact, travel dates, etc.). Traveler.com is not responsible for issues caused by incorrect information you supplied.',
  },
  {
    title: '10. Service Availability',
    body: 'Traveler.com is a platform for discovering, booking and managing travel services. Availability, schedules and prices may change based on the provider; we make reasonable efforts to keep information accurate.',
  },
  {
    title: '11. Failed or Duplicate Payments',
    body: 'If money left your account but the payment appears to have failed, contact support with your transaction details. We will investigate before any refund or additional payment. Avoid paying again for the same booking unless instructed.',
  },
  {
    title: '12. Fraud & Unauthorized Transactions',
    body: 'We may investigate, hold, cancel or review any transaction suspected of fraud or unauthorized use, to protect customers, companies and the platform.',
  },
  {
    title: '13. Platform Changes',
    body: 'These terms may be updated as our services and platform grow. Material changes will be published with a new "Last Updated" date.',
  },
  {
    title: '14. Contact & Support',
    body: 'For questions about a booking, payment, cancellation or refund, please reach out through Traveler.com\u2019s official support channels.',
  },
]

function TermsAndConditions() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={20} color={COLORS.text} />
        </div>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Terms & Conditions</h1>
          <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Payment & Booking Terms</p>
        </div>
      </div>

      <div style={{ margin: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {SECTIONS.map((s) => (
          <div key={s.title} style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '5px' }}>{s.title}</p>
            <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.5 }}>{s.body}</p>
          </div>
        ))}
        <p style={{ fontSize: '10.5px', color: COLORS.textMuted, textAlign: 'center', marginTop: '6px' }}>
          By continuing to book or pay on Traveler.com, you agree to these terms.
        </p>
      </div>
    </div>
  )
}

export default TermsAndConditions
