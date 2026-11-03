import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import useIsDesktop from './useIsDesktop'
import NotificationBell from './NotificationBell'

// ---------------------------------------------------------------------------
// Desktop shell for PERSONAL (customer) accounts.
// - Phones / narrow screens: renders the page exactly as before (no shell).
// - Desktop (900px and wider): a website-style top navbar + page + footer.
// The shell is drawn as a full-screen layer, so it is never limited by the
// phone-style frame that wraps the rest of the app (same idea as CompanyLayout).
// ---------------------------------------------------------------------------

type NavItem = { label: string; path: string; match: string[] }

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/home', match: ['/home'] },
  { label: 'Hotels', path: '/hotels', match: ['/hotels'] },
  { label: 'Buses', path: '/bus', match: ['/bus'] },
  { label: 'Trains', path: '/train', match: ['/train'] },
  { label: 'Flights', path: '/flights', match: ['/flights', '/flight'] },
  { label: 'Tours', path: '/tours', match: ['/tours', '/tour'] },
  { label: 'Event Centers', path: '/event-centers', match: ['/event-centers', '/event-center'] },
  { label: 'Vehicles', path: '/vehicle-rentals', match: ['/vehicle-rentals'] },
]

function isActive(pathname: string, item: NavItem): boolean {
  return item.match.some((base) => pathname === base || pathname.startsWith(base + '/'))
}

type IconName = 'ticket' | 'wallet' | 'user' | 'settings' | 'help' | 'logout' | 'chevronDown'

function MenuIcon({ name, size = 18 }: { name: IconName; size?: number }) {
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
    case 'ticket':
      return (
        <svg {...common}>
          <path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" />
          <path d="M14 5v14" strokeDasharray="2 3" />
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
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      )
    case 'help':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8" />
          <circle cx="12" cy="17" r="0.6" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5M21 12H9" />
        </svg>
      )
    case 'chevronDown':
      return (
        <svg {...common}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      )
    default:
      return null
  }
}

// The name is remembered between page changes so the avatar does not flicker.
let cachedUserName = ''

const CSS = `
.tcu-root {
  --tcu-primary: #0EA5E9;
  --tcu-secondary: #F97316;
  --tcu-page-bg: #F8FAFC;
  --tcu-border: #E2E8F0;
  --tcu-title: #0F172A;
  --tcu-muted: #64748B;
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  background: var(--tcu-page-bg);
  font-family: inherit;
  color: var(--tcu-title);
}
.tcu-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.tcu-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  flex-shrink: 0;
  height: 72px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 32px;
  background: #FFFFFF;
  border-bottom: 1px solid var(--tcu-border);
}
.tcu-brand {
  flex-shrink: 0;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0.3px;
  cursor: pointer;
  white-space: nowrap;
}
.tcu-brand-a { color: var(--tcu-primary); }
.tcu-brand-b { color: var(--tcu-secondary); }
.tcu-nav {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.tcu-nav::-webkit-scrollbar { display: none; }
.tcu-nav-btn {
  flex-shrink: 0;
  padding: 9px 14px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #475569;
  font-size: 14.5px;
  font-weight: 500;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.tcu-nav-btn:hover { background: #F1F5F9; color: var(--tcu-title); }
.tcu-nav-btn.tcu-active {
  background: #E0F2FE;
  color: #0369A1;
  font-weight: 700;
}
.tcu-nav-btn:focus-visible,
.tcu-bookings-btn:focus-visible,
.tcu-avatar-btn:focus-visible,
.tcu-menu-item:focus-visible,
.tcu-footer-link:focus-visible {
  outline: 2px solid var(--tcu-primary);
  outline-offset: 2px;
}
.tcu-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 14px;
}
.tcu-bookings-btn {
  display: none;
  padding: 9px 16px;
  border: 1px solid var(--tcu-border);
  border-radius: 10px;
  background: #FFFFFF;
  color: #334155;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.tcu-bookings-btn:hover { background: #F1F5F9; }
@media (min-width: 1180px) {
  .tcu-bookings-btn { display: inline-block; }
}
.tcu-avatar-wrap { position: relative; }
.tcu-avatar-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: none;
  background: transparent;
  color: #475569;
  font-family: inherit;
  cursor: pointer;
}
.tcu-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--tcu-primary);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 700;
}
.tcu-menu-backdrop { position: fixed; inset: 0; z-index: 29; }
.tcu-menu {
  position: absolute;
  right: 0;
  top: 54px;
  z-index: 30;
  width: 230px;
  padding: 6px;
  background: #FFFFFF;
  border: 1px solid var(--tcu-border);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(15,23,42,0.14);
}
.tcu-menu-item {
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
.tcu-menu-item:hover { background: #F1F5F9; }
.tcu-menu-item.tcu-danger { color: #DC2626; }
.tcu-menu-sep { height: 1px; margin: 6px 4px; background: var(--tcu-border); }
.tcu-content {
  flex: 1;
  min-width: 0;
  padding: 28px 32px 56px;
  box-sizing: border-box;
}
.tcu-content-inner {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
}
.tcu-content-inner > div[style*="max-width: 480px"] { max-width: 880px !important; }
.tcu-content-inner [style*="position: fixed"][style*="max-width: 480px"] { max-width: 880px !important; }
.tcu-content-inner [style*="position: sticky"] { top: 72px !important; }
[data-tcu-hide="1"] { display: none !important; }
.tcu-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--tcu-border);
  background: #FFFFFF;
  padding: 22px 32px;
  box-sizing: border-box;
}
.tcu-footer-inner {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--tcu-muted);
}
.tcu-footer-links { display: flex; gap: 20px; flex-wrap: wrap; }
.tcu-footer-link {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--tcu-muted);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
}
.tcu-footer-link:hover { color: var(--tcu-title); text-decoration: underline; }
`

