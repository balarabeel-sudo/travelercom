import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

const COLORS = {
  navy: '#0F172A',
  primary: '#6B21A8',        // Purple for Premium
  primaryLight: '#A855F7',
  accent: '#F59E0B',         // Gold
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  green: '#16A34A',
  border: '#E2E8F0',
};

type Stats = {
  totalBookings: number;
  revenue: number;
  pending: number;
  completed: number;
  activeListings: number;
  walletBalance: number;
  rating?: number;
};

function BusinessSuite() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('pending');
  const [stats, setStats] = useState<Stats>({
    totalBookings: 0, revenue: 0, pending: 0, completed: 0, activeListings: 0, walletBalance: 0,
  });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [trend, setTrend] = useState<number[]>([12, 19, 28, 35, 22, 31, 45]);

  useEffect(() => {
    // ... (data fetching code dinka na baya zai kasance kamar haka - na bar shi ba a canza ba domin brevity)
    const load = async () => {
      // Your existing data fetching logic here (I kept it the same)
      // Paste your load function from the old file here
      // For now I'm showing structure
      setLoading(false);
    };
    load();
  }, [navigate]);

  if (loading) {
    return <div className="loading">Loading Business Suite...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
      {/* Premium Header */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.primary}, #4C1D95)`,
        padding: '20px',
        color: 'white',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span onClick={() => navigate('/home')} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            👑 <span style={{ fontWeight: 700 }}>BUSINESS SUITE</span>
          </div>
          <span>🔔</span>
        </div>

        <div style={{ marginTop: '20px' }}>
          <p style={{ fontSize: '22px', fontWeight: 800 }}>{businessName}</p>
          <p style={{ color: '#C4B5FD' }}>Premium Plan • Verified</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Overview Stats - 2x2 Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <MetricCard icon="📦" label="Total Bookings" value={stats.totalBookings} color={COLORS.primary} />
          <MetricCard icon="💰" label="Revenue" value={`₦${stats.revenue.toLocaleString()}`} color="#10B981" />
          <MetricCard icon="⏳" label="Pending" value={stats.pending} color="#F59E0B" />
          <MetricCard icon="✅" label="Completed" value={stats.completed} color={COLORS.green} />
        </div>

        {/* Performance Chart */}
        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
          <p style={{ fontWeight: 700, marginBottom: '12px' }}>Performance (This Week)</p>
          {/* You can replace with real chart library later (Recharts or Chart.js) */}
          <div style={{ height: '140px', background: '#F3E8FF', borderRadius: '12px', display: 'flex', alignItems: 'flex-end', padding: '0 10px', gap: '8px' }}>
            {trend.map((val, i) => (
              <div key={i} style={{ flex: 1, height: `${val}%`, background: COLORS.primaryLight, borderRadius: '6px 6px 0 0' }} />
            ))}
          </div>
        </div>

        {/* Quick Actions - More Premium Style */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <QuickAction icon="➕" label="Add Listing" onClick={() => navigate('/add-listing')} />
          <QuickAction icon="📋" label="Manage Listings" onClick={() => navigate('/listings-management')} />
          <QuickAction icon="👥" label="Guests" onClick={() => navigate('/guests')} />
          <QuickAction icon="📊" label="Reports" onClick={() => navigate('/reports')} />
        </div>

        {/* Recent Bookings */}
        {/* ... (you can keep your existing recent bookings section) */}
      </div>
    </div>
  );
}

// Reusable Components
function MetricCard({ icon, label, value, color }: any) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
      <p style={{ fontSize: '22px', fontWeight: 800, color }}>{value}</p>
      <p style={{ fontSize: '13px', color: COLORS.textMuted }}>{label}</p>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: any) {
  return (
    <div onClick={onClick} style={{
      background: COLORS.card,
      borderRadius: '16px',
      padding: '18px 12px',
      textAlign: 'center',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      cursor: 'pointer'
    }}>
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>{icon}</div>
      <p style={{ fontWeight: 600, fontSize: '13px' }}>{label}</p>
    </div>
  );
}

export default BusinessSuite;
