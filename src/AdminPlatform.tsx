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
  orange: '#9A3412',
}

type Settings = {
  id: string
  platform_name: string
  platform_logo_url: string | null
  platform_description: string | null
  contact_email: string | null
  support_phone: string | null
  support_whatsapp: string | null
  business_address: string | null
  default_currency: string
  default_country: string
  commission_default: number
  commission_hotel: number
  commission_flight: number
  commission_tour: number
  commission_event: number
  commission_bus: number
  commission_train: number
  commission_agency: number
  maintenance_mode: boolean
  maintenance_message: string | null
  new_registrations_enabled: boolean
}

const COMMISSION_FIELDS: { key: keyof Settings; label: string }[] = [
  { key: 'commission_default', label: 'Default (fallback)' },
  { key: 'commission_hotel', label: 'Hotel' },
  { key: 'commission_flight', label: 'Flight' },
  { key: 'commission_tour', label: 'Tour' },
  { key: 'commission_event', label: 'Event Center' },
  { key: 'commission_bus', label: 'Bus' },
  { key: 'commission_train', label: 'Train' },
  { key: 'commission_agency', label: 'Agency (custom partners)' },
]

export default function AdminPlatform() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.from('platform_settings').select('*').eq('id', 'main').single()
    if (error) setError(error.message)
    else setSettings(data)
    setLoading(false)
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
    setSaved(false)
  }

  async function save() {
    if (!settings) return
    setSaving(true)
    setError('')
    const { data: userData } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('platform_settings')
      .update({
        platform_name: settings.platform_name,
        platform_logo_url: settings.platform_logo_url,
        platform_description: settings.platform_description,
        contact_email: settings.contact_email,
        support_phone: settings.support_phone,
        support_whatsapp: settings.support_whatsapp,
        business_address: settings.business_address,
        default_currency: settings.default_currency,
        default_country: settings.default_country,
        commission_default: settings.commission_default,
        commission_hotel: settings.commission_hotel,
        commission_flight: settings.commission_flight,
        commission_tour: settings.commission_tour,
        commission_event: settings.commission_event,
        commission_bus: settings.commission_bus,
        commission_train: settings.commission_train,
        commission_agency: settings.commission_agency,
        maintenance_mode: settings.maintenance_mode,
        maintenance_message: settings.maintenance_message,
        new_registrations_enabled: settings.new_registrations_enabled,
        updated_at: new Date().toISOString(),
        updated_by: userData?.user?.id,
      })
      .eq('id', 'main')

    setSaving(false)
    if (error) { setError(error.message); return }
    setSaved(true)
  }

  if (loading) return <div style={{ padding: '16px' }}><p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading...</p></div>
  if (error && !settings) return <div style={{ padding: '16px' }}><p style={{ fontSize: '12px', color: COLORS.red }}>{error}</p></div>
  if (!settings) return null

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '14px', padding: '14px', marginBottom: '20px' }}>
        <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.orange, marginBottom: '4px' }}>Not yet wired to the live app</p>
        <p style={{ fontSize: '11.5px', color: COLORS.orange, lineHeight: 1.6 }}>
          These values save to the database, but the booking pages still use their own fixed commission rates, and Maintenance Mode / registration lock aren't checked anywhere yet. Wiring that up is a separate follow-up task.
        </p>
      </div>

      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>GENERAL</p>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px', marginBottom: '22px', display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
        <div>
          <label style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '4px', display: 'block' }}>Platform Name</label>
          <input value={settings.platform_name} onChange={(e) => update('platform_name', e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '13px', color: COLORS.text }} />
        </div>
        <div>
          <label style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '4px', display: 'block' }}>Logo URL</label>
          <input value={settings.platform_logo_url || ''} onChange={(e) => update('platform_logo_url', e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '13px', color: COLORS.text }} />
        </div>
        <div>
          <label style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '4px', display: 'block' }}>Description</label>
          <textarea value={settings.platform_description || ''} onChange={(e) => update('platform_description', e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '13px', minHeight: '56px', color: COLORS.text }} />
        </div>
        <div>
          <label style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '4px', display: 'block' }}>Contact Email</label>
          <input value={settings.contact_email || ''} onChange={(e) => update('contact_email', e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '13px', color: COLORS.text }} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '4px', display: 'block' }}>Support Phone</label>
            <input value={settings.support_phone || ''} onChange={(e) => update('support_phone', e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '13px', color: COLORS.text }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '4px', display: 'block' }}>Support WhatsApp</label>
            <input value={settings.support_whatsapp || ''} onChange={(e) => update('support_whatsapp', e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '13px', color: COLORS.text }} />
          </div>
        </div>
        <div>
          <label style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '4px', display: 'block' }}>Business Address</label>
          <input value={settings.business_address || ''} onChange={(e) => update('business_address', e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '13px', color: COLORS.text }} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '4px', display: 'block' }}>Default Currency</label>
            <input value={settings.default_currency} onChange={(e) => update('default_currency', e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '13px', color: COLORS.text }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '4px', display: 'block' }}>Default Country</label>
            <input value={settings.default_country} onChange={(e) => update('default_country', e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '13px', color: COLORS.text }} />
          </div>
        </div>
      </div>

      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>COMMISSION RATES (%)</p>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px', marginBottom: '22px' }}>
        {COMMISSION_FIELDS.map((f) => (
          <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: COLORS.text }}>{f.label}</span>
            <input
              type="number"
              value={settings[f.key] as number}
              onChange={(e) => update(f.key, Number(e.target.value) as any)}
              style={{ width: '70px', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '13px', textAlign: 'right' as const, color: COLORS.text }}
            />
          </div>
        ))}
      </div>

      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '10px', letterSpacing: '0.4px' }}>FEATURE TOGGLES</p>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '14px', marginBottom: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.text }}>Maintenance Mode</p>
            <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Not yet enforced anywhere</p>
          </div>
          <div
            onClick={() => update('maintenance_mode', !settings.maintenance_mode)}
            style={{ width: '42px', height: '24px', borderRadius: '12px', background: settings.maintenance_mode ? COLORS.primary : COLORS.border, cursor: 'pointer', position: 'relative' as const, transition: 'background 0.2s' }}
          >
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute' as const, top: '3px', left: settings.maintenance_mode ? '21px' : '3px', transition: 'left 0.2s' }} />
          </div>
        </div>
        {settings.maintenance_mode && (
          <input
            value={settings.maintenance_message || ''}
            onChange={(e) => update('maintenance_message', e.target.value)}
            placeholder="Maintenance message shown to users"
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', marginTop: '8px', color: COLORS.text }}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.text }}>New Registrations</p>
            <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Not yet enforced anywhere</p>
          </div>
          <div
            onClick={() => update('new_registrations_enabled', !settings.new_registrations_enabled)}
            style={{ width: '42px', height: '24px', borderRadius: '12px', background: settings.new_registrations_enabled ? COLORS.green : COLORS.border, cursor: 'pointer', position: 'relative' as const, transition: 'background 0.2s' }}
          >
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute' as const, top: '3px', left: settings.new_registrations_enabled ? '21px' : '3px', transition: 'left 0.2s' }} />
          </div>
        </div>
      </div>

      {error && <p style={{ fontSize: '12px', color: COLORS.red, marginBottom: '10px' }}>{error}</p>}

      <div
        onClick={() => !saving && save()}
        style={{ textAlign: 'center' as const, padding: '13px', borderRadius: '10px', background: COLORS.primary, color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
      >
        {saving ? 'Saving...' : saved ? (<>Saved <Icon name="check" size={15} color="#fff" /></>) : 'Save Changes'}
      </div>
    </div>
  )
}
