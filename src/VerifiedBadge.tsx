// Facebook-style blue verified badge (scalloped circle with a white tick).
// Use it next to the name of any business that has upgraded to Business Suite.

type VerifiedBadgeProps = {
  size?: number
  color?: string
  title?: string
}

// Build the wavy (scalloped) outline once, using simple geometry.
const LOBES = 8
const STEPS = 160
const CENTER = 12
const BASE_RADIUS = 10.2
const WAVE = 0.9

const BADGE_PATH = (() => {
  const points: string[] = []
  for (let i = 0; i <= STEPS; i++) {
    const angle = (i / STEPS) * Math.PI * 2
    const radius = BASE_RADIUS + WAVE * Math.cos(LOBES * angle)
    const x = CENTER + radius * Math.cos(angle)
    const y = CENTER + radius * Math.sin(angle)
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return points.join(' ') + ' Z'
})()

function VerifiedBadge({ size = 16, color = '#1877F2', title = 'Verified business' }: VerifiedBadgeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
    >
      <title>{title}</title>
      <path d={BADGE_PATH} fill={color} />
      <path
        d="M7.6 12.4 L10.7 15.4 L16.4 9.2"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default VerifiedBadge
