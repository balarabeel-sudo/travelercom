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

// Date-range-aware room availability. Replaces the old "status: available/occupied"
// single-slot model, which could only represent ONE booking per unit ever (until an
// expiry job ran) and had no idea whether a unit would be free for a DIFFERENT,
// non-overlapping date range. This checks real overlap against the bookings table,
// so a room booked 14–20 correctly shows as available again from the 20th onward for
// any new request — no waiting on a cleanup job, no false "fully booked".
//
// Used by BOTH the customer booking flow (HotelDetails.tsx) and the staff walk-in
// flow (AddGuest.tsx) so the two can never disagree about what's actually free.
export type AvailabilityResult =
  | { available: true; unitId: string; unitNumber: string }
  | { available: false; availableFrom: string | null }

export async function listAvailableUnits(
  inventoryItemId: string,
  checkInDate: string,
  checkOutDate: string
): Promise<{ id: string; unit_number: string }[]> {
  const { data: units } = await supabase
    .from('inventory_units')
    .select('id, unit_number, status')
    .eq('inventory_item_id', inventoryItemId)
    .order('unit_number', { ascending: true })

  const usableUnits = (units || []).filter((u) => u.status !== 'maintenance')
  if (usableUnits.length === 0) return []

  const { data: overlapping } = await supabase
    .from('bookings')
    .select('assigned_unit_number')
    .eq('inventory_item_id', inventoryItemId)
    .eq('booking_status', 'confirmed')
    .lt('check_in_date', checkOutDate)
    .gt('check_out_date', checkInDate)

  const occupiedNumbers = new Set((overlapping || []).map((b) => b.assigned_unit_number))
  return usableUnits
    .filter((u) => !occupiedNumbers.has(u.unit_number))
    .map((u) => ({ id: u.id, unit_number: u.unit_number }))
}

export async function findAvailableUnit(
  inventoryItemId: string,
  checkInDate: string,
  checkOutDate: string
): Promise<AvailabilityResult> {
  const { data: units } = await supabase
    .from('inventory_units')
    .select('id, unit_number, status')
    .eq('inventory_item_id', inventoryItemId)
    .order('unit_number', { ascending: true })

  const usableUnits = (units || []).filter((u) => u.status !== 'maintenance')
  if (usableUnits.length === 0) return { available: false, availableFrom: null }

  const { data: overlapping } = await supabase
    .from('bookings')
    .select('assigned_unit_number')
    .eq('inventory_item_id', inventoryItemId)
    .eq('booking_status', 'confirmed')
    .lt('check_in_date', checkOutDate)
    .gt('check_out_date', checkInDate)

  const occupiedNumbers = new Set((overlapping || []).map((b) => b.assigned_unit_number))
  const free = usableUnits.find((u) => !occupiedNumbers.has(u.unit_number))
  if (free) return { available: true, unitId: free.id, unitNumber: free.unit_number }

  // Every unit clashes with the requested dates — find the soonest date any of
  // them frees up, so the UI can say "Available from <date>" instead of a dead end.
  const { data: soonest } = await supabase
    .from('bookings')
    .select('check_out_date')
    .eq('inventory_item_id', inventoryItemId)
    .eq('booking_status', 'confirmed')
    .gte('check_out_date', checkInDate)
    .order('check_out_date', { ascending: true })
    .limit(1)

  return { available: false, availableFrom: soonest?.[0]?.check_out_date || null }
}
