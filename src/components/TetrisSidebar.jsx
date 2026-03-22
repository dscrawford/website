import { useRef, useEffect } from 'react'
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

export default function TetrisSidebar({ nextQueue, hold, score, level }) {
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
    </aside>
  )
}
