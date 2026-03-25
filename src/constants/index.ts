/**
 * Application-wide constants
 * Centralized location for magic numbers and configuration values
 */

export { DEFAULT_ROSTER_SETTINGS, DEFAULT_SCORING_RULES } from './scoring';
export { HOCKEY_DAY_CUTOFF_HOUR, NEW_YORK_TIME_ZONE } from './time';

// ============================================
// TIMING CONSTANTS
// ============================================

/** Live stats refresh interval in seconds (5 minutes) */
export const LIVE_STATS_REFRESH_SECONDS = 300;

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
