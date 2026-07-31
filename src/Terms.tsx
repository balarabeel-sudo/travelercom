import { useNavigate } from 'react-router-dom'
import Icon from './Icons'

const COLORS = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  purple: '#6B21A8',
  text: '#0F172A',
  textMuted: '#64748B',
}

const SECTIONS = [
  {
    title: '1. Agreement',
    body: `Welcome to Traveler.com.\n\nThese Terms & Conditions govern your access to and use of Traveler.com and all related services operated by RB GLOBAL.\n\nBy creating an account or using Traveler.com, you confirm that you have read, understood, and agree to these Terms & Conditions.`,
  },
  {
    title: '2. Our Services',
    body: `Traveler.com provides a digital platform that connects users with travel and hospitality services, including:\n• Hotel Booking\n• Flight Booking\n• Bus Booking\n• Train Booking\n• Car Rental\n• Traveler Wallet\n• Traveler Pay\n• Traveler AI\n• Marketplace\n• Digital Payments\n• Future travel services introduced by Traveler.com\n\nTraveler.com acts as a technology platform connecting customers and service providers.`,
  },
  {
    title: '3. User Responsibilities',
    body: `Users agree to:\n• Provide accurate information.\n• Protect their account password.\n• Use the platform lawfully.\n• Respect hotels, transport operators, and other users.\n• Avoid fraudulent bookings or payments.\n\nUsers are responsible for all activities carried out using their accounts.`,
  },
  {
    title: '4. Company Responsibilities',
    body: `Hotels, airlines, transport operators, and other business partners must:\n• Publish accurate prices.\n• Keep room, seat, and service availability updated.\n• Honor confirmed bookings.\n• Provide quality customer service.\n• Comply with local laws and regulations.\n\nRepeated violations may result in suspension or permanent removal from Traveler.com.`,
  },
  {
    title: '5. Booking Confirmation',
    body: `A booking is considered confirmed only after:\n• Successful payment (where required), or\n• Confirmation by the service provider.\n\nTraveler.com may issue:\n• Booking Reference\n• QR Code\n• Digital Receipt\n• Confirmation Notification\n\nThese serve as proof of booking.`,
  },
  {
    title: '6. Check-in and Verification',
    body: `Hotels and other providers may verify customers using:\n• Booking Reference\n• QR Code\n• Government-issued ID (where required)\n\nTraveler.com reserves the right to introduce secure digital access technologies, including digital keys and other authentication methods, as the platform evolves.`,
  },
  {
    title: '7. Payments',
    body: `Payments may be completed through supported methods, including:\n• Traveler Wallet\n• Traveler Pay\n• Bank Transfer\n• Debit/Credit Cards\n• POS\n• Cash (where supported)\n\nTraveler.com may temporarily hold funds in escrow until booking conditions are satisfied.`,
  },
  {
    title: '8. Cancellations and Refunds',
    body: `Cancellation and refund eligibility depends on:\n• Hotel policy\n• Airline policy\n• Bus operator policy\n• Train operator policy\n• Car rental policy\n\nWhere applicable, refunds will be processed according to the provider's cancellation rules.`,
  },
  {
    title: '9. Traveler Wallet',
    body: `Traveler Wallet users agree to:\n• Keep account information accurate.\n• Use the wallet only for lawful transactions.\n• Protect login credentials.\n• Report suspicious activity immediately.\n\nTraveler.com may suspend wallet access where fraud or legal concerns are identified.`,
  },
  {
    title: '10. Prohibited Activities',
    body: `Users must not:\n• Create fake accounts.\n• Make fraudulent bookings.\n• Attempt unauthorized access.\n• Upload harmful software.\n• Abuse or harass other users.\n• Manipulate prices or reviews.\n• Use Traveler.com for illegal activities.\n\nViolations may result in account suspension or permanent termination.`,
  },
  {
    title: '11. Intellectual Property',
    body: `All Traveler.com content, including:\n• Logo\n• Brand identity\n• Software\n• Design\n• Graphics\n• Icons\n• Technology\n• AI systems\n• Documentation\n\nremain the intellectual property of RB GLOBAL unless otherwise stated.\n\nUnauthorized copying or commercial use is prohibited.`,
  },
  {
    title: '12. Limitation of Liability',
    body: `Traveler.com provides the technology platform connecting travelers and service providers.\n\nService quality, transportation schedules, accommodation standards, and operational delivery remain the responsibility of the respective providers.\n\nTraveler.com is not responsible for delays, cancellations, natural disasters, government actions, or events beyond reasonable control.`,
  },
  {
    title: '13. Account Suspension',
    body: `Traveler.com may suspend or terminate accounts that:\n• Violate these Terms.\n• Engage in fraud.\n• Threaten platform security.\n• Misuse services.`,
  },
  {
    title: '14. Changes to These Terms',
    body: `Traveler.com may update these Terms & Conditions from time to time.\n\nContinued use of the platform after updates constitutes acceptance of the revised Terms.`,
  },
  {
    title: '15. Governing Law',
    body: `These Terms shall be governed by the applicable laws and regulations of the jurisdictions in which Traveler.com operates, while respecting international business and consumer protection standards where applicable.`,
  },
  {
    title: '16. Contact',
    body: `Questions regarding these Terms & Conditions may be submitted through the official Traveler.com support channels.`,
  },
]

export default function Terms() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px',
        background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Terms & Conditions</h1>
      </div>

      <div style={{ padding: '16px' }}>
        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '16px' }}>Effective Date: July 31, 2026</p>

        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '18px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          {SECTIONS.map((s, i) => (
            <div key={s.title} style={{ marginBottom: i < SECTIONS.length - 1 ? '20px' : 0 }}>
              <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.purple, marginBottom: '8px' }}>{s.title}</p>
              <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{s.body}</p>
            </div>
          ))}
        </div>

        <div style={{ background: '#F5F3FF', borderRadius: '16px', padding: '18px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.purple, marginBottom: '6px' }}>Our Mission</p>
          <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.6 }}>
            Traveler.com exists to make travel simple, secure, transparent, and accessible for everyone. Our goal is to connect travelers with trusted travel services through technology, innovation, and reliable digital experiences across the world.
          </p>
        </div>
      </div>
    </div>
  )
}
