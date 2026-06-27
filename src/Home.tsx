import { useNavigate } from 'react-router-dom'

function Home() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      maxWidth: '430px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{
        background: '#0ea5e9',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h1 style={{
          color: 'white',
          fontSize: '20px',
          fontWeight: 'bold'
        }}>
          TRAVELER.COM
        </h1>
        <div style={{
          width: '36px',
          height: '36px',
          background: 'white',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px'
        }}>
          👤
        </div>
      </div>

      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0ea5e9, #f97316)',
        margin: '16px',
        borderRadius: '12px',
        padding: '20px',
        color: 'white'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>
          Explore Nigeria
        </h2>
        <p style={{ fontSize: '14px', opacity: 0.9 }}>
          From Lagos to Abuja and Beyond!
        </p>
      </div>

      {/* Services Grid */}
      <div style={{ padding: '0 16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
          Our Services
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '24px'
        }}>
          {[
            { icon: '🏨', label: 'Hotel & Stays', path: '/hotels' },
            { icon: '🚌', label: 'Bus Stations', path: '/buses' },
            { icon: '🚂', label: 'Train & Railway', path: '/trains' },
            { icon: '✈️', label: 'Domestic Flights', path: '/flights' },
          ].map((service) => (
            <div
              key={service.label}
              onClick={() => navigate(service.path)}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                {service.icon}
              </div>
              <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#1a1a1a' }}>
                {service.label}
              </p>
            </div>
          ))}
        </div>

        {/* My Trips */}
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
          My Trips
        </h3>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          textAlign: 'center',
          color: '#666'
        }}>
          <p>No upcoming trips</p>
          <p style={{ fontSize: '14px' }}>Book your first trip!</p>
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '430px',
        background: 'white',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '12px 0'
      }}>
        {[
          { icon: '🏠', label: 'Home' },
          { icon: '🔍', label: 'Search' },
          { icon: '🎫', label: 'Bookings' },
          { icon: '👤', label: 'Account' },
        ].map((item) => (
          <div key={item.label} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer'
          }}>
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span style={{ fontSize: '11px', color: '#666' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Home
