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
  orange: '#d97706',
  orangeBg: '#FFFBEB',
  red: '#dc2626',
  redBg: '#FEF2F2',
  blue: '#0EA5E9',
  blueBg: '#EFF6FF',
}

type Banner = { id: string; title: string; message: string; image_url: string | null; link_url: string | null; active: boolean; created_at: string }
type Notice = { id: string; title: string; message: string; target_audience: 'all' | 'personal' | 'company'; active: boolean; created_at: string }

const EMPTY_BANNER_FORM = { title: '', message: '', image_url: '', link_url: '' }
const EMPTY_NOTICE_FORM = { title: '', message: '', target_audience: 'all' as 'all' | 'personal' | 'company' }
const PAGE_SIZE = 5

function StatCard({ label, sub, value, icon, color, bg }: { label: string; sub: string; value: number; icon: string; color: string; bg: string }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '15px', flex: '1 1 200px', minWidth: '180px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} color={color} />
        </div>
      </div>
      <p style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text }}>{value}</p>
      <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginTop: '2px' }}>{label}</p>
      <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>{sub}</p>
    </div>
  )
}

function BannersTab() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_BANNER_FORM)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => { fetchBanners() }, [])

  async function fetchBanners() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.from('platform_banners').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setBanners(data || [])
    setLoading(false)
  }

  function openNew() { setForm(EMPTY_BANNER_FORM); setEditingId(null); setShowForm(true) }
  function openEdit(b: Banner) {
    setForm({ title: b.title, message: b.message, image_url: b.image_url || '', link_url: b.link_url || '' })
    setEditingId(b.id); setShowForm(true)
  }

  async function save() {
    if (!form.title.trim() || !form.message.trim()) { setError('Title da message dole ne.'); return }
    setSaving(true); setError('')
    const { data: userData } = await supabase.auth.getUser()
    const payload = { title: form.title.trim(), message: form.message.trim(), image_url: form.image_url.trim() || null, link_url: form.link_url.trim() || null }
    const { error } = editingId
      ? await supabase.from('platform_banners').update(payload).eq('id', editingId)
      : await supabase.from('platform_banners').insert({ ...payload, active: true, created_by: userData?.user?.id })
    setSaving(false)
    if (error) { setError(error.message); return }
    setShowForm(false); fetchBanners()
  }

  async function toggleActive(b: Banner) {
    const { error } = await supabase.from('platform_banners').update({ active: !b.active }).eq('id', b.id)
    if (error) setError(error.message); else fetchBanners()
  }

  async function remove(b: Banner) {
    if (!confirm(`Delete "${b.title}"?`)) return
    const { error } = await supabase.from('platform_banners').delete().eq('id', b.id)
    if (error) setError(error.message); else fetchBanners()
  }

  const totalPages = Math.max(1, Math.ceil(banners.length / PAGE_SIZE))
  const pageItems = banners.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      {/* Stat cards — real counts only, no fabricated impressions */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px', marginBottom: '20px' }}>
        <StatCard label="Total Banners" sub="Across all placements" value={banners.length} icon="megaphone" color={COLORS.blue} bg={COLORS.blueBg} />
        <StatCard label="Active Banners" sub="Currently visible" value={banners.filter((b) => b.active).length} icon="check" color={COLORS.green} bg={COLORS.greenBg} />
        <StatCard label="Hidden Banners" sub="Not visible to users" value={banners.filter((b) => !b.active).length} icon="eyeOff" color={COLORS.orange} bg={COLORS.orangeBg} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.4px' }}>HOME BANNERS</p>
        <div onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '9px', background: COLORS.primary, cursor: 'pointer' }}>
          <Icon name="plus" size={14} color="#fff" />
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff' }}>New Banner</span>
        </div>
      </div>
      <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '14px' }}>Manage banners displayed on the home page</p>

      {error && <div style={{ background: COLORS.redBg, border: '1px solid #FECACA', borderRadius: '10px', padding: '10px', marginBottom: '12px' }}><p style={{ fontSize: '12px', color: COLORS.red }}>{error}</p></div>}

      {loading ? (
        <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p>
      ) : banners.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
            <Icon name="megaphone" size={22} color={COLORS.textMuted} />
          </div>
          <p style={{ fontSize: '13px', color: COLORS.textMuted }}>No banners yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '12px' }}>
          {pageItems.map((b) => (
            <div key={b.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px', display: 'flex', gap: '13px' }}>
              {b.image_url ? (
                <img src={b.image_url} alt="" style={{ width: '84px', height: '84px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '84px', height: '84px', borderRadius: '10px', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="megaphone" size={20} color={COLORS.textMuted} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{b.title}</p>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: b.active ? COLORS.green : COLORS.textMuted, background: b.active ? COLORS.greenBg : COLORS.bg, padding: '3px 9px', borderRadius: '20px', flexShrink: 0 }}>
                    {b.active ? 'ACTIVE' : 'HIDDEN'}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '4px', lineHeight: 1.4 }}>{b.message}</p>
                <div style={{ display: 'flex', gap: '7px', marginTop: '10px', flexWrap: 'wrap' as const }}>
                  <div onClick={() => openEdit(b)} style={{ padding: '6px 12px', borderRadius: '7px', border: `1px solid ${COLORS.blue}`, fontSize: '11.5px', fontWeight: 700, color: COLORS.blue, cursor: 'pointer' }}>Edit</div>
                  <div onClick={() => toggleActive(b)} style={{ padding: '6px 12px', borderRadius: '7px', border: `1px solid ${COLORS.border}`, fontSize: '11.5px', fontWeight: 700, color: COLORS.text, cursor: 'pointer' }}>{b.active ? 'Hide' : 'Show'}</div>
                  <div onClick={() => remove(b)} style={{ padding: '6px 12px', borderRadius: '7px', border: `1px solid ${COLORS.red}`, fontSize: '11.5px', fontWeight: 700, color: COLORS.red, cursor: 'pointer' }}>Delete</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Banner tips — static guidance, not data */}
      <div style={{ background: COLORS.blueBg, border: '1px solid #BFDBFE', borderRadius: '12px', padding: '13px', marginTop: '18px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <Icon name="check" size={14} color={COLORS.blue} />
        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#1E3A8A' }}>Banner tips</p>
          <p style={{ fontSize: '11.5px', color: '#1E40AF', marginTop: '2px', lineHeight: 1.5 }}>Recommended size: 1920 x 600px. Use high-quality images for better engagement.</p>
        </div>
      </div>

      {!loading && banners.length > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', flexWrap: 'wrap' as const, gap: '8px' }}>
          <span style={{ fontSize: '11.5px', color: COLORS.textMuted }}>Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, banners.length)} of {banners.length} banners</span>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              style={{ width: '28px', height: '28px', borderRadius: '7px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: page === 1 ? COLORS.textMuted : COLORS.text, cursor: page === 1 ? 'default' : 'pointer' }}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} style={{ width: '28px', height: '28px', borderRadius: '7px', border: `1px solid ${p === page ? COLORS.primary : COLORS.border}`, background: p === page ? COLORS.primary : COLORS.card, color: p === page ? '#fff' : COLORS.text, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{p}</button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ width: '28px', height: '28px', borderRadius: '7px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: page === totalPages ? COLORS.textMuted : COLORS.text, cursor: page === totalPages ? 'default' : 'pointer' }}>›</button>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }} onClick={() => !saving && setShowForm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, borderTopLeftRadius: '18px', borderTopRightRadius: '18px', padding: '20px', width: '100%', maxWidth: '480px' }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>{editingId ? 'Edit Banner' : 'New Banner'}</p>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px', color: COLORS.text }} />
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Message" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', minHeight: '60px', marginBottom: '10px', color: COLORS.text }} />
            <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="Image URL" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px', color: COLORS.text }} />
            <input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="Link URL (optional)" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px', color: COLORS.text }} />
            {error && <p style={{ color: COLORS.red, fontSize: '12px', marginBottom: '8px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div onClick={() => !saving && save()} style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', background: COLORS.primary, color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}>{saving ? '...' : 'Save'}</div>
              <div onClick={() => !saving && setShowForm(false)} style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontSize: '13.5px', cursor: 'pointer' }}>Cancel</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationsTab() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_NOTICE_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchNotices() }, [])

  async function fetchNotices() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.from('admin_notifications').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setNotices(data || [])
    setLoading(false)
  }

  async function send() {
    if (!form.title.trim() || !form.message.trim()) { setError('Title da message dole ne.'); return }
    setSaving(true); setError('')
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('admin_notifications').insert({
      title: form.title.trim(), message: form.message.trim(), target_audience: form.target_audience, active: true, created_by: userData?.user?.id,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setForm(EMPTY_NOTICE_FORM); setShowForm(false); fetchNotices()
  }

  async function toggleActive(n: Notice) {
    const { error } = await supabase.from('admin_notifications').update({ active: !n.active }).eq('id', n.id)
    if (error) setError(error.message); else fetchNotices()
  }

  async function remove(n: Notice) {
    if (!confirm(`Delete "${n.title}"?`)) return
    const { error } = await supabase.from('admin_notifications').delete().eq('id', n.id)
    if (error) setError(error.message); else fetchNotices()
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px', marginBottom: '20px' }}>
        <StatCard label="Total Notifications" sub="Sent to users" value={notices.length} icon="bell" color={COLORS.blue} bg={COLORS.blueBg} />
        <StatCard label="Visible" sub="Currently shown" value={notices.filter((n) => n.active).length} icon="check" color={COLORS.green} bg={COLORS.greenBg} />
        <StatCard label="Hidden" sub="Not visible to users" value={notices.filter((n) => !n.active).length} icon="eyeOff" color={COLORS.orange} bg={COLORS.orangeBg} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.4px' }}>IN-APP NOTIFICATIONS</p>
        <div onClick={() => { setForm(EMPTY_NOTICE_FORM); setShowForm(true) }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '9px', background: COLORS.primary, cursor: 'pointer' }}>
          <Icon name="plus" size={14} color="#fff" />
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff' }}>Send</span>
        </div>
      </div>

      {error && <div style={{ background: COLORS.redBg, border: '1px solid #FECACA', borderRadius: '10px', padding: '10px', marginBottom: '12px' }}><p style={{ fontSize: '12px', color: COLORS.red }}>{error}</p></div>}

      {loading ? (
        <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p>
      ) : notices.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
            <Icon name="bell" size={22} color={COLORS.textMuted} />
          </div>
          <p style={{ fontSize: '13px', color: COLORS.textMuted }}>No notifications sent yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
          {notices.map((n) => (
            <div key={n.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{n.title}</p>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: n.active ? COLORS.green : COLORS.textMuted, background: n.active ? COLORS.greenBg : COLORS.bg, padding: '3px 8px', borderRadius: '6px' }}>
                  {n.active ? 'VISIBLE' : 'HIDDEN'}
                </span>
              </div>
              <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '6px', lineHeight: 1.4 }}>{n.message}</p>
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '6px' }}>
                {n.target_audience === 'all' ? 'All users' : n.target_audience === 'personal' ? 'Personal users only' : 'Companies only'} · {new Date(n.created_at).toLocaleString()}
              </p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <div onClick={() => toggleActive(n)} style={{ flex: 1, textAlign: 'center' as const, padding: '8px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12px', fontWeight: 600, color: COLORS.text, cursor: 'pointer' }}>{n.active ? 'Hide' : 'Unhide'}</div>
                <div onClick={() => remove(n)} style={{ flex: 1, textAlign: 'center' as const, padding: '8px', borderRadius: '8px', border: `1px solid ${COLORS.red}`, fontSize: '12px', fontWeight: 600, color: COLORS.red, cursor: 'pointer' }}>Delete</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }} onClick={() => !saving && setShowForm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, borderTopLeftRadius: '18px', borderTopRightRadius: '18px', padding: '20px', width: '100%', maxWidth: '480px' }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>Send Notification</p>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px', color: COLORS.text }} />
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Message" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', minHeight: '64px', marginBottom: '10px', color: COLORS.text }} />
            <label style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '6px', display: 'block' }}>Audience</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              {(['all', 'personal', 'company'] as const).map((aud) => (
                <div key={aud} onClick={() => setForm({ ...form, target_audience: aud })}
                  style={{
                    flex: 1, textAlign: 'center' as const, padding: '8px', borderRadius: '8px', cursor: 'pointer',
                    border: `1px solid ${form.target_audience === aud ? COLORS.primary : COLORS.border}`,
                    background: form.target_audience === aud ? COLORS.blueBg : 'transparent',
                    fontSize: '12px', fontWeight: 700,
                    color: form.target_audience === aud ? COLORS.primary : COLORS.textMuted,
                  }}>
                  {aud === 'all' ? 'All' : aud === 'personal' ? 'Personal' : 'Company'}
                </div>
              ))}
            </div>
            {error && <p style={{ color: COLORS.red, fontSize: '12px', marginTop: '8px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <div onClick={() => !saving && send()} style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', background: COLORS.primary, color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}>{saving ? '...' : 'Send'}</div>
              <div onClick={() => !saving && setShowForm(false)} style={{ flex: 1, textAlign: 'center' as const, padding: '11px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontSize: '13.5px', cursor: 'pointer' }}>Cancel</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminMarketing() {
  const [tab, setTab] = useState<'banners' | 'notifications'>('banners')

  return (
    <div style={{ padding: '18px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>Marketing</h2>
      <div style={{ display: 'flex', gap: '8px', margin: '14px 0 22px' }}>
        {(['banners', 'notifications'] as const).map((t) => (
          <div key={t} onClick={() => setTab(t)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 15px', borderRadius: '9px', cursor: 'pointer',
              border: `1px solid ${tab === t ? COLORS.primary : COLORS.border}`,
              background: tab === t ? COLORS.blueBg : COLORS.card,
              fontSize: '12.5px', fontWeight: 700,
              color: tab === t ? COLORS.primary : COLORS.textMuted,
            }}>
            <Icon name={t === 'banners' ? 'image' : 'bell'} size={14} color={tab === t ? COLORS.primary : COLORS.textMuted} />
            {t === 'banners' ? 'Banners' : 'Notifications'}
          </div>
        ))}
      </div>
      {tab === 'banners' ? <BannersTab /> : <NotificationsTab />}
    </div>
  )
}
