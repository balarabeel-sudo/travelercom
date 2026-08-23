import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  greenBg: '#DCFCE7',
  red: '#dc2626',
  redBg: '#FEF2F2',
  navy: '#0F172A',
  purple: '#7C3AED',
  purpleBg: '#F5F3FF',
}

// Maps a permission "module" (from company_permissions.module) to a real
// destination in the app. Modules with no built destination yet (finance,
// refunds, platform) are intentionally left out — they'll appear here
// automatically once those pages exist, since this list drives what's shown.
type ActionConfig = { label: string; icon: string; type: 'route' | 'contact'; route?: string }
const MODULE_ACTIONS: Record<string, ActionConfig> = {
  bookings: { label: 'Bookings', icon: 'ticket', type: 'route', route: '/bookings-management' },
  tickets: { label: 'Tickets', icon: 'clipboard', type: 'route', route: '/verify-booking' },
  customers: { label: 'Guests', icon: 'users', type: 'route', route: '/guests' },
  support: { label: 'Support', icon: 'headphones', type: 'contact' },
  finance: { label: 'Finance', icon: 'cash', type: 'route', route: '/analytics' },
  refunds: { label: 'Refunds', icon: 'refresh', type: 'route', route: '/wallet' },
}

// Display-only labels/icons for grouping the full permission catalog in
// "My Permissions" — every module shows here regardless of whether a
// Quick Action page exists for it yet.
const MODULE_LABELS: Record<string, { label: string; icon: string }> = {
  bookings: { label: 'Bookings', icon: 'ticket' },
  tickets: { label: 'Tickets', icon: 'clipboard' },
  customers: { label: 'Guests', icon: 'users' },
  finance: { label: 'Finance', icon: 'cash' },
  refunds: { label: 'Refunds', icon: 'refresh' },
  support: { label: 'Support', icon: 'headphones' },
  platform: { label: 'Platform', icon: 'globe' },
}
function moduleMeta(mod: string) {
  return MODULE_LABELS[mod] || { label: mod.charAt(0).toUpperCase() + mod.slice(1), icon: 'box' }
}

type PermRow = { key: string; module: string; description: string; risk_level: string }
type SectionKey = 'home' | 'permissions' | 'profile'

type StaffInfo = {
  id: string
  company_id: string
  role_label: string | null
  status: string
  joined_at: string | null
  last_active_at: string | null
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function Avatar({ label, size = 40 }: { label: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: COLORS.primary,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.4, fontWeight: 700, flexShrink: 0,
    }}>
      {(label[0] || '?').toUpperCase()}
    </div>
  )
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div style={{ padding: '32px 16px', textAlign: 'center' as const }}>
      <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
        <Icon name={icon} size={20} color={COLORS.textMuted} />
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{title}</p>
      <p style={{ fontSize: 12, color: COLORS.textMuted }}>{subtitle}</p>
    </div>
  )
}

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 16, border: `1px solid ${COLORS.border}`, padding: 16, marginBottom: 14 }}>
      {title && <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 12 }}>{title}</p>}
      {children}
    </div>
  )
}

