import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import NotificationBell from './NotificationBell'
import { releaseExpiredUnits } from './inventoryUtils'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
}

const PERIOD_DAYS: Record<'week' | 'month' | 'year', number> = { week: 7, month: 30, year: 365 }

function computePeriodStats(bookings: any[], filter: 'week' | 'month' | 'year') {
  const days = PERIOD_DAYS[filter]
  const now = Date.now()
  const currentStart = now - days * 86400000
  const previousStart = now - 2 * days * 86400000

  const inRange = (b: any, start: number, end: number) => {
    const t = new Date(b.created_at).getTime()
    return t >= start && t < end
  }

  const build = (list: any[]) => {
    const totalBookings = list.length
    const pendingBookings = list.filter((b: any) => !b.checked_in && b.booking_status === 'confirmed').length
    const completed = list.filter((b: any) => b.checked_in).length
    const revenue = list
      .filter((b: any) => b.checked_in)
      .reduce((sum: number, b: any) => {
        const rate = Number(b.services?.commission_rate ?? 3)
        return sum + Number(b.amount_paid) * (1 - rate / 100)
      }, 0)
    return { totalBookings, pendingBookings, completed, revenue }
  }

  const current = build(bookings.filter((b: any) => inRange(b, currentStart, now)))
  const previous = build(bookings.filter((b: any) => inRange(b, previousStart, currentStart)))

  const pct = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 100)
  }

  return {
    changes: {
      totalBookings: pct(current.totalBookings, previous.totalBookings),
      revenue: pct(current.revenue, previous.revenue),
      pendingBookings: pct(current.pendingBookings, previous.pendingBookings),
      completed: pct(current.completed, previous.completed),
    }
  }
}

