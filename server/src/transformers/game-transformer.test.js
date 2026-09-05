import { describe, it, expect } from 'vitest'
import { transformEvent, transformScoreboard } from './game-transformer.js'

function makeEvent(overrides = {}) {
  return {
    id: 'evt-1',
    date: '2026-08-21T18:00:00Z',
    status: {
      period: 2,
      displayClock: '5:32',
      type: { state: 'in', shortDetail: 'Q2 5:32', completed: false },
    },
    competitions: [
      {
        broadcasts: [{ names: ['ESPN'] }],
        competitors: [
          {
            homeAway: 'home',
            score: '14',
            team: {
              id: '10',
              displayName: 'Home Team',
              abbreviation: 'HOM',
              logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/hom.png',
            },
            records: [{ summary: '3-1' }],
          },
          {
            homeAway: 'away',
            score: '10',
            team: {
              id: '20',
              displayName: 'Away Team',
              abbreviation: 'AWY',
              logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/awy.png',
            },
            records: [{ summary: '2-2' }],
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('transformEvent', () => {
  it('transforms a well-formed event', () => {
    const result = transformEvent(makeEvent())
    expect(result).toEqual({
      id: 'evt-1',
      homeTeam: {
        id: '10',
        name: 'Home Team',
        abbreviation: 'HOM',
        logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/hom.png',
        score: 14,
        record: '3-1',
        homeAway: 'home',
      },
      awayTeam: {
        id: '20',
        name: 'Away Team',
        abbreviation: 'AWY',
        logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/awy.png',
        score: 10,
        record: '2-2',
        homeAway: 'away',
      },
      status: {
        state: 'in',
        period: 2,
        clock: '5:32',
        detail: 'Q2 5:32',
        completed: false,
      },
      broadcasts: ['ESPN'],
      startTime: '2026-08-21T18:00:00Z',
      venue: null,
      neutralSite: false,
    })
  })

  it('maps the venue and neutral-site flag', () => {
    const ev = makeEvent()
    ev.competitions[0].venue = { fullName: 'Cotton Bowl', address: { city: 'Dallas', state: 'TX', country: 'USA' } }
    ev.competitions[0].neutralSite = true
    const result = transformEvent(ev)
    expect(result.venue).toEqual({ name: 'Cotton Bowl', city: 'Dallas', state: 'TX' })
    expect(result.neutralSite).toBe(true)
    expect(Object.isFrozen(result.venue)).toBe(true)
  })

  it('uses the country when a venue abroad has no state, and drops nameless or hostile venues', () => {
    const ev = makeEvent()
    ev.competitions[0].venue = { fullName: 'Aviva Stadium', address: { city: 'Dublin', country: 'Ireland' } }
    expect(transformEvent(ev).venue).toEqual({ name: 'Aviva Stadium', city: 'Dublin', state: 'Ireland' })
    ev.competitions[0].venue = { address: { city: 'Nowhere' } }
    expect(transformEvent(ev).venue).toBeNull()
    ev.competitions[0].venue = 'Cotton Bowl'
    expect(transformEvent(ev).venue).toBeNull()
    ev.competitions[0].venue = { fullName: 'x'.repeat(300), address: { city: 7, state: { evil: 1 } } }
    const hostile = transformEvent(ev).venue
    expect(hostile.name.length).toBeLessThanOrEqual(80)
    expect(hostile).toMatchObject({ city: '7', state: null })
    ev.competitions[0].neutralSite = 'true'
    expect(transformEvent(ev).neutralSite).toBe(false)
  })

  it('only keeps numeric team ids so they can be used in upstream URLs', () => {
    const ev = makeEvent()
    ev.competitions[0].competitors[0].team.id = '../etc'
    ev.competitions[0].competitors[1].team.id = 42
    const result = transformEvent(ev)
    expect(result.homeTeam.id).toBeNull()
    expect(result.awayTeam.id).toBe('42')
    const bare = makeEvent()
    delete bare.competitions[0].competitors[0].team.id
    expect(transformEvent(bare).homeTeam.id).toBeNull()
  })

  it('strips control and bidi-override characters from team names', () => {
    const ev = makeEvent()
    ev.competitions[0].competitors[0].team.displayName = '\u202EmaeT emoH\u202C  '
    ev.competitions[0].competitors[0].team.abbreviation = 'H\u200BOM'
    const result = transformEvent(ev)
    expect(result.homeTeam.name).toBe('maeT emoH')
    expect(result.homeTeam.abbreviation).toBe('H OM')
  })

  it('freezes the returned object and nested status', () => {
    const result = transformEvent(makeEvent())
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.status)).toBe(true)
  })

  it.each([
    ['missing competitions array', { competitions: undefined }],
    ['empty competitions array', { competitions: [] }],
    ['competition with no competitors array', { competitions: [{}] }],
    ['competitors as a non-array object', { competitions: [{ competitors: {} }] }],
  ])('returns null when %s', (_label, overrides) => {
    expect(transformEvent(makeEvent(overrides))).toBeNull()
  })

  it('returns null when only one side is present', () => {
    for (const homeAway of ['home', 'away']) {
      const event = makeEvent({
        competitions: [{ competitors: [{ homeAway, team: { abbreviation: 'X' } }] }],
      })
      expect(transformEvent(event)).toBeNull()
    }
  })

  it('defaults competitor fields when team data is missing', () => {
    const event = makeEvent({
      competitions: [
        {
          competitors: [
            { homeAway: 'home' },
            { homeAway: 'away', team: { name: 'Fallback Name' } },
          ],
        },
      ],
    })
    const result = transformEvent(event)
    expect(result.homeTeam).toMatchObject({ name: 'Unknown', abbreviation: '???', logo: null })
    expect(result.awayTeam).toMatchObject({ name: 'Fallback Name' })
  })

  it.each([
    ['undefined', undefined, 0],
    ['empty string', '', 0],
    ['null', null, 0],
    ['numeric zero', 0, 0],
    ['numeric', 21, 21],
    ['numeric string', '7', 7],
    ['non-numeric string clamps to 0', 'PPD', 0],
  ])('parses competitor score: %s', (_label, score, expected) => {
    const event = makeEvent({
      competitions: [
        {
          competitors: [
            { homeAway: 'home', score, team: { abbreviation: 'HOM' } },
            { homeAway: 'away', team: { abbreviation: 'AWY' } },
          ],
        },
      ],
    })
    expect(transformEvent(event).homeTeam.score).toBe(expected)
  })

  it('rejects non-espncdn or non-https logo URLs', () => {
    for (const logo of [
      'http://a.espncdn.com/logo.png',
      'https://evil.example/logo.png',
      'javascript:alert(1)',
      'not a url',
      42,
    ]) {
      const event = makeEvent({
        competitions: [
          {
            competitors: [
              { homeAway: 'home', team: { abbreviation: 'HOM', logo } },
              { homeAway: 'away', team: { abbreviation: 'AWY' } },
            ],
          },
        ],
      })
      expect(transformEvent(event).homeTeam.logo).toBeNull()
    }
  })

  it('coerces non-string field types instead of passing them through', () => {
    const event = makeEvent({
      competitions: [
        {
          competitors: [
            { homeAway: 'home', team: { abbreviation: { evil: true }, displayName: 7 } },
            { homeAway: 'away', team: { abbreviation: 'AWY' } },
          ],
        },
      ],
    })
    const home = transformEvent(event).homeTeam
    expect(home.abbreviation).toBe('???')
    expect(home.name).toBe('7')
  })

  it('clamps unknown status states to pre', () => {
    const result = transformEvent(
      makeEvent({ status: { type: { state: 'suspended' } } })
    )
    expect(result.status.state).toBe('pre')
  })

  it('handles non-array broadcasts without throwing', () => {
    const event = makeEvent({
      competitions: [
        {
          broadcasts: {},
          competitors: makeEvent().competitions[0].competitors,
        },
      ],
    })
    expect(() => transformEvent(event)).not.toThrow()
    expect(transformEvent(event).broadcasts).toEqual([])
  })

  it('flattens broadcasts, coerces numbers, drops nulls, caps at four', () => {
    const event = makeEvent({
      competitions: [
        {
          broadcasts: [
            { names: ['ESPN', 'ESPN2', 7, null] },
            { names: ['ABC', 'FOX', 'CBS'] },
            { names: 'not-an-array' },
          ],
          competitors: makeEvent().competitions[0].competitors,
        },
      ],
    })
    expect(transformEvent(event).broadcasts).toEqual(['ESPN', 'ESPN2', '7', 'ABC'])
  })
})

describe('transformScoreboard', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['missing events', {}],
    ['non-array events', { events: 'nope' }],
    ['empty events', { events: [] }],
  ])('returns frozen [] for %s', (_label, raw) => {
    const result = transformScoreboard(raw)
    expect(result).toEqual([])
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('filters out incomplete events, keeping valid ones', () => {
    const valid = makeEvent({ id: 'valid-1' })
    const invalid = makeEvent({ id: 'invalid-1', competitions: [] })
    const result = transformScoreboard({ events: [valid, invalid] })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('valid-1')
  })

  it('isolates a throwing event instead of poisoning the league cycle', () => {
    const valid = makeEvent({ id: 'valid-1' })
    // status as a Proxy that throws on access simulates hostile shape drift
    const hostile = makeEvent({ id: 'bad' })
    Object.defineProperty(hostile, 'status', {
      get() {
        throw new Error('shape drift')
      },
    })
    const result = transformScoreboard({ events: [hostile, valid] })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('valid-1')
  })

  it('caps processing at 200 events', () => {
    const events = Array.from({ length: 500 }, (_, i) => makeEvent({ id: `e${i}` }))
    expect(transformScoreboard({ events }).length).toBe(200)
  })
})

describe('fallback hash ids', () => {
  it('derives a stable hash id from teams, sport and start time when id is missing', () => {
    const event = makeEvent({ id: undefined })
    const a = transformEvent(event, 'mlb')
    const b = transformEvent(makeEvent({ id: undefined }), 'mlb')
    expect(a.id).toMatch(/^h[0-9a-f]{8,16}$/)
    expect(a.id).toBe(b.id)
  })

  it('hash id varies with sport and start time', () => {
    const base = makeEvent({ id: undefined })
    const mlb = transformEvent(base, 'mlb')
    const nba = transformEvent(makeEvent({ id: undefined }), 'nba')
    const later = transformEvent(makeEvent({ id: undefined, date: '2099-01-01T00:00:00Z' }), 'mlb')
    expect(nba.id).not.toBe(mlb.id)
    expect(later.id).not.toBe(mlb.id)
  })

  it('keeps the real ESPN id when present', () => {
    expect(transformEvent(makeEvent({ id: '123' }), 'mlb').id).toBe('123')
  })
})
