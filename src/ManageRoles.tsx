import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

const COLORS = {
  bg: '#F8FAFC', card: '#FFFFFF', text: '#1A1A1A', textMuted: '#64748B',
  border: '#E2E8F0', red: '#dc2626', redBg: '#FEF2F2', green: '#16a34a',
  purple: '#7c3aed', purpleBg: '#F5F3FF', orange: '#d97706', orangeBg: '#FFFBEB',
}

type Template = { id: string; name: string; description: string | null; company_id: string | null }
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

export default function ManageRoles({ companyId, onBack, onCreateRole }: { companyId?: string; onBack?: () => void; onCreateRole?: () => void }) {
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(companyId || null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Template | null>(null)

  useEffect(() => {
    if (companyId) { setResolvedCompanyId(companyId); return }
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('companies').select('id').eq('owner_id', user.id).maybeSingle()
      if (data) setResolvedCompanyId(data.id)
    })()
  }, [companyId])

  const load = useCallback(async () => {
    if (!resolvedCompanyId) return
    setLoading(true)
    const { data: tmpls } = await supabase
      .from('company_role_templates')
      .select('id, name, description, company_id')
      .or(`company_id.is.null,company_id.eq.${resolvedCompanyId}`)
      .order('company_id', { ascending: true, nullsFirst: true })
      .order('name')
    setTemplates(tmpls || [])

    const { data: staffRows } = await supabase
      .from('company_staff')
      .select('template_id')
      .eq('company_id', resolvedCompanyId)
    const counts: Record<string, number> = {}
    for (const r of staffRows || []) {
      if (!r.template_id) continue
      counts[r.template_id] = (counts[r.template_id] || 0) + 1
    }
    setStaffCounts(counts)
    setLoading(false)
  }, [resolvedCompanyId])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: 32 }}>
      <div style={{ background: COLORS.card, padding: 16, borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={onBack} style={iconBtn}>‹</button>
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, color: COLORS.text }}>Manage Roles</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>Default & custom roles for your team</div>
            </div>
          </div>
          <button onClick={onCreateRole} style={{ ...iconBtn, background: COLORS.purple, color: '#fff' }}>+</button>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {loading && <div style={{ textAlign: 'center', color: COLORS.textMuted, padding: 30 }}>Loading…</div>}

        {!loading && (
          <>
            <SectionLabel text="Default Roles (shared, read-only)" />
            {templates.filter((t) => t.company_id === null).map((t) => (
              <RoleCard key={t.id} t={t} count={staffCounts[t.id] || 0} editable={false} onEdit={() => {}} />
            ))}

            <SectionLabel text="Your Custom Roles" />
            {templates.filter((t) => t.company_id !== null).length === 0 ? (
              <div style={{ fontSize: 12.5, color: COLORS.textMuted, padding: '10px 0 20px' }}>
                No custom roles yet. Tap + to create one.
              </div>
            ) : (
              templates.filter((t) => t.company_id !== null).map((t) => (
                <RoleCard key={t.id} t={t} count={staffCounts[t.id] || 0} editable onEdit={() => setEditing(t)} />
              ))
            )}
          </>
        )}
      </div>

      {editing && resolvedCompanyId && (
        <EditRoleSheet
          template={editing}
          companyId={resolvedCompanyId}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function SectionLabel({ text }: { text: string }) {
  return <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', margin: '14px 0 8px' }}>{text}</div>
}

function RoleCard({ t, count, editable, onEdit }: { t: Template; count: number; editable: boolean; onEdit: () => void }) {
  return (
    <div
      onClick={editable ? onEdit : undefined}
      style={{
        background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 13,
        marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: editable ? 'pointer' : 'default',
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{t.name}</div>
        {t.description && <div style={{ fontSize: 11.5, color: COLORS.textMuted, marginTop: 2 }}>{t.description}</div>}
        <div style={{ fontSize: 11, color: COLORS.purple, fontWeight: 700, marginTop: 4 }}>{count} staff assigned</div>
      </div>
      {editable && <span style={{ color: COLORS.textMuted, fontSize: 16 }}>›</span>}
    </div>
  )
}

function EditRoleSheet({ template, companyId, onClose, onSaved }: { template: Template; companyId: string; onClose: () => void; onSaved: () => void }) {
  const [perms, setPerms] = useState<Perm[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      const [{ data: allPerms }, { data: current }] = await Promise.all([
        supabase.from('company_permissions').select('key, module, description, risk_level').order('module'),
        supabase.from('company_role_template_permissions').select('permission_key').eq('template_id', template.id),
      ])
      setPerms(allPerms || [])
      setSelected(new Set((current || []).map((c) => c.permission_key)))
    })()
  }, [template])

  const toggle = (key: string) => {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelected(next)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase.functions.invoke('company-manage-staff', {
      body: { action: 'update_role_permissions', company_id: companyId, template_id: template.id, permission_keys: [...selected] },
    })
    setSaving(false)
    if (err || (data && data.error)) {
      setError(await resolveEdgeError(data, err))
      return
    }
    onSaved()
  }

  const modules = [...new Set(perms.map((p) => p.module))]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 20, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: COLORS.card, width: '100%', maxHeight: '85vh', overflowY: 'auto', borderRadius: '20px 20px 0 0', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Edit "{template.name}"</div>
          <span onClick={onClose} style={{ cursor: 'pointer', fontSize: 18, color: COLORS.textMuted }}>✕</span>
        </div>

        {error && <div style={{ background: COLORS.redBg, color: COLORS.red, padding: 10, borderRadius: 10, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

        <div style={{ background: COLORS.orangeBg, color: COLORS.orange, fontSize: 11.5, padding: 10, borderRadius: 10, marginBottom: 14 }}>
          Changing these updates the default permissions for everyone with this role.
        </div>

        {modules.map((mod) => (
          <div key={mod} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.purple, textTransform: 'capitalize', marginBottom: 6 }}>{mod}</div>
            {perms.filter((p) => p.module === mod).map((p) => (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
                <div style={{ fontSize: 13, color: COLORS.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {p.description}
                  {p.risk_level === 'high' && <span style={{ fontSize: 10, color: COLORS.red, fontWeight: 800 }}>🔴</span>}
                </div>
                <input type="checkbox" checked={selected.has(p.key)} onChange={() => toggle(p.key)} style={{ width: 20, height: 20 }} />
              </div>
            ))}
          </div>
        ))}

        <button
          onClick={save}
          disabled={saving}
          style={{ width: '100%', marginTop: 10, padding: 14, borderRadius: 12, border: 'none', background: COLORS.purple, color: '#fff', fontWeight: 700, fontSize: 14 }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }
