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
    body: `Welcome to Traveler.com.\n\nThese Company Terms & Conditions govern your access to and use of Traveler.com as a company, agency, or independent provider ("Provider") listing travel and hospitality services on our platform.\n\nBy creating a company account or using Traveler.com as a Provider, you confirm that you have read, understood, and agree to these Terms & Conditions.`,
  },
  {
    title: '2. About Traveler.com',
    body: `Traveler.com is a travel technology platform operated by RB GLOBAL that connects Providers — hotels, airlines, bus and train operators, tour operators, event centers, and vehicle rental companies — with customers looking to book their services.\n\nTraveler.com acts as a booking and payment platform. It does not itself operate hotels, vehicles, or transport services.`,
  },
  {
    title: '3. Eligibility & Verification',
    body: `To list on Traveler.com, your business must provide accurate registration details, including business name, address, and, where applicable, CAC registration and license information.\n\nTraveler.com reviews and approves company accounts before listings go live. We may request additional documents for verification and may decline or suspend an account where information cannot be verified.`,
  },
  {
    title: '4. Company Account & Staff',
    body: `You are responsible for:\n• Keeping your company account information accurate and up to date.\n• Managing staff access and permissions granted within your account.\n• All actions taken by staff members you have added to your account.\n\nNotify us immediately if you suspect unauthorized access to your company account.`,
  },
  {
    title: '5. Listing Accuracy',
    body: `You must ensure that everything you publish about your listings — including prices, photos, descriptions, and amenities/features (e.g. AC, Wi-Fi, parking, meals) — accurately reflects what you actually offer.\n\nDo not advertise a feature or amenity that is not genuinely available. Misleading listings may be edited, suspended, or removed, and repeated violations may lead to account suspension.`,
  },
  {
    title: '6. Availability & Pricing',
    body: `You are responsible for keeping room, seat, unit, and service availability updated on Traveler.com. Overbooking or accepting a booking you cannot honor may result in penalties or account review.\n\nPrices shown to customers must match what you intend to charge; hidden or undisclosed mandatory charges are not permitted.`,
  },
  {
    title: '7. Booking Commitments',
    body: `Once a customer's booking is confirmed through Traveler.com, you are expected to honor it as described. If you must cancel a confirmed booking due to unavailability or an operational issue, notify Traveler.com and the customer as early as possible.`,
  },
  {
    title: '8. Commission & Fees',
    body: `Traveler.com charges a commission on bookings completed through the platform. Current commission rates are shown in your company dashboard and may vary by service category.\n\nCommission is deducted automatically from the booking amount; the remaining balance is what is due to you as the Provider.`,
  },
  {
    title: '9. Payments & Payouts',
    body: `Customer payments for bookings made through Traveler.com are held securely until the applicable booking condition is met (for example, check-in or service completion), after which your share becomes available for withdrawal, less Traveler.com's commission.\n\nWithdrawal requests are reviewed and processed by Traveler.com. Processing times may vary.`,
  },
  {
    title: '10. Cancellations & Refunds',
    body: `Where a customer is entitled to a refund under Traveler.com's booking and refund policies, the refunded amount is returned to the customer through the platform's existing payment system.\n\nAs a Provider, you agree to cooperate with Traveler.com in resolving cancellation and refund requests fairly and in a timely manner.`,
  },
  {
    title: '11. Business Suite & Premium Plans',
    body: `Providers may have access to optional plans (such as Business Suite) offering features like detailed inventory management. Plan features, limits, and eligibility are set out within the app and may change as Traveler.com develops.`,
  },
  {
    title: '12. Reviews & Ratings',
    body: `Customer reviews and ratings on Traveler.com must reflect genuine experiences. Providers must not create fake reviews, pay for reviews, or attempt to manipulate ratings in any way. Providers may report reviews they believe are abusive or fraudulent for investigation.`,
  },
  {
    title: '13. Prohibited Activities',
    body: `As a Provider, you must not:\n• Create fake listings, bookings, or accounts.\n• Misrepresent your services, pricing, or availability.\n• Attempt unauthorized access to the platform or other accounts.\n• Manipulate prices, reviews, or booking data.\n• Use Traveler.com for any unlawful purpose.\n\nViolations may result in listing removal, account suspension, or permanent termination.`,
  },
  {
    title: '14. Compliance with Local Laws',
    body: `You are responsible for ensuring your business complies with all applicable local laws and regulations governing your sector (for example, hospitality, transport, or tourism regulations) in the areas where you operate.`,
  },
  {
    title: '15. Suspension & Termination',
    body: `Traveler.com may suspend or remove a company account or listing that violates these Terms, repeatedly fails to honor bookings, receives credible fraud reports, or otherwise misuses the platform.`,
  },
  {
    title: '16. Limitation of Liability',
    body: `Traveler.com provides the technology platform connecting you with customers. You, as the Provider, remain responsible for the actual delivery, quality, and safety of the service booked.\n\nTraveler.com is not responsible for losses arising from circumstances beyond its reasonable control, including natural events or government actions.`,
  },
  {
    title: '17. Changes to These Terms',
    body: `Traveler.com may update these Company Terms & Conditions from time to time. Continued use of the platform as a Provider after an update constitutes acceptance of the revised Terms.`,
  },
  {
    title: '18. Contact Information',
    body: `Questions regarding these Company Terms & Conditions may be submitted through Traveler.com's official support channels.`,
  },
]

export default function CompanyTerms() {
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
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>Company Terms & Conditions</h1>
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
          <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.purple, marginBottom: '6px' }}>Growing Together</p>
          <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.6 }}>
            Traveler.com exists to help businesses like yours reach more travelers — through a platform built on transparency, fair commissions, and reliable technology.
          </p>
        </div>
      </div>
    </div>
  )
}
