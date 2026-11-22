import AdminListings from './AdminListings'
import type { ListingsConfig } from './AdminListings'
import AdminTransportForm from './AdminTransportForm'

const route = (l: any) => (l.origin ? `${l.origin} → ${l.destination}` : (l.destination || 'No route set'))

const CONFIG: ListingsConfig = {
  title: 'Transport',
  subtitle: 'All bus and train listings across the platform.',
  categories: ['bus', 'train'],
  icon: 'bus',
  searchPlaceholder: 'Search listing name...',
  emptyText: 'No transport listings found.',
  priceUnit: '/seat',
  priceLabel: 'PRICE / SEAT',
  typeFilters: [
    { key: 'all', label: 'All' },
    { key: 'bus', label: 'Bus' },
    { key: 'train', label: 'Train' },
  ],
  rowSubtitle: (l) => `${l.companies?.business_name || 'Unknown'} · ${route(l)}`,
  detailSubtitle: (l) => `${l.companies?.business_name || 'Unknown company'} · ${l.category === 'train' ? 'Train' : 'Bus'}`,
  detailItems: (l) => [
    { label: 'ROUTE', value: l.origin ? `${l.origin} → ${l.destination}` : (l.destination || 'Not set') },
    { label: 'DEPARTURE', value: l.departure_time ? new Date(l.departure_time).toLocaleString() : 'Not set' },
  ],
  Form: AdminTransportForm,
}

export default function AdminTransport() {
  return <AdminListings config={CONFIG} />
}
