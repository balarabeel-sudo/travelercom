import { supabase } from './supabaseClient'

export async function releaseExpiredUnits(companyId: string) {
  const today = new Date().toISOString().split('T')[0]

  const { data: items } = await supabase
    .from('inventory_items')
    .select('id')
    .eq('company_id', companyId)

  const itemIds = (items || []).map((i) => i.id)
  if (itemIds.length === 0) return

  const { data: occupiedUnits } = await supabase
    .from('inventory_units')
    .select('id, booking_id')
    .in('inventory_item_id', itemIds)
    .eq('status', 'occupied')
    .not('booking_id', 'is', null)

  if (!occupiedUnits || occupiedUnits.length === 0) return

  const bookingIds = occupiedUnits.map((u) => u.booking_id).filter(Boolean) as string[]

  const { data: expiredBookings } = await supabase
    .from('bookings')
    .select('id')
    .in('id', bookingIds)
    .lt('check_out_date', today)

  const expiredIds = new Set((expiredBookings || []).map((b) => b.id))
  if (expiredIds.size === 0) return

  const unitsToRelease = occupiedUnits
    .filter((u) => u.booking_id && expiredIds.has(u.booking_id))
    .map((u) => u.id)

  if (unitsToRelease.length === 0) return

  await supabase
    .from('inventory_units')
    .update({ status: 'available', booking_id: null })
    .in('id', unitsToRelease)
}
