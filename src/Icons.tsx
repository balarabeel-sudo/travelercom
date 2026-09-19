type IconProps = {
  name: string
  size?: number
  color?: string
  strokeWidth?: number
  filled?: boolean
}

const paths: Record<string, string> = {
  home: 'M3 11l9-8 9 8M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10',
  cart: 'M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-1.3 4.3A1 1 0 0 0 6.7 19H18M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  building: 'M4 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16M12 21v-6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6M8 7h.01M8 11h.01M8 15h.01M4 21h16',
  robot: 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm3 5h.01M16 12h.01M9 17h6',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm11 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  tractor: 'M3 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0Zm12 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM6 17h6M9 17V9h4l3 4h2v4M9 9V5H6',
  bookmark: 'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9Zm-7 13a2 2 0 0 0 4 0',
  message: 'M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z',
  comment: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z',
  share: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13',
  chevronRight: 'M9 18l6-6-6-6',
  chevronLeft: 'M15 18l-6-6 6-6',
  arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  close: 'M18 6 6 18M6 6l12 12',
  edit: 'M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z',
  lock: 'M5 11h14v10H5V11Zm3 0V7a4 4 0 0 1 8 0v4',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3a14 14 0 0 1 4 9 14 14 0 0 1-4 9 14 14 0 0 1-4-9 14 14 0 0 1 4-9Z',
  currency: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h1a3.5 3.5 0 0 1 0 7H4M7 19h8M12 2v2M12 20v2',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8Zm2 13h14',
  leaf: 'M11 20A7 7 0 0 1 4 13c0-6 7-11 15-11 0 8-5 15-11 15a7 7 0 0 1-6-3.5',
  mapPin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  star: 'M12 2l2.9 6.6L22 9.3l-5 4.9 1.2 7.2L12 17.8l-6.2 3.6L7 14.2 2 9.3l7.1-.7L12 2Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  wrench: 'M14.7 6.3a4 4 0 0 1 5 5l-6.1 6.1a2 2 0 0 1-2.8 0L4.6 11.2a2 2 0 0 1 0-2.8l6.1-6.1a4 4 0 0 1 4 4Z',
  truck: 'M2 8h11v8H2V8Zm11 3h4l3 3v2h-7v-5Zm-8 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  seedling: 'M12 21v-8M12 13c0-4-3-7-7-7 0 4 3 7 7 7Zm0 0c0-5 3-9 8-9 0 5-3 9-8 9Z',
  droplet: 'M12 2s6 7 6 12a6 6 0 0 1-12 0c0-5 6-12 6-12Z',
  checkCircle: 'M22 11.1V12a10 10 0 1 1-6-9.2M22 4 12 14.1l-3-3',
  filter: 'M4 4h16l-6 8v6l-4 2v-8L4 4Z',
  camera: 'M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Zm8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 15-4.5L23 9M1 15l4.5 4.5A9 9 0 0 0 20.5 15',
  alertTriangle: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01',

  // --- Added: already referenced by existing listing/booking/payment UI
  // (Hotel & Bus amenity icons, receipt rows, payment method icons) but
  // missing from this file, so they were rendering as the fallback circle.
  hotel: 'M3 18v-6a3 3 0 0 1 3-3h3a3 3 0 0 1 3 3M3 18v3M3 18h18M12 12h6a3 3 0 0 1 3 3v3M21 18v3M6 12V9a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v3',
  trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6h14ZM10 11v6M14 11v6',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  hourglass: 'M6 2h12M6 22h12M6 2c0 6 6 8 6 10s-6 4-6 10M18 2c0 6-6 8-6 10s6 4 6 10',
  wifi: 'M5 12.6a10 10 0 0 1 14 0M8.5 16.1a5 5 0 0 1 7 0M12 20h.01M2 8.8a15 15 0 0 1 20 0',
  parking: 'M7 4v16M7 4h5a4 4 0 1 1 0 8H7',
  restaurant: 'M6 2v8a2 2 0 0 0 4 0V2M8 10v12M16 2v20M16 2c-2 0-3 2-3 5s1 5 3 5',
  pool: 'M2 18c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0M2 12c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0',
  gym: 'M6 7v10M18 7v10M2 9v6M22 9v6M6 12h12',
  laundry: 'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm8 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
  snowflake: 'M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7',
  coffee: 'M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8ZM6 1v3M10 1v3M14 1v3',
  plane: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  food: 'M11 2v20M11 2c-2 0-3 3-3 6s1 4 3 4M20 2v20M20 2c-3 1-4 4-4 8 0 2 1 3 2 3',
  plug: 'M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0V8ZM12 18v4',
  seat: 'M5 11V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M4 11h16v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6ZM6 18v3M18 18v3',
  toilet: 'M5 12h14M7 12V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v7M7 12a5 5 0 0 0 10 0M9 22h6l1-5H8l1 5Z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm2.5-13.5-2 5.5-5.5 2 2-5.5 5.5-2Z',
  van: 'M2 9h13l4 4v5h-3M2 9v9h3M2 9V6h9l4 3M6 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  shield: 'M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z',
  speaker: 'M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 15h.01M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  wallet: 'M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
  cash: 'M4 6h16v12H4V6Zm8 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 10h.01M20 14h.01',

  // --- Added: used by the new Vehicle Rental listing form and the Staff
  // Overview panel.
  car: 'M5 17h14M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0M3 17v-4l2-5h14l2 5v4M5 8h14',
  bluetooth: 'M7 7l10 10-5 5V2l5 5L7 17',
  bus: 'M4 16V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10M4 16a2 2 0 0 0 2 2h1M4 16h16m0 0a2 2 0 0 1-2 2h-1M7 18v2M17 18v2M7 9h10',
  map: 'M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3ZM9 3v15M15 6v15',
  tent: 'M4 20 12 4l8 16M2 20h20M12 12l3 8H9l3-8Z',
  ticket: 'M2 9a3 3 0 0 1 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 1 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v3ZM13 5v14',
  trendingUp: 'M23 6 13.5 15.5 8.5 10.5 1 18M17 6h6v6',

  // --- Added: also referenced in Home.tsx (company stats icons, bottom nav)
  barChart: 'M3 3v18h18M8 17V10M13 17V6M18 17v-4',
  box: 'M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  clipboard: 'M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1ZM6 4h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 3',
  megaphone: 'M3 10v4a1 1 0 0 0 1 1h2l7 4V5L6 9H4a1 1 0 0 0-1 1ZM17 8a4 4 0 0 1 0 8',
  train: 'M4 15V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Zm0 0h16M8 21l-2 2M16 21l2 2M8 6v5M16 6v5',
  userPlus: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6',

  // --- Added: referenced in Settings.tsx / Account.tsx / Login.tsx / CompanyMenu.tsx
  chat: 'M4 4h16v12H8l-4 4V4Z',
  creditCard: 'M2 6h20v4H2V6Zm0 4h20v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9Zm3 6h6',
  fileText: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M9 13h6M9 17h6M9 9h2',
  helpCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-1.5-9a1.5 1.5 0 1 1 2.6 1c-.6.5-1.1.9-1.1 2M12 17h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13h.01M11 11h1v6h1',
  logOut: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.3 1a7.4 7.4 0 0 0-2-1.2L14.6 3H9.4l-.4 2.6a7.4 7.4 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.3-1a7.4 7.4 0 0 0 2 1.2l.4 2.6h5.2l.4-2.6a7.4 7.4 0 0 0 2-1.2l2.3 1 2-3.4-2-1.6a7.4 7.4 0 0 0 .1-1.2Z',

  // --- Added
  withdraw: 'M12 20V8M7 13l5 5 5-5M5 4h14',
  premium: 'M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8Zm2 13h14M8 15h8',
  eye: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 11 7 11 7a13.2 13.2 0 0 1-3.4 4.2M6.6 6.6C3.7 8.4 2 12 2 12s2.5 4.5 7.1 6.3M14.1 14.1 9.9 9.9',
}

export default function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 2, filled }: IconProps) {
  const d = paths[name]

  if (!d) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} />
      </svg>
    )
  }

  const shouldFill = filled ?? (name === 'heart' || name === 'star')

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} fill={shouldFill ? color : 'none'} />
    </svg>
  )
}
