import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import useIsDesktop from './useIsDesktop'
import NotificationBell from './NotificationBell'
import UpgradeModal, { UpgradeGate } from './UpgradeModal'

// ---------------------------------------------------------------------------
// Which routes get the desktop company shell.
// A route is included when its path equals one of these bases, or starts with
// the base followed by "/" (so "/inventory/:id" is covered by "/inventory",
// and "/staff-dashboard" is NOT covered by "/staff").
// App.tsx uses this same function, so the two can never get out of sync.
// ---------------------------------------------------------------------------
const COMPANY_DESKTOP_BASES = [
  '/company-menu',
  '/my-listings',
  '/listings-management',
  '/bookings-management',
  '/guests',
  '/reviews',
  '/settings',
  '/add-guest',
  '/add-bus-listing',
  '/add-listing',
  '/add-hotel-listing',
  '/add-tour-listing',
  '/add-event-center-listing',
  '/add-vehicle-rental-listing',
  '/add-flight-listing',
  '/inventory',
  '/analytics',
  '/promotions',
  '/company-profile',
  '/staff',
]

export function isCompanyDesktopPath(pathname: string): boolean {
  return COMPANY_DESKTOP_BASES.some(
    (base) => pathname === base || pathname.startsWith(base + '/')
  )
}

// ---------------------------------------------------------------------------
// Sidebar navigation
// ---------------------------------------------------------------------------
type IconName =
  | 'grid'
  | 'list'
  | 'sliders'
  | 'calendar'
  | 'users'
  | 'box'
  | 'chart'
  | 'tag'
  | 'shield'
  | 'building'
  | 'back'
  | 'star'
  | 'wallet'
  | 'lock'
  | 'chevronDown'
  | 'logout'
  | 'settings'

type NavItem = { label: string; path: string; icon: IconName; premium?: boolean }
type NavGroup = { title: string | null; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [
      { label: 'Overview', path: '/home', icon: 'grid' },
      { label: 'Bookings', path: '/bookings-management', icon: 'calendar' },
      { label: 'Listings', path: '/my-listings', icon: 'list' },
      { label: 'Inventory', path: '/inventory', icon: 'box', premium: true },
      { label: 'Analytics', path: '/analytics', icon: 'chart', premium: true },
      { label: 'Staff Access', path: '/staff', icon: 'shield', premium: true },
      { label: 'Promotions', path: '/promotions', icon: 'tag', premium: true },
      { label: 'Ratings', path: '/reviews', icon: 'star', premium: true },
      { label: 'Wallet', path: '/wallet', icon: 'wallet' },
      { label: 'Settings', path: '/settings', icon: 'settings' },
    ],
  },
  {
    title: 'More',
    items: [
      { label: 'Listings Management', path: '/listings-management', icon: 'sliders' },
      { label: 'Guests', path: '/guests', icon: 'users', premium: true },
      { label: 'Company Profile', path: '/company-profile', icon: 'building' },
      { label: 'Account & Support', path: '/company-menu', icon: 'settings' },
    ],
  },
]

function isActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path + '/')
}

// Business Suite pages. A Free-plan company who opens one of these directly (for
// example by typing the address) sees the upgrade screen instead of the page.
const PREMIUM_ROUTES: { label: string; path: string }[] = [
  ...NAV_GROUPS.flatMap((g) => g.items.filter((i) => i.premium)).map((i) => ({ label: i.label, path: i.path })),
  { label: 'Add Guest', path: '/add-guest' },
]

