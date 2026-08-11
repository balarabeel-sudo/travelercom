const COLORS = {
  base: '#E9EEF3',
  highlight: '#F5F8FA',
  card: '#FFFFFF',
  border: '#E2E8F0',
}

/** Shared shimmer keyframes — injected once, safe to render multiple times on a page. */
function ShimmerStyle() {
  return (
    <style>{`
      @keyframes tc-shimmer {
        0% { background-position: -400px 0; }
        100% { background-position: 400px 0; }
      }
      .tc-shimmer {
        background: linear-gradient(90deg, ${COLORS.base} 25%, ${COLORS.highlight} 37%, ${COLORS.base} 63%);
        background-size: 800px 100%;
        animation: tc-shimmer 1.4s ease-in-out infinite;
      }
    `}</style>
  )
}

/**
 * Skeleton for a listing card (Hotels/Bus/Flights/Train/Tours/EventCenters style):
 * image block + a few text lines + price/button row.
 * Usage: {loading ? <ListCardSkeleton count={4} /> : <realCards />}
 */
export function ListCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <ShimmerStyle />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: COLORS.card, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div className="tc-shimmer" style={{ height: '150px', width: '100%' }} />
          <div style={{ padding: '14px' }}>
            <div className="tc-shimmer" style={{ height: '15px', width: '70%', borderRadius: '5px', marginBottom: '8px' }} />
            <div className="tc-shimmer" style={{ height: '11px', width: '45%', borderRadius: '5px', marginBottom: '12px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div className="tc-shimmer" style={{ height: '18px', width: '90px', borderRadius: '5px' }} />
              <div className="tc-shimmer" style={{ height: '32px', width: '100px', borderRadius: '9px' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton for a details page: hero image + title lines + a couple of info blocks.
 * Usage: {loading ? <DetailsSkeleton /> : <realDetails />}
 */
export function DetailsSkeleton() {
  return (
    <div style={{ padding: '16px' }}>
      <ShimmerStyle />
      <div className="tc-shimmer" style={{ height: '180px', width: '100%', borderRadius: '16px', marginBottom: '16px' }} />
      <div className="tc-shimmer" style={{ height: '19px', width: '75%', borderRadius: '5px', marginBottom: '8px' }} />
      <div className="tc-shimmer" style={{ height: '13px', width: '40%', borderRadius: '5px', marginBottom: '20px' }} />
      <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '16px', border: `1px solid ${COLORS.border}` }}>
        <div className="tc-shimmer" style={{ height: '12px', width: '55%', borderRadius: '5px', marginBottom: '10px' }} />
        <div className="tc-shimmer" style={{ height: '12px', width: '85%', borderRadius: '5px', marginBottom: '8px' }} />
        <div className="tc-shimmer" style={{ height: '12px', width: '65%', borderRadius: '5px' }} />
      </div>
      <div className="tc-shimmer" style={{ height: '52px', width: '100%', borderRadius: '12px' }} />
    </div>
  )
}

/**
 * A single-line skeleton bar for smaller inline loading spots (e.g. a stat, a balance).
 * Usage: {loading ? <LineSkeleton width="120px" /> : <realValue />}
 */
export function LineSkeleton({ width = '100%', height = '14px' }: { width?: string; height?: string }) {
  return (
    <>
      <ShimmerStyle />
      <div className="tc-shimmer" style={{ height, width, borderRadius: '5px' }} />
    </>
  )
}
