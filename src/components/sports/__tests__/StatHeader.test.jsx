// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import StatHeader from '../StatHeader.jsx'
import { computeTooltipPosition, TOOLTIP_WIDTH } from '../tooltipPosition.js'

const INFO = Object.freeze({ name: 'Interceptions Thrown', description: 'Passes caught by the defense.' })

function renderHeader(props) {
  return render(
    <table>
      <thead>
        <tr>
          <StatHeader label="INT" {...props} />
        </tr>
      </thead>
    </table>
  )
}

describe('StatHeader', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders a plain header when there is nothing to explain', () => {
    renderHeader({ info: null })
    const th = screen.getByRole('columnheader')
    expect(th.textContent).toBe('INT')
    expect(th.hasAttribute('tabindex')).toBe(false)
    fireEvent.mouseEnter(th)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows the full name and description on hover and hides on leave', () => {
    renderHeader({ info: INFO })
    const th = screen.getByRole('columnheader')
    expect(screen.queryByRole('tooltip')).toBeNull()

    fireEvent.mouseEnter(th)
    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toContain('Interceptions Thrown')
    expect(tip.textContent).toContain('Passes caught by the defense.')
    expect(th.getAttribute('aria-describedby')).toBe(tip.id)

    fireEvent.mouseLeave(th)
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(th.hasAttribute('aria-describedby')).toBe(false)
  })

  it('is keyboard accessible: focus shows, Escape and blur hide', () => {
    renderHeader({ info: INFO })
    const th = screen.getByRole('columnheader')
    expect(th.getAttribute('tabindex')).toBe('0')

    fireEvent.focus(th)
    expect(screen.getByRole('tooltip')).toBeTruthy()
    fireEvent.keyDown(th, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()

    fireEvent.focus(th)
    expect(screen.getByRole('tooltip')).toBeTruthy()
    fireEvent.blur(th)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('hides when the page scrolls so a fixed tooltip never drifts', () => {
    renderHeader({ info: INFO })
    fireEvent.mouseEnter(screen.getByRole('columnheader'))
    expect(screen.getByRole('tooltip')).toBeTruthy()
    fireEvent.scroll(window)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('hides when the viewport resizes', () => {
    renderHeader({ info: INFO })
    fireEvent.mouseEnter(screen.getByRole('columnheader'))
    expect(screen.getByRole('tooltip')).toBeTruthy()
    fireEvent.resize(window)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('renders only the name when there is no description', () => {
    renderHeader({ info: { name: 'Zed Score', description: null } })
    fireEvent.mouseEnter(screen.getByRole('columnheader'))
    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toBe('Zed Score')
  })

  it('positions the tooltip from the header rect', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 500, right: 540, top: 300, bottom: 320, width: 40, height: 20,
    })
    renderHeader({ info: INFO })
    fireEvent.mouseEnter(screen.getByRole('columnheader'))
    const tip = screen.getByRole('tooltip')
    expect(tip.style.left).toBe(`${520 - TOOLTIP_WIDTH / 2}px`)
    expect(tip.style.top).toBe('294px')
    expect(tip.className).toContain('stat-tip--above')
  })
})

describe('computeTooltipPosition', () => {
  const viewport = { width: 1000, height: 800 }
  const rect = (left, top, width = 40, height = 20) => ({
    left, top, width, height, right: left + width, bottom: top + height,
  })

  it('centers above the header with a gap', () => {
    const pos = computeTooltipPosition(rect(500, 300), viewport)
    expect(pos).toEqual({ left: 520 - TOOLTIP_WIDTH / 2, top: 294, width: TOOLTIP_WIDTH, placement: 'above' })
  })

  it('clamps to the left and right viewport edges', () => {
    expect(computeTooltipPosition(rect(0, 300), viewport).left).toBe(8)
    expect(computeTooltipPosition(rect(980, 300), viewport).left).toBe(1000 - TOOLTIP_WIDTH - 8)
  })

  it('flips below the header when there is no room above', () => {
    const pos = computeTooltipPosition(rect(500, 40), viewport)
    expect(pos.placement).toBe('below')
    expect(pos.top).toBe(66)
  })

  it('flips exactly at the threshold', () => {
    expect(computeTooltipPosition(rect(500, 96), viewport)).toMatchObject({ placement: 'below', top: 122 })
    expect(computeTooltipPosition(rect(500, 97), viewport)).toMatchObject({ placement: 'above', top: 91 })
  })

  it('honors an explicit width', () => {
    expect(computeTooltipPosition(rect(500, 300), viewport, 100)).toEqual({
      left: 470, top: 294, width: 100, placement: 'above',
    })
  })

  it('never produces a negative width or offset on a viewport narrower than the margins', () => {
    const pos = computeTooltipPosition(rect(0, 300), { width: 10, height: 100 })
    expect(pos.width).toBe(0)
    expect(pos.left).toBe(8)
  })

  it('shrinks to fit narrow viewports', () => {
    const pos = computeTooltipPosition(rect(10, 300), { width: 200, height: 800 })
    expect(pos.width).toBe(200 - 16)
    expect(pos.left).toBe(8)
  })
})
