/**
 * Application-wide constants
 * Centralized location for magic numbers and configuration values
 */

// ============================================
// TIMING CONSTANTS
// ============================================

/** Live stats refresh interval in seconds (5 minutes) */
export const LIVE_STATS_REFRESH_SECONDS = 300;

/** Hockey day cutoff hour in ET (3 AM) - games before this show previous day */
export const HOCKEY_DAY_CUTOFF_HOUR = 3;

/** Injury data cache time in milliseconds (5 minutes) */
export const INJURY_CACHE_MS = 5 * 60 * 1000;

// ============================================
// ROSTER LIMITS
// ============================================

/** Maximum forwards on active roster */
export const MAX_FORWARDS = 9;

/** Maximum defensemen on active roster */
export const MAX_DEFENSE = 6;

/** Maximum goalies on active roster */
export const MAX_GOALIES = 2;

/** Maximum reserve players */
export const MAX_RESERVES = 5;

/** Total active roster size */
export const ACTIVE_ROSTER_SIZE = MAX_FORWARDS + MAX_DEFENSE + MAX_GOALIES; // 17

/** Total roster size including reserves */
export const TOTAL_ROSTER_SIZE = ACTIVE_ROSTER_SIZE + MAX_RESERVES; // 22

// ============================================
// SCORING DEFAULTS
// ============================================

/** Default scoring rules for fantasy points */
export const DEFAULT_SCORING_RULES = {
  // Skater scoring
  goal: 1,
  assist: 1,
  shortHandedGoal: 1, // Bonus on top of goal
  overtimeGoal: 1,    // Bonus on top of goal
  fight: 2,
  
  // Defense bonuses
  blockedShot: 0.15,
  hit: 0.1,
  
  // Goalie scoring
  win: 1,
  shutout: 2,
  save: 0.04,
  goalieAssist: 1,
  goalieGoal: 20,
  goalieFight: 5,
};

// ============================================
// NHL API CONSTANTS
// ============================================

/** NHL headshot URL pattern */
export const NHL_HEADSHOT_URL = (team: string, playerId: number) =>
  `https://assets.nhle.com/mugs/nhl/20242025/${team}/${playerId}.png`;

/** NHL team logo URL pattern */
export const NHL_TEAM_LOGO_URL = (team: string) =>
  `https://assets.nhle.com/logos/nhl/svg/${team}_dark.svg`;

/** Default skater headshot fallback */
export const DEFAULT_SKATER_HEADSHOT = 'https://assets.nhle.com/mugs/nhl/default-skater.png';

// ============================================
// UI CONSTANTS
// ============================================

/** Maximum items to show in league feed */
export const MAX_FEED_ITEMS = 5;

/** Maximum days to show in trend chart */
export const MAX_TREND_DAYS = 7;

/** Position scarcity thresholds */
export const SCARCITY_THRESHOLDS = {
  critical: 10,  // Red - very few left
  warning: 20,   // Amber - getting scarce
  healthy: 20,   // Green - plenty available
};
