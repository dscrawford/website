// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import TetrisSidebar from '../TetrisSidebar.jsx'

// jsdom has no canvas: the piece previews need a stubbed 2d context
HTMLCanvasElement.prototype.getContext = () => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  fillStyle: '',
  shadowColor: '',
  shadowBlur: 0,
})

function renderSidebar(props = {}) {
  const onSpeedChange = vi.fn()
  const utils = render(
    <TetrisSidebar
      nextQueue={[1]}
      hold={0}
      score={0}
      level={0}
      aiStrategy="flat"
      onAiStrategyChange={vi.fn()}
      speedMultiplier={1}
      onSpeedChange={onSpeedChange}
      aiInfo={null}
      onReset={vi.fn()}
      {...props}
    />
  )
  return { ...utils, onSpeedChange }
}

describe('TetrisSidebar — speed slider', () => {
  afterEach(cleanup)

  it('renders a range input capped to [1, 20]', () => {
    renderSidebar({ speedMultiplier: 5 })
    const slider = screen.getByRole('slider', { name: /game speed multiplier/i })
    expect(slider.getAttribute('type')).toBe('range')
    expect(slider.getAttribute('min')).toBe('1')
    expect(slider.getAttribute('max')).toBe('20')
    expect(slider.value).toBe('5')
  })

  it('displays the current speed with an x suffix', () => {
    renderSidebar({ speedMultiplier: 12 })
    expect(screen.getByText('12x')).toBeTruthy()
  })

  it.each([2, 20])('reports slider moves as numbers (%i)', (target) => {
    const { onSpeedChange } = renderSidebar({ speedMultiplier: 1 })
    const slider = screen.getByRole('slider', { name: /game speed multiplier/i })
    fireEvent.change(slider, { target: { value: String(target) } })
    expect(onSpeedChange).toHaveBeenCalledWith(target)
  })

  it('the DOM clamps out-of-range values to the slider max', () => {
    renderSidebar({ speedMultiplier: 999 })
    const slider = screen.getByRole('slider', { name: /game speed multiplier/i })
    expect(Number(slider.value)).toBeLessThanOrEqual(20)
  })

  it('the old free-text speed input is gone', () => {
    const { container } = renderSidebar()
    expect(container.querySelector('.speed-input')).toBeNull()
  })
})
