import './BroadcastBadge.css'

const NETWORK_COLORS = {
  ESPN: '#d12f2f',
  'ESPN2': '#d12f2f',
  'ESPN+': '#d12f2f',
  'ESPN Unlmtd': '#d12f2f',
  FOX: '#003366',
  FS1: '#003366',
  CBS: '#1a5dab',
  NBC: '#e5a100',
  ABC: '#333',
  TBS: '#00a6d6',
  TNT: '#b71c1c',
  'MLB.TV': '#002d72',
  'NBA TV': '#c8102e',
  'NFL Network': '#003b75',
  'SEC Network': '#00205b',
  'Big Ten Network': '#002b5c',
  'ACC Network': '#013ca6',
}

export default function BroadcastBadge({ networks }) {
  if (!networks || networks.length === 0) return null

  const primary = networks[0]
  const color = NETWORK_COLORS[primary] || '#444'

  return (
    <span
      className="broadcast-badge"
      style={{ backgroundColor: color }}
      title={networks.join(', ')}
    >
      {primary}
    </span>
  )
}
