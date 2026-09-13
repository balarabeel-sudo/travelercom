import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

const COLORS = { bg: '#F8FAFC', textMuted: '#64748B' }

// Dedicated Add Listing pages, one per category. Categories not listed here
// (train, flight) still fall back to the older shared AddListing.tsx until
// their own dedicated pages are built.
const DEDICATED_PATH: Record<string, string> = {
  hotel: '/add-hotel-listing',
  bus: '/add-bus-listing',
  tour: '/add-tour-listing',
  event_center: '/add-event-center-listing',
}

function AddListingRouter() {
  const navigate = useNavigate()

  useEffect(() => {
    const route = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { navigate('/login', { replace: true }); return }

      const { data: company } = await supabase
        .from('companies')
        .select('business_type')
        .eq('owner_id', userData.user.id)
        .maybeSingle()

      const target = company?.business_type ? DEDICATED_PATH[company.business_type] : null
      navigate(target || '/add-listing', { replace: true })
    }
    route()
  }, [navigate])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, color: COLORS.textMuted, fontSize: '14px' }}>
      Loading...
    </div>
  )
}

export default AddListingRouter
