import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const COLORS = {
  bg: '#F8FAFC', card: '#FFFFFF', text: '#1A1A1A', textMuted: '#64748B',
  border: '#E2E8F0', green: '#16a34a', greenBg: '#F0FDF4', red: '#dc2626',
  purple: '#7c3aed', purpleBg: '#F5F3FF',
}

type Perm = { key: string; module: string; description: string; risk_level: string }
type Template = { id: string; name: string }

export default function PermissionMatrix({ onBack }: { onBack?: () => void }) {
  const [perms, setPerms] = useState<Perm[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [grid, setGrid] = useState<Record<string, Set<string>>>({}) // template_id -> set of permission_key
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: t }, { data: tp }] = await Promise.all([
        supabase.from('company_permissions').select('key, module, description, risk_level').order('module'),
        supabase.from('company_role_templates').select('id, name').order('name'),
        supabase.from('company_role_template_permissions').select('template_id, permission_key'),
      ])
      setPerms(p || [])
      setTemplates(t || [])
      const g: Record<string, Set<string>> = {}
      for (const row of tp || []) {
        if (!g[row.template_id]) g[row.template_id] = new Set()
        g[row.template_id].add(row.permission_key)
      }
      setGrid(g)
      setLoading(false)
    })()
  }, [])

  const modules = [...new Set(perms.map((p) => p.module))]

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: 32 }}>
      <div style={{ background: COLORS.card, padding: 16, borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={iconBtn}>‹</button>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: COLORS.text }}>Permission Matrix</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>What each role can access, at a glance</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: COLORS.textMuted, padding: 40 }}>Loading…</div>
      ) : (
        <div style={{ padding: '16px', overflowX: 'auto' }}>
          <div style={{ minWidth: templates.length * 92 + 170 }}>
            {/* Header row */}
            <div style={{ display: 'flex', position: 'sticky', top: 0, background: COLORS.bg, zIndex: 2, paddingBottom: 8 }}>
              <div style={{ width: 170, flexShrink: 0 }} />
              {templates.map((t) => (
                <div
                  key={t.id}
                  style={{
                    width: 92, flexShrink: 0, textAlign: 'center', fontSize: 10.5, fontWeight: 800,
                    color: COLORS.purple, padding: '0 4px', wordBreak: 'break-word',
                  }}
                >
                  {t.name}
                </div>
              ))}
            </div>

            {modules.map((mod) => (
              <div key={mod}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: COLORS.text, textTransform: 'capitalize', margin: '12px 0 6px', background: COLORS.purpleBg, padding: '5px 10px', borderRadius: 8, display: 'inline-block' }}>
                  {mod}
                </div>
                {perms.filter((p) => p.module === mod).map((p) => (
                  <div key={p.key} style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.card }}>
                    <div style={{ width: 170, flexShrink: 0, fontSize: 11.5, color: COLORS.text, padding: '9px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {p.description}
                      {p.risk_level === 'high' && <span style={{ color: COLORS.red, fontSize: 10 }}>🔴</span>}
                    </div>
                    {templates.map((t) => {
                      const has = grid[t.id]?.has(p.key)
                      return (
                        <div key={t.id} style={{ width: 92, flexShrink: 0, textAlign: 'center' }}>
                          <span style={{ color: has ? COLORS.green : COLORS.textMuted, fontSize: 14, opacity: has ? 1 : 0.3 }}>
                            {has ? '✓' : '–'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 12, border: `1px solid ${COLORS.border}`,
  background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
}
