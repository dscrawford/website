import { memo, useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { computeTooltipPosition } from './tooltipPosition.js'
import './StatHeader.css'

function StatTooltip({ id, info, position }) {
  const { left, top, width, placement } = position
  return createPortal(
    <div id={id} role="tooltip" className={`stat-tip stat-tip--${placement}`} style={{ left, top, width }}>
      <span className="stat-tip-name">{info.name}</span>
      {info.description && <span className="stat-tip-desc">{info.description}</span>}
    </div>,
    document.body
  )
}

// Column header that explains its abbreviation on hover or keyboard focus.
// The tooltip is portaled with fixed positioning so the table's own
// overflow scrolling and the page's backdrop-filter cannot clip it.
function StatHeader({ label, info }) {
  const id = useId()
  const ref = useRef(null)
  const [position, setPosition] = useState(null)

  const show = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    setPosition(computeTooltipPosition(rect, { width: window.innerWidth, height: window.innerHeight }))
  }, [])
  const hide = useCallback(() => setPosition(null), [])

  useEffect(() => {
    if (!position) return undefined
    window.addEventListener('scroll', hide, { capture: true, passive: true })
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide, { capture: true })
      window.removeEventListener('resize', hide)
    }
  }, [position, hide])

  if (!info) return <th>{label}</th>

  return (
    <th
      ref={ref}
      className="stat-th"
      tabIndex={0}
      aria-describedby={position ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => e.key === 'Escape' && hide()}
    >
      <span className="stat-label">{label}</span>
      {position && <StatTooltip id={id} info={info} position={position} />}
    </th>
  )
}

export default memo(StatHeader)
