import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  greenBg: '#F0FDF4',
  red: '#dc2626',
  redBg: '#FEF2F2',
  blue: '#0EA5E9',
  blueBg: '#EFF6FF',
  orange: '#d97706',
  orangeBg: '#FFFBEB',
  purple: '#7c3aed',
  purpleBg: '#F5F3FF',
}

type Profile = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  account_type: string | null
  status: string | null
  created_at: string
  suspended_reason?: string | null
}

type Summary = {
  total_users: number
  total_new_this_week: number
  personal_accounts: number
  company_accounts: number
  active_users: number
  active_new_this_week: number
  suspended_users: number
  suspended_this_week: number
}

type ChipFilter = 'all' | 'personal' | 'company' | 'active' | 'suspended'
const PAGE_SIZE_OPTIONS = [10, 25, 50]

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false)
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isDesktop
}

function initials(u: Profile) {
  return (u.full_name || u.email || '?').charAt(0).toUpperCase()
}

function StatCard({ label, value, delta, deltaGood, icon, color, bg }: {
  label: string; value: number; delta?: string; deltaGood?: boolean; icon: string; color: string; bg: string
}) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px', flex: '1 1 150px', minWidth: '150px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} color={color} />
        </div>
        <span style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted }}>{label}</span>
      </div>
      <p style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text, lineHeight: 1 }}>{value.toLocaleString()}</p>
      {delta && (
        <p style={{ fontSize: '10.5px', fontWeight: 700, color: deltaGood ? COLORS.green : COLORS.red, marginTop: '5px' }}>{delta}</p>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const suspended = status === 'suspended'
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, padding: '4px 9px', borderRadius: '6px',
      background: suspended ? COLORS.redBg : COLORS.greenBg,
      color: suspended ? COLORS.red : COLORS.green,
      display: 'inline-block',
    }}>
      {suspended ? 'Suspended' : 'Active'}
    </span>
  )
}

function TypeBadge({ type }: { type: string | null }) {
  const isCompany = type === 'company'
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, padding: '4px 9px', borderRadius: '6px',
      background: isCompany ? COLORS.blueBg : COLORS.purpleBg,
      color: isCompany ? COLORS.blue : COLORS.purple,
      display: 'inline-block',
    }}>
      {isCompany ? 'Company' : 'Personal'}
    </span>
  )
}

