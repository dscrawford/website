// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import DatePicker from '../DatePicker.jsx'
import { shiftDate, todayISO } from '../dates.js'

afterEach(cleanup)

describe('DatePicker', () => {
  it('shows the selected day and steps a day either way', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-09-04" onChange={onChange} />)
    expect(screen.getByRole('button', { name: /pick a date/i }).textContent).toMatch(/Sep 4/)
    fireEvent.click(screen.getByRole('button', { name: /previous day/i }))
    expect(onChange).toHaveBeenLastCalledWith('2026-09-03')
    fireEvent.click(screen.getByRole('button', { name: /next day/i }))
    expect(onChange).toHaveBeenLastCalledWith('2026-09-05')
  })

  it('opens the native calendar from the date button and reports the chosen day', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-09-04" onChange={onChange} />)
    const input = screen.getByLabelText(/choose a date/i)
    input.showPicker = vi.fn()
    fireEvent.click(screen.getByRole('button', { name: /pick a date/i }))
    expect(input.showPicker).toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '2026-10-31' } })
    expect(onChange).toHaveBeenLastCalledWith('2026-10-31')
  })

  it('offers a Today shortcut only when not on today', () => {
    const onChange = vi.fn()
    const { rerender } = render(<DatePicker value="2020-01-01" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /^today$/i }))
    expect(onChange).toHaveBeenLastCalledWith(todayISO())
    rerender(<DatePicker value={todayISO()} onChange={onChange} />)
    expect(screen.queryByRole('button', { name: /^today$/i })).toBeNull()
  })

  it('ignores an empty or malformed native value', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-09-04" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/choose a date/i), { target: { value: '' } })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('shiftDate', () => {
  it('moves across month and year boundaries without timezone drift', () => {
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDate('2026-02-28', 1)).toBe('2026-03-01')
    expect(shiftDate('2024-02-28', 1)).toBe('2024-02-29')
  })
})
