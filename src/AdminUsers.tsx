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
  red: '#dc2626',
}

type Profile = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  account_type: string | null
  status: string | null
  created_at: string
}

const PAGE_SIZE = 30

export default function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'personal' | 'company' | 'suspended'>('all')
  const [selected, setSelected] = useState<Profile | null>(null)
  const [notFound, setNotFound] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(PAGE_SIZE)

    if (search.trim()) {
      query = query.or(`full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`)
    }
    if (filter === 'personal') query = query.eq('account_type', 'personal')
    if (filter === 'company') query = query.eq('account_type', 'company')
    if (filter === 'suspended') query = query.eq('status', 'suspended')

    const { data, error } = await query
    setLoading(false)
    if (error) {
      setNotFound(true)
      return
    }
    setUsers(data || [])
  }

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  if (notFound) {
    return (
      <div style={{ padding: '30px 20px', textAlign: 'center' as const }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.red, marginBottom: '6px' }}>Couldn't load users</p>
        <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.6 }}>
          This usually means the <code>profiles</code> table or its admin read policy hasn't been set up yet — run <code>admin_profiles_setup.sql</code> in Supabase first.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '10px 13px', marginBottom: '12px' }}>
        <Icon name="search" size={15} color={COLORS.textMuted} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
          placeholder="Search name, email or phone..."
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', background: 'transparent' }}
        />
        {search && (
          <span onClick={fetchUsers} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Search</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '7px', marginBottom: '14px', overflowX: 'auto' as const }}>
        {(['all', 'personal', 'company', 'suspended'] as const).map((f) => (
          <span
            key={f}
            onClick={() => setFilter(f)}
            style={{
              flexShrink: 0, padding: '7px 13px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
              background: filter === f ? COLORS.primary : COLORS.card,
              color: filter === f ? 'white' : COLORS.text,
              border: `1px solid ${filter === f ? COLORS.primary : COLORS.border}`,
            }}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </span>
        ))}
      </div>

      {loading ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>Loading users...</p>
      ) : users.length === 0 ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' as const, padding: '30px 0' }}>No users found.</p>
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
                {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{u.full_name || 'Unnamed user'}</p>
                <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '1px' }}>{u.email}</p>
              </div>
              <span style={{
                fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                background: u.status === 'suspended' ? '#FEF2F2' : u.account_type === 'company' ? '#EFF6FF' : '#F0FDF4',
                color: u.status === 'suspended' ? COLORS.red : u.account_type === 'company' ? COLORS.primary : COLORS.green,
              }}>
                {u.status === 'suspended' ? 'SUSPENDED' : (u.account_type || 'personal').toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}

      {users.length === PAGE_SIZE && (
        <p style={{ fontSize: '11px', color: COLORS.textMuted, textAlign: 'center' as const, marginTop: '12px' }}>
          Showing first {PAGE_SIZE} — refine your search to narrow results.
        </p>
      )}

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: COLORS.card, borderRadius: '20px 20px 0 0', padding: '22px 20px', width: '100%', maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: COLORS.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: 700 }}>
                {(selected.full_name || selected.email || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{selected.full_name || 'Unnamed user'}</p>
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted }}>{(selected.account_type || 'personal')} account</p>
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Email</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>{selected.email || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Phone</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>{selected.phone || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0' }}>
                <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Joined</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>{new Date(selected.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div style={{ background: '#F1F5F9', borderRadius: '10px', padding: '11px', marginBottom: '14px' }}>
              <p style={{ fontSize: '11px', color: COLORS.textMuted, lineHeight: 1.6 }}>
                Suspend/Restore requires a secure server-side function (not yet built) since it must revoke login access — coming in a later round.
              </p>
            </div>

            <button
              onClick={() => setSelected(null)}
              style={{ width: '100%', padding: '13px', background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