export default function StaffDashboard() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [accessError, setAccessError] = useState('')
  const [section, setSection] = useState<SectionKey>('home')

  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [staff, setStaff] = useState<StaffInfo | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [roleName, setRoleName] = useState('')

  const [catalog, setCatalog] = useState<PermRow[]>([])
  const [effective, setEffective] = useState<Set<string>>(new Set())

  const [bookingsToday, setBookingsToday] = useState<number | null>(null)
  const [tasks, setTasks] = useState<{ id: string; title: string; priority: string; status: string; created_at: string }[]>([])

  useEffect(() => {
    (async () => {
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userData.user) { navigate('/login'); return }
      const user = userData.user
      setUserEmail(user.email || '')
      setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'there')

      const { data: staffRow, error: staffErr } = await supabase
        .from('company_staff')
        .select('id, company_id, template_id, role_label, status, joined_at, last_active_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (staffErr) {
        setAccessError(`Database error checking staff access: ${staffErr.message}`)
        setChecking(false)
        return
      }
      if (!staffRow) {
        setAccessError('No staff access found for this account.')
        setChecking(false)
        return
      }
      if (staffRow.status === 'suspended') {
        setAccessError('Your staff access has been suspended. Contact your company admin.')
        setChecking(false)
        return
      }

      setStaff(staffRow)
      setRoleName(staffRow.role_label || 'Staff')

      const [companyRes, templateRes, catalogRes, overridesRes] = await Promise.all([
        supabase.from('companies').select('*').eq('id', staffRow.company_id).maybeSingle(),
        staffRow.template_id
          ? supabase.from('company_role_templates').select('name').eq('id', staffRow.template_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase.from('company_permissions').select('key, module, description, risk_level'),
        supabase.from('company_staff_permission_overrides').select('*').eq('company_staff_id', staffRow.id),
      ])

      if (companyRes.data?.business_name) setCompanyName(companyRes.data.business_name)
      const cd: any = companyRes.data || {}
      setCompanyPhone(cd.business_phone || cd.phone || cd.contact_phone || '')
      setCompanyEmail(cd.business_email || cd.email || cd.contact_email || '')
      if (templateRes?.data?.name) setRoleName(templateRes.data.name)

      const permCatalog: PermRow[] = catalogRes.data || []
      setCatalog(permCatalog)

      let basePerms = new Set<string>()
      if (staffRow.template_id) {
        const { data: templatePerms } = await supabase
          .from('company_role_template_permissions')
          .select('permission_key')
          .eq('template_id', staffRow.template_id)
        basePerms = new Set((templatePerms || []).map((r: any) => r.permission_key))
      }

      // Overrides layer on top of the role template. The exact override-flag
      // column wasn't confirmed against the live schema — this handles the
      // common shapes (`granted` boolean, or `action` text) defensively.
      for (const row of (overridesRes.data || []) as any[]) {
        const isGrant = row.granted === true || row.action === 'grant' || row.action === 'allow'
        const isRevoke = row.granted === false || row.action === 'revoke' || row.action === 'deny'
        if (isGrant) basePerms.add(row.permission_key)
        else if (isRevoke) basePerms.delete(row.permission_key)
      }

      setEffective(basePerms)

      if (basePerms.has('bookings.view')) {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        const { count } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', staffRow.company_id)
          .gte('created_at', todayStart.toISOString())
        setBookingsToday(count ?? 0)
      }

      const { data: taskRows } = await supabase
        .from('staff_tasks')
        .select('id, title, priority, status, created_at')
        .eq('assigned_to', staffRow.id)
        .order('status', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(20)
      setTasks(taskRows || [])

      setChecking(false)
    })()
  }, [navigate])

  const markTaskDone = async (taskId: string) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'done' } : t))
    const { error } = await supabase
      .from('staff_tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', taskId)
    if (error) {
      // revert on failure
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'open' } : t))
      alert('Could not update task: ' + error.message)
    }
  }

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted, fontSize: 13 }}>
        Loading your workspace...
      </div>
    )
  }

  if (accessError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center' as const }}>
        <Icon name="alertCircle" size={28} color={COLORS.red} />
        <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginTop: 12, marginBottom: 6 }}>We couldn't load your workspace</p>
        <p style={{ fontSize: 12.5, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 18 }}>{accessError}</p>
        <span onClick={() => navigate('/login')} style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Back to Login</span>
      </div>
    )
  }

  const groupedCatalog = catalog.reduce((acc: Record<string, PermRow[]>, p) => {
    (acc[p.module] = acc[p.module] || []).push(p)
    return acc
  }, {})

  const visibleModules = Object.keys(groupedCatalog).filter((m) => {
    if (!groupedCatalog[m].some((p) => effective.has(p.key))) return false
    const action = MODULE_ACTIONS[m]
    if (!action) return false // no built page for this module yet — stays hidden until one exists
    if (action.type === 'contact' && !companyPhone && !companyEmail) return false
    return true
  })

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: 480, margin: '0 auto', paddingBottom: 90 }}>

      <div style={{ padding: '18px 20px 14px 20px', background: COLORS.card, borderBottom: `1px solid ${COLORS.border}` }}>
        <p style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>
          <span style={{ color: COLORS.primary }}>TRAVELER</span><span style={{ color: COLORS.secondary }}>.COM</span>
        </p>
        {section === 'home' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar label={userName} size={44} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{greeting()}, {userName}</p>
              <p style={{ fontSize: 11.5, color: COLORS.textMuted }}>{companyName || 'Loading...'}</p>
            </div>
          </div>
        )}
        {section === 'permissions' && <p style={{ fontSize: 17, fontWeight: 800, color: COLORS.text }}>My Permissions</p>}
        {section === 'profile' && <p style={{ fontSize: 17, fontWeight: 800, color: COLORS.text }}>Profile</p>}
      </div>

      <div style={{ padding: 16 }}>
        {section === 'home' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ background: COLORS.navy, borderRadius: 12, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="briefcase" size={13} color="#FBBF24" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{roleName}</span>
              </div>
              <div style={{ background: COLORS.greenBg, borderRadius: 12, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: COLORS.green }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.green }}>Active</span>
              </div>
            </div>

            <SectionCard title="Today's Overview">
              {bookingsToday !== null ? (
                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, flex: 1 }}>
                  <p style={{ fontSize: 22, fontWeight: 800, color: COLORS.text }}>{bookingsToday}</p>
                  <p style={{ fontSize: 11.5, color: COLORS.textMuted }}>Bookings today</p>
                </div>
              ) : (
                <p style={{ fontSize: 12.5, color: COLORS.textMuted }}>Nothing to show for your current access yet.</p>
              )}
            </SectionCard>

            <SectionCard title="Your Access">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, color: COLORS.textMuted }}>Role</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.text }}>{roleName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, color: COLORS.textMuted }}>Access Status</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.green }}>Active</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 12.5, color: COLORS.textMuted }}>Permissions</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.text }}>{effective.size}</span>
              </div>
              <button onClick={() => setSection('permissions')} style={{
                width: '100%', padding: 11, borderRadius: 10, border: `1px solid ${COLORS.border}`,
                background: COLORS.bg, color: COLORS.primary, fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
              }}>
                View My Permissions
              </button>
            </SectionCard>

            {visibleModules.length > 0 && (
              <SectionCard title="Quick Actions">
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
                  {visibleModules.map((m) => {
                    const action = MODULE_ACTIONS[m]
                    const handleClick = () => {
                      if (action.type === 'route' && action.route) navigate(action.route)
                      else if (action.type === 'contact') {
                        if (companyPhone) window.location.href = `tel:${companyPhone}`
                        else if (companyEmail) window.location.href = `mailto:${companyEmail}`
                      }
                    }
                    return (
                      <div key={m} onClick={handleClick} style={{
                        flex: '1 1 45%', background: '#F8FAFC', borderRadius: 12, padding: 12,
                        display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6,
                        cursor: 'pointer',
                      }}>
                        <Icon name={action.icon} size={18} color={COLORS.primary} />
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.text }}>{action.label}</span>
                      </div>
                    )
                  })}
                </div>
              </SectionCard>
            )}

            <SectionCard title="My Tasks">
              {tasks.length === 0 && (
                <EmptyState icon="checkCircle" title="You're all caught up" subtitle="You have no pending tasks right now." />
              )}
              {tasks.map((t) => {
                const priorityColor = t.priority === 'high' ? COLORS.red : t.priority === 'medium' ? '#F59E0B' : COLORS.textMuted
                return (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                    borderBottom: `1px solid ${COLORS.border}`, opacity: t.status === 'done' ? 0.5 : 1,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColor, flexShrink: 0 }} />
                    <span style={{
                      flex: 1, fontSize: 12.5, color: COLORS.text,
                      textDecoration: t.status === 'done' ? 'line-through' : 'none',
                    }}>{t.title}</span>
                    {t.status === 'open' ? (
                      <button onClick={() => markTaskDone(t.id)} style={{
                        border: `1px solid ${COLORS.border}`, background: '#fff', borderRadius: 8,
                        padding: '5px 10px', fontSize: 11, fontWeight: 700, color: COLORS.primary, cursor: 'pointer',
                      }}>Done</button>
                    ) : (
                      <Icon name="checkCircle" size={15} color={COLORS.green} />
                    )}
                  </div>
                )
              })}
            </SectionCard>

            <SectionCard title="Recent Activity">
              <EmptyState icon="clock" title="Nothing yet" subtitle="Your recent activity will appear here." />
            </SectionCard>
          </>
        )}

        {section === 'permissions' && (
          <>
            {Object.keys(groupedCatalog).length === 0 && (
              <EmptyState icon="shield" title="No permissions found" subtitle="Contact your company admin if this looks wrong." />
            )}
            {Object.keys(groupedCatalog).map((mod) => {
              const meta = moduleMeta(mod)
              return (
                <SectionCard key={mod} title={meta.label}>
                  {groupedCatalog[mod].map((p) => {
                    const has = effective.has(p.key)
                    return (
                      <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                        <Icon name={has ? 'check' : 'x'} size={15} color={has ? COLORS.green : COLORS.textMuted} />
                        <span style={{ fontSize: 12.5, color: has ? COLORS.text : COLORS.textMuted }}>{p.description}</span>
                      </div>
                    )
                  })}
                </SectionCard>
              )
            })}
          </>
        )}

        {section === 'profile' && staff && (
          <>
            <SectionCard>
              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', textAlign: 'center' as const, padding: '8px 0 16px 0' }}>
                <Avatar label={userName} size={64} />
                <p style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, marginTop: 10 }}>{userName}</p>
                <p style={{ fontSize: 12, color: COLORS.textMuted }}>{userEmail}</p>
              </div>
              {[
                ['Role', roleName],
                ['Account Status', 'Active'],
                ['Joined', staff.joined_at ? new Date(staff.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
                ['Last Active', staff.last_active_at ? new Date(staff.last_active_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderTop: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: 12.5, color: COLORS.textMuted }}>{label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.text }}>{value}</span>
                </div>
              ))}
            </SectionCard>

            <SectionCard title="Account">
              <div onClick={() => setSection('permissions')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', cursor: 'pointer', borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 13, color: COLORS.text }}>My Permissions</span>
                <Icon name="chevronRight" size={16} color={COLORS.textMuted} />
              </div>
              <div onClick={async () => { await supabase.auth.signOut(); navigate('/login') }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', cursor: 'pointer' }}>
                <span style={{ fontSize: 13, color: COLORS.red, fontWeight: 700 }}>Log Out</span>
                <Icon name="logOut" size={16} color={COLORS.red} />
              </div>
            </SectionCard>
          </>
        )}
      </div>

      <div style={{
        position: 'fixed' as const, bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto',
        background: COLORS.card, borderTop: `1px solid ${COLORS.border}`,
        display: 'flex', padding: '10px 0 14px 0',
      }}>
        {([
          ['home', 'home', 'Home'],
          ['permissions', 'shield', 'Access'],
          ['profile', 'user', 'Profile'],
        ] as [SectionKey, string, string][]).map(([key, icon, label]) => (
          <div key={key} onClick={() => setSection(key)} style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <Icon name={icon} size={20} color={section === key ? COLORS.primary : COLORS.textMuted} />
            <span style={{ fontSize: 10.5, fontWeight: section === key ? 700 : 500, color: section === key ? COLORS.primary : COLORS.textMuted }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