export default function AdminUsers() {
  const isDesktop = useIsDesktop()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [chip, setChip] = useState<ChipFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [selected, setSelected] = useState<Profile | null>(null)
  const [reasonInput, setReasonInput] = useState('')
  const [showReasonBox, setShowReasonBox] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  const [showAddUser, setShowAddUser] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'personal' | 'company'>('personal')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState(false)

  const fetchSummary = async () => {
    const { data, error } = await supabase.rpc('admin_users_summary')
    if (!error && data) setSummary(data as Summary)
  }

  const fetchUsers = async () => {
    setLoading(true)
    setErrorMsg('')
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false })

    if (search.trim()) {
      query = query.or(`full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%,id.eq.${search.trim()}`)
    }
    if (chip === 'personal') query = query.eq('account_type', 'personal')
    if (chip === 'company') query = query.eq('account_type', 'company')
    if (chip === 'active') query = query.neq('status', 'suspended')
    if (chip === 'suspended') query = query.eq('status', 'suspended')

    query = query.range(from, to)

    const { data, error, count } = await query
    setLoading(false)
    if (error) {
      setErrorMsg("Couldn't load users — make sure admin_users_round1_setup.sql (and the fix) have been run.")
      return
    }
    setUsers(data || [])
    setTotalCount(count || 0)
  }

  useEffect(() => { fetchSummary() }, [])
  useEffect(() => { fetchUsers() }, [chip, page, pageSize, search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1) }, [chip, search, pageSize])

  const runAction = async (action: 'suspend' | 'restore', reason?: string) => {
    if (!selected) return
    setActionLoading(true)
    setActionError('')
    const { data, error } = await supabase.functions.invoke('admin-manage-users', {
      body: { action, target_user_id: selected.id, reason: reason || undefined },
    })
    setActionLoading(false)
    if (error || (data && data.error)) {
      setActionError((data && data.error) || error?.message || 'Action failed')
      return
    }
    setSelected(null)
    setShowReasonBox(false)
    setReasonInput('')
    fetchUsers()
    fetchSummary()
  }

  const submitAddUser = async () => {
    if (!newEmail.trim()) { setAddError('Email is required'); return }
    setAddLoading(true)
    setAddError('')
    const { data, error } = await supabase.functions.invoke('admin-manage-users', {
      body: { action: 'invite', email: newEmail.trim(), full_name: newName.trim() || undefined, account_type: newType },
    })
    setAddLoading(false)
    if (error || (data && data.error)) {
      setAddError((data && data.error) || error?.message || 'Failed to invite user')
      return
    }
    setAddSuccess(true)
    fetchUsers()
    fetchSummary()
  }

  const closeAddUser = () => {
    setShowAddUser(false)
    setNewEmail('')
    setNewName('')
    setNewType('personal')
    setAddError('')
    setAddSuccess(false)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const chips: { key: ChipFilter; label: string; count: number | undefined; dotColor?: string }[] = [
    { key: 'all', label: 'All Users', count: summary?.total_users },
    { key: 'personal', label: 'Personal', count: summary?.personal_accounts },
    { key: 'company', label: 'Company', count: summary?.company_accounts },
    { key: 'active', label: 'Active', count: summary?.active_users, dotColor: COLORS.green },
    { key: 'suspended', label: 'Suspended', count: summary?.suspended_users, dotColor: COLORS.red },
  ]

  return (
    <div style={{ padding: isDesktop ? '24px 28px' : '16px', maxWidth: '1400px', margin: '0 auto', overflowY: 'auto' as const, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '18px' }}>
        <div>
          <h2 style={{ fontSize: isDesktop ? '20px' : '17px', fontWeight: 800, color: COLORS.text }}>Users</h2>
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>Dashboard / Users</p>
        </div>
        <div style={{ display: 'flex', gap: '9px' }}>
          <button
            onClick={() => alert('Export is coming soon.')}
            style={{ padding: '9px 14px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, color: COLORS.text, cursor: 'pointer' }}>
            Export
          </button>
          <button
            onClick={() => setShowAddUser(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: COLORS.primary, border: 'none', borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, color: 'white', cursor: 'pointer' }}>
            <Icon name="plus" size={14} color="white" />
            Add User
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px', marginBottom: '16px' }}>
        <StatCard label="Total Users" value={summary?.total_users ?? 0}
          delta={summary ? `↑ ${summary.total_new_this_week} this week` : undefined} deltaGood icon="briefcase" color={COLORS.purple} bg={COLORS.purpleBg} />
        <StatCard label="Personal Accounts" value={summary?.personal_accounts ?? 0} icon="check" color={COLORS.green} bg={COLORS.greenBg} />
        <StatCard label="Company Accounts" value={summary?.company_accounts ?? 0} icon="briefcase" color={COLORS.blue} bg={COLORS.blueBg} />
        <StatCard label="Active Users" value={summary?.active_users ?? 0}
          delta={summary ? `↑ ${summary.active_new_this_week} this week` : undefined} deltaGood icon="check" color={COLORS.green} bg={COLORS.greenBg} />
        <StatCard label="Suspended Users" value={summary?.suspended_users ?? 0}
          delta={summary ? `${summary.suspended_this_week} this week` : undefined} deltaGood={false} icon="x" color={COLORS.red} bg={COLORS.redBg} />
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '10px 13px', marginBottom: '12px' }}>
        <Icon name="search" size={15} color={COLORS.textMuted} />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
          placeholder="Search by name, email, phone or user ID..."
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', background: 'transparent', color: COLORS.text }}
        />
        {searchInput && (
          <span onClick={() => setSearch(searchInput)} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Search</span>
        )}
      </div>

      {/* Chips */}
      <div style={{ display: 'flex', gap: '7px', marginBottom: '16px', overflowX: 'auto' as const, paddingBottom: '2px' }}>
        {chips.map((c) => (
          <span
            key={c.key}
            onClick={() => setChip(c.key)}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 13px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
              background: chip === c.key ? COLORS.primary : COLORS.card,
              color: chip === c.key ? 'white' : COLORS.text,
              border: `1px solid ${chip === c.key ? COLORS.primary : COLORS.border}`,
            }}>
            {c.dotColor && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: chip === c.key ? 'white' : c.dotColor }} />}
            {c.label}
            {c.count !== undefined && <span style={{ opacity: 0.85 }}>{c.count.toLocaleString()}</span>}
          </span>
        ))}
      </div>

      {/* Table / List */}
      {errorMsg ? (
        <div style={{ padding: '30px 20px', textAlign: 'center' as const, background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}` }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.red, marginBottom: '6px' }}>Couldn't load users</p>
          <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.6 }}>{errorMsg}</p>
        </div>
      ) : loading ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>Loading users...</p>
      ) : users.length === 0 ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>No users found.</p>
      ) : isDesktop ? (
        <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}`, overflowX: 'auto' as const }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, minWidth: '760px' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                {['User', 'Account Type', 'Status', 'Joined', 'Actions'].map((h) => (
                  <th key={h} style={{ textAlign: 'left' as const, padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase' as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: COLORS.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
                        {initials(u)}
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{u.full_name || 'Unnamed user'}</p>
                        <p style={{ fontSize: '11px', color: COLORS.textMuted }}>{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}><TypeBadge type={u.account_type} /></td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={u.status} /></td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: COLORS.text }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => setSelected(u)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '7px', fontSize: '11.5px', fontWeight: 700, color: COLORS.text, cursor: 'pointer' }}>
                      <Icon name="eye" size={13} color={COLORS.text} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}` }}>
          {users.map((u, idx) => (
            <div
              key={u.id}
              onClick={() => setSelected(u)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 15px', cursor: 'pointer',
                borderBottom: idx === users.length - 1 ? 'none' : `1px solid ${COLORS.border}`,
              }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: COLORS.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>
                {initials(u)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{u.full_name || 'Unnamed user'}</p>
                <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '1px' }}>{u.email}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end' as const, gap: '5px' }}>
                <TypeBadge type={u.account_type} />
                <StatusBadge status={u.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!errorMsg && !loading && users.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ padding: '7px 9px', borderRadius: '7px', border: `1px solid ${COLORS.border}`, fontSize: '12px', color: COLORS.text, background: COLORS.card }}>
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} per page</option>)}
            </select>
            <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount.toLocaleString()} users
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: '6px 11px', borderRadius: '7px', border: `1px solid ${COLORS.border}`, background: COLORS.card, fontSize: '12px', fontWeight: 700, color: page === 1 ? COLORS.textMuted : COLORS.text, cursor: page === 1 ? 'default' : 'pointer' }}>‹</button>
            <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, padding: '0 6px' }}>{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: '6px 11px', borderRadius: '7px', border: `1px solid ${COLORS.border}`, background: COLORS.card, fontSize: '12px', fontWeight: 700, color: page === totalPages ? COLORS.textMuted : COLORS.text, cursor: page === totalPages ? 'default' : 'pointer' }}>›</button>
          </div>
        </div>
      )}

      {/* Detail sheet */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center', zIndex: 100, padding: isDesktop ? '20px' : 0 }}>
          <div style={{ background: COLORS.card, borderRadius: isDesktop ? '16px' : '20px 20px 0 0', padding: '22px 20px', width: '100%', maxWidth: '440px', maxHeight: '88vh', overflowY: 'auto' as const }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: COLORS.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: 700 }}>
                {initials(selected)}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{selected.full_name || 'Unnamed user'}</p>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  <TypeBadge type={selected.account_type} />
                  <StatusBadge status={selected.status} />
                </div>
              </div>
              <span onClick={() => { setSelected(null); setShowReasonBox(false); setActionError('') }} style={{ cursor: 'pointer' }}>
                <Icon name="x" size={18} color={COLORS.textMuted} />
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Email</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>{selected.email || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Phone</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>{selected.phone || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: '12px', color: COLORS.textMuted }}>User ID</span>
                <span style={{ fontSize: '10.5px', fontWeight: 600, color: COLORS.text }}>{selected.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: selected.status === 'suspended' && selected.suspended_reason ? `1px solid ${COLORS.border}` : 'none' }}>
                <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Joined</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>{new Date(selected.created_at).toLocaleDateString()}</span>
              </div>
              {selected.status === 'suspended' && selected.suspended_reason && (
                <div style={{ padding: '9px 0' }}>
                  <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Suspension reason</span>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text, marginTop: '3px' }}>{selected.suspended_reason}</p>
                </div>
              )}
            </div>

            {actionError && (
              <div style={{ background: COLORS.redBg, borderRadius: '8px', padding: '9px 11px', marginBottom: '12px' }}>
                <p style={{ fontSize: '11.5px', color: COLORS.red, fontWeight: 600 }}>{actionError}</p>
              </div>
            )}

            {selected.status === 'suspended' ? (
              <button
                onClick={() => runAction('restore')}
                disabled={actionLoading}
                style={{ width: '100%', padding: '13px', background: COLORS.green, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer', marginBottom: '10px', opacity: actionLoading ? 0.7 : 1 }}>
                {actionLoading ? 'Restoring...' : 'Restore User'}
              </button>
            ) : showReasonBox ? (
              <div style={{ marginBottom: '10px' }}>
                <textarea
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Reason for suspension (optional)"
                  rows={3}
                  style={{ width: '100%', padding: '10px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', resize: 'none' as const, marginBottom: '9px', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', gap: '9px' }}>
                  <button
                    onClick={() => runAction('suspend', reasonInput)}
                    disabled={actionLoading}
                    style={{ flex: 1, padding: '12px', background: COLORS.red, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', opacity: actionLoading ? 0.7 : 1 }}>
                    {actionLoading ? 'Suspending...' : 'Confirm Suspend'}
                  </button>
                  <button
                    onClick={() => { setShowReasonBox(false); setReasonInput('') }}
                    style={{ padding: '12px 16px', background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowReasonBox(true)}
                style={{ width: '100%', padding: '13px', background: COLORS.redBg, color: COLORS.red, border: `1px solid ${COLORS.red}`, borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer', marginBottom: '10px' }}>
                Suspend User
              </button>
            )}

            {!showReasonBox && (
              <button
                onClick={() => { setSelected(null); setActionError('') }}
                style={{ width: '100%', padding: '13px', background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer' }}>
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add User modal */}
      {showAddUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center', zIndex: 100, padding: isDesktop ? '20px' : 0 }}>
          <div style={{ background: COLORS.card, borderRadius: isDesktop ? '16px' : '20px 20px 0 0', padding: '22px 20px', width: '100%', maxWidth: '420px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>Add User</p>
              <span onClick={closeAddUser} style={{ cursor: 'pointer' }}>
                <Icon name="x" size={18} color={COLORS.textMuted} />
              </span>
            </div>

            {addSuccess ? (
              <div style={{ textAlign: 'center' as const, padding: '10px 0 6px' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: COLORS.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Icon name="check" size={20} color={COLORS.green} />
                </div>
                <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>Invite sent</p>
                <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.6, marginBottom: '16px' }}>
                  {newEmail} will receive an email to set their password and activate the account.
                </p>
                <button onClick={closeAddUser}
                  style={{ width: '100%', padding: '13px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer' }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '6px' }}>Full name</p>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name"
                  style={{ width: '100%', padding: '11px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '12px' }} />

                <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '6px' }}>Email</p>
                <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="name@example.com" type="email"
                  style={{ width: '100%', padding: '11px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '12px' }} />

                <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '6px' }}>Account type</p>
                <div style={{ display: 'flex', gap: '9px', marginBottom: '16px' }}>
                  {(['personal', 'company'] as const).map((t) => (
                    <span key={t} onClick={() => setNewType(t)}
                      style={{
                        flex: 1, textAlign: 'center' as const, padding: '10px', borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                        background: newType === t ? COLORS.primary : COLORS.bg,
                        color: newType === t ? 'white' : COLORS.text,
                        border: `1px solid ${newType === t ? COLORS.primary : COLORS.border}`,
                      }}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </span>
                  ))}
                </div>

                {addError && (
                  <div style={{ background: COLORS.redBg, borderRadius: '8px', padding: '9px 11px', marginBottom: '12px' }}>
                    <p style={{ fontSize: '11.5px', color: COLORS.red, fontWeight: 600 }}>{addError}</p>
                  </div>
                )}

                <button
                  onClick={submitAddUser}
                  disabled={addLoading}
                  style={{ width: '100%', padding: '13px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer', opacity: addLoading ? 0.7 : 1 }}>
                  {addLoading ? 'Sending invite...' : 'Send Invite'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