function premiumFeatureFor(pathname: string): string | null {
  const hit = PREMIUM_ROUTES.find((r) => isActive(pathname, r.path))
  return hit ? hit.label : null
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
    case 'grid':
      return (
        <svg {...common}>
          <path d="M3 11l9-8 9 8" />
          <path d="M5 10v10h5v-6h4v6h5V10" />
        </svg>
      )
    case 'list':
      return (
        <svg {...common}>
          <path d="M8 6h13M8 12h13M8 18h13" />
          <circle cx="4" cy="6" r="1" />
          <circle cx="4" cy="12" r="1" />
          <circle cx="4" cy="18" r="1" />
        </svg>
      )
    case 'sliders':
      return (
        <svg {...common}>
          <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
          <circle cx="15" cy="6" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      )
    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
          <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2 .7 3.5 2.6 3.5 5.6" />
        </svg>
      )
    case 'box':
      return (
        <svg {...common}>
          <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
          <path d="M3 8l9 5 9-5M12 13v8" />
        </svg>
      )
    case 'chart':
      return (
        <svg {...common}>
          <path d="M3 3v18h18" />
          <path d="M8 17v-5M13 17V8M18 17v-8" />
        </svg>
      )
    case 'tag':
      return (
        <svg {...common}>
          <path d="M3 11v3a1 1 0 0 0 .7.95L8 16l1.5 4.2a1 1 0 0 0 1.6.4L13 19h0" />
          <path d="M8 16V9l11-5v14l-6-2.6" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c0-3.6 2.9-6 6.5-6 1.3 0 2.5.3 3.5.9" />
          <path d="M18 13l3 1.2v3c0 2.4-1.5 3.9-3 4.5-1.5-.6-3-2.1-3-4.5v-3z" />
        </svg>
      )
    case 'building':
      return (
        <svg {...common}>
          <path d="M4 21V5l8-2v18M12 9h8v12M3 21h18" />
          <path d="M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2" />
        </svg>
      )
    case 'star':
      return (
        <svg {...common}>
          <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
        </svg>
      )
    case 'wallet':
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h13v4" />
          <path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-1z" />
          <circle cx="16.5" cy="14" r="1.2" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      )
    case 'back':
      return (
        <svg {...common}>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      )
    case 'chevronDown':
      return (
        <svg {...common}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5M21 12H9" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      )
    default:
      return null
  }
}

// Company name is remembered between page changes so the top bar does not
// flicker empty every time a new company page mounts.
let cachedCompanyName = ''
let cachedCompanyLogo = ''
let cachedCompanyPlan = ''

// ---------------------------------------------------------------------------
// Styles (colours are CSS variables at the top so they are easy to change)
// ---------------------------------------------------------------------------
const CSS = `
.tcl-root {
  --tcl-primary: #2563EB;
  --tcl-primary-soft: #EFF6FF;
  --tcl-page-bg: #F8FAFC;
  --tcl-border: #E2E8F0;
  --tcl-title: #0F172A;
  --tcl-muted: #64748B;
  /* The shell is drawn as a full-screen layer on top of the page, so it is
     always the full width of the browser and never limited by the phone-style
     frame that wraps the rest of the app. */
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  background: var(--tcl-page-bg);
  font-family: inherit;
  color: var(--tcl-title);
}
.tcl-sidebar {
  width: 260px;
  flex-shrink: 0;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 0 14px 24px;
  background: #FFFFFF;
  border-right: 1px solid var(--tcl-border);
  display: flex;
  flex-direction: column;
}
.tcl-brand {
  height: 72px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 10px;
  margin: 0 -14px 14px;
  padding-left: 24px;
  border-bottom: 1px solid var(--tcl-border);
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.3px;
  cursor: pointer;
}
.tcl-brand-a { color: #F97316; }
.tcl-brand-b { color: #0EA5E9; }
.tcl-group-title {
  margin: 22px 12px 8px;
  font-size: 12px;
  font-weight: 700;
  color: #94A3B8;
}
.tcl-nav-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  margin-bottom: 4px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #475569;
  font-size: 15px;
  font-weight: 500;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.tcl-nav-btn:hover {
  background: #F1F5F9;
  color: var(--tcl-title);
}
.tcl-pro {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  background: #F3E8FF;
  color: #6B21A8;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.3px;
}
.tcl-nav-btn.tcl-active {
  background: var(--tcl-primary-soft);
  color: var(--tcl-primary);
  font-weight: 600;
}
.tcl-nav-btn:focus-visible,
.tcl-back:focus-visible,
.tcl-avatar-btn:focus-visible,
.tcl-menu-item:focus-visible {
  outline: 2px solid var(--tcl-primary);
  outline-offset: 2px;
}
.tcl-main {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.tcl-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  height: 72px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 32px;
  background: #FFFFFF;
  border-bottom: 1px solid var(--tcl-border);
}
.tcl-back {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 12px 7px 8px;
  border: 1px solid var(--tcl-border);
  border-radius: 9px;
  background: #ffffff;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.tcl-back:hover { background: #F1F5F9; }
.tcl-company {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #334155;
  font-size: 15px;
  font-weight: 500;
}
.tcl-spacer { flex: 1; }
.tcl-avatar-wrap { position: relative; }
.tcl-avatar-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  border: none;
  background: transparent;
  color: #475569;
  font-family: inherit;
  cursor: pointer;
}
.tcl-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #F97316;
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
}
.tcl-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 29;
}
.tcl-menu {
  position: absolute;
  right: 0;
  top: 56px;
  z-index: 30;
  width: 220px;
  padding: 6px;
  background: #FFFFFF;
  border: 1px solid var(--tcl-border);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(15,23,42,0.14);
}
.tcl-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #334155;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.tcl-menu-item:hover { background: #F1F5F9; }
.tcl-menu-item.tcl-danger { color: #DC2626; }
.tcl-content {
  flex: 1;
  min-width: 0;
  padding: 28px 32px 48px;
  box-sizing: border-box;
}
.tcl-content-inner {
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
}
`

