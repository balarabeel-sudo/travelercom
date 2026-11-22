import { useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'

// Shared pieces for the admin "Add / Edit listing" forms (transport, tours,
// event centers, vehicle rental). Hotels and flights keep their own forms.

export const COLORS = {
  primary: '#0EA5E9', secondary: '#F97316', bg: '#F8FAFC', card: '#FFFFFF',
  text: '#1A1A1A', textMuted: '#64748B', border: '#E2E8F0', green: '#16a34a', red: '#DC2626',
}

export const inputStyle = {
  width: '100%', padding: '11px', border: `1px solid ${COLORS.border}`, borderRadius: '8px',
  fontSize: '14px', boxSizing: 'border-box' as const, fontFamily: 'inherit',
}

export type FormProps = {
  editId?: string | null
  onSaved: () => void
  onCancel: () => void
}

export type CompanyOption = { id: string; business_name: string }

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '6px', display: 'block' }}>{label}</label>
      {children}
    </div>
  )
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: '14px' }}>
      {children}
    </div>
  )
}

export function MultiChips({ options, selected, onToggle, icons }: {
  options: string[]
  selected: string[]
  onToggle: (o: string) => void
  icons?: Record<string, string>
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
      {options.map((o) => {
        const active = selected.includes(o)
        return (
          <span key={o} onClick={() => onToggle(o)} style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '20px',
            fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
            background: active ? COLORS.primary : COLORS.bg,
            color: active ? 'white' : COLORS.textMuted,
          }}>
            {icons && icons[o] && <Icon name={icons[o]} size={13} color={active ? 'white' : COLORS.textMuted} />} {o}
          </span>
        )
      })}
    </div>
  )
}

export function SingleChips({ options, value, onChange, icons }: {
  options: string[]
  value: string
  onChange: (v: string) => void
  icons?: Record<string, string>
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
      {options.map((o) => {
        const active = value === o
        return (
          <span key={o} onClick={() => onChange(active ? '' : o)} style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '20px',
            fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
            background: active ? COLORS.primary : COLORS.bg,
            color: active ? 'white' : COLORS.textMuted,
          }}>
            {icons && icons[o] && <Icon name={icons[o]} size={13} color={active ? 'white' : COLORS.textMuted} />} {o}
          </span>
        )
      })}
    </div>
  )
}

// Up to `max` photos: existing URLs (when editing) plus newly picked files.
export function usePhotos(max = 5) {
  const [existing, setExisting] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])

  const add = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || [])
    if (picked.length === 0) return
    const room = max - (existing.length + files.length)
    const toAdd = picked.slice(0, Math.max(room, 0))
    setFiles((prev) => [...prev, ...toAdd])
    setPreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))])
    e.target.value = ''
  }
  const removeExisting = (i: number) => setExisting((prev) => prev.filter((_, idx) => idx !== i))
  const removeNew = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i))
    setPreviews((prev) => prev.filter((_, idx) => idx !== i))
  }

  const upload = async (prefix: string): Promise<{ urls: string[]; error: string | null }> => {
    const uploaded: string[] = []
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const name = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
      const { error } = await supabase.storage.from('listing-photos').upload(name, file)
      if (error) return { urls: [], error: error.message }
      const { data } = supabase.storage.from('listing-photos').getPublicUrl(name)
      uploaded.push(data.publicUrl)
    }
    return { urls: [...existing, ...uploaded].slice(0, max), error: null }
  }

  return { max, existing, setExisting, files, previews, add, removeExisting, removeNew, upload }
}

export type PhotosState = ReturnType<typeof usePhotos>

export function PhotoField({ photos }: { photos: PhotosState }) {
  const count = photos.existing.length + photos.files.length
  const removeBtn = (onClick: () => void) => (
    <span onClick={onClick} style={{
      position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%',
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    }}><Icon name="x" size={11} color="white" /></span>
  )
  return (
    <Field label={`Photos (${count}/${photos.max})`}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        {photos.existing.map((url, i) => (
          <div key={`ex-${i}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: '10px', overflow: 'hidden' }}>
            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {removeBtn(() => photos.removeExisting(i))}
          </div>
        ))}
        {photos.previews.map((url, i) => (
          <div key={`new-${i}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: '10px', overflow: 'hidden' }}>
            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {removeBtn(() => photos.removeNew(i))}
          </div>
        ))}
        {count < photos.max && (
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '1',
            border: `2px dashed ${COLORS.border}`, borderRadius: '10px', cursor: 'pointer', background: COLORS.bg,
          }}>
            <Icon name="camera" size={18} color={COLORS.textMuted} />
            <input type="file" accept="image/*" multiple onChange={photos.add} style={{ display: 'none' }} />
          </label>
        )}
      </div>
      <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '6px' }}>First photo is used as the cover photo shown in listings.</p>
    </Field>
  )
}

