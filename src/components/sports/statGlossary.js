// Stat header glossary for box scores. A static module rather than a DB:
// ~90 entries that change only when ESPN changes its columns, versioned
// with the code that renders them. Lookup precedence: group → sport → common.

const entry = (name, description) => Object.freeze({ name, description })

const COMMON = {
  TD: entry('Touchdowns', 'Scoring plays worth six points.'),
  YDS: entry('Yards', 'Total yards gained.'),
  AVG: entry('Average', 'Yards gained per attempt.'),
  LONG: entry('Longest Play', 'Longest single play, in yards.'),
  PTS: entry('Points', 'Points scored.'),
  MIN: entry('Minutes', 'Minutes played.'),
  NO: entry('Number', 'Number of attempts.'),
}

const SPORTS = {
  football: {
    SACKS: entry('Sacks', 'Tackles of the quarterback behind the line of scrimmage on a pass play.'),
  },
  basketball: {
    MIN: entry('Minutes', 'Minutes played.'),
    PTS: entry('Points', 'Total points scored.'),
    FG: entry('Field Goals', 'Field goals made-attempted, counting every shot except free throws.'),
    '3PT': entry('Three-Pointers', 'Three-point shots made-attempted.'),
    FT: entry('Free Throws', 'Free throws made-attempted.'),
    REB: entry('Rebounds', 'Total rebounds, offensive plus defensive.'),
    AST: entry('Assists', 'Passes that led directly to a made basket.'),
    TO: entry('Turnovers', 'Possessions lost to the opponent without a shot attempt.'),
    STL: entry('Steals', 'Opponent possessions taken away on defense.'),
    BLK: entry('Blocks', 'Opponent shot attempts deflected.'),
    OREB: entry('Offensive Rebounds', 'Rebounds of the player’s own team’s missed shots.'),
    DREB: entry('Defensive Rebounds', 'Rebounds of the opponent’s missed shots.'),
    PF: entry('Personal Fouls', 'Fouls committed.'),
    '+/-': entry('Plus/Minus', 'Team’s net points while the player was on the court.'),
  },
  baseball: {
    H: entry('Hits', 'Balls put in play that reached base safely.'),
    R: entry('Runs', 'Runs scored.'),
    HR: entry('Home Runs', 'Hits that cleared the outfield fence in fair territory.'),
    BB: entry('Walks', 'Bases on balls: four pitches out of the strike zone.'),
    K: entry('Strikeouts', 'At bats ending in three strikes.'),
    AVG: entry('Batting Average', 'Hits divided by at bats.'),
  },
}

const FOOTBALL_RETURN = {
  YDS: entry('Return Yards', 'Yards gained on returns.'),
  AVG: entry('Yards per Return', 'Return yards divided by returns.'),
  LONG: entry('Longest Return', 'Longest single return, in yards.'),
  TD: entry('Return Touchdowns', 'Returns run back for a touchdown.'),
}