function Home() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [accountType, setAccountType] = useState<'personal' | 'company'>('personal')
  const [displayName, setDisplayName] = useState('')
  const [companyApproval, setCompanyApproval] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [companyPlan, setCompanyPlan] = useState<'free' | 'business_suite'>('free')
  const [rawBookings, setRawBookings] = useState<any[]>([])
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'year'>('week')
  const [companyStats, setCompanyStats] = useState({
    totalBookings: 0,
    revenue: 0,
    pendingBookings: 0,
    completed: 0,
    activeListings: 0,
  })
  const [popularHotels, setPopularHotels] = useState<{
    id: string; title: string; destination: string; photo_url: string | null;
    price: number; seats_available: number | null; avgRating: number | null
  }[]>([])
  const [popularBus, setPopularBus] = useState<{
    id: string; origin: string | null; destination: string; departure_time: string | null;
    price: number; photo_url: string | null; companyName: string
  }[]>([])
  const [popularFlights, setPopularFlights] = useState<{
    id: string; origin: string | null; destination: string; departure_time: string | null;
    price: number; photo_url: string | null; companyName: string
  }[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [banners, setBanners] = useState<{ id: string; title: string; message: string; image_url: string | null; link_url: string | null }[]>([])

  useEffect(() => {
    const loadBanners = async () => {
      const { data } = await supabase
        .from('platform_banners')
        .select('id, title, message, image_url, link_url')
        .eq('active', true)
        .order('created_at', { ascending: false })
      setBanners(data || [])
    }
    loadBanners()
  }, [])

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        navigate('/login')
        return
      }
      const meta = data.user.user_metadata || {}
      const isCompany = meta.account_type === 'company'

      // Staff members (invited via Staff Access) don't own a company, so
      // they'd otherwise land on the generic personal Home. Send them to
      // their own Staff Dashboard instead.
      if (!isCompany) {
        const { data: staffRow } = await supabase
          .from('company_staff')
          .select('id')
          .eq('user_id', data.user.id)
          .eq('status', 'active')
          .maybeSingle()
        if (staffRow) {
          navigate('/staff-dashboard', { replace: true })
          return
        }
      }

      setAccountType(isCompany ? 'company' : 'personal')
      setDisplayName(meta.full_name || '')

      // Ensure a profiles row exists for this user (required for companies/wallets/bookings FK)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!existingProfile) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: meta.full_name || null,
          phone_number: meta.phone || null,
          account_type: isCompany ? 'company' : 'personal',
          company_name: isCompany ? (meta.full_name || null) : null,
          status: 'pending',
        })
      }
      
      if (isCompany) {
      const { data: existing } = await supabase
          .from('companies')
          .select('id, approval_status, plan')
          .eq('owner_id', data.user.id)
          .maybeSingle()

        let companyId = existing?.id

        if (existing) {
          setCompanyApproval(existing.approval_status)
          setCompanyPlan(existing.plan || 'free')
          releaseExpiredUnits(companyId)
        } else {
          const { data: created } = await supabase
            .from('companies')
            .insert({
              owner_id: data.user.id,
              business_name: meta.full_name || 'My Company',
              business_type: meta.business_type || null,
              approval_status: 'pending'
            })
            .select('id, approval_status, plan')
            .single()
          setCompanyApproval(created?.approval_status || 'pending')
          setCompanyPlan(created?.plan || 'free')
          companyId = created?.id
        }  

        if (companyId) {
          const { data: allBookings } = await supabase
            .from('bookings')
            .select('checked_in, booking_status, amount_paid, created_at, services(commission_rate)')
            .eq('company_id', companyId)

          const bookings = allBookings || []
          setRawBookings(bookings)
          const totalBookings = bookings.length
          const pendingBookings = bookings.filter((b: any) => !b.checked_in && b.booking_status === 'confirmed').length
          const completed = bookings.filter((b: any) => b.checked_in).length
          const revenue = bookings
            .filter((b: any) => b.checked_in)
            .reduce((sum: number, b: any) => {
              const rate = Number(b.services?.commission_rate ?? 3)
              return sum + Number(b.amount_paid) * (1 - rate / 100)
            }, 0)

          const { count: activeListings } = await supabase
            .from('services')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('status', 'active')

          setCompanyStats({
            totalBookings,
            revenue,
            pendingBookings,
            completed,
            activeListings: activeListings || 0,
          })
        }
      } else {
        const { data: hotelRows } = await supabase
          .from('services')
          .select('id, title, destination, photo_url, price, seats_available')
          .eq('category', 'hotel')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(6)

        if (hotelRows && hotelRows.length > 0) {
          const ids = hotelRows.map((h) => h.id)
          const { data: reviewRows } = await supabase
            .from('reviews')
            .select('service_id, rating')
            .in('service_id', ids)

          const ratingMap: Record<string, number[]> = {}
          ;(reviewRows || []).forEach((r: any) => {
            if (r.rating == null) return
            if (!ratingMap[r.service_id]) ratingMap[r.service_id] = []
            ratingMap[r.service_id].push(Number(r.rating))
          })

          setPopularHotels(hotelRows.map((h: any) => {
            const ratings = ratingMap[h.id] || []
            const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
            return { ...h, avgRating }
          }))
        }

        const { data: busRows } = await supabase
          .from('services')
          .select('id, origin, destination, departure_time, price, photo_url, companies(business_name)')
          .eq('category', 'bus')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(6)
        setPopularBus((busRows || []).map((r: any) => ({ ...r, companyName: r.companies?.business_name || 'Traveler.com Partner' })))

        const { data: flightRows } = await supabase
          .from('services')
          .select('id, origin, destination, departure_time, price, photo_url, companies(business_name)')
          .eq('category', 'flight')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(6)
        setPopularFlights((flightRows || []).map((r: any) => ({ ...r, companyName: r.companies?.business_name || 'Traveler.com Partner' })))

        const { data: favRows } = await supabase
          .from('favorites')
          .select('service_id')
          .eq('user_id', data.user.id)
        setFavoriteIds(new Set((favRows || []).map((f: any) => f.service_id)))
      }

      setLoading(false)
    }
    loadUser()
  }, [navigate])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const toggleFavorite = async (e: React.MouseEvent, serviceId: string) => {
    e.stopPropagation()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const isFav = favoriteIds.has(serviceId)
    const next = new Set(favoriteIds)
    if (isFav) {
      next.delete(serviceId)
      setFavoriteIds(next)
      await supabase.from('favorites').delete().eq('user_id', userData.user.id).eq('service_id', serviceId)
    } else {
      next.add(serviceId)
      setFavoriteIds(next)
      await supabase.from('favorites').insert({ user_id: userData.user.id, service_id: serviceId })
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: COLORS.textMuted,
        fontSize: '14px'
      }}>
        Loading...
      </div>
    )
  }

