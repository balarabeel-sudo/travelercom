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
    title: '1. Introduction',
    body: `Welcome to Traveler.com.\n\nTraveler.com is a global travel technology platform owned and operated by RB GLOBAL, created to simplify travel by connecting travelers with hotels, flights, buses, trains, car rentals, travel services, digital payments, and other travel-related solutions.\n\nYour privacy is important to us. This Privacy Policy explains how we collect, use, store, protect, and share your personal information whenever you use Traveler.com.\n\nBy creating an account or using any Traveler.com service, you agree to this Privacy Policy.`,
  },
  {
    title: '2. Information We Collect',
    body: `Traveler.com may collect the following information:\n\nPersonal Information\n• Full Name\n• Phone Number\n• Email Address\n• Date of Birth (where required)\n• Nationality\n• Government Identification (when verification is required)\n\nBooking Information\n• Hotel reservations\n• Flight bookings\n• Bus tickets\n• Train tickets\n• Car rental reservations\n• Travel history\n\nPayment Information\n• Payment method\n• Wallet transactions\n• Payment status\n• Escrow records\n\nTraveler.com does not store your complete debit or credit card details.`,
  },
  {
    title: '3. Device Information',
    body: `We may collect:\n• Device model\n• Operating system\n• Browser version\n• IP address\n• Approximate location\n• App version\n• Login activity\n\nThis information helps improve security and platform performance.`,
  },
  {
    title: '4. How We Use Your Information',
    body: `Traveler.com uses your information to:\n• Process bookings\n• Verify your identity\n• Prevent fraud\n• Improve customer support\n• Process payments\n• Send booking confirmations\n• Generate receipts\n• Improve our AI travel services\n• Recommend hotels, flights, and transportation\n• Improve platform performance`,
  },
  {
    title: '5. Traveler Wallet',
    body: `If you use Traveler Wallet, we may store:\n• Wallet balance\n• Transaction history\n• Currency conversions\n• Withdrawal records\n• Escrow information\n\nAll financial records are protected using modern encryption technologies.`,
  },
  {
    title: '6. Traveler AI',
    body: `Traveler AI may analyze your travel preferences to provide:\n• Personalized travel suggestions\n• Destination recommendations\n• Hotel recommendations\n• Flight recommendations\n• Safety information\n• Local travel guidance\n\nTraveler AI never sells your personal conversations.`,
  },
  {
    title: '7. Information Sharing',
    body: `Traveler.com only shares information when necessary with:\n• Hotels\n• Airlines\n• Bus companies\n• Train operators\n• Car rental companies\n• Payment providers\n• Government authorities when legally required\n\nWe never sell your personal information to advertisers.`,
  },
  {
    title: '8. Data Security',
    body: `Traveler.com uses industry-standard security measures including:\n• Encryption\n• Secure authentication\n• Protected databases\n• Access control\n• Fraud detection systems\n• Activity monitoring\n\nWhile we work hard to protect your information, no online service can guarantee 100% security.`,
  },
  {
    title: '9. Cookies',
    body: `Traveler.com uses cookies and similar technologies to:\n• Keep you signed in\n• Improve performance\n• Remember preferences\n• Enhance user experience\n\nYou may disable cookies through your browser settings, although some features may not work correctly.`,
  },
  {
    title: '10. Your Rights',
    body: `Depending on your location, you may have the right to:\n• Access your personal data\n• Correct inaccurate information\n• Delete your account\n• Request a copy of your data\n• Withdraw certain permissions where applicable\n\nSome information may be retained where required by law.`,
  },
  {
    title: "11. Children's Privacy",
    body: `Traveler.com is not intended for children under the age required by applicable law without parental or guardian consent.`,
  },
  {
    title: '12. International Services',
    body: `Traveler.com may operate across multiple countries.\n\nYour information may be processed in different jurisdictions while maintaining appropriate security and privacy safeguards.`,
  },
  {
    title: '13. Policy Updates',
    body: `We may update this Privacy Policy from time to time.\n\nWhen significant changes are made, users will be notified through the app, website, or email where appropriate.`,
  },
  {
    title: '14. Contact Us',
    body: `For privacy-related questions, data requests, or concerns, please contact Traveler.com Support through the official support channels available within the platform.`,
  },
]

export default function PrivacyPolicy() {
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
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Privacy Policy</h1>
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
          <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.purple, marginBottom: '6px' }}>Our Commitment</p>
          <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.6 }}>
            Traveler.com was created with one mission: to make travel safer, easier, faster, and more accessible for everyone, while respecting every user's privacy and protecting personal information with transparency and responsibility.
          </p>
        </div>
      </div>
    </div>
  )
}
