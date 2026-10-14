import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import useIsDesktop from './useIsDesktop'
import NotificationBell from './NotificationBell'

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
  '/add-guest',
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
  | 'chevronDown'
  | 'logout'
  | 'settings'

type NavItem = { label: string; path: string; icon: IconName }
type NavGroup = { title: string | null; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [
      { label: 'Overview', path: '/home', icon: 'grid' },
      { label: 'Bookings', path: '/bookings-management', icon: 'calendar' },
      { label: 'Listings', path: '/my-listings', icon: 'list' },
      { label: 'Inventory', path: '/inventory', icon: 'box' },
      { label: 'Analytics', path: '/analytics', icon: 'chart' },
      { label: 'Staff Access', path: '/staff', icon: 'shield' },
      { label: 'Promotions', path: '/promotions', icon: 'tag' },
    ],
  },
  {
    title: 'More',
    items: [
      { label: 'Listings Management', path: '/listings-management', icon: 'sliders' },
      { label: 'Guests', path: '/guests', icon: 'users' },
      { label: 'Company Profile', path: '/company-profile', icon: 'building' },
      { label: 'Account & Support', path: '/company-menu', icon: 'settings' },
    ],
  },
]

function isActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path + '/')
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

// ---------------------------------------------------------------------------
// Styles (colours are CSS variables at the top so they are easy to change)
// ---------------------------------------------------------------------------
const CSS = `
/* While the company shell is on screen, make the app frame full width.
   This is a safety net: it works even if the phone-style frame in App.tsx
   still thinks the page should be 430px wide. The style tag is removed when
   the shell unmounts, so customer pages are not affected. */
.tc-app-shell {
  display: block !important;
  padding: 0 !important;
  background: #F8FAFC !important;
}
.tc-app-frame {
  width: 100% !important;
  max-width: none !important;
  min-height: 100vh !important;
  max-height: none !important;
  border-radius: 0 !important;
  overflow: visible !important;
  box-shadow: none !important;
}
.tcl-root {
  --tcl-primary: #2563EB;
  --tcl-primary-soft: #EFF6FF;
  --tcl-page-bg: #F8FAFC;
  --tcl-border: #E2E8F0;
  --tcl-title: #0F172A;
  --tcl-muted: #64748B;
  display: flex;
  min-height: 100vh;
  background: var(--tcl-page-bg);
  font-family: inherit;
  color: var(--tcl-title);
}
.tcl-sidebar {
  position: sticky;
  top: 0;
  align-self: flex-start;
  width: 260px;
  flex-shrink: 0;
  height: 100vh;
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
  const [menuOpen, setMenuOpen] = useState(false)

  // Start each page at the top when navigating between sections.
  useEffect(() => {
    if (isDesktop) window.scrollTo(0, 0)
  }, [pathname, isDesktop])

  // Close the account menu whenever the page changes.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Load the company name for the top bar (desktop only, so phones make no
  // extra requests). Owners are found by owner_id, staff by company_staff.
  useEffect(() => {
    if (!isDesktop) return
    let cancelled = false
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) return
      let name = ''
      const { data: own } = await supabase
        .from('companies')
        .select('business_name')
        .eq('owner_id', uid)
        .limit(1)
      if (own && own.length > 0) {
        name = own[0].business_name || ''
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
            .select('business_name')
            .eq('id', cid)
            .limit(1)
          name = comp && comp.length > 0 ? comp[0].business_name || '' : ''
        }
      }
      if (name) cachedCompanyName = name
      if (!cancelled && name) setCompanyName(name)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isDesktop])

  if (!isDesktop) {
    return <>{children}</>
  }

  const showBack = pathname !== '/home' && pathname !== '/company-menu'
  const initial = (companyName || 'C').trim().charAt(0).toUpperCase()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="tcl-root">
      <style>{CSS}</style>

      <aside className="tcl-sidebar">
        <div className="tcl-brand" onClick={() => navigate('/home')}>
          <span className="tcl-brand-a">TRAVELER</span>
          <span className="tcl-brand-b">.COM</span>
        </div>

        {NAV_GROUPS.map((group, gi) => (
          <div key={group.title || 'main-' + gi}>
            {group.title && <div className="tcl-group-title">{group.title}</div>}
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
              <span className="tcl-avatar">{initial}</span>
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
          <div className="tcl-content-inner">{children}</div>
        </main>
      </div>
    </div>
  )
}
