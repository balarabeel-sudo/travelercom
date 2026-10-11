import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useIsDesktop from './useIsDesktop'

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

type NavItem = { label: string; path: string; icon: IconName }
type NavGroup = { title: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Main',
    items: [{ label: 'Overview', path: '/company-menu', icon: 'grid' }],
  },
  {
    title: 'Manage',
    items: [
      { label: 'My Listings', path: '/my-listings', icon: 'list' },
      { label: 'Listings Management', path: '/listings-management', icon: 'sliders' },
      { label: 'Bookings', path: '/bookings-management', icon: 'calendar' },
      { label: 'Guests', path: '/guests', icon: 'users' },
    ],
  },
  {
    title: 'Business',
    items: [
      { label: 'Inventory', path: '/inventory', icon: 'box' },
      { label: 'Analytics', path: '/analytics', icon: 'chart' },
      { label: 'Promotions', path: '/promotions', icon: 'tag' },
    ],
  },
  {
    title: 'Team',
    items: [{ label: 'Staff & Roles', path: '/staff', icon: 'shield' }],
  },
  {
    title: 'Account',
    items: [{ label: 'Company Profile', path: '/company-profile', icon: 'building' }],
  },
]

function isActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path + '/')
}

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 20,
    height: 20,
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
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
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
          <path d="M7 15l4-4 3 3 5-6" />
        </svg>
      )
    case 'tag':
      return (
        <svg {...common}>
          <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
          <circle cx="7.5" cy="7.5" r="1.2" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      )
    case 'building':
      return (
        <svg {...common}>
          <path d="M4 21V5l8-2v18M12 9h8v12M3 21h18" />
          <path d="M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2" />
        </svg>
      )
    case 'back':
      return (
        <svg {...common}>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      )
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Styles (colours are CSS variables at the top so they are easy to change)
// ---------------------------------------------------------------------------
const CSS = `
.tcl-root {
  --tcl-sidebar-bg: #0f172a;
  --tcl-sidebar-text: #94a3b8;
  --tcl-sidebar-text-active: #ffffff;
  --tcl-sidebar-hover: rgba(255,255,255,0.06);
  --tcl-sidebar-active-bg: rgba(37,99,235,0.18);
  --tcl-primary: #2563eb;
  --tcl-page-bg: #f8fafc;
  --tcl-border: #e2e8f0;
  --tcl-title: #0f172a;
  display: flex;
  min-height: 100vh;
  background: var(--tcl-page-bg);
  font-family: inherit;
}
.tcl-sidebar {
  position: sticky;
  top: 0;
  align-self: flex-start;
  width: 252px;
  flex-shrink: 0;
  height: 100vh;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 20px 14px 24px;
  background: var(--tcl-sidebar-bg);
  display: flex;
  flex-direction: column;
}
.tcl-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 10px 22px;
  color: #ffffff;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.2px;
}
.tcl-brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--tcl-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 800;
}
.tcl-group-title {
  margin: 18px 10px 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #64748b;
}
.tcl-nav-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 2px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--tcl-sidebar-text);
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.tcl-nav-btn:hover {
  background: var(--tcl-sidebar-hover);
  color: #e2e8f0;
}
.tcl-nav-btn.tcl-active {
  background: var(--tcl-sidebar-active-bg);
  color: var(--tcl-sidebar-text-active);
  font-weight: 600;
}
.tcl-nav-btn.tcl-active svg {
  color: #60a5fa;
}
.tcl-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.tcl-topbar {
  position: sticky;
  top: 0;
  z-index: 5;
  height: 64px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 28px;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(8px);
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
.tcl-back:hover { background: #f1f5f9; }
.tcl-page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--tcl-title);
}
.tcl-content {
  flex: 1;
  min-width: 0;
  padding: 24px 28px 40px;
  box-sizing: border-box;
}
.tcl-content-inner {
  width: 100%;
  max-width: 1280px;
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

  // Start each page at the top when navigating between sections.
  useEffect(() => {
    if (isDesktop) window.scrollTo(0, 0)
  }, [pathname, isDesktop])

  if (!isDesktop) {
    return <>{children}</>
  }

  let pageTitle = 'Company'
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isActive(pathname, item.path)) pageTitle = item.label
    }
  }

  const showBack = pathname !== '/company-menu'

  return (
    <div className="tcl-root">
      <style>{CSS}</style>

      <aside className="tcl-sidebar">
        <div className="tcl-brand">
          <div className="tcl-brand-mark">T</div>
          <span>TravelerCom</span>
        </div>

        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="tcl-group-title">{group.title}</div>
            {group.items.map((item) => (
              <button
                key={item.path}
                type="button"
                className={
                  'tcl-nav-btn' + (isActive(pathname, item.path) ? ' tcl-active' : '')
                }
                onClick={() => navigate(item.path)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </aside>

      <div className="tcl-main">
        <header className="tcl-topbar">
          {showBack && (
            <button type="button" className="tcl-back" onClick={() => navigate(-1)}>
              <Icon name="back" />
              Back
            </button>
          )}
          <h1 className="tcl-page-title">{pageTitle}</h1>
        </header>

        <main className="tcl-content">
          <div className="tcl-content-inner">{children}</div>
        </main>
      </div>
    </div>
  )
}
