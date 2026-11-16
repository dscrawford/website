// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import TopNav from '../TopNav.jsx'
import { GAMES } from '../games.js'

afterEach(cleanup)

const gamesButton = () => screen.getByRole('button', { name: 'GAMES' })

describe('TopNav', () => {
  it('lists the sections in order', () => {
    render(<TopNav />)
    const labels = [...document.querySelectorAll('.nav-links > .nav-link, .nav-links .nav-games > button')]
      .map((el) => el.textContent)
    expect(labels).toEqual(['GAMES', 'SPORTS', 'CODE', 'RESUME'])
  })

  it('routes SPORTS through navigate', () => {
    const navigate = vi.fn()
    render(<TopNav navigate={navigate} />)
    fireEvent.click(screen.getByRole('link', { name: 'SPORTS' }))
    expect(navigate).toHaveBeenCalledWith('/sports')
  })

  it('keeps the games menu closed until GAMES is clicked', () => {
    render(<TopNav />)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(gamesButton().getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(gamesButton())
    expect(gamesButton().getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('links every game to its site', () => {
    render(<TopNav />)
    fireEvent.click(gamesButton())
    const items = screen.getAllByRole('menuitem')
    expect(items.map((a) => [a.textContent, a.getAttribute('href')]))
      .toEqual(GAMES.map((g) => [g.name, g.href]))
    expect(items[0].getAttribute('href')).toBe('/FishingGame/')
  })

  it('does not route game links through the SPA', () => {
    const navigate = vi.fn()
    render(<TopNav navigate={navigate} />)
    fireEvent.click(gamesButton())
    fireEvent.click(screen.getByRole('menuitem', { name: 'Fishing Game' }))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('toggles closed on a second click', () => {
    render(<TopNav />)
    fireEvent.click(gamesButton())
    fireEvent.click(gamesButton())
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes on Escape', () => {
    render(<TopNav />)
    fireEvent.click(gamesButton())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes on a click outside', () => {
    render(<TopNav />)
    fireEvent.click(gamesButton())
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('stays open on a click inside the menu', () => {
    render(<TopNav />)
    fireEvent.click(gamesButton())
    fireEvent.mouseDown(screen.getByRole('menu'))
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('routes the title home', () => {
    const navigate = vi.fn()
    render(<TopNav navigate={navigate} />)
    fireEvent.click(screen.getByRole('link', { name: 'DCRAW.NET' }))
    expect(navigate).toHaveBeenCalledWith('/')
  })
})
