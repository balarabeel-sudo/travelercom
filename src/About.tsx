import { useNavigate } from 'react-router-dom'
import Icon from './Icons'

const COLORS = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  purple: '#6B21A8',
  primary: '#0EA5E9',
  green: '#16A34A',
  text: '#0F172A',
  textMuted: '#64748B',
}

const VALUES = [
  { title: 'Trust', text: 'Every verified business, booking, payment, and transaction is designed to protect both travelers and business partners.' },
  { title: 'Innovation', text: 'We continuously develop modern technologies that improve travel experiences worldwide.' },
  { title: 'Simplicity', text: 'Technology should make life easier — not more complicated. Every screen, feature, and service is built with simplicity in mind.' },
  { title: 'Transparency', text: 'We believe pricing, policies, commissions, and transactions should always be clear and honest.' },
  { title: 'Security', text: 'We invest in modern technologies to help protect customer information, digital payments, and business operations.' },
]

const ECOSYSTEM = ['Traveler Hotels', 'Traveler Flights', 'Traveler Pay', 'Traveler Wallet', 'Traveler AI', 'Traveler Marketplace', 'Traveler APIs']

const RB_TRAVEL = ['Traveler.com', 'Travel Pay', 'Traveler Hotel', 'Traveler Airline', 'Traveler Market', 'Traveler Bus']
const RB_FARM = ['Farmlite', 'Skyspace', 'Farmcenter', 'Farmchem', 'Farmfinance', 'Farm Machinery']

export default function About() {
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
        <h1 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>About Traveler.com</h1>
      </div>

      <div style={{ padding: '16px' }}>

        <div style={{ background: `linear-gradient(135deg, ${COLORS.purple}, #4C1D95)`, borderRadius: '18px', padding: '22px', color: 'white', marginBottom: '18px' }}>
          <p style={{ fontSize: '19px', fontWeight: 800, marginBottom: '8px' }}>Welcome to Traveler.com</p>
          <p style={{ fontSize: '12.5px', color: '#DDD6FE', lineHeight: 1.6 }}>
            Traveler.com is more than a booking platform. It is a technology company building a smarter, safer, and more connected travel ecosystem for individuals, businesses, and governments.
          </p>
        </div>

        <Card title="Our Vision">
          To become the world's most trusted travel ecosystem, connecting millions of travelers with verified transportation, accommodation, financial services, and travel technology through one intelligent platform. We envision a future where traveling across cities and countries becomes as simple as sending a message.
        </Card>

        <Card title="Our Mission">
          Traveler.com exists to simplify every stage of a person's journey — secure hotel booking, flight reservations, bus and train tickets, car rentals, digital travel payments, currency solutions, AI travel assistance, and business management tools. Our goal is to help people travel with confidence while helping businesses grow through modern digital infrastructure.
        </Card>

        <Card title="What Makes Us Different?">
          Traveler.com is not just another booking website. We are building a complete travel ecosystem where every service works together, so a traveler never needs multiple applications to complete one journey.
        </Card>

        <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>Our Core Values</p>
        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '18px', marginBottom: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          {VALUES.map((v, i) => (
            <div key={v.title} style={{ marginBottom: i < VALUES.length - 1 ? '14px' : 0 }}>
              <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.purple, marginBottom: '4px' }}>{v.title}</p>
              <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.6 }}>{v.text}</p>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>Building the Future of Travel</p>
        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '18px', marginBottom: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.6, marginBottom: '12px' }}>
            Our long-term ecosystem includes services designed to work together, giving travelers one seamless experience across every stage of their journey:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {ECOSYSTEM.map((e) => (
              <span key={e} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.primary, background: '#EFF6FF', padding: '6px 12px', borderRadius: '8px' }}>{e}</span>
            ))}
          </div>
        </div>

        <Card title="Supporting Businesses">
          Hotels, transport operators, travel agencies, tour companies, rental companies, and other travel businesses use Traveler.com to reach more customers, manage bookings, receive secure payments, track revenue, access analytics, and grow digitally.
        </Card>

        <Card title="Global Ambition">
          Traveler.com begins with Africa, but our vision reaches far beyond one region. Our ambition is to become a globally recognized travel technology company that serves travelers and businesses across continents while maintaining world-class standards.
        </Card>

        <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>Part of RB GLOBAL</p>
        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '18px', marginBottom: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.6, marginBottom: '16px' }}>
            Traveler.com is owned and operated by RB GLOBAL, a parent company building technology ecosystems across multiple industries.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Icon name="trendingUp" size={15} color={COLORS.primary} />
            <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.text }}>Travel Ecosystem</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
            {RB_TRAVEL.map((b) => (
              <span key={b} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.primary, background: '#EFF6FF', padding: '6px 12px', borderRadius: '8px' }}>{b}</span>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Icon name="box" size={15} color={COLORS.green} />
            <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.text }}>Farm Ecosystem</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {RB_FARM.map((b) => (
              <span key={b} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.green, background: '#F0FDF4', padding: '6px 12px', borderRadius: '8px' }}>{b}</span>
            ))}
          </div>
        </div>

        <div style={{ background: '#F5F3FF', borderRadius: '16px', padding: '18px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.purple, marginBottom: '6px' }}>Our Commitment</p>
          <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.6 }}>
            To make travel easier, safer, smarter, and more accessible for everyone. Together, we are not only changing how people book travel — we are transforming how the world travels.
          </p>
        </div>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '16px', padding: '18px', marginBottom: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
      <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.purple, marginBottom: '8px' }}>{title}</p>
      <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.7 }}>{children}</p>
    </div>
  )
}
