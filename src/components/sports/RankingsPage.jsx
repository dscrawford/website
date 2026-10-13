import TopNav from '../TopNav.jsx'
import DatePicker from './DatePicker.jsx'
import TeamCell from './TeamCell.jsx'
import StatHeader from './StatHeader.jsx'
import useApiData from '../../hooks/useApiData.js'
import { todayISO, formatDay } from './dates.js'
import { LEAGUE_KEYS, leagueLabel, isValidDay, hasPolls, standingsPath } from './leagues.js'
import './RankingsPage.css'

const NO_POLLS = Object.freeze([])
// Polls carry ESPN's type: the committee ranking decides the playoff, so
// it is the default once it exists
const PREFERRED = ['cfp', 'ap']

const COLUMNS = Object.freeze({
  prev: { name: 'Previous', description: "The team's rank in the poll's last edition" },
  record: { name: 'Record', description: 'Wins and losses when the poll was published' },
  points: { name: 'Points', description: 'Weighted total of all ballots' },
  votes: { name: 'First-place votes', description: 'Ballots that ranked the team first' },
})

function trendClass(trend) {
  if (!trend || trend === '-') return ''
  return trend.startsWith('+') ? ' rank-trend--up' : trend.startsWith('-') ? ' rank-trend--down' : ''
}

function trendLabel(rank) {
  if (!rank.previous) return 'NEW'
  return rank.trend && rank.trend !== '-' ? rank.trend : '—'
}

function pickPoll(polls, requested) {
  if (polls.length === 0) return null
  const byType = (type) => polls.find((p) => p.type === type)
  return (requested && byType(requested)) || PREFERRED.map(byType).find(Boolean) || polls[0]
}

function TeamList({ title, entries, leagueKey, navigate }) {
  if (!entries || entries.length === 0) return null
  return (
    <p className="rank-others">
      <span className="rank-others-title">{title}</span>{' '}
      {entries.map((entry, i) => (
        <span key={entry.team.id ?? i} className="rank-other">
          {i > 0 && ', '}
          <TeamCell team={{ ...entry.team, name: '', logo: null }} leagueKey={leagueKey} navigate={navigate} />
          {entry.points > 0 && <span className="rank-other-points"> {entry.points}</span>}
        </span>
      ))}
    </p>
  )
}

// The polls in force on a day for a college league: /sports/rankings/:league
// with ?date=YYYY-MM-DD (today when absent) and ?poll=<type> to pick one
export default function RankingsPage({ navigate, leagueKey, search = window.location.search }) {
  const known = LEAGUE_KEYS.has(leagueKey) && hasPolls(leagueKey)
  const params = new URLSearchParams(search)
  const requestedDate = params.get('date')
  const date = requestedDate && isValidDay(requestedDate) && requestedDate !== todayISO() ? requestedDate : undefined
  const path = known ? `/api/scores/${leagueKey}/rankings${date ? `?date=${date}` : ''}` : null
  const { data, loading, error: failed, retry } = useApiData(path)
  // The API answers an ESPN outage with an empty, unstamped payload
  const error = failed || (data !== null && !data.fetchedAt)
  const polls = data?.polls ?? NO_POLLS
  const poll = pickPoll(polls, params.get('poll'))
  const showVotes = poll?.ranks.some((r) => r.points > 0)

  const go = (nextDate, nextPoll) => {
    const query = new URLSearchParams()
    if (nextDate && nextDate !== todayISO()) query.set('date', nextDate)
    if (nextPoll) query.set('poll', nextPoll)
    const qs = query.toString()
    navigate?.(`/sports/rankings/${leagueKey}${qs ? `?${qs}` : ''}`)
  }
  const backHref = date ? `/sports?date=${date}` : '/sports'

  return (
    <div className="sports-page">
      <TopNav navigate={navigate} />
      <div className="sports-content rank-page">
        <a
          className="game-page-back"
          href={backHref}
          onClick={(e) => {
            e.preventDefault()
            navigate?.(backHref)
          }}
        >
          ← SCOREBOARD
        </a>

        {!known && <p className="sports-status">No rankings for this league.</p>}

        {known && (
          <>
            <div className="sports-date">
              <DatePicker value={date ?? todayISO()} onChange={(iso) => go(iso, poll?.type)} label="Rankings date" />
            </div>
            <p className="game-page-league">{leagueLabel(leagueKey)}</p>
            <h1 className="sports-title">{date ? `RANKINGS AS OF ${formatDay(date).toUpperCase()}` : 'RANKINGS'}</h1>

            {polls.length > 1 && (
              <nav className="rank-tabs" aria-label="Poll">
                {polls.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`sports-nav-tab${p.id === poll?.id ? ' rank-tab--active' : ''}`}
                    aria-pressed={p.id === poll?.id}
                    onClick={() => go(date, p.type)}
                  >
                    {p.shortName}
                  </button>
                ))}
              </nav>
            )}

            {loading && <p className="sports-status">Loading rankings...</p>}
            {error && (
              <p className="sports-status">
                Unable to load rankings.{' '}
                <button type="button" className="sched-retry" onClick={retry}>
                  Retry
                </button>
              </p>
            )}
            {data && !error && !poll && <p className="sports-status">No poll published for this date.</p>}

            {poll && (
              <section className="rank-poll" aria-label={poll.name}>
                <header className="rank-head">
                  <h2 className="rank-poll-name">{poll.name}</h2>
                  <span className="rank-poll-week">
                    {poll.week}
                    {poll.date && ` · ${formatDay(poll.date.slice(0, 10))}`}
                  </span>
                </header>
                <div className="rank-table-wrap">
                  <table className="rank-table">
                    <thead>
                      <tr>
                        <th className="rank-col-num">#</th>
                        <th className="rank-col-team">TEAM</th>
                        <StatHeader label="REC" info={COLUMNS.record} />
                        <StatHeader label="PREV" info={COLUMNS.prev} />
                        {showVotes && <StatHeader label="PTS" info={COLUMNS.points} />}
                        {showVotes && <StatHeader label="1ST" info={COLUMNS.votes} />}
                      </tr>
                    </thead>
                    <tbody>
                      {poll.ranks.map((entry) => (
                        <tr key={entry.team.id ?? entry.rank} className="rank-row">
                          <td className="rank-col-num">{entry.rank}</td>
                          <td className="rank-col-team">
                            <TeamCell team={entry.team} leagueKey={leagueKey} navigate={navigate} />
                          </td>
                          <td>{entry.record ?? ''}</td>
                          <td>
                            <span className={`rank-trend${trendClass(entry.trend)}`}>{trendLabel(entry)}</span>
                          </td>
                          {showVotes && <td>{entry.points}</td>}
                          {showVotes && <td>{entry.firstPlaceVotes || ''}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TeamList title="Others receiving votes:" entries={poll.others} leagueKey={leagueKey} navigate={navigate} />
                <TeamList title="Dropped out:" entries={poll.droppedOut} leagueKey={leagueKey} navigate={navigate} />
              </section>
            )}

            <a
              className="rank-standings-link"
              href={standingsPath(leagueKey)}
              onClick={(e) => {
                e.preventDefault()
                navigate?.(standingsPath(leagueKey))
              }}
            >
              CONFERENCE STANDINGS →
            </a>
          </>
        )}
      </div>
    </div>
  )
}