export default function UserLayout({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [userName, setUserName] = useState(cachedUserName)
  const [menuOpen, setMenuOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLElement>(null)

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

  // Phone pages draw their own fixed bottom navigation bar. The desktop navbar replaces it,
  // so any small fixed bar that holds the Home and Account tabs is hidden on desktop.
  useEffect(() => {
    if (!isDesktop) return
    const root = contentRef.current
    if (!root) return
    const hideMobileNav = () => {
      root.querySelectorAll<HTMLElement>('[style*="position: fixed"]').forEach((el) => {
        if (el.hasAttribute('data-tcu-hide')) return
        const text = el.textContent || ''
        if (text.includes('Home') && text.includes('Account') && el.getBoundingClientRect().height < 120) {
          el.setAttribute('data-tcu-hide', '1')
        }
      })
    }
    hideMobileNav()
    const observer = new MutationObserver(hideMobileNav)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [isDesktop, pathname])

  // The user's name is only needed for the avatar letter on desktop.
  useEffect(() => {
    if (!isDesktop) return
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      const name = (data.user?.user_metadata?.full_name as string | undefined) || ''
      if (name) cachedUserName = name
      if (!cancelled && name) setUserName(name)
    })
    return () => {
      cancelled = true
    }
  }, [isDesktop])

  if (!isDesktop) {
    return <>{children}</>
  }

  const initial = (userName || 'U').trim().charAt(0).toUpperCase()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return createPortal(
    <div className="tcu-root">
      <style>{CSS}</style>
      <div className="tcu-scroll" ref={scrollRef}>
        <header className="tcu-topbar">
          <div className="tcu-brand" onClick={() => navigate('/home')}>
            <span className="tcu-brand-a">TRAVELER</span>
            <span className="tcu-brand-b">.COM</span>
          </div>

          <nav className="tcu-nav" aria-label="Main">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.path}
                type="button"
                className={'tcu-nav-btn' + (isActive(pathname, item) ? ' tcu-active' : '')}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="tcu-right">
            <button type="button" className="tcu-bookings-btn" onClick={() => navigate('/bookings')}>
              My Bookings
            </button>
            <NotificationBell iconColor="#475569" />
            <div className="tcu-avatar-wrap">
              <button
                type="button"
                className="tcu-avatar-btn"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="tcu-avatar">{initial}</span>
                <MenuIcon name="chevronDown" size={16} />
              </button>
              {menuOpen && (
                <>
                  <div className="tcu-menu-backdrop" onClick={() => setMenuOpen(false)} />
                  <div className="tcu-menu" role="menu">
                    <button type="button" className="tcu-menu-item" role="menuitem" onClick={() => navigate('/bookings')}>
                      <MenuIcon name="ticket" />
                      My Bookings
                    </button>
                    <button type="button" className="tcu-menu-item" role="menuitem" onClick={() => navigate('/wallet')}>
                      <MenuIcon name="wallet" />
                      Wallet
                    </button>
                    <button type="button" className="tcu-menu-item" role="menuitem" onClick={() => navigate('/account')}>
                      <MenuIcon name="user" />
                      Account
                    </button>
                    <button type="button" className="tcu-menu-item" role="menuitem" onClick={() => navigate('/customer-settings')}>
                      <MenuIcon name="settings" />
                      Settings
                    </button>
                    <button type="button" className="tcu-menu-item" role="menuitem" onClick={() => navigate('/support')}>
                      <MenuIcon name="help" />
                      Support
                    </button>
                    <div className="tcu-menu-sep" />
                    <button type="button" className="tcu-menu-item tcu-danger" role="menuitem" onClick={handleLogout}>
                      <MenuIcon name="logout" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="tcu-content" ref={contentRef}>
          <div className="tcu-content-inner">{children}</div>
        </main>

        <footer className="tcu-footer">
          <div className="tcu-footer-inner">
            <span>&copy; {new Date().getFullYear()} TravelerCom. All rights reserved.</span>
            <div className="tcu-footer-links">
              <button type="button" className="tcu-footer-link" onClick={() => navigate('/about')}>About</button>
              <button type="button" className="tcu-footer-link" onClick={() => navigate('/customer-terms')}>Terms</button>
              <button type="button" className="tcu-footer-link" onClick={() => navigate('/customer-privacy')}>Privacy</button>
              <button type="button" className="tcu-footer-link" onClick={() => navigate('/support')}>Support</button>
            </div>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  )
}

// Remembered between page changes so the shell does not flash while the account type loads.
let cachedIsCompany: boolean | null = null

// Wraps any customer-facing page. On desktop, personal accounts get the UserLayout shell;
// company accounts and phones get the page exactly as before.
export function UserShell({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop()
  const [isCompany, setIsCompany] = useState<boolean | null>(cachedIsCompany)

  useEffect(() => {
    if (!isDesktop) return
    let cancelled = false
    const apply = (session: any) => {
      const company = session?.user?.user_metadata?.account_type === 'company'
      cachedIsCompany = company
      if (!cancelled) setIsCompany(company)
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => apply(session))
    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [isDesktop])

  if (!isDesktop || isCompany === true) return <>{children}</>
  if (isCompany === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: '14px' }}>
        Loading...
      </div>
    )
  }
  return <UserLayout>{children}</UserLayout>
}
