import { useRef, useEffect, useState } from 'react'
import { PIECE_SHAPES } from '../game-engine/types.js'
import { PIECE_COLORS, PIECE_GLOW_COLORS } from '../rendering/colors.js'
import './TetrisSidebar.css'

function PiecePreview({ pieceType, size = 80 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !pieceType) return
    const ctx = canvas.getContext('2d')
    const cellSize = 18
    ctx.clearRect(0, 0, size, size)

    const shape = PIECE_SHAPES[pieceType][0]
    const rows = shape.map(([r]) => r)
    const cols = shape.map(([, c]) => c)
    const minR = Math.min(...rows)
    const maxR = Math.max(...rows)
    const minC = Math.min(...cols)
    const maxC = Math.max(...cols)
    const pieceH = (maxR - minR + 1) * cellSize
    const pieceW = (maxC - minC + 1) * cellSize
    const offsetX = (size - pieceW) / 2 - minC * cellSize
    const offsetY = (size - pieceH) / 2 - minR * cellSize

    ctx.fillStyle = PIECE_COLORS[pieceType]
    ctx.shadowColor = PIECE_GLOW_COLORS[pieceType]
    ctx.shadowBlur = 6

    for (const [r, c] of shape) {
      ctx.fillRect(
        offsetX + c * cellSize + 1,
        offsetY + r * cellSize + 1,
        cellSize - 2,
        cellSize - 2
      )
    }
    ctx.shadowBlur = 0
  }, [pieceType, size])

  return <canvas ref={canvasRef} width={size} height={size} className="piece-preview-canvas" />
}

function SpeedInput({ value, onChange }) {
  const [draft, setDraft] = useState(String(value))
  const [editing, setEditing] = useState(false)

  // Sync draft from prop when not actively editing
  useEffect(() => {
    if (!editing) setDraft(String(value))
  }, [value, editing])

  const commit = () => {
    setEditing(false)
    const num = Math.floor(Number(draft))
    if (num >= 1 && num <= 999) {
      onChange?.(num)
    } else {
      setDraft(String(value))
    }
  }

  return (
    <div className="speed-input-row">
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onFocus={(e) => { setEditing(true); e.target.select() }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
        className="speed-input"
      />
      <span className="sidebar-value">x</span>
    </div>
  )
}

const STRATEGY_OPTIONS = [
  ['flat', 'FLAT'],
  ['threeTower', '3-TOWER'],
  ['off', 'OFF'],
]

const stopPropagation = (e) => e.stopPropagation()

export default function TetrisSidebar({
  nextQueue,
  hold,
  score,
  level,
  aiStrategy,
  onAiStrategyChange,
  speedMultiplier,
  onSpeedChange,
}) {
  return (
    <aside className="tetris-sidebar">
      <div className="sidebar-section">
        <div className="sidebar-label">NEXT:</div>
        <PiecePreview pieceType={nextQueue?.[0]} />
      </div>
      <div className="sidebar-section">
        <div className="sidebar-label">HOLD:</div>
        <PiecePreview pieceType={hold} />
      </div>
      <div className="sidebar-section">
        <div className="sidebar-label">SCORE:</div>
        <div className="sidebar-value score-value">
          {(score ?? 0).toLocaleString()}
        </div>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-label">LEVEL:</div>
        <div className="sidebar-value">{level ?? 0}</div>
      </div>
      <div
        className="sidebar-section"
        onClick={stopPropagation}
        onMouseDown={stopPropagation}
        onPointerDown={stopPropagation}
      >
        <div className="sidebar-label">AI MODE:</div>
        <div className="ai-strategy-selector">
          {STRATEGY_OPTIONS.map(([key, label]) => (
            <button
              key={key}
              className={`ai-strategy-btn${aiStrategy === key ? ' active' : ''}${key === 'off' && aiStrategy === key ? ' off-active' : ''}`}
              onClick={() => onAiStrategyChange?.(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div
        className="sidebar-section"
        onClick={stopPropagation}
        onMouseDown={stopPropagation}
        onPointerDown={stopPropagation}
      >
        <div className="sidebar-label">SPEED:</div>
        <SpeedInput value={speedMultiplier} onChange={onSpeedChange} />
      </div>
    </aside>
  )
}
