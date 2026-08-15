import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
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
}

const MODULES = ['all', 'staff', 'refunds', 'withdrawals', 'platform', 'marketing', 'support', 'companies', 'bookings']

export default function AdminAuditLogs() {
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
    if (error) setError(error.message)
    else setLogs(data || [])
    setLoading(false)
  }

  const filtered = search.trim()
    ? logs.filter((l) => l.action.toLowerCase().includes(search.toLowerCase()) || (l.target_id || '').toLowerCase().includes(search.toLowerCase()))
    : logs

  function actionLabel(action: string) {
    return action.replace(/\./g, ' → ').replace(/_/g, ' ')
  }

  return (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>
        AUDIT LOG (last 100)
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search action or target ID..."
        style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px', color: COLORS.text }}
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
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px' }}>
                {new Date(l.created_at).toLocaleString()}
                {l.target_id ? ` · ${l.target_type || 'target'}: ${l.target_id.slice(0, 8)}...` : ''}
              </p>
              {expanded === l.id && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${COLORS.border}` }}>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>Actor: {l.actor_id || '—'}</p>
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
