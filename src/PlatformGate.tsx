import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

// PlatformGate makes the Platform Management switches real.
// It reads the single row in platform_settings and:
//   1. Maintenance mode: shows a maintenance screen to everyone except admins.
//   2. Feature flags: blocks the pages of a feature the founder switched off.
//   3. New registrations: blocks the register page when switched off.
// Safety rules:
//   - If the settings cannot be read (offline, error), the app stays OPEN.
//   - Admins always get through, so the founder can never lock himself out.
//   - Sign-in pages stay reachable during maintenance so admins can sign in.

const COLORS = {
  primary: '#0EA5E9',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  red: '#dc2626',
  navy: '#0F172A',
}

type PlatformSettings = {
  maintenance_mode: boolean | null
  maintenance_message: string | null
  new_registrations_enabled: boolean | null
  feature_hotel_booking: boolean | null
  feature_transport_booking: boolean | null
  feature_flight_booking: boolean | null
  feature_wallet: boolean | null
}

// Pages that stay open during maintenance so admins can still sign in.
const MAINTENANCE_OPEN_PATHS = ['/', '/account-type', '/login', '/forgot-password']

type FlagKey = 'new_registrations_enabled' | 'feature_hotel_booking' | 'feature_transport_booking' | 'feature_flight_booking' | 'feature_wallet'

// Which switch controls which pages. A path matches itself and everything below it.
const FEATURE_ROUTES: { flag: FlagKey; paths: string[]; message: string }[] = [
  { flag: 'new_registrations_enabled', paths: ['/register'], message: 'New sign ups are paused right now. Please check back soon.' },
  { flag: 'feature_hotel_booking', paths: ['/hotels'], message: 'Hotel booking is temporarily unavailable. Please check back soon.' },
  { flag: 'feature_transport_booking', paths: ['/bus', '/train'], message: 'Bus and train booking is temporarily unavailable. Please check back soon.' },
  { flag: 'feature_flight_booking', paths: ['/flights', '/flight'], message: 'Flight booking is temporarily unavailable. Please check back soon.' },
  { flag: 'feature_wallet', paths: ['/wallet'], message: 'The wallet is temporarily unavailable. Please check back soon.' },
]

function pathMatches(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(base + '/')
}

function Screen(props: { icon: string; title: string; message: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px', padding: '32px 24px', maxWidth: '380px', width: '100%', textAlign: 'center' as const }}>
        <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
          <Icon name={props.icon} size={26} color={COLORS.navy} />
        </div>
        <p style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text, marginBottom: '8px' }}>{props.title}</p>
        <p style={{ fontSize: '13px', color: COLORS.textMuted, lineHeight: 1.6, marginBottom: '22px' }}>{props.message}</p>
        {props.children}
      </div>
    </div>
  )
}

function PrimaryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ background: COLORS.navy, color: '#fff', borderRadius: '10px', padding: '12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginBottom: '10px' }}>
      {label}
    </div>
  )
}

function TextLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <span onClick={onClick} style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>
      {label}
    </span>
  )
}

function PlatformGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  // null = not known yet, true/false = known
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  const loadSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('maintenance_mode, maintenance_message, new_registrations_enabled, feature_hotel_booking, feature_transport_booking, feature_flight_booking, feature_wallet')
        .eq('id', 'main')
        .maybeSingle()
      // On any problem keep the previous value; with none yet the app stays open.
      if (!error && data) setSettings(data as PlatformSettings)
    } catch {
      // Stay open when settings cannot be read.
    }
  }, [])

  const checkAdmin = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (!user) {
        setIsAdmin(false)
        return
      }
      const { data, error } = await supabase.from('admins').select('suspended').eq('user_id', user.id).maybeSingle()
      setIsAdmin(!error && !!data && !data.suspended)
    } catch {
      setIsAdmin(false)
    }
  }, [])

  // Settings: load now, then on a one minute timer and whenever the app comes back to the screen.
  useEffect(() => {
    loadSettings()
    const timer = setInterval(loadSettings, 60000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadSettings()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadSettings])

  // Admin status: check now and again whenever someone signs in or out.
  useEffect(() => {
    checkAdmin()
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      checkAdmin()
    })
    return () => listener.subscription.unsubscribe()
  }, [checkAdmin])

  // No settings yet (or unreadable): the app stays open.
  if (!settings) return <>{children}</>

  const maintenanceBlocks = settings.maintenance_mode === true && !MAINTENANCE_OPEN_PATHS.includes(pathname)

  const blockedFeature = FEATURE_ROUTES.find(
    (f) => settings[f.flag] === false && f.paths.some((p) => pathMatches(pathname, p))
  )

  // Nothing to block on this page.
  if (!maintenanceBlocks && !blockedFeature) return <>{children}</>

  // Wait for the admin check so an admin never sees a flash of the blocked screen.
  if (isAdmin === null) {
    return <div style={{ minHeight: '100vh', background: COLORS.bg }} />
  }

  // Admins always get through.
  if (isAdmin) return <>{children}</>

  if (maintenanceBlocks) {
    return (
      <Screen
        icon="hourglass"
        title="We will be right back"
        message={settings.maintenance_message || 'TravelerCom is being updated. Please check back shortly.'}>
        <PrimaryButton label="Try again" onClick={loadSettings} />
        <TextLink label="Staff sign in" onClick={() => navigate('/login')} />
      </Screen>
    )
  }

  return (
    <Screen icon="alertCircle" title="Not available right now" message={blockedFeature ? blockedFeature.message : ''}>
      <PrimaryButton label="Back to home" onClick={() => navigate('/home')} />
    </Screen>
  )
}

export default PlatformGate