export function CompanyField({ companies, companyId, onChange, typeLabel }: {
  companies: CompanyOption[]
  companyId: string
  onChange: (id: string) => void
  typeLabel: string
}) {
  return (
    <Field label="Company">
      {companies.length === 0 ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>No approved {typeLabel} companies found. Create and approve a company with business type "{typeLabel}" first.</p>
      ) : (
        <select value={companyId} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
        </select>
      )}
    </Field>
  )
}

export function FormHeader({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
      <span onClick={onCancel} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="arrowLeft" size={19} color={COLORS.text} /></span>
      <h2 style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text }}>{title}</h2>
    </div>
  )
}

export function LoadingBlock() {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
      <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading…</p>
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
      <p style={{ fontSize: '13px', color: COLORS.red, marginBottom: '12px' }}>{message}</p>
      <span onClick={onRetry} style={{ fontSize: '13px', fontWeight: 700, color: COLORS.primary, cursor: 'pointer' }}>Retry</span>
    </div>
  )
}

export function SuccessScreen({ title, note, backLabel, onBack }: { title: string; note?: string; backLabel: string; onBack: () => void }) {
  return (
    <div style={{ padding: '50px 20px', textAlign: 'center' as const }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><Icon name="check" size={40} color={COLORS.green} /></div>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.green, marginBottom: '8px' }}>{title}</p>
      {note && <p style={{ fontSize: '12px', color: COLORS.textMuted, maxWidth: '360px', margin: '0 auto 14px auto' }}>{note}</p>}
      <button onClick={onBack} style={{ padding: '12px 24px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
        {backLabel}
      </button>
    </div>
  )
}

export function SubmitButton({ submitting, disabled, editing, onClick }: { submitting: boolean; disabled?: boolean; editing: boolean; onClick: () => void }) {
  const off = submitting || !!disabled
  return (
    <button
      onClick={onClick}
      disabled={off}
      style={{
        width: '100%', padding: '13px', background: off ? '#94a3b8' : COLORS.secondary,
        color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px',
        cursor: off ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
      }}>
      {submitting
        ? (editing ? 'Updating...' : 'Adding...')
        : editing
          ? (<><Icon name="check" size={14} color="white" strokeWidth={2.5} /> Update Listing</>)
          : (<><Icon name="plus" size={14} color="white" strokeWidth={2.5} /> Add Listing</>)}
    </button>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

// Local-time helpers so editing a listing shows the same time that was typed in.
export function toLocalDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function toLocalTime(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export function addDays(dateStr: string, n: number) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function formatDuration(mins: number | null) {
  if (mins == null) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export async function auditAdminListing(action: string, serviceId: string | null, title: string, category: string, companyId: string | null) {
  const { data: userData } = await supabase.auth.getUser()
  if (userData?.user) {
    await supabase.rpc('log_audit', {
      p_action: action, p_module: 'listings', p_target_type: 'service', p_target_id: serviceId,
      p_previous: null, p_new: { title, category }, p_company_id: companyId,
    })
  }
}

// Deletes a listing and its room/seat/vehicle types. Refuses when real bookings exist.
export async function deleteListingCascade(serviceId: string): Promise<string | null> {
  const blocked = 'Cannot delete: this listing still has bookings linked to it. Deactivate it instead.'
  const { count } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('service_id', serviceId)
  if (count && count > 0) return blocked
  const { error: invErr } = await supabase.from('inventory_items').delete().eq('service_id', serviceId)
  if (invErr) return blocked
  const { error: svcErr } = await supabase.from('services').delete().eq('id', serviceId)
  if (svcErr) return blocked
  return null
}
