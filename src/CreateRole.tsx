import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const COLORS = {
  bg: '#F8FAFC', card: '#FFFFFF', text: '#1A1A1A', textMuted: '#64748B',
  border: '#E2E8F0', red: '#dc2626', redBg: '#FEF2F2', green: '#16a34a',
  purple: '#7c3aed', purpleBg: '#F5F3FF',
}

type Perm = { key: string; module: string; description: string; risk_level: string }

async function resolveEdgeError(data: any, error: any): Promise<string> {
  if (data && data.error) return data.error
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.clone().json()
      if (body?.error) return body.error
    } catch {}
  }
  return error?.message || 'Action failed'
}

export default function CreateRole({ companyId, onBack, onCreated }: { companyId?: string; onBack?: () => void; onCreated?: () => void }) {
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(companyId || null)
  const [perms, setPerms] = useState<Perm[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)

  useEffect(() => {
    if (!companyId) {
      (async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase.from('companies').select('id').eq('owner_id', user.id).maybeSingle()
        if (data) setResolvedCompanyId(data.id)
      })()
    }
    supabase.from('company_permissions').select('key, module, description, risk_level').order('module').then(({ data }) => setPerms(data || []))
  }, [companyId])

  const toggle = (key: string, risky: boolean) => {
    const next = new Set(selected)
    if (next.has(key)) {
      next.delete(key)
      setSelected(next)
    } else if (risky && confirmKey !== key) {
      setConfirmKey(key)
    } else {
      next.add(key)
      setSelected(next)
      setConfirmKey(null)
    }
  }

  const modules = [...new Set(perms.map((p) => p.module))]

  const submit = async () => {
    if (!name.trim()) { setError('Role name is required'); return }
    if (!resolvedCompanyId) { setError('Could not determine your company'); return }
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.functions.invoke('company-manage-staff', {
      body: {
        action: 'create_role',
        company_id: resolvedCompanyId,
        role_name: name.trim(),
        role_description: description.trim() || undefined,
        permission_keys: [...selected],
      },
    })
    setLoading(false)
    if (err || (data && data.error)) {
      setError(await resolveEdgeError(data, err))
      return
    }
    setSuccess(true)
    onCreated?.()
  }

  if (success) {
    return (
      <div style={{ background: COLORS.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>Role created</div>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 20, textAlign: 'center' }}>
          "{name}" is now available when inviting staff.
        </div>
        <button onClick={onBack} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: COLORS.purple, color: '#fff', fontWeight: 700 }}>
          Done
        </button>
      </div>
    )
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: 100 }}>
      <div style={{ background: COLORS.card, padding: 16, borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={iconBtn}>‹</button>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: COLORS.text }}>Create Role</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>Custom role for your company only</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {error && <div style={{ background: COLORS.redBg, color: COLORS.red, padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{error}</div>}

        <label style={label}>Role Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Check-in Officer" style={input} />

        <label style={label}>Description (optional)</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role is for" style={input} />

        <div style={{ fontSize: 13.5, fontWeight: 800, color: COLORS.text, margin: '20px 0 4px' }}>
          Permissions ({selected.size} selected)
        </div>
        <div style={{ fontSize: 11.5, color: COLORS.textMuted, marginBottom: 10 }}>
          Choose what staff with this role can do.
        </div>

        {modules.map((mod) => (
          <div key={mod} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.purple, textTransform: 'capitalize', marginBottom: 6 }}>{mod}</div>
            {perms.filter((p) => p.module === mod).map((p) => {
              const risky = p.risk_level === 'high'
              const checked = selected.has(p.key)
              return (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
                  <div style={{ fontSize: 13, color: COLORS.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {p.description}
                    {risky && <span style={{ fontSize: 10, color: COLORS.red, fontWeight: 800 }}>🔴 HIGH RISK</span>}
                  </div>
                  <input type="checkbox" checked={checked} onChange={() => toggle(p.key, risky)} style={{ width: 20, height: 20 }} />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, padding: 14 }}>
        <button
          onClick={submit}
          disabled={loading}
          style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: COLORS.purple, color: '#fff', fontWeight: 700, fontSize: 14 }}
        >
          {loading ? 'Creating…' : 'Create Role'}
        </button>
      </div>

      {confirmKey && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, maxWidth: 320 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>Include high-risk permission?</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 16 }}>
              Any staff given this role will be able to <b>{confirmKey}</b>. Are you sure?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmKey(null)} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${COLORS.border}`, background: '#fff' }}>Cancel</button>
              <button
                onClick={() => { const next = new Set(selected); next.add(confirmKey); setSelected(next); setConfirmKey(null) }}
                style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: COLORS.red, color: '#fff', fontWeight: 700 }}
              >
                Include
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const iconBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: COLORS.textMuted, display: 'block', margin: '12px 0 6px' }
const input: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: 14, background: '#fff' }
