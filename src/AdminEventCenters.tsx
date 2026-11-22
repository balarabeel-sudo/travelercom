import AdminListings from './AdminListings'
import type { ListingsConfig } from './AdminListings'
import AdminEventCenterForm from './AdminEventCenterForm'

const CONFIG: ListingsConfig = {
  title: 'Event Centers',
  subtitle: 'All event center listings across the platform.',
  categories: ['event_center'],
  icon: 'tent',
  searchPlaceholder: 'Search event center name...',
  emptyText: 'No event center listings found.',
  priceUnit: '',
  priceLabel: 'PRICE',
  rowSubtitle: (l) => `${l.companies?.business_name || 'Unknown'} · ${l.destination || 'No destination'}`,
  detailSubtitle: (l) => `${l.companies?.business_name || 'Unknown company'}${l.event_type ? ` · ${l.event_type}` : ''}`,
  detailItems: (l) => [
    { label: 'DESTINATION', value: l.destination || 'Not set' },
    { label: 'CAPACITY', value: l.capacity != null ? `${l.capacity} people` : 'Not set' },
  ],
  Form: AdminEventCenterForm,
}

export default function AdminEventCenters() {
  return <AdminListings config={CONFIG} />
}
