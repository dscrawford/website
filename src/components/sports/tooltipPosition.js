export const TOOLTIP_WIDTH = 220
const VIEWPORT_MARGIN = 8
const GAP = 6
// Below this many px from the top there is no room to open upward
const FLIP_THRESHOLD = 96

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi)

// Fixed-position placement from the anchor's viewport rect; a fixed width
// lets the tooltip be clamped to the viewport without measuring itself
export function computeTooltipPosition(rect, viewport, width = TOOLTIP_WIDTH) {
  const tipWidth = Math.max(0, Math.min(width, viewport.width - VIEWPORT_MARGIN * 2))
  const left = clamp(
    rect.left + rect.width / 2 - tipWidth / 2,
    VIEWPORT_MARGIN,
    Math.max(VIEWPORT_MARGIN, viewport.width - tipWidth - VIEWPORT_MARGIN)
  )
  const above = rect.top > FLIP_THRESHOLD
  return {
    left,
    top: above ? rect.top - GAP : rect.bottom + GAP,
    width: tipWidth,
    placement: above ? 'above' : 'below',
  }
}