const GROUPS = {
  passing: {
    'C/ATT': entry('Completions / Attempts', 'Passes completed out of passes thrown.'),
    YDS: entry('Passing Yards', 'Yards gained on completed passes.'),
    AVG: entry('Yards per Attempt', 'Passing yards divided by pass attempts.'),
    TD: entry('Passing Touchdowns', 'Completed passes that scored a touchdown.'),
    INT: entry('Interceptions Thrown', 'Passes caught by the defense.'),
    SACKS: entry('Times Sacked', 'Times tackled behind the line of scrimmage while attempting to pass.'),
    QBR: entry('Adjusted QBR', 'ESPN’s 0–100 quarterback rating, adjusted for situation and opponent.'),
    RTG: entry('Passer Rating', 'NFL passer rating (0–158.3) from completions, yards, touchdowns and interceptions per attempt.'),
  },
  rushing: {
    CAR: entry('Carries', 'Rushing attempts.'),
    YDS: entry('Rushing Yards', 'Yards gained on carries.'),
    AVG: entry('Yards per Carry', 'Rushing yards divided by carries.'),
    TD: entry('Rushing Touchdowns', 'Carries that scored a touchdown.'),
    LONG: entry('Longest Rush', 'Longest single carry, in yards.'),
  },
  receiving: {
    REC: entry('Receptions', 'Passes caught.'),
    YDS: entry('Receiving Yards', 'Yards gained on catches.'),
    AVG: entry('Yards per Reception', 'Receiving yards divided by receptions.'),
    TD: entry('Receiving Touchdowns', 'Catches that scored a touchdown.'),
    LONG: entry('Longest Reception', 'Longest single catch, in yards.'),
    TGTS: entry('Targets', 'Passes thrown to the player, caught or not.'),
  },
  fumbles: {
    FUM: entry('Fumbles', 'Times the player lost control of the ball.'),
    LOST: entry('Fumbles Lost', 'Fumbles recovered by the opposing team.'),
    REC: entry('Fumbles Recovered', 'Loose balls recovered, whether fumbled by a teammate or an opponent.'),
  },
  defensive: {
    TOT: entry('Total Tackles', 'Solo tackles plus assisted tackles.'),
    SOLO: entry('Solo Tackles', 'Tackles made without assistance.'),
    TFL: entry('Tackles for Loss', 'Tackles made behind the line of scrimmage.'),
    PD: entry('Passes Defended', 'Passes broken up or deflected.'),
    'QB HUR': entry('Quarterback Hurries', 'Times the quarterback was pressured into throwing early.'),
    'QB HTS': entry('Quarterback Hits', 'Times the quarterback was knocked down after releasing the ball.'),
    TD: entry('Defensive Touchdowns', 'Touchdowns scored on turnovers.'),
  },
  interceptions: {
    INT: entry('Interceptions', 'Opponent passes caught by the defender.'),
    YDS: entry('Interception Return Yards', 'Yards gained returning interceptions.'),
    TD: entry('Interception Return Touchdowns', 'Interceptions returned for a touchdown.'),
  },
  kickreturns: {
    ...FOOTBALL_RETURN,
    NO: entry('Kick Returns', 'Kickoffs returned.'),
  },
  puntreturns: {
    ...FOOTBALL_RETURN,
    NO: entry('Punt Returns', 'Punts returned.'),
  },
  kicking: {
    FG: entry('Field Goals', 'Field goals made / attempted.'),
    PCT: entry('Field Goal Percentage', 'Field goals made divided by attempts.'),
    LONG: entry('Longest Field Goal', 'Longest field goal made, in yards.'),
    XP: entry('Extra Points', 'Extra points made / attempted.'),
    PTS: entry('Kicking Points', 'Points from field goals (3 each) and extra points (1 each).'),
  },
  punting: {
    NO: entry('Punts', 'Punts kicked.'),
    YDS: entry('Punt Yards', 'Total distance punted.'),
    AVG: entry('Yards per Punt', 'Punt yards divided by punts.'),
    TB: entry('Touchbacks', 'Punts into the end zone; the receiving team starts at its 20-yard line.'),
    'IN 20': entry('Inside the 20', 'Punts downed inside the opponent’s 20-yard line.'),
    LONG: entry('Longest Punt', 'Longest single punt, in yards.'),
  },
  batting: {
    'H-AB': entry('Hits - At Bats', 'Hits and at bats in this game.'),
    AB: entry('At Bats', 'Plate appearances, not counting walks, hit by pitches, sacrifices and interference.'),
    R: entry('Runs', 'Runs scored.'),
    H: entry('Hits', 'Balls put in play that reached base safely.'),
    RBI: entry('Runs Batted In', 'Runs that scored as a result of the batter’s plate appearance.'),
    HR: entry('Home Runs', 'Hits that cleared the outfield fence in fair territory.'),
    BB: entry('Walks', 'Bases on balls: four pitches out of the strike zone.'),
    K: entry('Strikeouts', 'At bats ending in three strikes.'),
    '#P': entry('Pitches Seen', 'Total pitches faced.'),
    AVG: entry('Batting Average', 'Hits divided by at bats.'),
    OBP: entry('On-Base Percentage', 'How often the batter reaches base per plate appearance.'),
    SLG: entry('Slugging Percentage', 'Total bases divided by at bats.'),
  },
  pitching: {
    IP: entry('Innings Pitched', 'Innings pitched; a decimal .1 or .2 counts outs in a partial inning.'),
    H: entry('Hits Allowed', 'Hits given up.'),
    R: entry('Runs Allowed', 'Runs given up, earned or not.'),
    ER: entry('Earned Runs', 'Runs allowed that did not result from errors or passed balls.'),
    BB: entry('Walks Allowed', 'Batters walked.'),
    K: entry('Strikeouts', 'Batters struck out.'),
    HR: entry('Home Runs Allowed', 'Home runs given up.'),
    'PC-ST': entry('Pitches - Strikes', 'Pitches thrown and how many were strikes.'),
    ERA: entry('Earned Run Average', 'Earned runs allowed per nine innings.'),
    PC: entry('Pitch Count', 'Total pitches thrown.'),
  },
}

export const STAT_GLOSSARY = Object.freeze({
  common: Object.freeze(COMMON),
  sports: Object.freeze(SPORTS),
  groups: Object.freeze(GROUPS),
})

const key = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '')
// Own-property lookups only: group and label names come from upstream data
const own = (table, k) => (table && Object.hasOwn(table, k) ? table[k] : undefined)

// Lookup order: group-specific → sport-specific → common → upstream name.
// Returns { name, description } or null when nothing explains the label.
export function describeStat({ sport, group, label, fallbackName } = {}) {
  const labelKey = key(label)
  if (!labelKey) return null
  const found =
    own(own(GROUPS, key(group).toLowerCase()), labelKey) ??
    own(own(SPORTS, key(sport).toLowerCase()), labelKey) ??
    own(COMMON, labelKey)
  if (found) return found
  if (typeof fallbackName === 'string' && fallbackName.trim()) {
    return Object.freeze({ name: fallbackName.trim(), description: null })
  }
  return null
}
