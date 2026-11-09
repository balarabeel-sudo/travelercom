import { Fragment, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import useIsDesktop from './useIsDesktop'

const COLORS = {
  primary: '#0EA5E9',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
}

type LogEntry = {
  id: string
  actor_id: string | null
  action: string
  module: string
  target_type: string | null
  target_id: string | null
  previous_value: any
  new_value: any
  created_at: string
  actor_name?: string | null
}

const MODULES = ['all', 'staff', 'refunds', 'withdrawals', 'platform', 'marketing', 'support', 'companies', 'bookings']

// Actions the platform performs by itself (scheduled jobs). They have no person behind them.
const SYSTEM_ACTIONS = new Set(['premium_expired', 'withdrawal.legacy_refunded'])

export default function AdminAuditLogs() {
  const isDesktop = useIsDesktop()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [moduleFilter, setModuleFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { load() }, [moduleFilter])

  async function load() {
    setLoading(true)
    setError('')
    let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100)
    if (moduleFilter !== 'all') query = query.eq('module', moduleFilter)

    const { data, error } = await query
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Look up the name of the person behind each action (name, or email if no name).
    const rows: LogEntry[] = data || []
    const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id))]
    const names: Record<string, string> = {}
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', actorIds)
      for (const p of profiles || []) names[p.id] = p.full_name || p.email || ''
    }
    setLogs(rows.map((r) => ({ ...r, actor_name: r.actor_id ? names[r.actor_id] || null : null })))
    setLoading(false)
  }

  // Who did it. A missing person is either the platform itself (scheduled jobs) or an older
  // entry from before the person was being recorded.
  function whoText(l: LogEntry) {
    if (l.actor_name) return l.actor_name
    if (!l.actor_id) return SYSTEM_ACTIONS.has(l.action) ? 'System' : 'Unknown (older entry)'
    return 'Unknown user'
  }

  const filtered = search.trim()
    ? logs.filter((l) => {
        const q = search.toLowerCase()
        return l.action.toLowerCase().includes(q) || (l.target_id || '').toLowerCase().includes(q) || whoText(l).toLowerCase().includes(q)
      })
    : logs

  function actionLabel(action: string) {
    return action.replace(/\./g, ' → ').replace(/_/g, ' ')
  }

  const cellBase = { padding: '13px 14px', fontSize: '12.5px', color: COLORS.text, borderBottom: `1px solid ${COLORS.border}`, verticalAlign: 'middle' as const }
  const headers = ['TIME', 'DONE BY', 'ACTION', 'MODULE', 'TARGET']

  return (
    <div style={{ padding: isDesktop ? '24px 28px' : '16px', maxWidth: isDesktop ? '1400px' : undefined, margin: '0 auto' }}>
      {isDesktop ? (
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text }}>Audit Log</h2>
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>The last 100 recorded actions. Click a row to see the details.</p>
        </div>
      ) : (
        <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>
          AUDIT LOG (last 100)
        </p>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, action or target ID..."
        style={{ width: '100%', maxWidth: isDesktop ? '440px' : undefined, padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px', color: COLORS.text, boxSizing: 'border-box' as const }}
      />

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto' as const, paddingBottom: '4px' }}>
        {MODULES.map((m) => (
          <div
            key={m}
            onClick={() => setModuleFilter(m)}
            style={{
              padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', flexShrink: 0,
              border: `1px solid ${moduleFilter === m ? COLORS.primary : COLORS.border}`,
              background: moduleFilter === m ? '#EFF6FF' : COLORS.card,
              fontSize: '12px', fontWeight: 700,
              color: moduleFilter === m ? COLORS.primary : COLORS.textMuted,
            }}
          >
            {m === 'all' ? 'All' : m.charAt(0).toUpperCase() + m.slice(1)}
          </div>
        ))}
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px', marginBottom: '12px' }}><p style={{ fontSize: '12px', color: '#dc2626' }}>{error}</p></div>}

      {loading ? (
        <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
            <Icon name="hourglass" size={22} color={COLORS.textMuted} />
          </div>
          <p style={{ fontSize: '13px', color: COLORS.textMuted }}>No log entries yet.</p>
        </div>
      ) : isDesktop ? (
        <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' as const }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, minWidth: '700px' }}>
              <thead>
                <tr style={{ background: COLORS.bg }}>
                  {headers.map((h) => (
                    <th
                      key={h}
                      style={{ textAlign: 'left' as const, padding: '11px 14px', fontSize: '10.5px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.4px', borderBottom: `1px solid ${COLORS.border}`, whiteSpace: 'nowrap' as const }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <Fragment key={l.id}>
                    <tr
                      onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                      onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.bg }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      style={{ cursor: 'pointer' }}>
                      <td style={{ ...cellBase, color: COLORS.textMuted, whiteSpace: 'nowrap' as const }}>{new Date(l.created_at).toLocaleString()}</td>
                      <td style={{ ...cellBase, fontWeight: 700 }}>{whoText(l)}</td>
                      <td style={{ ...cellBase, fontWeight: 700, textTransform: 'capitalize' as const }}>{actionLabel(l.action)}</td>
                      <td style={cellBase}>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: COLORS.textMuted, background: '#F1F5F9', padding: '3px 8px', borderRadius: '6px' }}>{l.module}</span>
                      </td>
                      <td style={{ ...cellBase, color: COLORS.textMuted, whiteSpace: 'nowrap' as const }}>
                        {l.target_id ? `${l.target_type || 'target'}: ${l.target_id.slice(0, 8)}...` : '—'}
                      </td>
                    </tr>
                    {expanded === l.id && (
                      <tr>
                        <td colSpan={5} style={{ padding: '12px 14px', background: COLORS.bg, borderBottom: `1px solid ${COLORS.border}` }}>
                          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '4px', wordBreak: 'break-all' as const }}>Done by: {whoText(l)}{l.actor_id ? ` (${l.actor_id})` : ''}</p>
                          {l.target_id && (
                            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '4px', wordBreak: 'break-all' as const }}>Target ID: {l.target_id}</p>
                          )}
                          {l.previous_value && (
                            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '4px', wordBreak: 'break-word' as const }}>
                              Before: {JSON.stringify(l.previous_value)}
                            </p>
                          )}
                          {l.new_value && (
                            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, wordBreak: 'break-word' as const }}>
                              After: {JSON.stringify(l.new_value)}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
          {filtered.map((l) => (
            <div
              key={l.id}
              onClick={() => setExpanded(expanded === l.id ? null : l.id)}
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '12px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, textTransform: 'capitalize' as const }}>{actionLabel(l.action)}</p>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: COLORS.textMuted, background: '#F1F5F9', padding: '3px 8px', borderRadius: '6px' }}>
                  {l.module}
                </span>
              </div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text, marginTop: '4px' }}>By {whoText(l)}</p>
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>
                {new Date(l.created_at).toLocaleString()}
                {l.target_id ? ` · ${l.target_type || 'target'}: ${l.target_id.slice(0, 8)}...` : ''}
              </p>
              {expanded === l.id && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${COLORS.border}` }}>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px', wordBreak: 'break-all' as const }}>Done by: {whoText(l)}{l.actor_id ? ` (${l.actor_id})` : ''}</p>
                  {l.previous_value && (
                    <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px', wordBreak: 'break-word' as const }}>
                      Before: {JSON.stringify(l.previous_value)}
                    </p>
                  )}
                  {l.new_value && (
                    <p style={{ fontSize: '11px', color: COLORS.textMuted, wordBreak: 'break-word' as const }}>
                      After: {JSON.stringify(l.new_value)}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
