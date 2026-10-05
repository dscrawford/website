import { useRef } from 'react'
import { isValidDay } from './leagues.js'
import { todayISO, shiftDate, formatDay } from './dates.js'
import './DatePicker.css'

// Day stepper plus the platform's own calendar: a hidden <input type=date>
// gives phones their native wheel/sheet and desktops the browser popup,
// with none of the layout or touch handling a custom grid would need.
export default function DatePicker({ value, onChange }) {
  const inputRef = useRef(null)
  const today = todayISO()

  const openCalendar = () => {
    const input = inputRef.current
    if (!input) return
    try {
      if (typeof input.showPicker === 'function') input.showPicker()
      else {
        input.focus()
        input.click()
      }
    } catch {
      input.focus()
    }
  }

  return (
    <div className="date-picker" role="group" aria-label="Scoreboard date">
      <button type="button" className="date-step" aria-label="Previous day" onClick={() => onChange(shiftDate(value, -1))}>
        {'‹'}
      </button>
      <button type="button" className="date-current" aria-label="Pick a date" onClick={openCalendar}>
        <span className="date-icon" aria-hidden="true">{'📅'}</span>
        {formatDay(value)}
      </button>
      <input
        ref={inputRef}
        className="date-native"
        type="date"
        aria-label="Choose a date"
        value={value}
        onChange={(e) => {
          if (isValidDay(e.target.value)) onChange(e.target.value)
        }}
      />
      <button type="button" className="date-step" aria-label="Next day" onClick={() => onChange(shiftDate(value, 1))}>
        {'›'}
      </button>
      {value !== today && (
        <button type="button" className="date-today" onClick={() => onChange(today)}>
          Today
        </button>
      )}
    </div>
  )
}