if (accountType === 'company') {
    const periodStats = companyPlan === 'business_suite' ? computePeriodStats(rawBookings, timeFilter) : null

    const analytics = [
      { label: 'Total Bookings', value: companyStats.totalBookings.toString(), icon: 'box', statKey: 'totalBookings' },
      { label: 'Revenue', value: `₦${companyStats.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: 'trendingUp', statKey: 'revenue' },
      { label: 'Pending Bookings', value: companyStats.pendingBookings.toString(), icon: 'clock', statKey: 'pendingBookings' },
      { label: 'Completed', value: companyStats.completed.toString(), icon: 'checkCircle', statKey: 'completed' },
      { label: 'Active Listings', value: companyStats.activeListings.toString(), icon: 'clipboard', statKey: null },
    ]

    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>

        <div style={{
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: COLORS.card,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
        }}>
          <div>
            <h1 style={{ fontSize: '19px', fontWeight: 800, color: COLORS.secondary, letterSpacing: '0.5px' }}>
              TRAVELER<span style={{ color: COLORS.primary }}>.COM</span>
            </h1>
            <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Company: {displayName}</p>
          </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <NotificationBell iconColor={COLORS.text} />
            <div
              onClick={() => navigate('/company-profile')}
              title="Company Profile"
              style={{
                width: '34px', height: '34px', borderRadius: '50%', background: COLORS.secondary,
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '15px', fontWeight: 800, cursor: 'pointer'
              }}>
              {displayName?.charAt(0).toUpperCase() || 'C'}
            </div>
          </div>
        </div>

        <div style={{
          margin: '16px', padding: '18px', borderRadius: '16px',
          background: companyPlan === 'business_suite' ? 'linear-gradient(135deg, #6B21A8, #4C1D95)' : COLORS.card,
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
        }}>
          <div>
            <p style={{
              fontSize: '15px', fontWeight: 800,
              color: companyPlan === 'business_suite' ? 'white' : COLORS.text,
              display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              Welcome back, {displayName}!
              {companyPlan === 'business_suite' && <Icon name="star" size={14} color="#FBBF24" />}
            </p>
            <p style={{
              fontSize: '12px',
              color: companyPlan === 'business_suite' ? '#DDD6FE' : COLORS.textMuted
            }}>
              Here's what's happening with your business today.
            </p>
          </div>
          {companyPlan === 'business_suite' && (
            <div
              onClick={() => navigate('/company-menu')}
              style={{
                background: 'white', color: '#6B21A8', fontSize: '12px', fontWeight: 700,
                padding: '9px 14px', borderRadius: '10px', cursor: 'pointer', whiteSpace: 'nowrap'
              }}>
              Manage Plan
            </div>
          )}
        </div>

        {companyApproval !== 'approved' && (
          <div
            onClick={() => navigate('/upload-docs')}
            style={{
              background: companyApproval === 'rejected' ? '#fef2f2' : '#fff7ed',
              border: `1px solid ${companyApproval === 'rejected' ? '#fca5a5' : '#fdba74'}`,
              margin: '16px',
              borderRadius: '14px',
              padding: '14px',
              cursor: 'pointer'
            }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: companyApproval === 'rejected' ? '#b91c1c' : '#c2410c', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon name={companyApproval === 'rejected' ? 'alertCircle' : 'clock'} size={14} color={companyApproval === 'rejected' ? '#b91c1c' : '#c2410c'} />
              {companyApproval === 'rejected' ? 'Application Rejected' : 'Account Pending Approval'}
            </p>
            <p style={{ fontSize: '12px', color: companyApproval === 'rejected' ? '#991b1b' : '#9a3412' }}>
              {companyApproval === 'rejected'
                ? 'Please contact support for more information.'
                : 'Upload your CAC document to get approved and start listing your services.'}
            </p>
          </div>
        )}

        <div style={{ padding: '0 16px' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>
              Overview
            </h3>
            {companyPlan === 'business_suite' && (
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as 'week' | 'month' | 'year')}
                style={{
                  fontSize: '12px', fontWeight: 600, color: COLORS.primary, background: '#eff6ff',
                  border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer'
                }}>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="year">Last 12 Months</option>
              </select>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            {analytics.map((a) => {
              const change = a.statKey && periodStats ? periodStats.changes[a.statKey as keyof typeof periodStats.changes] : null
              return (
                <div key={a.label} style={{
                  background: COLORS.card,
                  borderRadius: '14px',
                  padding: '16px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Icon name={a.icon} size={22} color={COLORS.primary} />
                  </div>
                  <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text }}>{a.value}</p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{a.label}</p>
                  {companyPlan === 'business_suite' && change !== null && (
                    <p style={{ fontSize: '10.5px', fontWeight: 700, marginTop: '6px', color: change >= 0 ? '#16A34A' : '#DC2626' }}>
                      {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% vs last {timeFilter === 'week' ? '7 days' : timeFilter === 'month' ? '30 days' : '12 months'}
                    </p>
                  )}
                </div>
              )
            })}
            <div
              onClick={() => navigate('/verify-booking')}
              style={{
                background: COLORS.card,
                borderRadius: '14px',
                padding: '16px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                cursor: 'pointer'
              }}>
              <div style={{ marginBottom: '8px' }}>
                <Icon name="camera" size={22} color={COLORS.primary} />
              </div>
              <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>Verify</p>
              <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Booking</p>
            </div>
          </div> 
         {companyPlan === 'business_suite' && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>Quick Actions</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <PremiumAction icon="users" label="Staff Access" onClick={() => navigate('/staff')} />
                <PremiumAction icon="userPlus" label="Add Guest" onClick={() => navigate('/add-guest')} />
                <PremiumAction icon="barChart" label="Analytics" onClick={() => navigate('/analytics')} />
                <PremiumAction icon="box" label="Inventory" onClick={() => navigate('/inventory')} />
                <PremiumAction icon="megaphone" label="Promotions" onClick={() => navigate('/promotions')} />
                <PremiumAction icon="star" label="Ratings" onClick={() => navigate('/reviews')} />
              </div>
            </div>
          )} 

          <h3
            onClick={() => navigate('/listings-management')}
            style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginBottom: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            My Listings <Icon name="chevronRight" size={15} color={COLORS.text} />
          </h3>
          <div
            onClick={() => navigate('/listings-management')}
            style={{
              background: COLORS.card, borderRadius: '14px', padding: '20px', marginBottom: '24px',
              textAlign: 'center', color: COLORS.textMuted, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', cursor: 'pointer'
            }}>
            <p style={{ fontSize: '13px' }}>Tap to manage your listings</p>
          </div>

          <h3
            onClick={() => navigate('/bookings-management')}
            style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginBottom: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Bookings Received <Icon name="chevronRight" size={15} color={COLORS.text} />
          </h3>
          <div
            onClick={() => navigate('/bookings-management')}
            style={{
              background: COLORS.card, borderRadius: '14px', padding: '20px',
              textAlign: 'center', color: COLORS.textMuted, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', cursor: 'pointer'
            }}>
            <p style={{ fontSize: '13px' }}>Tap to view all bookings</p>
          </div>
        </div>

        <CompanyBottomNav active="home" navigate={navigate} />

      </div>
    )
  }
  
const services = [
    { icon: 'hotel', label: 'Hotels & Stays', desc: 'Find your comfort', path: '/hotels' },
    { icon: 'bus', label: 'Bus Stations', desc: 'Travel by road', path: '/bus' },
    { icon: 'train', label: 'Railway', desc: 'Travel by train', path: '/train' },
    { icon: 'plane', label: 'Domestic Flights', desc: 'Fly across Nigeria', path: '/flights' },
    { icon: 'map', label: 'Tours & Attractions', desc: 'Explore places', path: '/tours' },
    { icon: 'tent', label: 'Event Centers', desc: 'Book a venue', path: '/event-centers' },
  ]

  const destinations = [
    { city: 'Lagos', icon: 'mapPin', color: '#0369a1' },
    { city: 'Abuja', icon: 'mapPin', color: '#0EA5E9' },
    { city: 'Kaduna', icon: 'mapPin', color: '#F97316' },
    { city: 'Kano', icon: 'mapPin', color: '#0369a1' },
    { city: 'Port Harcourt', icon: 'mapPin', color: '#0EA5E9' },
  ]

  // No real listings yet for tours/events — will be populated once companies start adding services

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '90px' }}>

      {/* ---------- HEADER ---------- */}
      <div style={{
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: COLORS.card,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <h1 style={{ fontSize: '19px', fontWeight: 800, color: COLORS.primary, letterSpacing: '0.5px' }}>
          TRAVELER<span style={{ color: COLORS.secondary }}>.COM</span>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <NotificationBell iconColor={COLORS.text} />
          <div
            onClick={handleLogout}
            title="Logout"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: COLORS.primary,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}>
            {displayName ? displayName.charAt(0).toUpperCase() : <Icon name="user" size={16} color="white" />}
          </div>
        </div>
      </div>

      {/* ---------- HERO SECTION ---------- */}
      <div style={{
        margin: '16px',
        borderRadius: '20px',
        padding: '24px 20px',
        background: `linear-gradient(135deg, ${COLORS.primary}, #0369a1)`,
        color: 'white',
        boxShadow: '0 8px 24px rgba(14,165,233,0.25)'
      }}>
        <h2 style={{ fontSize: '21px', fontWeight: 800, lineHeight: 1.3, marginBottom: '6px' }}>
          Explore Nigeria With Confidence
        </h2>
        <p style={{ fontSize: '13px', opacity: 0.9 }}>
          Hotels, Transport, Flights & Tours in One Platform
        </p>
      </div>

      {/* ---------- QUICK SERVICES GRID ---------- */}
      <div style={{ padding: '4px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Our Services</h3>
          <span onClick={() => navigate('/search')} style={{ fontSize: '12.5px', color: COLORS.primary, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
            View all <Icon name="chevronRight" size={13} color={COLORS.primary} />
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '24px' }}>
          {services.map((s) => (
            <div
              key={s.label}
              onClick={() => navigate(s.path)}
              style={{
                background: COLORS.card,
                borderRadius: '14px',
                padding: '12px 8px',
                cursor: 'pointer',
                border: `1px solid ${COLORS.border}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}>
              <div style={{
                width: '36px',
                height: '36px',
                background: COLORS.bg,
                borderRadius: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '6px',
              }}>
                <Icon name={s.icon} size={18} color={COLORS.primary} />
              </div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.text, lineHeight: 1.2 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- FEATURED DESTINATIONS ---------- */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginBottom: '12px', padding: '0 16px' }}>
          Featured Destinations
        </h3>
        <div style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          padding: '0 16px 4px 16px',
        }}>
          {destinations.map((d) => (
            <div
              key={d.city}
              onClick={() => navigate(`/search?city=${d.city}`)}
              style={{
                minWidth: '140px',borderRadius: '16px',
                overflow: 'hidden',
                background: COLORS.card,
                boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                cursor: 'pointer',
                flexShrink: 0
              }}>
              <div style={{
                height: '90px',
                background: `linear-gradient(135deg, ${d.color}, ${COLORS.primary})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon name={d.icon} size={30} color="white" />
              </div>
              <div style={{ padding: '10px' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '2px' }}>
                  {d.city}
                </p>
                <p style={{ fontSize: '11px', color: COLORS.primary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                  Explore <Icon name="chevronRight" size={12} color={COLORS.primary} />
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- RECOMMENDED HOTELS ---------- */}
      <div style={{ padding: '0 16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>
            Recommended Hotels
          </h3>
          <span
            onClick={() => navigate('/hotels')}
            style={{ fontSize: '12px', color: COLORS.primary, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
            See all <Icon name="chevronRight" size={13} color={COLORS.primary} />
          </span>
        </div>

        {popularHotels.length === 0 ? (
          <div style={{
            background: COLORS.card,
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            color: COLORS.textMuted,
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
          }}>
            <p style={{ fontSize: '13px' }}>No hotels available yet</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Check back soon!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
            {popularHotels.map((h) => (
              <div
                key={h.id}
                onClick={() => navigate(`/hotels/${h.id}`)}
                style={{
                  width: '190px',
                  flexShrink: 0,
                  background: COLORS.card,
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                  cursor: 'pointer'
                }}>
                <div style={{ position: 'relative', height: '110px' }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: h.photo_url ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '30px',
                  }}>
                    {h.photo_url ? <img src={h.photo_url} alt={h.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="hotel" size={30} color="white" />}
                  </div>
                  <div
                    onClick={(e) => toggleFavorite(e, h.id)}
                    style={{
                      position: 'absolute', top: '8px', right: '8px',
                      width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.9)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
                      color: favoriteIds.has(h.id) ? COLORS.secondary : '#94a3b8',
                    }}>
                    <Icon name="heart" size={14} color={favoriteIds.has(h.id) ? COLORS.secondary : '#94a3b8'} filled={favoriteIds.has(h.id)} />
                  </div>
                </div>
                <div style={{ padding: '10px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.title}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{h.destination}</p>
                    {h.avgRating !== null && (
                      <>
                        <span style={{ fontSize: '10px', color: COLORS.textMuted }}>•</span>
                        <Icon name="star" size={10} color="#D4A017" />
                        <span style={{ fontSize: '11px', color: COLORS.textMuted }}>{h.avgRating.toFixed(1)}</span>
                      </>
                    )}
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.primary, marginTop: '4px' }}>
                    ₦{Number(h.price).toLocaleString()}<span style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: 400 }}> /night</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- POPULAR BUS ROUTES ---------- */}
      <div style={{ padding: '0 16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>
            Popular Bus Routes
          </h3>
          <span onClick={() => navigate('/bus')} style={{ fontSize: '12px', color: COLORS.primary, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
            See all <Icon name="chevronRight" size={13} color={COLORS.primary} />
          </span>
        </div>
        {popularBus.length === 0 ? (
          <EmptyCard text="No bus routes available yet" />
        ) : (
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
            {popularBus.map((r) => (
              <TripCard
                key={r.id}
                icon="bus"
                route={r.origin ? `${r.origin} → ${r.destination}` : r.destination}
                company={r.companyName}
                date={r.departure_time ? new Date(r.departure_time).toLocaleDateString() : 'Schedule TBA'}
                price={Number(r.price)}
                photoUrl={r.photo_url}
                isFavorite={favoriteIds.has(r.id)}
                onToggleFavorite={(e) => toggleFavorite(e, r.id)}
                onClick={() => navigate(`/bus/${r.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---------- DOMESTIC FLIGHTS ---------- */}
      <div style={{ padding: '0 16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>
            Domestic Flights
          </h3>
          <span onClick={() => navigate('/services/flight')} style={{ fontSize: '12px', color: COLORS.primary, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
            See all <Icon name="chevronRight" size={13} color={COLORS.primary} />
          </span>
        </div>
        {popularFlights.length === 0 ? (
          <EmptyCard text="No flights available yet" />
        ) : (
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
            {popularFlights.map((f) => (
              <TripCard
                key={f.id}
                icon="plane"
                route={f.origin ? `${f.origin} → ${f.destination}` : f.destination}
                company={f.companyName}
                date={f.departure_time ? new Date(f.departure_time).toLocaleDateString() : 'Schedule TBA'}
                price={Number(f.price)}
                photoUrl={f.photo_url}
                isFavorite={favoriteIds.has(f.id)}
                onToggleFavorite={(e) => toggleFavorite(e, f.id)}
                onClick={() => navigate(`/flight/${f.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---------- PLATFORM BANNERS ---------- */}
      {banners.length > 0 && (
        <div style={{ padding: '0 16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
            {banners.map((b) => (
              <div
                key={b.id}
                onClick={() => {
                  if (!b.link_url) return
                  if (b.link_url.startsWith('http')) window.location.href = b.link_url
                  else navigate(b.link_url)
                }}
                style={{
                  minWidth: '280px',
                  flexShrink: 0,
                  background: b.image_url ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, #ea580c)`,
                  borderRadius: '18px',
                  padding: '20px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 8px 20px rgba(249,115,22,0.25)',
                  cursor: b.link_url ? 'pointer' : 'default',
                  position: 'relative',
                  overflow: 'hidden',
                  minHeight: '90px',
                }}>
                {b.image_url && (
                  <img src={b.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                )}
                <div style={{ flex: 1, position: 'relative' }}>
                  <p style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>{b.title}</p>
                  <p style={{ fontSize: '12px', opacity: 0.95 }}>{b.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- RECENT BOOKINGS ---------- */}
      <div style={{ padding: '0 16px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>
          Recent Bookings
        </h3>
        <EmptyCard text="No bookings yet" subtext="Book your first trip!" />
      </div>

      {/* ---------- BOTTOM NAVIGATION ---------- */}
      <BottomNav active="home" navigate={navigate} />

    </div>
  )
}

function EmptyCard({ text, subtext }: { text: string; subtext?: string }) {
  return (
    <div style={{
      background: COLORS.card,
      borderRadius: '16px',
      padding: '20px',
      textAlign: 'center',
      color: COLORS.textMuted,
      boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
    }}>
      <p style={{ fontSize: '13px' }}>{text}</p>
      {subtext && <p style={{ fontSize: '12px', marginTop: '4px' }}>{subtext}</p>}
    </div>
  )
}

function TripCard({ icon, route, company, date, price, photoUrl, isFavorite, onToggleFavorite, onClick }: {
  icon: string; route: string; company: string; date: string; price: number;
  photoUrl: string | null; isFavorite: boolean; onToggleFavorite: (e: React.MouseEvent) => void; onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width: '190px',
        flexShrink: 0,
        background: COLORS.card,
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        cursor: 'pointer'
      }}>
      <div style={{ position: 'relative', height: '90px' }}>
        <div style={{
          width: '100%',
          height: '100%',
          background: photoUrl ? undefined : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '26px',
        }}>
          {photoUrl ? <img src={photoUrl} alt={route} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name={icon} size={26} color="white" />}
        </div>
        <div
          onClick={onToggleFavorite}
          style={{
            position: 'absolute', top: '8px', right: '8px',
            width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(255,255,255,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isFavorite ? COLORS.secondary : '#94a3b8',
          }}>
          <Icon name="heart" size={13} color={isFavorite ? COLORS.secondary : '#94a3b8'} filled={isFavorite} />
        </div>
      </div>
      <div style={{ padding: '10px' }}>
        <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{route}</p>
        <p style={{ fontSize: '10.5px', color: COLORS.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{company} • {date}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
          <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.primary }}>₦{price.toLocaleString()}</p>
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'white',
            background: COLORS.secondary,
            padding: '4px 9px',
            borderRadius: '7px'
          }}>
            Book
          </span>
        </div>
      </div>
    </div>
  )
}

function BottomNav({ active, navigate }: { active: string; navigate: (p: string) => void }) {
  const items = [
    { key: 'home', icon: 'home', label: 'Home', path: '/home' },
    { key: 'search', icon: 'search', label: 'Search', path: '/search' },
    { key: 'bookings', icon: 'ticket', label: 'Bookings', path: '/bookings' },
    { key: 'account', icon: 'user', label: 'Account', path: '/account' },
  ]

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      maxWidth: '480px',
      margin: '0 auto',
      background: COLORS.card,
      borderTop: `1px solid ${COLORS.border}`,
      display: 'flex',
      justifyContent: 'space-around',
      padding: '10px 0 14px 0',
      boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
    }}>
      {items.map((item) => (
        <div
          key={item.key}
          onClick={() => navigate(item.path)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            gap: '2px'
          }}>
          <Icon name={item.icon} size={20} color={active === item.key ? COLORS.primary : COLORS.textMuted} strokeWidth={active === item.key ? 2.3 : 2} />
          <span style={{
            fontSize: '10.5px',
            fontWeight: active === item.key ? 700 : 500,
            color: active === item.key ? COLORS.primary : COLORS.textMuted
          }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}

function PremiumAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: COLORS.card, borderRadius: '14px', padding: '14px 8px',
        textAlign: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
      }}>
      <div style={{
        width: '34px', height: '34px', borderRadius: '10px', background: '#f3e8ff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px'
      }}>
        <Icon name={icon} size={17} color="#6B21A8" />
      </div>
      <p style={{ fontSize: '11px', fontWeight: 600, color: COLORS.text, lineHeight: '1.3' }}>{label}</p>
    </div>
  )
}

function CompanyBottomNav({ active, navigate }: { active: string; navigate: (p: string) => void }) {
  const items = [
    { key: 'home', icon: 'home', label: 'Home', path: '/home' },
    { key: 'bookings', icon: 'calendar', label: 'Bookings', path: '/bookings-management' },
    { key: 'add', icon: 'plus', label: 'Add', path: '/add-listing' },
    { key: 'wallet', icon: 'wallet', label: 'Wallet', path: '/wallet' },
    { key: 'menu', icon: 'menu', label: 'Menu', path: '/company-menu' },
  ]

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      maxWidth: '480px',
      margin: '0 auto',
      background: COLORS.card,
      borderTop: `1px solid ${COLORS.border}`,
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      padding: '10px 0 14px 0',
      boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
    }}>
      {items.map((item) => {
        if (item.key === 'add') {
          return (
            <div
              key={item.key}
              onClick={() => navigate(item.path)}
              style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: COLORS.secondary, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', marginTop: '-26px',
                boxShadow: '0 4px 12px rgba(249,115,22,0.4)'
              }}>
              <Icon name="plus" size={22} color="white" />
            </div>
          )
        }
        return (
          <div
            key={item.key}
            onClick={() => navigate(item.path)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '3px' }}>
            <Icon name={item.icon} size={20} color={active === item.key ? COLORS.primary : COLORS.textMuted} />
            <span style={{
              fontSize: '10.5px',
              fontWeight: active === item.key ? 700 : 500,
              color: active === item.key ? COLORS.primary : COLORS.textMuted
            }}>
              {item.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default Home
                