// ---------------------------------------------------------------------------
// Layout component
// On phones / narrow screens it renders the page exactly as before (no shell).
// On desktop it wraps the page in a sidebar + top bar.
// ---------------------------------------------------------------------------
export default function CompanyLayout({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [companyName, setCompanyName] = useState(cachedCompanyName)
  const [logoUrl, setLogoUrl] = useState(cachedCompanyLogo)
  // '' until the plan is known. Nothing is shown as locked while it is unknown.
  const [plan, setPlan] = useState(cachedCompanyPlan)
  const [upgradeFor, setUpgradeFor] = useState<string | null>(null)
  const [planChecked, setPlanChecked] = useState(cachedCompanyPlan !== '')
  const premiumFeature = premiumFeatureFor(pathname)
  const [menuOpen, setMenuOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Start each page at the top when navigating between sections.
  useEffect(() => {
    if (isDesktop) scrollRef.current?.scrollTo(0, 0)
  }, [pathname, isDesktop])

  // The shell scrolls by itself, so the page behind it must not scroll.
  useEffect(() => {
    if (!isDesktop) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isDesktop])

  // Close the account menu whenever the page changes.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Load the company name, logo and plan. Desktop always needs them for the top bar;
  // phones only load them on a Business Suite page whose plan is not known yet.
  // Owners are found by owner_id, staff by company_staff.
  useEffect(() => {
    if (!isDesktop && !(premiumFeature && !planChecked)) return
    let cancelled = false
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) {
        if (!cancelled) setPlanChecked(true)
        return
      }
      let name = ''
      let logo = ''
      let companyPlan = ''
      const { data: own } = await supabase
        .from('companies')
        .select('business_name, logo_url, plan')
        .eq('owner_id', uid)
        .limit(1)
      if (own && own.length > 0) {
        name = own[0].business_name || ''
        logo = own[0].logo_url || ''
        companyPlan = own[0].plan || 'free'
      } else {
        const { data: staff } = await supabase
          .from('company_staff')
          .select('company_id')
          .eq('user_id', uid)
          .eq('status', 'active')
          .limit(1)
        const cid = staff && staff.length > 0 ? staff[0].company_id : null
        if (cid) {
          const { data: comp } = await supabase
            .from('companies')
            .select('business_name, logo_url, plan')
            .eq('id', cid)
            .limit(1)
          name = comp && comp.length > 0 ? comp[0].business_name || '' : ''
          logo = comp && comp.length > 0 ? comp[0].logo_url || '' : ''
          companyPlan = comp && comp.length > 0 ? comp[0].plan || 'free' : ''
        }
      }
      if (name) cachedCompanyName = name
      cachedCompanyLogo = logo
      if (companyPlan) cachedCompanyPlan = companyPlan
      if (!cancelled && name) setCompanyName(name)
      if (!cancelled) setLogoUrl(logo)
      if (!cancelled && companyPlan) setPlan(companyPlan)
      if (!cancelled) setPlanChecked(true)
    }
    load().catch(() => {
      if (!cancelled) setPlanChecked(true)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, premiumFeature])

  // Free-plan companies never get a Business Suite page mounted: they see the upgrade
  // screen. While the plan is still being checked nothing from the page is loaded either.
  const gated = !!premiumFeature && plan === 'free'
  const waiting = !!premiumFeature && plan === '' && !planChecked
  const body = gated ? (
    <UpgradeGate feature={premiumFeature as string} />
  ) : waiting ? (
    <p style={{ textAlign: 'center', color: '#64748B', fontSize: '14px', padding: '60px 0' }}>Loading...</p>
  ) : (
    children
  )

  if (!isDesktop) {
    return <>{body}</>
  }

  const showBack = pathname !== '/home' && pathname !== '/company-menu'
  const initial = (companyName || 'C').trim().charAt(0).toUpperCase()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return createPortal(
    <div className="tcl-root">
      <style>{CSS}</style>
      {upgradeFor && <UpgradeModal feature={upgradeFor} onClose={() => setUpgradeFor(null)} />}

      <aside className="tcl-sidebar">
        <div className="tcl-brand" onClick={() => navigate('/home')}>
          <span className="tcl-brand-a">TRAVELER</span>
          <span className="tcl-brand-b">.COM</span>
        </div>

        {NAV_GROUPS.map((group, gi) => (
          <div key={group.title || 'main-' + gi}>
            {group.title && <div className="tcl-group-title">{group.title}</div>}
            {group.items.map((item) => {
              // Premium items stay visible for Free companies. Tapping one explains
              // the Business Suite plan instead of opening the page.
              const locked = !!item.premium && plan === 'free'
              return (
                <button
                  key={item.path}
                  type="button"
                  className={
                    'tcl-nav-btn' + (isActive(pathname, item.path) ? ' tcl-active' : '')
                  }
                  onClick={() => (locked ? setUpgradeFor(item.label) : navigate(item.path))}
                  aria-label={locked ? item.label + ' (Business Suite feature)' : undefined}
                >
                  <Icon name={item.icon} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {locked && (
                    <span className="tcl-pro">
                      <Icon name="lock" size={12} />
                      PRO
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </aside>

      <div className="tcl-main" ref={scrollRef}>
        <header className="tcl-topbar">
          {showBack && (
            <button type="button" className="tcl-back" onClick={() => navigate(-1)}>
              <Icon name="back" size={18} />
              Back
            </button>
          )}
          <div className="tcl-company">
            <Icon name="building" size={22} />
            <span>Company: {companyName || '...'}</span>
          </div>

          <div className="tcl-spacer" />

          <NotificationBell iconColor="#475569" />

          <div className="tcl-avatar-wrap">
            <button
              type="button"
              className="tcl-avatar-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="tcl-avatar" style={logoUrl ? { background: '#E2E8F0', overflow: 'hidden' } : undefined}>
                {logoUrl ? (
                  <img src={logoUrl} alt={companyName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  initial
                )}
              </span>
              <Icon name="chevronDown" size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="tcl-menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="tcl-menu" role="menu">
                  <button
                    type="button"
                    className="tcl-menu-item"
                    role="menuitem"
                    onClick={() => navigate('/company-profile')}
                  >
                    <Icon name="building" size={18} />
                    Company Profile
                  </button>
                  <button
                    type="button"
                    className="tcl-menu-item"
                    role="menuitem"
                    onClick={() => navigate('/settings')}
                  >
                    <Icon name="settings" size={18} />
                    Settings
                  </button>
                  <button
                    type="button"
                    className="tcl-menu-item tcl-danger"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    <Icon name="logout" size={18} />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="tcl-content">
          <div className="tcl-content-inner">{body}</div>
        </main>
      </div>
    </div>,
    document.body
  )
}
