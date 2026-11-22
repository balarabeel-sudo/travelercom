import AdminListings from './AdminListings'
import type { ListingsConfig } from './AdminListings'
import AdminVehicleRentalForm from './AdminVehicleRentalForm'

const RENTAL_MODE_LABEL: Record<string, string> = { self_drive: 'Self-Drive', with_driver: 'With Driver', both: 'Self-Drive or Driver' }

const CONFIG: ListingsConfig = {
  title: 'Vehicle Rental',
  subtitle: 'All rental vehicle listings across the platform.',
  categories: ['vehicle_rental'],
  icon: 'car',
  searchPlaceholder: 'Search vehicle name...',
  emptyText: 'No vehicle rental listings found.',
  priceUnit: '/day',
  priceLabel: 'PRICE / DAY',
  rowSubtitle: (l) => `${l.companies?.business_name || 'Unknown'} · ${l.destination || 'No city'}`,
  detailSubtitle: (l) => l.companies?.business_name || 'Unknown company',
  tags: (l) => [
    l.transmission || '',
    l.year != null ? String(l.year) : '',
    l.rental_mode ? (RENTAL_MODE_LABEL[l.rental_mode] || l.rental_mode) : '',
  ].filter((t) => t !== ''),
  detailItems: (l) => [
    { label: 'CITY', value: l.destination || 'Not set' },
    { label: 'FLEET AVAILABLE', value: l.seats_available != null ? String(l.seats_available) : '—' },
  ],
  Form: AdminVehicleRentalForm,
}

export default function AdminVehicleRentals() {
  return <AdminListings config={CONFIG} />
}
