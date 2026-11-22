import AdminListings from './AdminListings'
import type { ListingsConfig } from './AdminListings'
import AdminTourForm from './AdminTourForm'

const CONFIG: ListingsConfig = {
  title: 'Tours',
  subtitle: 'All tour listings across the platform.',
  categories: ['tour'],
  icon: 'map',
  searchPlaceholder: 'Search tour name...',
  emptyText: 'No tour listings found.',
  priceUnit: '',
  priceLabel: 'PRICE',
  rowSubtitle: (l) => `${l.companies?.business_name || 'Unknown'} · ${l.destination || 'No destination'}`,
  detailSubtitle: (l) => `${l.companies?.business_name || 'Unknown company'}${l.tour_type ? ` · ${l.tour_type}` : ''}`,
  detailItems: (l) => [
    { label: 'DESTINATION', value: l.destination || 'Not set' },
    { label: 'DATE', value: l.departure_time ? new Date(l.departure_time).toLocaleString() : 'Not set' },
  ],
  Form: AdminTourForm,
}

export default function AdminTours() {
  return <AdminListings config={CONFIG} />
}
