import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  text: '#1A1A1A',
  textMuted: '#64748B',
}

/**
 * Full-page "can't connect" state — use when a fetch fails due to no network
 * or a request error, instead of leaving the page blank or stuck on "Loading...".
 *
 * Usage:
 *   const [netError, setNetError] = useState(false)
 *   ...
 *   const { data, error } = await supabase.from('services').select('*')
 *   if (error) { setNetError(true); setLoading(false); return }
 *   ...
 *   if (netError) return <NetworkError onRetry={fetchItems} />
 */
export default function NetworkError({
  onRetry,
  title = "Couldn't connect",
  message = 'Check your internet connection and try again.',
}: {
  onRetry: () => void
  title?: string
  message?: string
}) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center' as const }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
        <Icon name="wifiOff" size={28} color={COLORS.secondary} />
      </div>
      <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '6px' }}>{title}</p>
      <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: '22px', maxWidth: '260px' }}>{message}</p>
      <button
        onClick={onRetry}
        style={{ padding: '12px 28px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Icon name="refresh" size={14} color="white" /> Try Again
      </button>
    </div>
  )
}
