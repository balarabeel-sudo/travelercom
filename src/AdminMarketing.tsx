import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  red: '#dc2626',
}

type Banner = {
  id: string
  title: string
  message: string
  image_url: string | null
  link_url: string | null
  active: boolean
  created_at: string
}

type Notice = {
  id: string
  title: string
  message: string
  active: boolean
  created_at: string
}

const EMPTY_BANNER_FORM = { title: '', message: '', image_url: '', link_url: '' }
const EMPTY_NOTICE_FORM = { title: '', message: '' }

function BannersTab() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_BANNER_FORM)
  const [saving, setSaving] = useState(false)

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.4px' }}>HOME BANNERS</p>
        <div onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', background: COLORS.primary, cursor: 'pointer' }}>
          <Icon name="plus" size={13} color="#fff" />
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff' }}>New</span>
        </div>
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px', marginBottom: '12px' }}><p style={{ fontSize: '12px', color: COLORS.red }}>{error}</p></div>}

      {loading ? (
        <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p>
      ) : banners.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
            <Icon name="megaphone" size={22} color={COLORS.textMuted} />
          </div>
          <p style={{ fontSize: '13px', color: COLORS.textMuted }}>No banners yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
          {banners.map((b) => (
            <div key={b.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{b.title}</p>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: b.active ? COLORS.green : COLORS.textMuted, background: b.active ? '#F0FDF4' : '#F1F5F9', padding: '3px 8px', borderRadius: '6px' }}>
                  {b.active ? 'ACTIVE' : 'HIDDEN'}
                </span>
              </div>
              <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '6px', lineHeight: 1.4 }}>{b.message}</p>
              {b.image_url && <img src={b.image_url} alt="" style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: '10px', marginTop: '8px' }} />}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <div onClick={() => openEdit(b)} style={{ flex: 1, textAlign: 'center' as const, padding: '8px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12px', fontWeight: 600, color: COLORS.text, cursor: 'pointer' }}>Edit</div>
                <div onClick={() => toggleActive(b)} style={{ flex: 1, textAlign: 'center' as const, padding: '8px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12px', fontWeight: 600, color: COLORS.text, cursor: 'pointer' }}>{b.active ? 'Hide' : 'Activate'}</div>
                <div onClick={() => remove(b)} style={{ flex: 1, textAlign: 'center' as const, padding: '8px', borderRadius: '8px', border: `1px solid ${COLORS.red}`, fontSize: '12px', fontWeight: 600, color: COLORS.red, cursor: 'pointer' }}>Delete</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }} onClick={() => !saving && setShowForm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, borderTopLeftRadius: '18px', borderTopRightRadius: '18px', padding: '20px', width: '100%', maxWidth: '480px' }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '12px' }}>{editingId ? 'Edit Banner' : 'New Banner'}</p>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px', color: COLORS.text }} />
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Message" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', minHeight: '64px', marginBottom: '10px', color: COLORS.text }} />
            <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="Image URL (optional)" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', marginBottom: '10px', color: COLORS.text }} />
            <input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="Link URL (optional)" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', color: COLORS.text }} />
            {error && <p style={{ color: COLORS.red, fontSize: '12px', marginTop: '8px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
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
      title: form.title.trim(), message: form.message.trim(), active: true, created_by: userData?.user?.id,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.4px' }}>IN-APP NOTIFICATIONS</p>
        <div onClick={() => { setForm(EMPTY_NOTICE_FORM); setShowForm(true) }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', background: COLORS.primary, cursor: 'pointer' }}>
          <Icon name="plus" size={13} color="#fff" />
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff' }}>Send</span>
        </div>
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px', marginBottom: '12px' }}><p style={{ fontSize: '12px', color: COLORS.red }}>{error}</p></div>}

      {loading ? (
        <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p>
      ) : notices.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
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
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: n.active ? COLORS.green : COLORS.textMuted, background: n.active ? '#F0FDF4' : '#F1F5F9', padding: '3px 8px', borderRadius: '6px' }}>
                  {n.active ? 'VISIBLE' : 'HIDDEN'}
                </span>
              </div>
              <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '6px', lineHeight: 1.4 }}>{n.message}</p>
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '6px' }}>{new Date(n.created_at).toLocaleString()}</p>
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
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Message" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', minHeight: '64px', color: COLORS.text }} />
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
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        {(['banners', 'notifications'] as const).map((t) => (
          <div
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
              border: `1px solid ${tab === t ? COLORS.primary : COLORS.border}`,
              background: tab === t ? '#EFF6FF' : COLORS.card,
              fontSize: '12.5px', fontWeight: 700,
              color: tab === t ? COLORS.primary : COLORS.textMuted,
            }}
          >
            {t === 'banners' ? 'Banners' : 'Notifications'}
          </div>
        ))}
      </div>
      {tab === 'banners' ? <BannersTab /> : <NotificationsTab />}
    </div>
  )
}
