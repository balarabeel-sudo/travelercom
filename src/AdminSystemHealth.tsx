import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  red: '#dc2626',
  orange: '#9A3412',
}

type CheckResult = {
  name: string
  status: 'healthy' | 'error' | 'checking' | 'not_checkable'
  responseMs: number | null
  lastChecked: string | null
  errorCount: number
  note?: string
}

const INITIAL: CheckResult[] = [
  { name: 'Database', status: 'checking', responseMs: null, lastChecked: null, errorCount: 0 },
  { name: 'Authentication', status: 'checking', responseMs: null, lastChecked: null, errorCount: 0 },
  { name: 'Storage', status: 'checking', responseMs: null, lastChecked: null, errorCount: 0 },
  { name: 'Payments (Paystack)', status: 'not_checkable', responseMs: null, lastChecked: null, errorCount: 0, note: 'Requires a server-side check (secret key) — not implemented client-side' },
]

function StatusDot({ status }: { status: CheckResult['status'] }) {
  const color = status === 'healthy' ? COLORS.green : status === 'error' ? COLORS.red : status === 'checking' ? COLORS.orange : COLORS.textMuted
  return <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: color }} />
}

export default function AdminSystemHealth() {
  const [checks, setChecks] = useState<CheckResult[]>(INITIAL)
  const [running, setRunning] = useState(false)

  useEffect(() => { runChecks() }, [])

  async function runChecks() {
    setRunning(true)
    const results: CheckResult[] = [...INITIAL.map((c) => ({ ...c }))]
    const now = new Date().toISOString()

    // Database
    try {
      const t0 = performance.now()
      const { error } = await supabase.from('platform_settings').select('id').limit(1)
      const ms = Math.round(performance.now() - t0)
      results[0] = { ...results[0], status: error ? 'error' : 'healthy', responseMs: ms, lastChecked: now, errorCount: error ? 1 : 0 }
    } catch {
      results[0] = { ...results[0], status: 'error', lastChecked: now, errorCount: 1 }
    }

    // Auth
    try {
      const t0 = performance.now()
      const { error } = await supabase.auth.getSession()
      const ms = Math.round(performance.now() - t0)
      results[1] = { ...results[1], status: error ? 'error' : 'healthy', responseMs: ms, lastChecked: now, errorCount: error ? 1 : 0 }
    } catch {
      results[1] = { ...results[1], status: 'error', lastChecked: now, errorCount: 1 }
    }

    // Storage
    try {
      const t0 = performance.now()
      const { error } = await supabase.storage.listBuckets()
      const ms = Math.round(performance.now() - t0)
      results[2] = { ...results[2], status: error ? 'error' : 'healthy', responseMs: ms, lastChecked: now, errorCount: error ? 1 : 0 }
    } catch {
      results[2] = { ...results[2], status: 'error', lastChecked: now, errorCount: 1 }
    }

    // Payments stays not_checkable, but stamp the check time
    results[3] = { ...results[3], lastChecked: now }

    setChecks(results)
    setRunning(false)
  }

  const overallHealthy = checks.filter((c) => c.status === 'healthy' || c.status === 'not_checkable').length === checks.length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusDot status={overallHealthy ? 'healthy' : 'error'} />
          <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>
            {overallHealthy ? 'Platform Operational' : 'Issue Detected'}
          </p>
        </div>
        <div
          onClick={() => !running && runChecks()}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, cursor: 'pointer' }}
        >
          <Icon name="refresh" size={13} color={COLORS.text} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>{running ? 'Checking...' : 'Recheck'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
        {checks.map((c) => (
          <div key={c.name} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StatusDot status={c.status} />
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{c.name}</span>
              </div>
              <span style={{
                fontSize: '10.5px', fontWeight: 700,
                color: c.status === 'healthy' ? COLORS.green : c.status === 'error' ? COLORS.red : COLORS.textMuted,
              }}>
                {c.status === 'healthy' ? 'HEALTHY' : c.status === 'error' ? 'ERROR' : c.status === 'checking' ? 'CHECKING' : 'N/A'}
              </span>
            </div>
            {c.note ? (
              <p style={{ fontSize: '11.5px', color: COLORS.orange, marginTop: '6px', lineHeight: 1.5 }}>{c.note}</p>
            ) : (
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '6px' }}>
                {c.responseMs !== null ? `${c.responseMs}ms` : '—'} · Errors: {c.errorCount} · {c.lastChecked ? new Date(c.lastChecked).toLocaleTimeString() : '—'}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
