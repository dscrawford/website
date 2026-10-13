import TopNav from '../TopNav.jsx'
import TeamCell from './TeamCell.jsx'
import StatHeader from './StatHeader.jsx'
import useApiData from '../../hooks/useApiData.js'
import { LEAGUE_KEYS, leagueLabel, seasonOptions, isValidSeason, hasPolls, rankingsPath, standingsPath } from './leagues.js'
import './RankingsPage.css'
import './StandingsPage.css'

const NO_GROUPS = Object.freeze([])

// One division or conference: its teams first place to last
function StandingsTable({ group, columns, leagueKey, navigate }) {
  return (
    <div className="stand-table-wrap">
      <table className="rank-table stand-table" aria-label={group.name}>
        <thead>
          <tr>
            <th className="rank-col-num">#</th>
            <th className="rank-col-team">{group.name.toUpperCase()}</th>
            {columns.map((c) => (
              <StatHeader key={c.key} label={c.label} info={c.title ? { name: c.title } : null} />
            ))}
          </tr>
        </thead>
        <tbody>
          {group.entries.map((entry, i) => (
            <tr key={entry.team.id ?? i} className="rank-row">
              <td className="rank-col-num">{i + 1}</td>
              <td className="rank-col-team">
                <TeamCell team={entry.team} leagueKey={leagueKey} navigate={navigate} />
              </td>
              {columns.map((c) => (
                <td key={c.key}>{entry.stats[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Group({ group, columns, leagueKey, navigate }) {
  const divisions = group.groups ?? (group.entries.length > 0 ? [group] : NO_GROUPS)
  return (
    <section className="stand-group" aria-label={group.name}>
      {group.groups && <h2 className="stand-group-name">{group.name}</h2>}
      {divisions.map((division) => (
        <StandingsTable key={division.id ?? division.name} group={division} columns={columns} leagueKey={leagueKey} navigate={navigate} />
      ))}
    </section>
  )
}

// Division (pro) or conference (college) standings: /sports/standings/:league
// with ?season=YYYY for a past year
export default function StandingsPage({ navigate, leagueKey, search = window.location.search }) {
  const known = LEAGUE_KEYS.has(leagueKey)
  const seasons = seasonOptions()
  const requested = new URLSearchParams(search).get('season')
  const season = requested && isValidSeason(requested) && requested !== seasons[0] ? requested : undefined
  const path = known ? `/api/scores/${leagueKey}/standings${season ? `?season=${season}` : ''}` : null
  const { data, loading, error: failed, retry } = useApiData(path)
  // The API answers an ESPN outage with an empty, unstamped payload
  const error = failed || (data !== null && !data.fetchedAt)
  const groups = data?.groups ?? NO_GROUPS
  const columns = data?.columns ?? NO_GROUPS

  const selectSeason = (year) => {
    navigate?.(standingsPath(leagueKey, year === seasons[0] ? undefined : year))
  }

  return (
    <div className="sports-page">
      <TopNav navigate={navigate} />
      <div className="sports-content stand-page">
        <a
          className="game-page-back"
          href="/sports"
          onClick={(e) => {
            e.preventDefault()
            navigate?.('/sports')
          }}
        >
          ← SCOREBOARD
        </a>

        {!known && <p className="sports-status">Unknown league.</p>}

        {known && (
          <>
            <p className="game-page-league">{leagueLabel(leagueKey)}</p>
            <header className="stand-head">
              <h1 className="sports-title stand-title">
                STANDINGS
                {data?.season?.label && <span className="stand-season-label">{data.season.label}</span>}
              </h1>
              <div className="team-tools">
                <label className="team-season">
                  <span className="team-season-label">Season</span>
                  <select
                    className="team-season-select"
                    aria-label="Season"
                    value={season ?? seasons[0]}
                    onChange={(e) => selectSeason(e.target.value)}
                  >
                    {seasons.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
                {hasPolls(leagueKey) && (
                  <a
                    className="rank-standings-link"
                    href={rankingsPath(leagueKey)}
                    onClick={(e) => {
                      e.preventDefault()
                      navigate?.(rankingsPath(leagueKey))
                    }}
                  >
                    POLLS →
                  </a>
                )}
              </div>
            </header>

            {loading && <p className="sports-status">Loading standings...</p>}
            {error && (
              <p className="sports-status">
                Unable to load standings.{' '}
                <button type="button" className="sched-retry" onClick={retry}>
                  Retry
                </button>
              </p>
            )}
            {data && !error && groups.length === 0 && <p className="sports-status">No standings for this season.</p>}

            {groups.map((group) => (
              <Group key={group.id ?? group.name} group={group} columns={columns} leagueKey={leagueKey} navigate={navigate} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
