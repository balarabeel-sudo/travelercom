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
    body: `Welcome to Traveler.com.\n\nThese Customer Terms & Conditions govern your access to and use of Traveler.com as a customer booking travel and hospitality services through our platform.\n\nBy creating a customer account or using Traveler.com, you confirm that you have read, understood, and agree to these Terms & Conditions.`,
  },
  {
    title: '2. About Traveler.com',
    body: `Traveler.com is a travel technology platform operated by RB GLOBAL, designed to help customers discover, book, and manage hotels, flights, buses, trains, tours, and event centers conveniently in one place.\n\nTraveler.com acts as a booking platform connecting customers with travel and service providers.`,
  },
  {
    title: '3. Eligibility',
    body: `To use Traveler.com as a customer, you must be able to form a legally binding contract under applicable law.\n\nBy registering, you confirm that the information you provide is accurate and that you are using the platform for lawful, personal travel purposes.`,
  },
  {
    title: '4. User Accounts',
    body: `You are responsible for:\n• Providing accurate registration information.\n• Keeping your login credentials secure.\n• All activity that occurs under your account.\n\nNotify us immediately if you suspect unauthorized access to your account.`,
  },
  {
    title: '5. Booking Services',
    body: `Traveler.com allows you to search, compare, and book hotels, flights, buses, trains, tours, and event centers.\n\nAvailability, pricing, and descriptions are provided by the service providers and displayed on the platform in real time where possible.`,
  },
  {
    title: '6. Payments',
    body: `Payments for bookings are made through your Traveler Wallet or other supported payment methods within the app.\n\nYou agree to ensure sufficient funds are available before confirming a booking. Traveler.com may hold funds until booking conditions are satisfied.`,
  },
  {
    title: '7. Booking Confirmation',
    body: `A booking is considered confirmed only after successful payment and system confirmation.\n\nUpon confirmation, you will receive a ticket code and/or digital ticket, which serves as proof of your booking.`,
  },
  {
    title: '8. Cancellation',
    body: `Bookings may be cancelled within the time window shown at the time of booking (where cancellation is available).\n\nCancellation outside this window may not be possible, depending on the service provider's policy.`,
  },
  {
    title: '9. Refunds',
    body: `Refund eligibility depends on the cancellation policy of the relevant service provider (hotel, airline, bus operator, train operator, tour operator, or event center).\n\nWhere a refund applies, it is processed to your Traveler Wallet.`,
  },
  {
    title: '10. Digital Tickets and QR Codes',
    body: `Your ticket code serves as your digital ticket and may be used for verification, check-in, or boarding, depending on the service.\n\nKeep your ticket code accessible until your booking is completed. Do not share it with people who are not part of your booking.`,
  },
  {
    title: '11. User Responsibilities',
    body: `As a customer, you agree to:\n• Provide accurate booking and personal information.\n• Arrive on time for bookings, check-ins, and departures.\n• Follow the rules of the service provider (hotel, transport operator, venue, etc.).\n• Use the platform lawfully and avoid fraudulent bookings or payments.`,
  },
  {
    title: '12. Service Provider Responsibilities',
    body: `Hotels, airlines, bus and train operators, tour operators, and event centers listed on Traveler.com are responsible for:\n• Publishing accurate pricing and availability.\n• Honoring confirmed bookings.\n• Delivering the service as described.\n\nTraveler.com works to ensure providers meet these standards but is not the direct operator of these services.`,
  },
  {
    title: '13. Third-Party Services',
    body: `Traveler.com connects you with independent third-party service providers. Traveler.com is not responsible for the direct actions, service quality, or conduct of these providers, though we take reports of issues seriously and may take action against providers who violate our standards.`,
  },
  {
    title: '14. Prohibited Activities',
    body: `As a customer, you must not:\n• Create fake accounts or bookings.\n• Attempt unauthorized access to the platform.\n• Abuse or harass service providers or other users.\n• Manipulate prices, reviews, or booking data.\n• Use Traveler.com for any unlawful purpose.\n\nViolations may result in account suspension or termination.`,
  },
  {
    title: '15. Account Suspension',
    body: `Traveler.com may suspend or terminate your customer account if you violate these Terms, engage in fraud, or misuse the platform in a way that threatens its security or other users.`,
  },
  {
    title: '16. Limitation of Liability',
    body: `Traveler.com provides the technology platform connecting you with travel service providers. Service quality, schedules, and delivery of the booked service remain the responsibility of the respective provider.\n\nTraveler.com is not responsible for delays, cancellations, or events beyond our reasonable control, including actions by third-party providers, natural events, or government actions.`,
  },
  {
    title: '17. Changes to These Terms',
    body: `Traveler.com may update these Customer Terms & Conditions from time to time. Continued use of the platform after an update constitutes acceptance of the revised Terms.`,
  },
  {
    title: '18. Contact Information',
    body: `Questions regarding these Customer Terms & Conditions may be submitted through Traveler.com's Help & Support section within the app.`,
  },
]

export default function CustomerTerms() {
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
          <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.purple, marginBottom: '6px' }}>Traveling with Confidence</p>
          <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.6 }}>
            These terms exist to keep your bookings safe, transparent, and reliable — so you can focus on the journey, not the paperwork.
          </p>
        </div>
      </div>
    </div>
  )
}
