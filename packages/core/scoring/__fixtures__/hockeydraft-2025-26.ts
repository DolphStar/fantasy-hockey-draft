/**
 * Golden fixture: the "Esports Hockey" pool on hockeydraft.ca, 2025-26 season (final).
 *
 * Captured 2026-07-24 from three pages of the completed pool:
 *   - /draft/draft_recap.aspx       -> HOCKEYDRAFT_DRAFT_RECAP   (every pick, FULL-SEASON line + points)
 *   - /draft/view_draft.aspx        -> HOCKEYDRAFT_FINAL_ROSTERS (17 active / 5 reserve) + standings
 *   - /draft/transactions_view.aspx -> HOCKEYDRAFT_TRANSACTIONS
 *
 * WHY THERE ARE TWO POINT COLUMNS, AND WHICH ONE IS THE ORACLE
 * -----------------------------------------------------------
 * hockeydraft.ca publishes two different "Points" values for the same player:
 *
 *   HOCKEYDRAFT_DRAFT_RECAP[].publishedPoints
 *     The player's FULL-SEASON stat line scored by the pool's rules, ignoring
 *     roster history. A pure function of the stat line, so it is a valid oracle
 *     for a scoring engine. THIS IS THE ONE THE PARITY TESTS ASSERT AGAINST.
 *
 *   HOCKEYDRAFT_FINAL_ROSTERS[].publishedPoints
 *     Points the player actually banked FOR THAT TEAM -- only on days they sat on
 *     that team's ACTIVE roster. Depends on the whole transaction history plus
 *     day-by-day stat splits that the site does not expose, so it is NOT
 *     reproducible from season totals. The one exception is 'Tay', who made zero
 *     in-season moves, so their roster held from day one (see CONTROL_TEAM).
 *
 * The stat columns on BOTH pages are full-season NHL totals.
 *
 * SCORING RULES IN FORCE (identical to packages/core/scoring/defaults.ts)
 * ----------------------------------------------------------------------
 *   All skaters : goal 1, assist 1, SH goal +1, OT goal +1, fight 2
 *   Defense only: blocked shot 0.15, hit 0.1
 *   Goalies     : win 1, shutout 2, save 0.04, assist 1, goal 20, fight 5
 *
 * NOTES / CAVEATS
 * ---------------
 * - `hdPlayerId` is hockeydraft.ca's internal player id, NOT the NHL API id
 *   (McDavid is 16362 here, 8478402 in the NHL API). It is used only as a stable
 *   unique key within these tests.
 * - hockeydraft.ca badges only D and G; every unbadged skater is recorded as 'F'.
 *   `toPlayerGameStats` maps 'F' -> 'C' because the engine special-cases exactly
 *   the strings 'D' and 'G' and treats every other position identically.
 * - `publishedPoints` is displayed to 1 decimal with round-half-to-EVEN (the .NET
 *   `Math.Round` default) -- 73.25 prints as 73.2, 79.15 prints as 79.2. Use
 *   `toPublishedPrecision` to compare against it.
 * - A few players appear in HOCKEYDRAFT_DRAFT_RECAP twice, having been re-acquired
 *   in a later round (e.g. Jacob Trouba, rounds 34 and 47). Both rows carry the
 *   same full-season line, so both are valid independent assertions.
 * - Round 54 has no pick on the source page. The gap is real, not a capture error.
 * - The transaction log prints no year, and the bulk "April 17 - Activated" rows are
 *   an end-of-season snapshot every team receives rather than real moves; they are
 *   flagged `endOfSeasonSnapshot`.
 */

import type { PlayerGameStats } from '../../nhl/types.js';

/** hockeydraft.ca only distinguishes forwards, defense and goalies. */
export type HockeyDraftPosition = 'F' | 'D' | 'G';

export interface HockeyDraftStatLine {
  name: string;
  /** hockeydraft.ca internal id -- NOT an NHL API player id. */
  hdPlayerId: number;
  nhlTeam: string;
  position: HockeyDraftPosition;
  goals: number;
  assists: number;
  shortHandedGoals: number;
  overtimeGoals: number;
  fights: number;
  blockedShots: number;
  hits: number;
  wins: number;
  shutouts: number;
  saves: number;
  /** Points as printed by hockeydraft.ca: 1 dp, round-half-to-even. */
  publishedPoints: number;
}

export interface HockeyDraftRecapPick extends HockeyDraftStatLine {
  round: number;
  team: string;
}

export interface HockeyDraftRosterEntry extends HockeyDraftStatLine {
  team: string;
  slot: 'active' | 'reserve';
  /** Round in which this team acquired the player. */
  draftPick: number;
}

export interface HockeyDraftTransaction {
  team: string;
  /** Month and day exactly as printed; the source page shows no year. */
  date: string;
  action: 'activated' | 'dropped' | 'claimed';
  player: string;
  /** The "(X -> Y)" free-agent swap this row belongs to, verbatim, when present. */
  swap: string | null;
  /** True for the bulk "April 17 - Activated" end-of-season snapshot rows. */
  endOfSeasonSnapshot: boolean;
}

/** Final standings as published, to 2 decimals. */
export const HOCKEYDRAFT_STANDINGS: { team: string; points: number }[] = [
  { team: 'Patrick', points: 1445.14 },
  { team: 'Nick', points: 1437.22 },
  { team: 'Kieran', points: 1430.47 },
  { team: 'Colin', points: 1411.08 },
  { team: 'Tay', points: 1053.87 },
];

/**
 * The team that made zero in-season transactions. Their final active roster held
 * all season, which makes their season total reproducible from season stat lines
 * alone -- the only end-to-end check available against the real standings.
 */
export const CONTROL_TEAM = 'Tay';

/** Roster shape the pool ran: 9 F / 6 D / 2 G active, plus 5 reserves of any position. */
export const ROSTER_SHAPE = { forwards: 9, defense: 6, goalies: 2, reserves: 5 } as const;

/** Active roster size: 9 F + 6 D + 2 G. */
export const ACTIVE_ROSTER_SIZE =
  ROSTER_SHAPE.forwards + ROSTER_SHAPE.defense + ROSTER_SHAPE.goalies;

/**
 * Every pick in the draft with its FULL-SEASON stat line and hockeydraft.ca's own
 * points for that line. This is the scoring-engine oracle.
 */
export const HOCKEYDRAFT_DRAFT_RECAP: HockeyDraftRecapPick[] = [
  { round: 1, team: 'Nick', name: 'Connor McDavid', hdPlayerId: 16362, nhlTeam: 'Edm', position: 'F', goals: 48, assists: 90, shortHandedGoals: 1, overtimeGoals: 1, fights: 0, blockedShots: 30, hits: 40, wins: 0, shutouts: 0, saves: 0, publishedPoints: 140 },
  { round: 1, team: 'Kieran', name: 'Leon Draisaitl', hdPlayerId: 16038, nhlTeam: 'Edm', position: 'F', goals: 35, assists: 62, shortHandedGoals: 1, overtimeGoals: 1, fights: 0, blockedShots: 15, hits: 34, wins: 0, shutouts: 0, saves: 0, publishedPoints: 99 },
  { round: 1, team: 'Patrick', name: 'Nikita Kucherov', hdPlayerId: 9030, nhlTeam: 'TB', position: 'F', goals: 44, assists: 86, shortHandedGoals: 1, overtimeGoals: 2, fights: 0, blockedShots: 31, hits: 36, wins: 0, shutouts: 0, saves: 0, publishedPoints: 133 },
  { round: 1, team: 'Colin', name: 'Auston Matthews', hdPlayerId: 16719, nhlTeam: 'Tor', position: 'F', goals: 28, assists: 26, shortHandedGoals: 0, overtimeGoals: 2, fights: 0, blockedShots: 81, hits: 42, wins: 0, shutouts: 0, saves: 0, publishedPoints: 56 },
  { round: 1, team: 'Tay', name: 'Nathan MacKinnon', hdPlayerId: 15002, nhlTeam: 'Col', position: 'F', goals: 53, assists: 74, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 35, hits: 64, wins: 0, shutouts: 0, saves: 0, publishedPoints: 128 },
  { round: 2, team: 'Nick', name: 'Mikko Rantanen', hdPlayerId: 16371, nhlTeam: 'Dal', position: 'F', goals: 22, assists: 55, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 30, hits: 48, wins: 0, shutouts: 0, saves: 0, publishedPoints: 79 },
  { round: 2, team: 'Kieran', name: 'Quinn Hughes', hdPlayerId: 27330, nhlTeam: 'Min', position: 'D', goals: 7, assists: 69, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 87, hits: 7, wins: 0, shutouts: 0, saves: 0, publishedPoints: 89.8 },
  { round: 2, team: 'Patrick', name: 'Kirill Kaprizov', hdPlayerId: 16496, nhlTeam: 'Min', position: 'F', goals: 45, assists: 44, shortHandedGoals: 0, overtimeGoals: 4, fights: 0, blockedShots: 27, hits: 52, wins: 0, shutouts: 0, saves: 0, publishedPoints: 93 },
  { round: 2, team: 'Colin', name: 'Zach Werenski', hdPlayerId: 16369, nhlTeam: 'Cls', position: 'D', goals: 22, assists: 59, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 94, hits: 30, wins: 0, shutouts: 0, saves: 0, publishedPoints: 98.1 },
  { round: 2, team: 'Tay', name: 'Cale Makar', hdPlayerId: 26946, nhlTeam: 'Col', position: 'D', goals: 20, assists: 59, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 116, hits: 35, wins: 0, shutouts: 0, saves: 0, publishedPoints: 99.9 },
  { round: 3, team: 'Nick', name: 'Jack Eichel', hdPlayerId: 16363, nhlTeam: 'Veg', position: 'F', goals: 27, assists: 63, shortHandedGoals: 1, overtimeGoals: 3, fights: 0, blockedShots: 40, hits: 35, wins: 0, shutouts: 0, saves: 0, publishedPoints: 94 },
  { round: 3, team: 'Kieran', name: 'Jack Hughes', hdPlayerId: 27706, nhlTeam: 'NJ', position: 'F', goals: 27, assists: 50, shortHandedGoals: 1, overtimeGoals: 1, fights: 0, blockedShots: 32, hits: 4, wins: 0, shutouts: 0, saves: 0, publishedPoints: 79 },
  { round: 3, team: 'Patrick', name: 'David Pastrnak', hdPlayerId: 16060, nhlTeam: 'Bos', position: 'F', goals: 29, assists: 71, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 32, hits: 86, wins: 0, shutouts: 0, saves: 0, publishedPoints: 101 },
  { round: 3, team: 'Colin', name: 'Brady Tkachuk', hdPlayerId: 27327, nhlTeam: 'Ott', position: 'F', goals: 22, assists: 37, shortHandedGoals: 1, overtimeGoals: 1, fights: 3, blockedShots: 19, hits: 162, wins: 0, shutouts: 0, saves: 0, publishedPoints: 67 },
  { round: 3, team: 'Tay', name: 'Devon Toews', hdPlayerId: 16139, nhlTeam: 'Col', position: 'D', goals: 3, assists: 21, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 83, hits: 26, wins: 0, shutouts: 0, saves: 0, publishedPoints: 39 },
  { round: 4, team: 'Nick', name: 'Kyle Connor', hdPlayerId: 16378, nhlTeam: 'Wpg', position: 'F', goals: 39, assists: 53, shortHandedGoals: 2, overtimeGoals: 2, fights: 0, blockedShots: 19, hits: 36, wins: 0, shutouts: 0, saves: 0, publishedPoints: 96 },
  { round: 4, team: 'Kieran', name: 'Mitch Marner', hdPlayerId: 16365, nhlTeam: 'Veg', position: 'F', goals: 24, assists: 56, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 46, hits: 24, wins: 0, shutouts: 0, saves: 0, publishedPoints: 80 },
  { round: 4, team: 'Patrick', name: 'Rasmus Dahlin', hdPlayerId: 27324, nhlTeam: 'Buf', position: 'D', goals: 19, assists: 55, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 80, hits: 67, wins: 0, shutouts: 0, saves: 0, publishedPoints: 94.7 },
  { round: 4, team: 'Colin', name: 'Evan Bouchard', hdPlayerId: 27333, nhlTeam: 'Edm', position: 'D', goals: 21, assists: 74, shortHandedGoals: 0, overtimeGoals: 3, fights: 0, blockedShots: 101, hits: 29, wins: 0, shutouts: 0, saves: 0, publishedPoints: 116 },
  { round: 4, team: 'Tay', name: 'Valeri Nichushkin', hdPlayerId: 15650, nhlTeam: 'Col', position: 'F', goals: 17, assists: 32, shortHandedGoals: 1, overtimeGoals: 0, fights: 0, blockedShots: 27, hits: 55, wins: 0, shutouts: 0, saves: 0, publishedPoints: 50 },
  { round: 5, team: 'Nick', name: 'William Nylander', hdPlayerId: 16043, nhlTeam: 'Tor', position: 'F', goals: 30, assists: 49, shortHandedGoals: 0, overtimeGoals: 3, fights: 0, blockedShots: 26, hits: 14, wins: 0, shutouts: 0, saves: 0, publishedPoints: 82 },
  { round: 5, team: 'Kieran', name: 'Moritz Seider', hdPlayerId: 27711, nhlTeam: 'Det', position: 'D', goals: 10, assists: 50, shortHandedGoals: 0, overtimeGoals: 1, fights: 1, blockedShots: 180, hits: 128, wins: 0, shutouts: 0, saves: 0, publishedPoints: 102.8 },
  { round: 5, team: 'Patrick', name: 'Brayden Point', hdPlayerId: 16112, nhlTeam: 'TB', position: 'F', goals: 18, assists: 32, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 23, hits: 8, wins: 0, shutouts: 0, saves: 0, publishedPoints: 50 },
  { round: 5, team: 'Colin', name: 'Macklin Celebrini', hdPlayerId: 29485, nhlTeam: 'SJ', position: 'F', goals: 45, assists: 70, shortHandedGoals: 0, overtimeGoals: 2, fights: 0, blockedShots: 53, hits: 53, wins: 0, shutouts: 0, saves: 0, publishedPoints: 117 },
  { round: 5, team: 'Tay', name: 'Gabriel Landeskog', hdPlayerId: 5363, nhlTeam: 'Col', position: 'F', goals: 14, assists: 21, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 32, hits: 86, wins: 0, shutouts: 0, saves: 0, publishedPoints: 37 },
  { round: 6, team: 'Nick', name: 'Victor Hedman', hdPlayerId: 4682, nhlTeam: 'TB', position: 'D', goals: 1, assists: 16, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 44, hits: 19, wins: 0, shutouts: 0, saves: 0, publishedPoints: 25.5 },
  { round: 6, team: 'Kieran', name: 'Igor Shesterkin', hdPlayerId: 16148, nhlTeam: 'NYR', position: 'G', goals: 0, assists: 0, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 0, hits: 0, wins: 25, shutouts: 1, saves: 1299, publishedPoints: 84 },
  { round: 6, team: 'Patrick', name: 'Connor Hellebuyck', hdPlayerId: 14904, nhlTeam: 'Wpg', position: 'G', goals: 0, assists: 0, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 23, shutouts: 0, saves: 1382, publishedPoints: 78.3 },
  { round: 6, team: 'Colin', name: 'Roman Josi', hdPlayerId: 14279, nhlTeam: 'Nsh', position: 'D', goals: 13, assists: 42, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 101, hits: 24, wins: 0, shutouts: 0, saves: 0, publishedPoints: 73.6 },
  { round: 6, team: 'Tay', name: 'Josh Manson', hdPlayerId: 14528, nhlTeam: 'Col', position: 'D', goals: 5, assists: 26, shortHandedGoals: 0, overtimeGoals: 0, fights: 5, blockedShots: 99, hits: 174, wins: 0, shutouts: 0, saves: 0, publishedPoints: 73.2 },
  { round: 7, team: 'Nick', name: 'Andrei Vasilevskiy', hdPlayerId: 14793, nhlTeam: 'TB', position: 'G', goals: 0, assists: 2, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 0, hits: 0, wins: 39, shutouts: 2, saves: 1349, publishedPoints: 104 },
  { round: 7, team: 'Kieran', name: 'Tim Stutzle', hdPlayerId: 28093, nhlTeam: 'Ott', position: 'F', goals: 34, assists: 49, shortHandedGoals: 2, overtimeGoals: 2, fights: 1, blockedShots: 44, hits: 126, wins: 0, shutouts: 0, saves: 0, publishedPoints: 89 },
  { round: 7, team: 'Patrick', name: 'Sam Reinhart', hdPlayerId: 16037, nhlTeam: 'Fla', position: 'F', goals: 29, assists: 32, shortHandedGoals: 3, overtimeGoals: 1, fights: 0, blockedShots: 40, hits: 59, wins: 0, shutouts: 0, saves: 0, publishedPoints: 65 },
  { round: 7, team: 'Colin', name: 'Artemi Panarin', hdPlayerId: 16348, nhlTeam: 'LA', position: 'F', goals: 28, assists: 56, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 16, hits: 11, wins: 0, shutouts: 0, saves: 0, publishedPoints: 84 },
  { round: 7, team: 'Tay', name: 'Artturi Lehkonen', hdPlayerId: 15686, nhlTeam: 'Col', position: 'F', goals: 21, assists: 27, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 33, hits: 45, wins: 0, shutouts: 0, saves: 0, publishedPoints: 48 },
  { round: 8, team: 'Nick', name: 'Adam Fox', hdPlayerId: 16784, nhlTeam: 'NYR', position: 'D', goals: 9, assists: 44, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 74, hits: 24, wins: 0, shutouts: 0, saves: 0, publishedPoints: 66.5 },
  { round: 8, team: 'Kieran', name: 'Aleksander Barkov', hdPlayerId: 15644, nhlTeam: 'Fla', position: 'F', goals: 0, assists: 0, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 0, shutouts: 0, saves: 0, publishedPoints: 0 },
  { round: 8, team: 'Patrick', name: 'MacKenzie Weegar', hdPlayerId: 15402, nhlTeam: 'Utah', position: 'D', goals: 4, assists: 24, shortHandedGoals: 0, overtimeGoals: 0, fights: 2, blockedShots: 175, hits: 168, wins: 0, shutouts: 0, saves: 0, publishedPoints: 75 },
  { round: 8, team: 'Colin', name: 'Clayton Keller', hdPlayerId: 16725, nhlTeam: 'Utah', position: 'F', goals: 26, assists: 62, shortHandedGoals: 0, overtimeGoals: 4, fights: 0, blockedShots: 32, hits: 8, wins: 0, shutouts: 0, saves: 0, publishedPoints: 92 },
  { round: 8, team: 'Tay', name: 'Martin Necas', hdPlayerId: 26954, nhlTeam: 'Col', position: 'F', goals: 38, assists: 62, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 26, hits: 85, wins: 0, shutouts: 0, saves: 0, publishedPoints: 100 },
  { round: 9, team: 'Nick', name: 'Jake Oettinger', hdPlayerId: 26968, nhlTeam: 'Dal', position: 'G', goals: 0, assists: 1, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 35, shutouts: 4, saves: 1234, publishedPoints: 93.4 },
  { round: 9, team: 'Kieran', name: 'Josh Morrissey', hdPlayerId: 15652, nhlTeam: 'Wpg', position: 'D', goals: 14, assists: 41, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 118, hits: 36, wins: 0, shutouts: 0, saves: 0, publishedPoints: 77.3 },
  { round: 9, team: 'Patrick', name: 'Sidney Crosby', hdPlayerId: 3737, nhlTeam: 'Pit', position: 'F', goals: 29, assists: 45, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 30, hits: 60, wins: 0, shutouts: 0, saves: 0, publishedPoints: 75 },
  { round: 9, team: 'Colin', name: 'Matt Boldy', hdPlayerId: 27717, nhlTeam: 'Min', position: 'F', goals: 42, assists: 43, shortHandedGoals: 4, overtimeGoals: 1, fights: 0, blockedShots: 58, hits: 61, wins: 0, shutouts: 0, saves: 0, publishedPoints: 90 },
  { round: 9, team: 'Tay', name: 'Matt Duchene', hdPlayerId: 4683, nhlTeam: 'Dal', position: 'F', goals: 16, assists: 29, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 23, hits: 29, wins: 0, shutouts: 0, saves: 0, publishedPoints: 45 },
  { round: 10, team: 'Nick', name: 'Shea Theodore', hdPlayerId: 15662, nhlTeam: 'Veg', position: 'D', goals: 10, assists: 30, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 87, hits: 2, wins: 0, shutouts: 0, saves: 0, publishedPoints: 53.2 },
  { round: 10, team: 'Kieran', name: 'Lane Hutson', hdPlayerId: 28799, nhlTeam: 'Mon', position: 'D', goals: 12, assists: 66, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 137, hits: 31, wins: 0, shutouts: 0, saves: 0, publishedPoints: 102.6 },
  { round: 10, team: 'Patrick', name: 'Jake Sanderson', hdPlayerId: 28095, nhlTeam: 'Ott', position: 'D', goals: 14, assists: 40, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 128, hits: 29, wins: 0, shutouts: 0, saves: 0, publishedPoints: 76.1 },
  { round: 10, team: 'Colin', name: 'Jesper Bratt', hdPlayerId: 16881, nhlTeam: 'NJ', position: 'F', goals: 22, assists: 50, shortHandedGoals: 1, overtimeGoals: 1, fights: 0, blockedShots: 24, hits: 74, wins: 0, shutouts: 0, saves: 0, publishedPoints: 74 },
  { round: 10, team: 'Tay', name: 'Mackenzie Blackwood', hdPlayerId: 16403, nhlTeam: 'Col', position: 'G', goals: 0, assists: 0, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 24, shutouts: 3, saves: 841, publishedPoints: 63.6 },
  { round: 11, team: 'Nick', name: 'Charlie McAvoy', hdPlayerId: 16732, nhlTeam: 'Bos', position: 'D', goals: 11, assists: 50, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 129, hits: 79, wins: 0, shutouts: 0, saves: 0, publishedPoints: 89.2 },
  { round: 11, team: 'Kieran', name: 'Elias Pettersson', hdPlayerId: 26947, nhlTeam: 'Van', position: 'F', goals: 15, assists: 36, shortHandedGoals: 1, overtimeGoals: 0, fights: 0, blockedShots: 108, hits: 69, wins: 0, shutouts: 0, saves: 0, publishedPoints: 52 },
  { round: 11, team: 'Patrick', name: 'Filip Forsberg', hdPlayerId: 14785, nhlTeam: 'Nsh', position: 'F', goals: 40, assists: 35, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 33, hits: 124, wins: 0, shutouts: 0, saves: 0, publishedPoints: 76 },
  { round: 11, team: 'Colin', name: 'Juuse Saros', hdPlayerId: 15724, nhlTeam: 'Nsh', position: 'G', goals: 0, assists: 0, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 28, shutouts: 0, saves: 1519, publishedPoints: 88.8 },
  { round: 11, team: 'Tay', name: 'Brent Burns', hdPlayerId: 3358, nhlTeam: 'Col', position: 'D', goals: 12, assists: 23, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 91, hits: 20, wins: 0, shutouts: 0, saves: 0, publishedPoints: 50.6 },
  { round: 12, team: 'Nick', name: 'Zach Hyman', hdPlayerId: 13994, nhlTeam: 'Edm', position: 'F', goals: 31, assists: 21, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 18, hits: 55, wins: 0, shutouts: 0, saves: 0, publishedPoints: 53 },
  { round: 12, team: 'Kieran', name: 'Connor Bedard', hdPlayerId: 29102, nhlTeam: 'Chi', position: 'F', goals: 30, assists: 45, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 27, hits: 31, wins: 0, shutouts: 0, saves: 0, publishedPoints: 76 },
  { round: 12, team: 'Patrick', name: 'J.T. Miller', hdPlayerId: 14589, nhlTeam: 'NYR', position: 'F', goals: 17, assists: 36, shortHandedGoals: 0, overtimeGoals: 3, fights: 1, blockedShots: 34, hits: 123, wins: 0, shutouts: 0, saves: 0, publishedPoints: 58 },
  { round: 12, team: 'Colin', name: 'Jason Robertson', hdPlayerId: 26981, nhlTeam: 'Dal', position: 'F', goals: 45, assists: 51, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 34, hits: 48, wins: 0, shutouts: 0, saves: 0, publishedPoints: 97 },
  { round: 12, team: 'Tay', name: 'Victor Olofsson', hdPlayerId: 27557, nhlTeam: 'Cgy', position: 'F', goals: 13, assists: 18, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 21, hits: 18, wins: 0, shutouts: 0, saves: 0, publishedPoints: 31 },
  { round: 13, team: 'Nick', name: 'Darnell Nurse', hdPlayerId: 15647, nhlTeam: 'Edm', position: 'D', goals: 7, assists: 17, shortHandedGoals: 0, overtimeGoals: 0, fights: 4, blockedShots: 166, hits: 137, wins: 0, shutouts: 0, saves: 0, publishedPoints: 70.6 },
  { round: 13, team: 'Kieran', name: 'Thomas Harley', hdPlayerId: 27723, nhlTeam: 'Dal', position: 'D', goals: 6, assists: 30, shortHandedGoals: 0, overtimeGoals: 2, fights: 0, blockedShots: 148, hits: 39, wins: 0, shutouts: 0, saves: 0, publishedPoints: 64.1 },
  { round: 13, team: 'Patrick', name: 'Mikhail Sergachev', hdPlayerId: 16727, nhlTeam: 'Utah', position: 'D', goals: 10, assists: 49, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 125, hits: 38, wins: 0, shutouts: 0, saves: 0, publishedPoints: 81.6 },
  { round: 13, team: 'Colin', name: 'Brandon Hagel', hdPlayerId: 16878, nhlTeam: 'TB', position: 'F', goals: 36, assists: 38, shortHandedGoals: 1, overtimeGoals: 0, fights: 2, blockedShots: 38, hits: 42, wins: 0, shutouts: 0, saves: 0, publishedPoints: 79 },
  { round: 13, team: 'Tay', name: 'Brock Nelson', hdPlayerId: 4990, nhlTeam: 'Col', position: 'F', goals: 33, assists: 32, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 65, hits: 38, wins: 0, shutouts: 0, saves: 0, publishedPoints: 66 },
  { round: 14, team: 'Nick', name: 'Nick Suzuki', hdPlayerId: 26955, nhlTeam: 'Mon', position: 'F', goals: 29, assists: 72, shortHandedGoals: 1, overtimeGoals: 1, fights: 0, blockedShots: 62, hits: 62, wins: 0, shutouts: 0, saves: 0, publishedPoints: 103 },
  { round: 14, team: 'Kieran', name: 'Noah Dobson', hdPlayerId: 27335, nhlTeam: 'Mon', position: 'D', goals: 12, assists: 35, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 188, hits: 62, wins: 0, shutouts: 0, saves: 0, publishedPoints: 81.4 },
  { round: 14, team: 'Patrick', name: 'Jake Guentzel', hdPlayerId: 15707, nhlTeam: 'TB', position: 'F', goals: 38, assists: 50, shortHandedGoals: 2, overtimeGoals: 2, fights: 1, blockedShots: 41, hits: 39, wins: 0, shutouts: 0, saves: 0, publishedPoints: 94 },
  { round: 14, team: 'Colin', name: 'Morgan Rielly', hdPlayerId: 14779, nhlTeam: 'Tor', position: 'D', goals: 11, assists: 25, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 113, hits: 35, wins: 0, shutouts: 0, saves: 0, publishedPoints: 58.4 },
  { round: 14, team: 'Tay', name: 'Jack Drury', hdPlayerId: 28337, nhlTeam: 'Col', position: 'F', goals: 10, assists: 17, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 56, hits: 46, wins: 0, shutouts: 0, saves: 0, publishedPoints: 29 },
  { round: 15, team: 'Nick', name: 'Dougie Hamilton', hdPlayerId: 9020, nhlTeam: 'NJ', position: 'D', goals: 12, assists: 27, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 78, hits: 87, wins: 0, shutouts: 0, saves: 0, publishedPoints: 59.4 },
  { round: 15, team: 'Kieran', name: 'Tage Thompson', hdPlayerId: 16744, nhlTeam: 'Buf', position: 'F', goals: 40, assists: 41, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 48, hits: 86, wins: 0, shutouts: 0, saves: 0, publishedPoints: 83 },
  { round: 15, team: 'Patrick', name: 'Seth Jones', hdPlayerId: 15628, nhlTeam: 'Fla', position: 'D', goals: 7, assists: 25, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 61, hits: 47, wins: 0, shutouts: 0, saves: 0, publishedPoints: 45.8 },
  { round: 15, team: 'Colin', name: 'Lucas Raymond', hdPlayerId: 28094, nhlTeam: 'Det', position: 'F', goals: 25, assists: 51, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 29, hits: 43, wins: 0, shutouts: 0, saves: 0, publishedPoints: 76 },
  { round: 15, team: 'Tay', name: 'Ross Colton', hdPlayerId: 16836, nhlTeam: 'Col', position: 'F', goals: 9, assists: 15, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 25, hits: 159, wins: 0, shutouts: 0, saves: 0, publishedPoints: 26 },
  { round: 16, team: 'Nick', name: 'Travis Konecny', hdPlayerId: 16385, nhlTeam: 'Phi', position: 'F', goals: 27, assists: 41, shortHandedGoals: 1, overtimeGoals: 0, fights: 1, blockedShots: 39, hits: 108, wins: 0, shutouts: 0, saves: 0, publishedPoints: 71 },
  { round: 16, team: 'Kieran', name: 'Adin Hill', hdPlayerId: 16437, nhlTeam: 'Veg', position: 'G', goals: 0, assists: 1, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 10, shutouts: 1, saves: 511, publishedPoints: 33.4 },
  { round: 16, team: 'Patrick', name: 'Sergei Bobrovsky', hdPlayerId: 4901, nhlTeam: 'Fla', position: 'G', goals: 0, assists: 2, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 0, hits: 0, wins: 27, shutouts: 4, saves: 1097, publishedPoints: 85.9 },
  { round: 16, team: 'Colin', name: 'Robert Thomas', hdPlayerId: 26962, nhlTeam: 'StL', position: 'F', goals: 25, assists: 38, shortHandedGoals: 2, overtimeGoals: 2, fights: 0, blockedShots: 40, hits: 10, wins: 0, shutouts: 0, saves: 0, publishedPoints: 67 },
  { round: 16, team: 'Tay', name: 'Parker Kelly', hdPlayerId: 27207, nhlTeam: 'Col', position: 'F', goals: 21, assists: 14, shortHandedGoals: 1, overtimeGoals: 0, fights: 0, blockedShots: 58, hits: 177, wins: 0, shutouts: 0, saves: 0, publishedPoints: 36 },
  { round: 17, team: 'Nick', name: 'Mark Scheifele', hdPlayerId: 9025, nhlTeam: 'Wpg', position: 'F', goals: 36, assists: 67, shortHandedGoals: 0, overtimeGoals: 1, fights: 1, blockedShots: 47, hits: 32, wins: 0, shutouts: 0, saves: 0, publishedPoints: 106 },
  { round: 17, team: 'Kieran', name: 'Samuel Montembeault', hdPlayerId: 16438, nhlTeam: 'Mon', position: 'G', goals: 0, assists: 0, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 10, shutouts: 0, saves: 554, publishedPoints: 32.2 },
  { round: 17, team: 'Patrick', name: 'Jakob Chychrun', hdPlayerId: 16734, nhlTeam: 'Was', position: 'D', goals: 26, assists: 34, shortHandedGoals: 0, overtimeGoals: 2, fights: 2, blockedShots: 114, hits: 58, wins: 0, shutouts: 0, saves: 0, publishedPoints: 88.9 },
  { round: 17, team: 'Colin', name: 'Rasmus Andersson', hdPlayerId: 16414, nhlTeam: 'Veg', position: 'D', goals: 17, assists: 31, shortHandedGoals: 1, overtimeGoals: 0, fights: 1, blockedShots: 148, hits: 37, wins: 0, shutouts: 0, saves: 0, publishedPoints: 76.9 },
  { round: 17, team: 'Tay', name: 'Scott Wedgewood', hdPlayerId: 13955, nhlTeam: 'Col', position: 'G', goals: 0, assists: 1, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 31, shutouts: 4, saves: 1007, publishedPoints: 80.3 },
  { round: 18, team: 'Nick', name: 'Matthew Tkachuk', hdPlayerId: 16724, nhlTeam: 'Fla', position: 'F', goals: 13, assists: 21, shortHandedGoals: 0, overtimeGoals: 0, fights: 2, blockedShots: 7, hits: 29, wins: 0, shutouts: 0, saves: 0, publishedPoints: 38 },
  { round: 18, team: 'Kieran', name: 'Logan Cooley', hdPlayerId: 28741, nhlTeam: 'Utah', position: 'F', goals: 24, assists: 19, shortHandedGoals: 2, overtimeGoals: 1, fights: 0, blockedShots: 27, hits: 54, wins: 0, shutouts: 0, saves: 0, publishedPoints: 46 },
  { round: 18, team: 'Patrick', name: 'Cole Caufield', hdPlayerId: 27720, nhlTeam: 'Mon', position: 'F', goals: 51, assists: 37, shortHandedGoals: 0, overtimeGoals: 5, fights: 0, blockedShots: 21, hits: 50, wins: 0, shutouts: 0, saves: 0, publishedPoints: 93 },
  { round: 18, team: 'Colin', name: 'Erik Karlsson', hdPlayerId: 4491, nhlTeam: 'Pit', position: 'D', goals: 15, assists: 51, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 64, hits: 20, wins: 0, shutouts: 0, saves: 0, publishedPoints: 77.6 },
  { round: 18, team: 'Tay', name: 'Andrei Kuzmenko', hdPlayerId: 28738, nhlTeam: 'LA', position: 'F', goals: 13, assists: 12, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 14, hits: 18, wins: 0, shutouts: 0, saves: 0, publishedPoints: 25 },
  { round: 19, team: 'Nick', name: 'Brandon Montour', hdPlayerId: 16088, nhlTeam: 'Sea', position: 'D', goals: 11, assists: 21, shortHandedGoals: 0, overtimeGoals: 2, fights: 1, blockedShots: 79, hits: 77, wins: 0, shutouts: 0, saves: 0, publishedPoints: 55.6 },
  { round: 19, team: 'Kieran', name: 'Miro Heiskanen', hdPlayerId: 26945, nhlTeam: 'Dal', position: 'D', goals: 9, assists: 54, shortHandedGoals: 1, overtimeGoals: 1, fights: 0, blockedShots: 132, hits: 21, wins: 0, shutouts: 0, saves: 0, publishedPoints: 86.9 },
  { round: 19, team: 'Patrick', name: 'John Carlson', hdPlayerId: 4503, nhlTeam: 'Anh', position: 'D', goals: 14, assists: 46, shortHandedGoals: 1, overtimeGoals: 0, fights: 0, blockedShots: 106, hits: 26, wins: 0, shutouts: 0, saves: 0, publishedPoints: 79.5 },
  { round: 19, team: 'Colin', name: 'Filip Gustavsson', hdPlayerId: 16773, nhlTeam: 'Min', position: 'G', goals: 0, assists: 2, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 28, shutouts: 4, saves: 1243, publishedPoints: 87.7 },
  { round: 19, team: 'Tay', name: 'Sam Malinski', hdPlayerId: 29090, nhlTeam: 'Col', position: 'D', goals: 8, assists: 32, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 95, hits: 46, wins: 0, shutouts: 0, saves: 0, publishedPoints: 58.8 },
  { round: 20, team: 'Nick', name: 'Matvei Michkov', hdPlayerId: 29108, nhlTeam: 'Phi', position: 'F', goals: 20, assists: 31, shortHandedGoals: 0, overtimeGoals: 1, fights: 1, blockedShots: 19, hits: 33, wins: 0, shutouts: 0, saves: 0, publishedPoints: 54 },
  { round: 20, team: 'Kieran', name: 'Nico Hischier', hdPlayerId: 26943, nhlTeam: 'NJ', position: 'F', goals: 28, assists: 38, shortHandedGoals: 0, overtimeGoals: 3, fights: 1, blockedShots: 63, hits: 58, wins: 0, shutouts: 0, saves: 0, publishedPoints: 71 },
  { round: 20, team: 'Patrick', name: 'Alex Ovechkin', hdPlayerId: 3637, nhlTeam: 'Was', position: 'F', goals: 32, assists: 32, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 16, hits: 134, wins: 0, shutouts: 0, saves: 0, publishedPoints: 64 },
  { round: 20, team: 'Colin', name: 'Vince Dunn', hdPlayerId: 16417, nhlTeam: 'Sea', position: 'D', goals: 11, assists: 33, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 87, hits: 27, wins: 0, shutouts: 0, saves: 0, publishedPoints: 60.8 },
  { round: 20, team: 'Tay', name: 'Jake Middleton', hdPlayerId: 16235, nhlTeam: 'Min', position: 'D', goals: 2, assists: 14, shortHandedGoals: 0, overtimeGoals: 0, fights: 6, blockedShots: 117, hits: 87, wins: 0, shutouts: 0, saves: 0, publishedPoints: 54.2 },
  { round: 21, team: 'Nick', name: 'John Tavares', hdPlayerId: 4681, nhlTeam: 'Tor', position: 'F', goals: 31, assists: 40, shortHandedGoals: 0, overtimeGoals: 2, fights: 0, blockedShots: 24, hits: 74, wins: 0, shutouts: 0, saves: 0, publishedPoints: 73 },
  { round: 21, team: 'Kieran', name: 'Jackson LaCombe', hdPlayerId: 27744, nhlTeam: 'Anh', position: 'D', goals: 10, assists: 48, shortHandedGoals: 1, overtimeGoals: 0, fights: 1, blockedShots: 128, hits: 76, wins: 0, shutouts: 0, saves: 0, publishedPoints: 87.8 },
  { round: 21, team: 'Patrick', name: 'Thatcher Demko', hdPlayerId: 16070, nhlTeam: 'Van', position: 'G', goals: 0, assists: 1, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 8, shutouts: 1, saves: 460, publishedPoints: 29.4 },
  { round: 21, team: 'Colin', name: 'Mathieu Olivier', hdPlayerId: 27554, nhlTeam: 'Cls', position: 'F', goals: 15, assists: 11, shortHandedGoals: 0, overtimeGoals: 0, fights: 9, blockedShots: 42, hits: 209, wins: 0, shutouts: 0, saves: 0, publishedPoints: 44 },
  { round: 21, team: 'Tay', name: 'Sebastian Aho', hdPlayerId: 16396, nhlTeam: 'Car', position: 'F', goals: 27, assists: 53, shortHandedGoals: 2, overtimeGoals: 2, fights: 0, blockedShots: 24, hits: 63, wins: 0, shutouts: 0, saves: 0, publishedPoints: 84 },
  { round: 22, team: 'Nick', name: 'Aaron Ekblad', hdPlayerId: 16036, nhlTeam: 'Fla', position: 'D', goals: 4, assists: 22, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 103, hits: 84, wins: 0, shutouts: 0, saves: 0, publishedPoints: 51.8 },
  { round: 22, team: 'Kieran', name: 'Nikolaj Ehlers', hdPlayerId: 16044, nhlTeam: 'Car', position: 'F', goals: 26, assists: 45, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 24, hits: 21, wins: 0, shutouts: 0, saves: 0, publishedPoints: 72 },
  { round: 22, team: 'Patrick', name: 'Luke Hughes', hdPlayerId: 28342, nhlTeam: 'NJ', position: 'D', goals: 6, assists: 29, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 53, hits: 19, wins: 0, shutouts: 0, saves: 0, publishedPoints: 44.8 },
  { round: 22, team: 'Colin', name: 'Brock Faber', hdPlayerId: 28135, nhlTeam: 'Min', position: 'D', goals: 15, assists: 36, shortHandedGoals: 1, overtimeGoals: 0, fights: 1, blockedShots: 148, hits: 33, wins: 0, shutouts: 0, saves: 0, publishedPoints: 79.5 },
  { round: 22, team: 'Tay', name: 'Roope Hintz', hdPlayerId: 16410, nhlTeam: 'Dal', position: 'F', goals: 15, assists: 29, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 18, hits: 60, wins: 0, shutouts: 0, saves: 0, publishedPoints: 45 },
  { round: 23, team: 'Kieran', name: 'Adrian Kempe', hdPlayerId: 16064, nhlTeam: 'LA', position: 'F', goals: 36, assists: 37, shortHandedGoals: 0, overtimeGoals: 4, fights: 0, blockedShots: 39, hits: 127, wins: 0, shutouts: 0, saves: 0, publishedPoints: 77 },
  { round: 24, team: 'Colin', name: 'Tom Wilson', hdPlayerId: 14790, nhlTeam: 'Was', position: 'F', goals: 30, assists: 32, shortHandedGoals: 1, overtimeGoals: 0, fights: 5, blockedShots: 52, hits: 179, wins: 0, shutouts: 0, saves: 0, publishedPoints: 73 },
  { round: 25, team: 'Kieran', name: 'Mark Stone', hdPlayerId: 14049, nhlTeam: 'Veg', position: 'F', goals: 28, assists: 45, shortHandedGoals: 1, overtimeGoals: 2, fights: 1, blockedShots: 47, hits: 31, wins: 0, shutouts: 0, saves: 0, publishedPoints: 78 },
  { round: 26, team: 'Colin', name: 'Dylan Larkin', hdPlayerId: 16050, nhlTeam: 'Det', position: 'F', goals: 34, assists: 33, shortHandedGoals: 1, overtimeGoals: 4, fights: 0, blockedShots: 33, hits: 46, wins: 0, shutouts: 0, saves: 0, publishedPoints: 72 },
  { round: 27, team: 'Patrick', name: 'Mike Matheson', hdPlayerId: 14797, nhlTeam: 'Mon', position: 'D', goals: 7, assists: 30, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 150, hits: 59, wins: 0, shutouts: 0, saves: 0, publishedPoints: 66.4 },
  { round: 28, team: 'Patrick', name: 'Evgeni Malkin', hdPlayerId: 3638, nhlTeam: 'Pit', position: 'F', goals: 19, assists: 42, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 17, hits: 24, wins: 0, shutouts: 0, saves: 0, publishedPoints: 61 },
  { round: 29, team: 'Patrick', name: 'Leo Carlsson', hdPlayerId: 29103, nhlTeam: 'Anh', position: 'F', goals: 29, assists: 38, shortHandedGoals: 2, overtimeGoals: 1, fights: 0, blockedShots: 29, hits: 14, wins: 0, shutouts: 0, saves: 0, publishedPoints: 70 },
  { round: 30, team: 'Kieran', name: 'Matthew Schaefer', hdPlayerId: 29841, nhlTeam: 'NYI', position: 'D', goals: 23, assists: 36, shortHandedGoals: 0, overtimeGoals: 2, fights: 0, blockedShots: 111, hits: 40, wins: 0, shutouts: 0, saves: 0, publishedPoints: 81.6 },
  { round: 31, team: 'Nick', name: 'Jake McCabe', hdPlayerId: 14818, nhlTeam: 'Tor', position: 'D', goals: 5, assists: 20, shortHandedGoals: 0, overtimeGoals: 0, fights: 2, blockedShots: 190, hits: 104, wins: 0, shutouts: 0, saves: 0, publishedPoints: 67.9 },
  { round: 32, team: 'Kieran', name: 'Lukas Dostal', hdPlayerId: 27408, nhlTeam: 'Anh', position: 'G', goals: 0, assists: 1, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 30, shutouts: 0, saves: 1351, publishedPoints: 85 },
  { round: 33, team: 'Patrick', name: 'Spencer Knight', hdPlayerId: 27718, nhlTeam: 'Chi', position: 'G', goals: 0, assists: 1, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 19, shutouts: 3, saves: 1428, publishedPoints: 83.1 },
  { round: 34, team: 'Patrick', name: 'Jacob Trouba', hdPlayerId: 14783, nhlTeam: 'Anh', position: 'D', goals: 10, assists: 25, shortHandedGoals: 0, overtimeGoals: 1, fights: 1, blockedShots: 152, hits: 143, wins: 0, shutouts: 0, saves: 0, publishedPoints: 75.1 },
  { round: 35, team: 'Nick', name: 'Jeremy Swayman', hdPlayerId: 27053, nhlTeam: 'Bos', position: 'G', goals: 0, assists: 0, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 0, hits: 0, wins: 31, shutouts: 2, saves: 1425, publishedPoints: 97 },
  { round: 36, team: 'Kieran', name: 'Cutter Gauthier', hdPlayerId: 28743, nhlTeam: 'Anh', position: 'F', goals: 41, assists: 28, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 20, hits: 66, wins: 0, shutouts: 0, saves: 0, publishedPoints: 70 },
  { round: 37, team: 'Patrick', name: 'Jackson LaCombe', hdPlayerId: 27744, nhlTeam: 'Anh', position: 'D', goals: 10, assists: 48, shortHandedGoals: 1, overtimeGoals: 0, fights: 1, blockedShots: 128, hits: 76, wins: 0, shutouts: 0, saves: 0, publishedPoints: 87.8 },
  { round: 38, team: 'Patrick', name: 'Wyatt Johnston', hdPlayerId: 28360, nhlTeam: 'Dal', position: 'F', goals: 45, assists: 41, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 56, hits: 56, wins: 0, shutouts: 0, saves: 0, publishedPoints: 87 },
  { round: 39, team: 'Colin', name: 'John Carlson', hdPlayerId: 4503, nhlTeam: 'Anh', position: 'D', goals: 14, assists: 46, shortHandedGoals: 1, overtimeGoals: 0, fights: 0, blockedShots: 106, hits: 26, wins: 0, shutouts: 0, saves: 0, publishedPoints: 79.5 },
  { round: 40, team: 'Nick', name: 'Morgan Rielly', hdPlayerId: 14779, nhlTeam: 'Tor', position: 'D', goals: 11, assists: 25, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 113, hits: 35, wins: 0, shutouts: 0, saves: 0, publishedPoints: 58.4 },
  { round: 41, team: 'Nick', name: 'Nikita Zadorov', hdPlayerId: 15655, nhlTeam: 'Bos', position: 'D', goals: 2, assists: 21, shortHandedGoals: 0, overtimeGoals: 0, fights: 5, blockedShots: 102, hits: 196, wins: 0, shutouts: 0, saves: 0, publishedPoints: 67.9 },
  { round: 42, team: 'Patrick', name: 'Darren Raddysh', hdPlayerId: 16319, nhlTeam: 'TB', position: 'D', goals: 22, assists: 48, shortHandedGoals: 0, overtimeGoals: 1, fights: 2, blockedShots: 69, hits: 67, wins: 0, shutouts: 0, saves: 0, publishedPoints: 92 },
  { round: 43, team: 'Patrick', name: 'Brad Marchand', hdPlayerId: 4351, nhlTeam: 'Fla', position: 'F', goals: 27, assists: 27, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 16, hits: 36, wins: 0, shutouts: 0, saves: 0, publishedPoints: 55 },
  { round: 44, team: 'Colin', name: 'Mattias Samuelsson', hdPlayerId: 27355, nhlTeam: 'Buf', position: 'D', goals: 13, assists: 28, shortHandedGoals: 1, overtimeGoals: 1, fights: 0, blockedShots: 153, hits: 132, wins: 0, shutouts: 0, saves: 0, publishedPoints: 79.2 },
  { round: 45, team: 'Colin', name: 'Filip Hronek', hdPlayerId: 16771, nhlTeam: 'Van', position: 'D', goals: 8, assists: 41, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 100, hits: 133, wins: 0, shutouts: 0, saves: 0, publishedPoints: 79.3 },
  { round: 46, team: 'Kieran', name: 'Ilya Sorokin', hdPlayerId: 16111, nhlTeam: 'NYI', position: 'G', goals: 0, assists: 1, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 29, shutouts: 7, saves: 1383, publishedPoints: 99.3 },
  { round: 47, team: 'Patrick', name: 'Jacob Trouba', hdPlayerId: 14783, nhlTeam: 'Anh', position: 'D', goals: 10, assists: 25, shortHandedGoals: 0, overtimeGoals: 1, fights: 1, blockedShots: 152, hits: 143, wins: 0, shutouts: 0, saves: 0, publishedPoints: 75.1 },
  { round: 48, team: 'Nick', name: 'Roman Josi', hdPlayerId: 14279, nhlTeam: 'Nsh', position: 'D', goals: 13, assists: 42, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 101, hits: 24, wins: 0, shutouts: 0, saves: 0, publishedPoints: 73.6 },
  { round: 49, team: 'Nick', name: 'Mike Matheson', hdPlayerId: 14797, nhlTeam: 'Mon', position: 'D', goals: 7, assists: 30, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 150, hits: 59, wins: 0, shutouts: 0, saves: 0, publishedPoints: 66.4 },
  { round: 50, team: 'Nick', name: 'Shayne Gostisbehere', hdPlayerId: 14852, nhlTeam: 'Car', position: 'D', goals: 13, assists: 37, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 64, hits: 29, wins: 0, shutouts: 0, saves: 0, publishedPoints: 62.5 },
  { round: 51, team: 'Colin', name: 'Justin Faulk', hdPlayerId: 5010, nhlTeam: 'Det', position: 'D', goals: 16, assists: 24, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 132, hits: 70, wins: 0, shutouts: 0, saves: 0, publishedPoints: 66.8 },
  { round: 52, team: 'Colin', name: 'Alex Tuch', hdPlayerId: 16053, nhlTeam: 'Buf', position: 'F', goals: 33, assists: 33, shortHandedGoals: 3, overtimeGoals: 1, fights: 1, blockedShots: 90, hits: 82, wins: 0, shutouts: 0, saves: 0, publishedPoints: 72 },
  { round: 53, team: 'Patrick', name: 'Alex DeBrincat', hdPlayerId: 16757, nhlTeam: 'Det', position: 'F', goals: 41, assists: 44, shortHandedGoals: 0, overtimeGoals: 2, fights: 1, blockedShots: 39, hits: 38, wins: 0, shutouts: 0, saves: 0, publishedPoints: 89 },
  { round: 55, team: 'Patrick', name: 'Jake Sanderson', hdPlayerId: 28095, nhlTeam: 'Ott', position: 'D', goals: 14, assists: 40, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 128, hits: 29, wins: 0, shutouts: 0, saves: 0, publishedPoints: 76.1 },
  { round: 56, team: 'Kieran', name: 'Pavel Dorofeyev', hdPlayerId: 27784, nhlTeam: 'Veg', position: 'F', goals: 37, assists: 27, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 28, hits: 27, wins: 0, shutouts: 0, saves: 0, publishedPoints: 64 },
];

/** End-of-season rosters: 17 active + 5 reserve per team. */
export const HOCKEYDRAFT_FINAL_ROSTERS: HockeyDraftRosterEntry[] = [
  { team: 'Colin', slot: 'active', draftPick: 4, name: 'Evan Bouchard', hdPlayerId: 27333, nhlTeam: 'Edm', position: 'D', goals: 21, assists: 74, shortHandedGoals: 0, overtimeGoals: 3, fights: 0, blockedShots: 101, hits: 29, wins: 0, shutouts: 0, saves: 0, publishedPoints: 116 },
  { team: 'Colin', slot: 'active', draftPick: 2, name: 'Zach Werenski', hdPlayerId: 16369, nhlTeam: 'Cls', position: 'D', goals: 22, assists: 59, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 94, hits: 30, wins: 0, shutouts: 0, saves: 0, publishedPoints: 98.1 },
  { team: 'Colin', slot: 'active', draftPick: 12, name: 'Jason Robertson', hdPlayerId: 26981, nhlTeam: 'Dal', position: 'F', goals: 45, assists: 51, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 34, hits: 48, wins: 0, shutouts: 0, saves: 0, publishedPoints: 97 },
  { team: 'Colin', slot: 'active', draftPick: 5, name: 'Macklin Celebrini', hdPlayerId: 29485, nhlTeam: 'SJ', position: 'F', goals: 45, assists: 70, shortHandedGoals: 0, overtimeGoals: 2, fights: 0, blockedShots: 53, hits: 53, wins: 0, shutouts: 0, saves: 0, publishedPoints: 91 },
  { team: 'Colin', slot: 'active', draftPick: 11, name: 'Juuse Saros', hdPlayerId: 15724, nhlTeam: 'Nsh', position: 'G', goals: 0, assists: 0, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 28, shutouts: 0, saves: 1519, publishedPoints: 88.8 },
  { team: 'Colin', slot: 'active', draftPick: 19, name: 'Filip Gustavsson', hdPlayerId: 16773, nhlTeam: 'Min', position: 'G', goals: 0, assists: 2, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 28, shutouts: 4, saves: 1243, publishedPoints: 87.7 },
  { team: 'Colin', slot: 'active', draftPick: 9, name: 'Matt Boldy', hdPlayerId: 27717, nhlTeam: 'Min', position: 'F', goals: 42, assists: 43, shortHandedGoals: 4, overtimeGoals: 1, fights: 0, blockedShots: 58, hits: 61, wins: 0, shutouts: 0, saves: 0, publishedPoints: 85 },
  { team: 'Colin', slot: 'active', draftPick: 22, name: 'Brock Faber', hdPlayerId: 28135, nhlTeam: 'Min', position: 'D', goals: 15, assists: 36, shortHandedGoals: 1, overtimeGoals: 0, fights: 1, blockedShots: 148, hits: 33, wins: 0, shutouts: 0, saves: 0, publishedPoints: 79.5 },
  { team: 'Colin', slot: 'active', draftPick: 8, name: 'Clayton Keller', hdPlayerId: 16725, nhlTeam: 'Utah', position: 'F', goals: 26, assists: 62, shortHandedGoals: 0, overtimeGoals: 4, fights: 0, blockedShots: 32, hits: 8, wins: 0, shutouts: 0, saves: 0, publishedPoints: 77 },
  { team: 'Colin', slot: 'active', draftPick: 7, name: 'Artemi Panarin', hdPlayerId: 16348, nhlTeam: 'LA', position: 'F', goals: 28, assists: 56, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 16, hits: 11, wins: 0, shutouts: 0, saves: 0, publishedPoints: 75 },
  { team: 'Colin', slot: 'active', draftPick: 15, name: 'Lucas Raymond', hdPlayerId: 28094, nhlTeam: 'Det', position: 'F', goals: 25, assists: 51, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 29, hits: 43, wins: 0, shutouts: 0, saves: 0, publishedPoints: 73 },
  { team: 'Colin', slot: 'active', draftPick: 39, name: 'John Carlson', hdPlayerId: 4503, nhlTeam: 'Anh', position: 'D', goals: 14, assists: 46, shortHandedGoals: 1, overtimeGoals: 0, fights: 0, blockedShots: 106, hits: 26, wins: 0, shutouts: 0, saves: 0, publishedPoints: 45.4 },
  { team: 'Colin', slot: 'active', draftPick: 3, name: 'Brady Tkachuk', hdPlayerId: 27327, nhlTeam: 'Ott', position: 'F', goals: 22, assists: 37, shortHandedGoals: 1, overtimeGoals: 1, fights: 3, blockedShots: 19, hits: 162, wins: 0, shutouts: 0, saves: 0, publishedPoints: 37 },
  { team: 'Colin', slot: 'active', draftPick: 13, name: 'Brandon Hagel', hdPlayerId: 16878, nhlTeam: 'TB', position: 'F', goals: 36, assists: 38, shortHandedGoals: 1, overtimeGoals: 0, fights: 2, blockedShots: 38, hits: 42, wins: 0, shutouts: 0, saves: 0, publishedPoints: 36 },
  { team: 'Colin', slot: 'active', draftPick: 17, name: 'Rasmus Andersson', hdPlayerId: 16414, nhlTeam: 'Veg', position: 'D', goals: 17, assists: 31, shortHandedGoals: 1, overtimeGoals: 0, fights: 1, blockedShots: 148, hits: 37, wins: 0, shutouts: 0, saves: 0, publishedPoints: 29.2 },
  { team: 'Colin', slot: 'active', draftPick: 44, name: 'Mattias Samuelsson', hdPlayerId: 27355, nhlTeam: 'Buf', position: 'D', goals: 13, assists: 28, shortHandedGoals: 1, overtimeGoals: 1, fights: 0, blockedShots: 153, hits: 132, wins: 0, shutouts: 0, saves: 0, publishedPoints: 28.4 },
  { team: 'Colin', slot: 'active', draftPick: 52, name: 'Alex Tuch', hdPlayerId: 16053, nhlTeam: 'Buf', position: 'F', goals: 33, assists: 33, shortHandedGoals: 3, overtimeGoals: 1, fights: 1, blockedShots: 90, hits: 82, wins: 0, shutouts: 0, saves: 0, publishedPoints: 9 },
  { team: 'Colin', slot: 'reserve', draftPick: 24, name: 'Tom Wilson', hdPlayerId: 14790, nhlTeam: 'Was', position: 'F', goals: 30, assists: 32, shortHandedGoals: 1, overtimeGoals: 0, fights: 5, blockedShots: 52, hits: 179, wins: 0, shutouts: 0, saves: 0, publishedPoints: 45 },
  { team: 'Colin', slot: 'reserve', draftPick: 26, name: 'Dylan Larkin', hdPlayerId: 16050, nhlTeam: 'Det', position: 'F', goals: 34, assists: 33, shortHandedGoals: 1, overtimeGoals: 4, fights: 0, blockedShots: 33, hits: 46, wins: 0, shutouts: 0, saves: 0, publishedPoints: 45 },
  { team: 'Colin', slot: 'reserve', draftPick: 10, name: 'Jesper Bratt', hdPlayerId: 16881, nhlTeam: 'NJ', position: 'F', goals: 22, assists: 50, shortHandedGoals: 1, overtimeGoals: 1, fights: 0, blockedShots: 24, hits: 74, wins: 0, shutouts: 0, saves: 0, publishedPoints: 39 },
  { team: 'Colin', slot: 'reserve', draftPick: 18, name: 'Erik Karlsson', hdPlayerId: 4491, nhlTeam: 'Pit', position: 'D', goals: 15, assists: 51, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 64, hits: 20, wins: 0, shutouts: 0, saves: 0, publishedPoints: 36.6 },
  { team: 'Colin', slot: 'reserve', draftPick: 51, name: 'Justin Faulk', hdPlayerId: 5010, nhlTeam: 'Det', position: 'D', goals: 16, assists: 24, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 132, hits: 70, wins: 0, shutouts: 0, saves: 0, publishedPoints: 0 },
  { team: 'Kieran', slot: 'active', draftPick: 10, name: 'Lane Hutson', hdPlayerId: 28799, nhlTeam: 'Mon', position: 'D', goals: 12, assists: 66, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 137, hits: 31, wins: 0, shutouts: 0, saves: 0, publishedPoints: 102.6 },
  { team: 'Kieran', slot: 'active', draftPick: 7, name: 'Tim Stutzle', hdPlayerId: 28093, nhlTeam: 'Ott', position: 'F', goals: 34, assists: 49, shortHandedGoals: 2, overtimeGoals: 2, fights: 1, blockedShots: 44, hits: 126, wins: 0, shutouts: 0, saves: 0, publishedPoints: 89 },
  { team: 'Kieran', slot: 'active', draftPick: 2, name: 'Quinn Hughes', hdPlayerId: 27330, nhlTeam: 'Min', position: 'D', goals: 7, assists: 69, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 87, hits: 7, wins: 0, shutouts: 0, saves: 0, publishedPoints: 80.6 },
  { team: 'Kieran', slot: 'active', draftPick: 4, name: 'Mitch Marner', hdPlayerId: 16365, nhlTeam: 'Veg', position: 'F', goals: 24, assists: 56, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 46, hits: 24, wins: 0, shutouts: 0, saves: 0, publishedPoints: 80 },
  { team: 'Kieran', slot: 'active', draftPick: 12, name: 'Connor Bedard', hdPlayerId: 29102, nhlTeam: 'Chi', position: 'F', goals: 30, assists: 45, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 27, hits: 31, wins: 0, shutouts: 0, saves: 0, publishedPoints: 76 },
  { team: 'Kieran', slot: 'active', draftPick: 15, name: 'Tage Thompson', hdPlayerId: 16744, nhlTeam: 'Buf', position: 'F', goals: 40, assists: 41, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 48, hits: 86, wins: 0, shutouts: 0, saves: 0, publishedPoints: 76 },
  { team: 'Kieran', slot: 'active', draftPick: 23, name: 'Adrian Kempe', hdPlayerId: 16064, nhlTeam: 'LA', position: 'F', goals: 36, assists: 37, shortHandedGoals: 0, overtimeGoals: 4, fights: 0, blockedShots: 39, hits: 127, wins: 0, shutouts: 0, saves: 0, publishedPoints: 72 },
  { team: 'Kieran', slot: 'active', draftPick: 20, name: 'Nico Hischier', hdPlayerId: 26943, nhlTeam: 'NJ', position: 'F', goals: 28, assists: 38, shortHandedGoals: 0, overtimeGoals: 3, fights: 1, blockedShots: 63, hits: 58, wins: 0, shutouts: 0, saves: 0, publishedPoints: 71 },
  { team: 'Kieran', slot: 'active', draftPick: 14, name: 'Noah Dobson', hdPlayerId: 27335, nhlTeam: 'Mon', position: 'D', goals: 12, assists: 35, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 188, hits: 62, wins: 0, shutouts: 0, saves: 0, publishedPoints: 68.2 },
  { team: 'Kieran', slot: 'active', draftPick: 5, name: 'Moritz Seider', hdPlayerId: 27711, nhlTeam: 'Det', position: 'D', goals: 10, assists: 50, shortHandedGoals: 0, overtimeGoals: 1, fights: 1, blockedShots: 180, hits: 128, wins: 0, shutouts: 0, saves: 0, publishedPoints: 67.3 },
  { team: 'Kieran', slot: 'active', draftPick: 3, name: 'Jack Hughes', hdPlayerId: 27706, nhlTeam: 'NJ', position: 'F', goals: 27, assists: 50, shortHandedGoals: 1, overtimeGoals: 1, fights: 0, blockedShots: 32, hits: 4, wins: 0, shutouts: 0, saves: 0, publishedPoints: 65 },
  { team: 'Kieran', slot: 'active', draftPick: 30, name: 'Matthew Schaefer', hdPlayerId: 29841, nhlTeam: 'NYI', position: 'D', goals: 23, assists: 36, shortHandedGoals: 0, overtimeGoals: 2, fights: 0, blockedShots: 111, hits: 40, wins: 0, shutouts: 0, saves: 0, publishedPoints: 61.6 },
  { team: 'Kieran', slot: 'active', draftPick: 25, name: 'Mark Stone', hdPlayerId: 14049, nhlTeam: 'Veg', position: 'F', goals: 28, assists: 45, shortHandedGoals: 1, overtimeGoals: 2, fights: 1, blockedShots: 47, hits: 31, wins: 0, shutouts: 0, saves: 0, publishedPoints: 61 },
  { team: 'Kieran', slot: 'active', draftPick: 9, name: 'Josh Morrissey', hdPlayerId: 15652, nhlTeam: 'Wpg', position: 'D', goals: 14, assists: 41, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 118, hits: 36, wins: 0, shutouts: 0, saves: 0, publishedPoints: 60 },
  { team: 'Kieran', slot: 'active', draftPick: 32, name: 'Lukas Dostal', hdPlayerId: 27408, nhlTeam: 'Anh', position: 'G', goals: 0, assists: 1, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 30, shutouts: 0, saves: 1351, publishedPoints: 55.2 },
  { team: 'Kieran', slot: 'active', draftPick: 46, name: 'Ilya Sorokin', hdPlayerId: 16111, nhlTeam: 'NYI', position: 'G', goals: 0, assists: 1, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 29, shutouts: 7, saves: 1383, publishedPoints: 41.6 },
  { team: 'Kieran', slot: 'active', draftPick: 56, name: 'Pavel Dorofeyev', hdPlayerId: 27784, nhlTeam: 'Veg', position: 'F', goals: 37, assists: 27, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 28, hits: 27, wins: 0, shutouts: 0, saves: 0, publishedPoints: 3 },
  { team: 'Kieran', slot: 'reserve', draftPick: 6, name: 'Igor Shesterkin', hdPlayerId: 16148, nhlTeam: 'NYR', position: 'G', goals: 0, assists: 0, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 0, hits: 0, wins: 25, shutouts: 1, saves: 1299, publishedPoints: 53.6 },
  { team: 'Kieran', slot: 'reserve', draftPick: 19, name: 'Miro Heiskanen', hdPlayerId: 26945, nhlTeam: 'Dal', position: 'D', goals: 9, assists: 54, shortHandedGoals: 1, overtimeGoals: 1, fights: 0, blockedShots: 132, hits: 21, wins: 0, shutouts: 0, saves: 0, publishedPoints: 50.4 },
  { team: 'Kieran', slot: 'reserve', draftPick: 36, name: 'Cutter Gauthier', hdPlayerId: 28743, nhlTeam: 'Anh', position: 'F', goals: 41, assists: 28, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 20, hits: 66, wins: 0, shutouts: 0, saves: 0, publishedPoints: 31 },
  { team: 'Kieran', slot: 'reserve', draftPick: 13, name: 'Thomas Harley', hdPlayerId: 27723, nhlTeam: 'Dal', position: 'D', goals: 6, assists: 30, shortHandedGoals: 0, overtimeGoals: 2, fights: 0, blockedShots: 148, hits: 39, wins: 0, shutouts: 0, saves: 0, publishedPoints: 17.4 },
  { team: 'Kieran', slot: 'reserve', draftPick: 11, name: 'Elias Pettersson', hdPlayerId: 26947, nhlTeam: 'Van', position: 'F', goals: 15, assists: 36, shortHandedGoals: 1, overtimeGoals: 0, fights: 0, blockedShots: 108, hits: 69, wins: 0, shutouts: 0, saves: 0, publishedPoints: 9 },
  { team: 'Nick', slot: 'active', draftPick: 1, name: 'Connor McDavid', hdPlayerId: 16362, nhlTeam: 'Edm', position: 'F', goals: 48, assists: 90, shortHandedGoals: 1, overtimeGoals: 1, fights: 0, blockedShots: 30, hits: 40, wins: 0, shutouts: 0, saves: 0, publishedPoints: 140 },
  { team: 'Nick', slot: 'active', draftPick: 17, name: 'Mark Scheifele', hdPlayerId: 9025, nhlTeam: 'Wpg', position: 'F', goals: 36, assists: 67, shortHandedGoals: 0, overtimeGoals: 1, fights: 1, blockedShots: 47, hits: 32, wins: 0, shutouts: 0, saves: 0, publishedPoints: 106 },
  { team: 'Nick', slot: 'active', draftPick: 14, name: 'Nick Suzuki', hdPlayerId: 26955, nhlTeam: 'Mon', position: 'F', goals: 29, assists: 72, shortHandedGoals: 1, overtimeGoals: 1, fights: 0, blockedShots: 62, hits: 62, wins: 0, shutouts: 0, saves: 0, publishedPoints: 103 },
  { team: 'Nick', slot: 'active', draftPick: 7, name: 'Andrei Vasilevskiy', hdPlayerId: 14793, nhlTeam: 'TB', position: 'G', goals: 0, assists: 2, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 0, hits: 0, wins: 39, shutouts: 2, saves: 1349, publishedPoints: 99.6 },
  { team: 'Nick', slot: 'active', draftPick: 4, name: 'Kyle Connor', hdPlayerId: 16378, nhlTeam: 'Wpg', position: 'F', goals: 39, assists: 53, shortHandedGoals: 2, overtimeGoals: 2, fights: 0, blockedShots: 19, hits: 36, wins: 0, shutouts: 0, saves: 0, publishedPoints: 96 },
  { team: 'Nick', slot: 'active', draftPick: 3, name: 'Jack Eichel', hdPlayerId: 16363, nhlTeam: 'Veg', position: 'F', goals: 27, assists: 63, shortHandedGoals: 1, overtimeGoals: 3, fights: 0, blockedShots: 40, hits: 35, wins: 0, shutouts: 0, saves: 0, publishedPoints: 94 },
  { team: 'Nick', slot: 'active', draftPick: 9, name: 'Jake Oettinger', hdPlayerId: 26968, nhlTeam: 'Dal', position: 'G', goals: 0, assists: 1, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 35, shutouts: 4, saves: 1234, publishedPoints: 93.4 },
  { team: 'Nick', slot: 'active', draftPick: 11, name: 'Charlie McAvoy', hdPlayerId: 16732, nhlTeam: 'Bos', position: 'D', goals: 11, assists: 50, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 129, hits: 79, wins: 0, shutouts: 0, saves: 0, publishedPoints: 88 },
  { team: 'Nick', slot: 'active', draftPick: 5, name: 'William Nylander', hdPlayerId: 16043, nhlTeam: 'Tor', position: 'F', goals: 30, assists: 49, shortHandedGoals: 0, overtimeGoals: 3, fights: 0, blockedShots: 26, hits: 14, wins: 0, shutouts: 0, saves: 0, publishedPoints: 82 },
  { team: 'Nick', slot: 'active', draftPick: 2, name: 'Mikko Rantanen', hdPlayerId: 16371, nhlTeam: 'Dal', position: 'F', goals: 22, assists: 55, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 30, hits: 48, wins: 0, shutouts: 0, saves: 0, publishedPoints: 79 },
  { team: 'Nick', slot: 'active', draftPick: 13, name: 'Darnell Nurse', hdPlayerId: 15647, nhlTeam: 'Edm', position: 'D', goals: 7, assists: 17, shortHandedGoals: 0, overtimeGoals: 0, fights: 4, blockedShots: 166, hits: 137, wins: 0, shutouts: 0, saves: 0, publishedPoints: 70.6 },
  { team: 'Nick', slot: 'active', draftPick: 12, name: 'Zach Hyman', hdPlayerId: 13994, nhlTeam: 'Edm', position: 'F', goals: 31, assists: 21, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 18, hits: 55, wins: 0, shutouts: 0, saves: 0, publishedPoints: 53 },
  { team: 'Nick', slot: 'active', draftPick: 15, name: 'Dougie Hamilton', hdPlayerId: 9020, nhlTeam: 'NJ', position: 'D', goals: 12, assists: 27, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 78, hits: 87, wins: 0, shutouts: 0, saves: 0, publishedPoints: 47.5 },
  { team: 'Nick', slot: 'active', draftPick: 18, name: 'Matthew Tkachuk', hdPlayerId: 16724, nhlTeam: 'Fla', position: 'F', goals: 13, assists: 21, shortHandedGoals: 0, overtimeGoals: 0, fights: 2, blockedShots: 7, hits: 29, wins: 0, shutouts: 0, saves: 0, publishedPoints: 38 },
  { team: 'Nick', slot: 'active', draftPick: 48, name: 'Roman Josi', hdPlayerId: 14279, nhlTeam: 'Nsh', position: 'D', goals: 13, assists: 42, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 101, hits: 24, wins: 0, shutouts: 0, saves: 0, publishedPoints: 14.6 },
  { team: 'Nick', slot: 'active', draftPick: 49, name: 'Mike Matheson', hdPlayerId: 14797, nhlTeam: 'Mon', position: 'D', goals: 7, assists: 30, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 150, hits: 59, wins: 0, shutouts: 0, saves: 0, publishedPoints: 10 },
  { team: 'Nick', slot: 'active', draftPick: 50, name: 'Shayne Gostisbehere', hdPlayerId: 14852, nhlTeam: 'Car', position: 'D', goals: 13, assists: 37, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 64, hits: 29, wins: 0, shutouts: 0, saves: 0, publishedPoints: 9.8 },
  { team: 'Nick', slot: 'reserve', draftPick: 21, name: 'John Tavares', hdPlayerId: 4681, nhlTeam: 'Tor', position: 'F', goals: 31, assists: 40, shortHandedGoals: 0, overtimeGoals: 2, fights: 0, blockedShots: 24, hits: 74, wins: 0, shutouts: 0, saves: 0, publishedPoints: 45 },
  { team: 'Nick', slot: 'reserve', draftPick: 8, name: 'Adam Fox', hdPlayerId: 16784, nhlTeam: 'NYR', position: 'D', goals: 9, assists: 44, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 74, hits: 24, wins: 0, shutouts: 0, saves: 0, publishedPoints: 33.6 },
  { team: 'Nick', slot: 'reserve', draftPick: 6, name: 'Victor Hedman', hdPlayerId: 4682, nhlTeam: 'TB', position: 'D', goals: 1, assists: 16, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 44, hits: 19, wins: 0, shutouts: 0, saves: 0, publishedPoints: 17.2 },
  { team: 'Nick', slot: 'reserve', draftPick: 16, name: 'Travis Konecny', hdPlayerId: 16385, nhlTeam: 'Phi', position: 'F', goals: 27, assists: 41, shortHandedGoals: 1, overtimeGoals: 0, fights: 1, blockedShots: 39, hits: 108, wins: 0, shutouts: 0, saves: 0, publishedPoints: 8 },
  { team: 'Nick', slot: 'reserve', draftPick: 35, name: 'Jeremy Swayman', hdPlayerId: 27053, nhlTeam: 'Bos', position: 'G', goals: 0, assists: 0, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 0, hits: 0, wins: 31, shutouts: 2, saves: 1425, publishedPoints: 5.8 },
  { team: 'Patrick', slot: 'active', draftPick: 1, name: 'Nikita Kucherov', hdPlayerId: 9030, nhlTeam: 'TB', position: 'F', goals: 44, assists: 86, shortHandedGoals: 1, overtimeGoals: 2, fights: 0, blockedShots: 31, hits: 36, wins: 0, shutouts: 0, saves: 0, publishedPoints: 130 },
  { team: 'Patrick', slot: 'active', draftPick: 3, name: 'David Pastrnak', hdPlayerId: 16060, nhlTeam: 'Bos', position: 'F', goals: 29, assists: 71, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 32, hits: 86, wins: 0, shutouts: 0, saves: 0, publishedPoints: 94 },
  { team: 'Patrick', slot: 'active', draftPick: 14, name: 'Jake Guentzel', hdPlayerId: 15707, nhlTeam: 'TB', position: 'F', goals: 38, assists: 50, shortHandedGoals: 2, overtimeGoals: 2, fights: 1, blockedShots: 41, hits: 39, wins: 0, shutouts: 0, saves: 0, publishedPoints: 94 },
  { team: 'Patrick', slot: 'active', draftPick: 2, name: 'Kirill Kaprizov', hdPlayerId: 16496, nhlTeam: 'Min', position: 'F', goals: 45, assists: 44, shortHandedGoals: 0, overtimeGoals: 4, fights: 0, blockedShots: 27, hits: 52, wins: 0, shutouts: 0, saves: 0, publishedPoints: 93 },
  { team: 'Patrick', slot: 'active', draftPick: 17, name: 'Jakob Chychrun', hdPlayerId: 16734, nhlTeam: 'Was', position: 'D', goals: 26, assists: 34, shortHandedGoals: 0, overtimeGoals: 2, fights: 2, blockedShots: 114, hits: 58, wins: 0, shutouts: 0, saves: 0, publishedPoints: 88.9 },
  { team: 'Patrick', slot: 'active', draftPick: 18, name: 'Cole Caufield', hdPlayerId: 27720, nhlTeam: 'Mon', position: 'F', goals: 51, assists: 37, shortHandedGoals: 0, overtimeGoals: 5, fights: 0, blockedShots: 21, hits: 50, wins: 0, shutouts: 0, saves: 0, publishedPoints: 87 },
  { team: 'Patrick', slot: 'active', draftPick: 4, name: 'Rasmus Dahlin', hdPlayerId: 27324, nhlTeam: 'Buf', position: 'D', goals: 19, assists: 55, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 80, hits: 67, wins: 0, shutouts: 0, saves: 0, publishedPoints: 86.6 },
  { team: 'Patrick', slot: 'active', draftPick: 16, name: 'Sergei Bobrovsky', hdPlayerId: 4901, nhlTeam: 'Fla', position: 'G', goals: 0, assists: 2, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 0, hits: 0, wins: 27, shutouts: 4, saves: 1097, publishedPoints: 85.9 },
  { team: 'Patrick', slot: 'active', draftPick: 11, name: 'Filip Forsberg', hdPlayerId: 14785, nhlTeam: 'Nsh', position: 'F', goals: 40, assists: 35, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 33, hits: 124, wins: 0, shutouts: 0, saves: 0, publishedPoints: 72 },
  { team: 'Patrick', slot: 'active', draftPick: 6, name: 'Connor Hellebuyck', hdPlayerId: 14904, nhlTeam: 'Wpg', position: 'G', goals: 0, assists: 0, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 23, shutouts: 0, saves: 1382, publishedPoints: 71.2 },
  { team: 'Patrick', slot: 'active', draftPick: 13, name: 'Mikhail Sergachev', hdPlayerId: 16727, nhlTeam: 'Utah', position: 'D', goals: 10, assists: 49, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 125, hits: 38, wins: 0, shutouts: 0, saves: 0, publishedPoints: 71 },
  { team: 'Patrick', slot: 'active', draftPick: 9, name: 'Sidney Crosby', hdPlayerId: 3737, nhlTeam: 'Pit', position: 'F', goals: 29, assists: 45, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 30, hits: 60, wins: 0, shutouts: 0, saves: 0, publishedPoints: 70 },
  { team: 'Patrick', slot: 'active', draftPick: 10, name: 'Jake Sanderson', hdPlayerId: 28095, nhlTeam: 'Ott', position: 'D', goals: 14, assists: 40, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 128, hits: 29, wins: 0, shutouts: 0, saves: 0, publishedPoints: 69.5 },
  { team: 'Patrick', slot: 'active', draftPick: 42, name: 'Darren Raddysh', hdPlayerId: 16319, nhlTeam: 'TB', position: 'D', goals: 22, assists: 48, shortHandedGoals: 0, overtimeGoals: 1, fights: 2, blockedShots: 69, hits: 67, wins: 0, shutouts: 0, saves: 0, publishedPoints: 44.8 },
  { team: 'Patrick', slot: 'active', draftPick: 38, name: 'Wyatt Johnston', hdPlayerId: 28360, nhlTeam: 'Dal', position: 'F', goals: 45, assists: 41, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 56, hits: 56, wins: 0, shutouts: 0, saves: 0, publishedPoints: 38 },
  { team: 'Patrick', slot: 'active', draftPick: 37, name: 'Jackson LaCombe', hdPlayerId: 27744, nhlTeam: 'Anh', position: 'D', goals: 10, assists: 48, shortHandedGoals: 1, overtimeGoals: 0, fights: 1, blockedShots: 128, hits: 76, wins: 0, shutouts: 0, saves: 0, publishedPoints: 24.8 },
  { team: 'Patrick', slot: 'active', draftPick: 53, name: 'Alex DeBrincat', hdPlayerId: 16757, nhlTeam: 'Det', position: 'F', goals: 41, assists: 44, shortHandedGoals: 0, overtimeGoals: 2, fights: 1, blockedShots: 39, hits: 38, wins: 0, shutouts: 0, saves: 0, publishedPoints: 22 },
  { team: 'Patrick', slot: 'reserve', draftPick: 8, name: 'MacKenzie Weegar', hdPlayerId: 15402, nhlTeam: 'Utah', position: 'D', goals: 4, assists: 24, shortHandedGoals: 0, overtimeGoals: 0, fights: 2, blockedShots: 175, hits: 168, wins: 0, shutouts: 0, saves: 0, publishedPoints: 70.2 },
  { team: 'Patrick', slot: 'reserve', draftPick: 7, name: 'Sam Reinhart', hdPlayerId: 16037, nhlTeam: 'Fla', position: 'F', goals: 29, assists: 32, shortHandedGoals: 3, overtimeGoals: 1, fights: 0, blockedShots: 40, hits: 59, wins: 0, shutouts: 0, saves: 0, publishedPoints: 48 },
  { team: 'Patrick', slot: 'reserve', draftPick: 5, name: 'Brayden Point', hdPlayerId: 16112, nhlTeam: 'TB', position: 'F', goals: 18, assists: 32, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 23, hits: 8, wins: 0, shutouts: 0, saves: 0, publishedPoints: 13 },
  { team: 'Patrick', slot: 'reserve', draftPick: 33, name: 'Spencer Knight', hdPlayerId: 27718, nhlTeam: 'Chi', position: 'G', goals: 0, assists: 1, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 19, shutouts: 3, saves: 1428, publishedPoints: 9.8 },
  { team: 'Patrick', slot: 'reserve', draftPick: 34, name: 'Jacob Trouba', hdPlayerId: 14783, nhlTeam: 'Anh', position: 'D', goals: 10, assists: 25, shortHandedGoals: 0, overtimeGoals: 1, fights: 1, blockedShots: 152, hits: 143, wins: 0, shutouts: 0, saves: 0, publishedPoints: 8 },
  { team: 'Tay', slot: 'active', draftPick: 1, name: 'Nathan MacKinnon', hdPlayerId: 15002, nhlTeam: 'Col', position: 'F', goals: 53, assists: 74, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 35, hits: 64, wins: 0, shutouts: 0, saves: 0, publishedPoints: 128 },
  { team: 'Tay', slot: 'active', draftPick: 8, name: 'Martin Necas', hdPlayerId: 26954, nhlTeam: 'Col', position: 'F', goals: 38, assists: 62, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 26, hits: 85, wins: 0, shutouts: 0, saves: 0, publishedPoints: 100 },
  { team: 'Tay', slot: 'active', draftPick: 2, name: 'Cale Makar', hdPlayerId: 26946, nhlTeam: 'Col', position: 'D', goals: 20, assists: 59, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 116, hits: 35, wins: 0, shutouts: 0, saves: 0, publishedPoints: 99.9 },
  { team: 'Tay', slot: 'active', draftPick: 17, name: 'Scott Wedgewood', hdPlayerId: 13955, nhlTeam: 'Col', position: 'G', goals: 0, assists: 1, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 31, shutouts: 4, saves: 1007, publishedPoints: 80.3 },
  { team: 'Tay', slot: 'active', draftPick: 6, name: 'Josh Manson', hdPlayerId: 14528, nhlTeam: 'Col', position: 'D', goals: 5, assists: 26, shortHandedGoals: 0, overtimeGoals: 0, fights: 5, blockedShots: 99, hits: 174, wins: 0, shutouts: 0, saves: 0, publishedPoints: 73.2 },
  { team: 'Tay', slot: 'active', draftPick: 13, name: 'Brock Nelson', hdPlayerId: 4990, nhlTeam: 'Col', position: 'F', goals: 33, assists: 32, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 65, hits: 38, wins: 0, shutouts: 0, saves: 0, publishedPoints: 66 },
  { team: 'Tay', slot: 'active', draftPick: 10, name: 'Mackenzie Blackwood', hdPlayerId: 16403, nhlTeam: 'Col', position: 'G', goals: 0, assists: 0, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 0, hits: 0, wins: 24, shutouts: 3, saves: 841, publishedPoints: 63.6 },
  { team: 'Tay', slot: 'active', draftPick: 19, name: 'Sam Malinski', hdPlayerId: 29090, nhlTeam: 'Col', position: 'D', goals: 8, assists: 32, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 95, hits: 46, wins: 0, shutouts: 0, saves: 0, publishedPoints: 58.8 },
  { team: 'Tay', slot: 'active', draftPick: 20, name: 'Jake Middleton', hdPlayerId: 16235, nhlTeam: 'Min', position: 'D', goals: 2, assists: 14, shortHandedGoals: 0, overtimeGoals: 0, fights: 6, blockedShots: 117, hits: 87, wins: 0, shutouts: 0, saves: 0, publishedPoints: 54.2 },
  { team: 'Tay', slot: 'active', draftPick: 11, name: 'Brent Burns', hdPlayerId: 3358, nhlTeam: 'Col', position: 'D', goals: 12, assists: 23, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 91, hits: 20, wins: 0, shutouts: 0, saves: 0, publishedPoints: 50.6 },
  { team: 'Tay', slot: 'active', draftPick: 4, name: 'Valeri Nichushkin', hdPlayerId: 15650, nhlTeam: 'Col', position: 'F', goals: 17, assists: 32, shortHandedGoals: 1, overtimeGoals: 0, fights: 0, blockedShots: 27, hits: 55, wins: 0, shutouts: 0, saves: 0, publishedPoints: 50 },
  { team: 'Tay', slot: 'active', draftPick: 7, name: 'Artturi Lehkonen', hdPlayerId: 15686, nhlTeam: 'Col', position: 'F', goals: 21, assists: 27, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 33, hits: 45, wins: 0, shutouts: 0, saves: 0, publishedPoints: 48 },
  { team: 'Tay', slot: 'active', draftPick: 9, name: 'Matt Duchene', hdPlayerId: 4683, nhlTeam: 'Dal', position: 'F', goals: 16, assists: 29, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 23, hits: 29, wins: 0, shutouts: 0, saves: 0, publishedPoints: 45 },
  { team: 'Tay', slot: 'active', draftPick: 3, name: 'Devon Toews', hdPlayerId: 16139, nhlTeam: 'Col', position: 'D', goals: 3, assists: 21, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 83, hits: 26, wins: 0, shutouts: 0, saves: 0, publishedPoints: 39 },
  { team: 'Tay', slot: 'active', draftPick: 5, name: 'Gabriel Landeskog', hdPlayerId: 5363, nhlTeam: 'Col', position: 'F', goals: 14, assists: 21, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 32, hits: 86, wins: 0, shutouts: 0, saves: 0, publishedPoints: 37 },
  { team: 'Tay', slot: 'active', draftPick: 12, name: 'Victor Olofsson', hdPlayerId: 27557, nhlTeam: 'Cgy', position: 'F', goals: 13, assists: 18, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 21, hits: 18, wins: 0, shutouts: 0, saves: 0, publishedPoints: 31 },
  { team: 'Tay', slot: 'active', draftPick: 14, name: 'Jack Drury', hdPlayerId: 28337, nhlTeam: 'Col', position: 'F', goals: 10, assists: 17, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 56, hits: 46, wins: 0, shutouts: 0, saves: 0, publishedPoints: 29 },
  { team: 'Tay', slot: 'reserve', draftPick: 15, name: 'Ross Colton', hdPlayerId: 16836, nhlTeam: 'Col', position: 'F', goals: 9, assists: 15, shortHandedGoals: 0, overtimeGoals: 0, fights: 1, blockedShots: 25, hits: 159, wins: 0, shutouts: 0, saves: 0, publishedPoints: 0 },
  { team: 'Tay', slot: 'reserve', draftPick: 16, name: 'Parker Kelly', hdPlayerId: 27207, nhlTeam: 'Col', position: 'F', goals: 21, assists: 14, shortHandedGoals: 1, overtimeGoals: 0, fights: 0, blockedShots: 58, hits: 177, wins: 0, shutouts: 0, saves: 0, publishedPoints: 0 },
  { team: 'Tay', slot: 'reserve', draftPick: 18, name: 'Andrei Kuzmenko', hdPlayerId: 28738, nhlTeam: 'LA', position: 'F', goals: 13, assists: 12, shortHandedGoals: 0, overtimeGoals: 0, fights: 0, blockedShots: 14, hits: 18, wins: 0, shutouts: 0, saves: 0, publishedPoints: 0 },
  { team: 'Tay', slot: 'reserve', draftPick: 21, name: 'Sebastian Aho', hdPlayerId: 16396, nhlTeam: 'Car', position: 'F', goals: 27, assists: 53, shortHandedGoals: 2, overtimeGoals: 2, fights: 0, blockedShots: 24, hits: 63, wins: 0, shutouts: 0, saves: 0, publishedPoints: 0 },
  { team: 'Tay', slot: 'reserve', draftPick: 22, name: 'Roope Hintz', hdPlayerId: 16410, nhlTeam: 'Dal', position: 'F', goals: 15, assists: 29, shortHandedGoals: 0, overtimeGoals: 1, fights: 0, blockedShots: 18, hits: 60, wins: 0, shutouts: 0, saves: 0, publishedPoints: 0 },
];

/** Every row of the season transaction log, in the order the site prints them. */
export const HOCKEYDRAFT_TRANSACTIONS: HockeyDraftTransaction[] = [
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'Juuse Saros', swap: null, endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'Artemi Panarin', swap: null, endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'Zach Werenski', swap: null, endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'Rasmus Andersson', swap: null, endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'Clayton Keller', swap: null, endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'Filip Gustavsson', swap: null, endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'Brandon Hagel', swap: null, endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'Jason Robertson', swap: null, endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'Brady Tkachuk', swap: null, endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'Evan Bouchard', swap: null, endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'Matt Boldy', swap: null, endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'Lucas Raymond', swap: null, endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'Brock Faber', swap: null, endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'Macklin Celebrini', swap: null, endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'Mattias Samuelsson', swap: 'Josi -> Samuelsson', endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'Alex Tuch', swap: 'Matthews -> Tuch', endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'April 17', action: 'activated', player: 'John Carlson', swap: 'Rielly -> Carlson', endOfSeasonSnapshot: true },
  { team: 'Colin', date: 'March 14', action: 'dropped', player: 'Filip Hronek', swap: 'Hronek -> Faulk', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'March 14', action: 'activated', player: 'Artemi Panarin', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'March 14', action: 'activated', player: 'Brady Tkachuk', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'March 14', action: 'activated', player: 'Alex Tuch', swap: 'Matthews -> Tuch', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'March 13', action: 'dropped', player: 'Tom Wilson', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'March 13', action: 'dropped', player: 'Filip Hronek', swap: 'Hronek -> Faulk', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'March 13', action: 'dropped', player: 'Auston Matthews', swap: 'Matthews -> Tuch', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'March 13', action: 'dropped', player: 'Dylan Larkin', swap: 'Thomas -> Larkin', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 31', action: 'activated', player: 'Matt Boldy', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 30', action: 'dropped', player: 'Artemi Panarin', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 24', action: 'dropped', player: 'Tom Wilson', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 24', action: 'activated', player: 'Rasmus Andersson', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 24', action: 'activated', player: 'Mattias Samuelsson', swap: 'Josi -> Samuelsson', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 23', action: 'dropped', player: 'Erik Karlsson', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 23', action: 'dropped', player: 'Matt Boldy', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 23', action: 'dropped', player: 'Filip Hronek', swap: 'Dunn -> Hronek', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 17', action: 'dropped', player: 'Filip Hronek', swap: 'Dunn -> Hronek', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 17', action: 'dropped', player: 'Auston Matthews', swap: 'Matthews -> Tuch', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 17', action: 'activated', player: 'Clayton Keller', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 17', action: 'activated', player: 'Brandon Hagel', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 16', action: 'dropped', player: 'Jesper Bratt', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 16', action: 'dropped', player: 'Brady Tkachuk', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 16', action: 'dropped', player: 'Vince Dunn', swap: 'Dunn -> Hronek', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 16', action: 'dropped', player: 'Tom Wilson', swap: 'Olivier -> Wilson', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 13', action: 'dropped', player: 'Roman Josi', swap: 'Josi -> Samuelson', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'January 12', action: 'dropped', player: 'Roman Josi', swap: 'Josi -> Samuelson', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'December 20', action: 'dropped', player: 'Brady Tkachuk', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'December 20', action: 'activated', player: 'John Carlson', swap: 'Rielly -> Carlson', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'December 19', action: 'dropped', player: 'Clayton Keller', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'December 19', action: 'dropped', player: 'Morgan Rielly', swap: 'Rielly -> Carlson', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'November 22', action: 'dropped', player: 'Morgan Rielly', swap: 'Rielly -> Carlson', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'November 22', action: 'activated', player: 'Macklin Celebrini', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'November 21', action: 'dropped', player: 'Roman Josi', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'November 21', action: 'dropped', player: 'Auston Matthews', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 25', action: 'dropped', player: 'Erik Karlsson', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 25', action: 'dropped', player: 'Tom Wilson', swap: 'Olivier -> Wilson', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 25', action: 'dropped', player: 'Dylan Larkin', swap: 'Thomas -> Larkin', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 25', action: 'activated', player: 'Lucas Raymond', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 24', action: 'dropped', player: 'Morgan Rielly', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 24', action: 'dropped', player: 'Brandon Hagel', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 24', action: 'dropped', player: 'Macklin Celebrini', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 24', action: 'dropped', player: 'Robert Thomas', swap: 'Thomas -> Larkin', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 18', action: 'dropped', player: 'Morgan Rielly', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 18', action: 'dropped', player: 'Clayton Keller', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 18', action: 'dropped', player: 'Brandon Hagel', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 18', action: 'dropped', player: 'Macklin Celebrini', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 18', action: 'dropped', player: 'Vince Dunn', swap: 'Dunn -> Hronek', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 18', action: 'dropped', player: 'Mathieu Olivier', swap: 'Olivier -> Wilson', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 17', action: 'dropped', player: 'Erik Karlsson', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 17', action: 'dropped', player: 'Rasmus Andersson', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 17', action: 'dropped', player: 'Clayton Keller', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 17', action: 'dropped', player: 'Brady Tkachuk', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 17', action: 'dropped', player: 'Lucas Raymond', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 17', action: 'dropped', player: 'Mathieu Olivier', swap: 'Olivier -> Wilson', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 7', action: 'dropped', player: 'Jesper Bratt', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 7', action: 'dropped', player: 'Lucas Raymond', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 7', action: 'dropped', player: 'Robert Thomas', swap: 'Thomas -> Larkin', endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'October 7', action: 'activated', player: 'Brock Faber', swap: null, endOfSeasonSnapshot: false },
  { team: 'Colin', date: 'n/a', action: 'claimed', player: 'Justin Faulk', swap: 'Hronek -> Faulk', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Mark Stone', swap: null, endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Josh Morrissey', swap: null, endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Mitch Marner', swap: null, endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Tage Thompson', swap: null, endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Nico Hischier', swap: null, endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Quinn Hughes', swap: null, endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Noah Dobson', swap: null, endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Lukas Dostal', swap: null, endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Jack Hughes', swap: null, endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Moritz Seider', swap: null, endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Tim Stutzle', swap: null, endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Lane Hutson', swap: null, endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Connor Bedard', swap: null, endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Adrian Kempe', swap: 'Barkov -> Kempe', endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Pavel Dorofeyev', swap: 'Drai -> Dorofeyev', endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Matthew Schaefer', swap: 'LaCombe -> Schaefer', endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 17', action: 'activated', player: 'Ilya Sorokin', swap: 'Montembeault -> Sorokin', endOfSeasonSnapshot: true },
  { team: 'Kieran', date: 'April 11', action: 'activated', player: 'Josh Morrissey', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'April 10', action: 'dropped', player: 'Miro Heiskanen', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'April 4', action: 'activated', player: 'Pavel Dorofeyev', swap: 'Drai -> Dorofeyev', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'April 3', action: 'dropped', player: 'Cutter Gauthier', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'March 21', action: 'dropped', player: 'Leon Draisaitl', swap: 'Draisaitl -> Dorofeyev', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'March 21', action: 'activated', player: 'Mark Stone', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'March 20', action: 'dropped', player: 'Leon Draisaitl', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'March 20', action: 'dropped', player: 'Leon Draisaitl', swap: 'Draisaitl -> Dorofeyev', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'March 7', action: 'activated', player: 'Jack Hughes', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'March 6', action: 'dropped', player: 'Mark Stone', swap: 'Ehlers -> Stone', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'February 28', action: 'dropped', player: 'Miro Heiskanen', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'February 27', action: 'dropped', player: 'Josh Morrissey', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'January 24', action: 'dropped', player: 'Leon Draisaitl', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'January 24', action: 'activated', player: 'Ilya Sorokin', swap: 'Montembeault -> Sorokin', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'January 23', action: 'dropped', player: 'Jack Hughes', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'January 23', action: 'dropped', player: 'Samuel Montembeault', swap: 'Montembeault -> Sorokin', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'January 17', action: 'dropped', player: 'Jack Hughes', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'January 17', action: 'dropped', player: 'Cutter Gauthier', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'January 17', action: 'activated', player: 'Noah Dobson', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'January 16', action: 'dropped', player: 'Leon Draisaitl', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'January 16', action: 'dropped', player: 'Miro Heiskanen', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'January 16', action: 'dropped', player: 'Cutter Gauthier', swap: 'Cooley -> Gauthier', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'January 10', action: 'dropped', player: 'Samuel Montembeault', swap: 'Montembeault -> Sorokin', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'January 10', action: 'activated', player: 'Connor Bedard', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'January 9', action: 'dropped', player: 'Igor Shesterkin', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'January 9', action: 'dropped', player: 'Jack Hughes', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'December 27', action: 'activated', player: 'Moritz Seider', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'December 26', action: 'dropped', player: 'Noah Dobson', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'December 20', action: 'dropped', player: 'Jack Hughes', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'December 20', action: 'activated', player: 'Lukas Dostal', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'December 19', action: 'dropped', player: 'Samuel Montembeault', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'December 19', action: 'dropped', player: 'Connor Bedard', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'December 13', action: 'dropped', player: 'Cutter Gauthier', swap: 'Cooley -> Gauthier', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'December 13', action: 'activated', player: 'Tage Thompson', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'December 12', action: 'dropped', player: 'Elias Pettersson', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'December 12', action: 'dropped', player: 'Logan Cooley', swap: 'Cooley -> Gauthier', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'December 6', action: 'dropped', player: 'Samuel Montembeault', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'December 5', action: 'dropped', player: 'Lukas Dostal', swap: 'Hill -> Dostal', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 29', action: 'dropped', player: 'Mark Stone', swap: 'Ehlers -> Stone', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 28', action: 'dropped', player: 'Tage Thompson', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 22', action: 'dropped', player: 'Lukas Dostal', swap: 'Hill -> Dostal', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 22', action: 'activated', player: 'Quinn Hughes', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 21', action: 'dropped', player: 'Adin Hill', swap: 'Hill -> Dostal', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 21', action: 'dropped', player: 'Samuel Montembeault', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 21', action: 'dropped', player: 'Thomas Harley', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 20', action: 'dropped', player: 'Adin Hill', swap: 'Hill -> Dostal', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 15', action: 'dropped', player: 'Miro Heiskanen', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 15', action: 'dropped', player: 'Elias Pettersson', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 15', action: 'dropped', player: 'Jackson LaCombe', swap: 'LaCombe -> Schaefer', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 15', action: 'activated', player: 'Matthew Schaefer', swap: 'LaCombe -> Schaefer', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 14', action: 'dropped', player: 'Quinn Hughes', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 14', action: 'dropped', player: 'Moritz Seider', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 14', action: 'dropped', player: 'Jackson LaCombe', swap: 'LaCombe -> Schaefer', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 13', action: 'dropped', player: 'Jack Hughes', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 8', action: 'dropped', player: 'Quinn Hughes', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 7', action: 'dropped', player: 'Jackson LaCombe', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'November 1', action: 'dropped', player: 'Jackson LaCombe', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'October 31', action: 'dropped', player: 'Quinn Hughes', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'October 21', action: 'dropped', player: 'Nikolaj Ehlers', swap: 'Ehlers -> Stone', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'October 20', action: 'dropped', player: 'Nikolaj Ehlers', swap: 'Ehlers -> Stone', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'October 18', action: 'dropped', player: 'Samuel Montembeault', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'October 18', action: 'dropped', player: 'Logan Cooley', swap: 'Cooley -> Gauthier', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'October 18', action: 'activated', player: 'Adrian Kempe', swap: 'Barkov -> Kempe', endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'October 17', action: 'dropped', player: 'Nikolaj Ehlers', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'October 17', action: 'dropped', player: 'Adin Hill', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'October 17', action: 'dropped', player: 'Elias Pettersson', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'October 4', action: 'dropped', player: 'Nikolaj Ehlers', swap: null, endOfSeasonSnapshot: false },
  { team: 'Kieran', date: 'October 3', action: 'dropped', player: 'Aleksander Barkov', swap: 'Barkov -> Kempe', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'Dougie Hamilton', swap: null, endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'Mark Scheifele', swap: null, endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'Zach Hyman', swap: null, endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'Andrei Vasilevskiy', swap: null, endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'Darnell Nurse', swap: null, endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'William Nylander', swap: null, endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'Connor McDavid', swap: null, endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'Jack Eichel', swap: null, endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'Mikko Rantanen', swap: null, endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'Kyle Connor', swap: null, endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'Matthew Tkachuk', swap: null, endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'Charlie McAvoy', swap: null, endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'Nick Suzuki', swap: null, endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'Jake Oettinger', swap: null, endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'Shayne Gostisbehere', swap: 'McCabe -> Gostisbehere', endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'Roman Josi', swap: 'Rielly -> Josi', endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'April 17', action: 'activated', player: 'Mike Matheson', swap: 'Zadorov -> Matheson', endOfSeasonSnapshot: true },
  { team: 'Nick', date: 'March 28', action: 'activated', player: 'Mikko Rantanen', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'March 27', action: 'dropped', player: 'John Tavares', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'March 14', action: 'activated', player: 'Shayne Gostisbehere', swap: 'McCabe -> Gostisbehere', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'March 14', action: 'activated', player: 'Roman Josi', swap: 'Rielly -> Josi', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'March 14', action: 'activated', player: 'Mike Matheson', swap: 'Zadorov -> Matheson', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'March 13', action: 'dropped', player: 'Jake McCabe', swap: 'McCabe -> Gostisbehere', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'March 13', action: 'dropped', player: 'Morgan Rielly', swap: 'Rielly -> Josi', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'March 13', action: 'dropped', player: 'Nikita Zadorov', swap: 'Zadorov -> Matheson', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'February 28', action: 'dropped', player: 'John Tavares', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'February 27', action: 'dropped', player: 'Mikko Rantanen', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'January 10', action: 'activated', player: 'Dougie Hamilton', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'January 9', action: 'dropped', player: 'Adam Fox', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'January 3', action: 'dropped', player: 'Adam Fox', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'January 3', action: 'activated', player: 'Matthew Tkachuk', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'January 2', action: 'dropped', player: 'John Tavares', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'January 2', action: 'dropped', player: 'Dougie Hamilton', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'December 27', action: 'dropped', player: 'Morgan Rielly', swap: 'Rielly -> Josi', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'December 27', action: 'dropped', player: 'Nikita Zadorov', swap: 'Zadorov -> Matheson', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'December 27', action: 'activated', player: 'Andrei Vasilevskiy', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'December 26', action: 'dropped', player: 'Jeremy Swayman', swap: 'Michkov -> Swayman', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'December 26', action: 'dropped', player: 'Brandon Montour', swap: 'Montour -> Rielly', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'December 26', action: 'dropped', player: 'Shea Theodore', swap: 'Theodore -> Zadorov', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'December 13', action: 'dropped', player: 'Jeremy Swayman', swap: 'Michkov -> Swayman', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'December 13', action: 'dropped', player: 'Matvei Michkov', swap: 'Michkov -> Swayman', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'December 13', action: 'activated', player: 'Charlie McAvoy', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'December 12', action: 'dropped', player: 'Victor Hedman', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'December 12', action: 'dropped', player: 'Andrei Vasilevskiy', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'December 12', action: 'dropped', player: 'Matvei Michkov', swap: 'Michkov -> Swayman', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'December 6', action: 'dropped', player: 'Victor Hedman', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'December 5', action: 'dropped', player: 'Adam Fox', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'November 22', action: 'dropped', player: 'Jake McCabe', swap: 'McCabe -> Gostisbehere', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'November 22', action: 'dropped', player: 'Shea Theodore', swap: 'Theodore -> Zadorov', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'November 21', action: 'dropped', player: 'Victor Hedman', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'November 21', action: 'dropped', player: 'Charlie McAvoy', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'November 19', action: 'dropped', player: 'Aaron Ekblad', swap: 'Ekblad -> McCabe', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'November 18', action: 'dropped', player: 'Aaron Ekblad', swap: 'Ekblad -> McCabe', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'November 8', action: 'activated', player: 'Zach Hyman', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'November 7', action: 'dropped', player: 'Matvei Michkov', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'November 1', action: 'dropped', player: 'Dougie Hamilton', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'November 1', action: 'dropped', player: 'Matvei Michkov', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'October 31', action: 'dropped', player: 'Aaron Ekblad', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'October 31', action: 'dropped', player: 'Travis Konecny', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'October 18', action: 'dropped', player: 'John Tavares', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'October 18', action: 'dropped', player: 'Aaron Ekblad', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'October 18', action: 'dropped', player: 'Brandon Montour', swap: 'Montour -> Rielly', endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'October 17', action: 'dropped', player: 'Dougie Hamilton', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'October 17', action: 'dropped', player: 'Shea Theodore', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'October 17', action: 'dropped', player: 'Matvei Michkov', swap: null, endOfSeasonSnapshot: false },
  { team: 'Nick', date: 'October 4', action: 'dropped', player: 'Dougie Hamilton', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'Sidney Crosby', swap: null, endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'Sergei Bobrovsky', swap: null, endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'Nikita Kucherov', swap: null, endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'Filip Forsberg', swap: null, endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'Connor Hellebuyck', swap: null, endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'Jake Guentzel', swap: null, endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'David Pastrnak', swap: null, endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'Kirill Kaprizov', swap: null, endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'Mikhail Sergachev', swap: null, endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'Jakob Chychrun', swap: null, endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'Rasmus Dahlin', swap: null, endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'Cole Caufield', swap: null, endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'Jackson LaCombe', swap: null, endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'Jake Sanderson', swap: null, endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'Wyatt Johnston', swap: null, endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'Darren Raddysh', swap: 'Hughes -> Raddysh', endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 17', action: 'activated', player: 'Alex DeBrincat', swap: 'Marchand -> Debrincat', endOfSeasonSnapshot: true },
  { team: 'Patrick', date: 'April 11', action: 'activated', player: 'Jake Sanderson', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'April 10', action: 'dropped', player: 'MacKenzie Weegar', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'March 28', action: 'activated', player: 'Sidney Crosby', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'March 27', action: 'dropped', player: 'Brayden Point', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'March 21', action: 'activated', player: 'Cole Caufield', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'March 20', action: 'dropped', player: 'Sam Reinhart', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'March 14', action: 'dropped', player: 'Brayden Point', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'March 14', action: 'activated', player: 'Jackson LaCombe', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'March 14', action: 'activated', player: 'Alex DeBrincat', swap: 'Marchand -> Debrincat', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'March 13', action: 'dropped', player: 'Brad Marchand', swap: 'Marchand -> Debrincat', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'March 13', action: 'dropped', player: 'Jake Sanderson', swap: 'Sanderson => Lacombe', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'March 12', action: 'dropped', player: 'Cole Caufield', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'February 28', action: 'dropped', player: 'Brad Marchand', swap: 'Marchand -> Debrincat', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'February 28', action: 'activated', player: 'Connor Hellebuyck', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'February 27', action: 'dropped', player: 'Sidney Crosby', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'February 27', action: 'dropped', player: 'Spencer Knight', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'February 7', action: 'dropped', player: 'Spencer Knight', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'February 6', action: 'dropped', player: 'Connor Hellebuyck', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'January 31', action: 'dropped', player: 'Seth Jones', swap: 'Jones -> Trouba', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'January 30', action: 'dropped', player: 'Seth Jones', swap: 'Jones -> Trouba', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'January 17', action: 'activated', player: 'Filip Forsberg', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'January 15', action: 'dropped', player: 'Brad Marchand', swap: 'Carlsson -> Marchand', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'January 10', action: 'dropped', player: 'Connor Hellebuyck', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'January 10', action: 'dropped', player: 'Brad Marchand', swap: 'Carlsson -> Marchand', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'January 10', action: 'activated', player: 'Wyatt Johnston', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'January 10', action: 'activated', player: 'Darren Raddysh', swap: 'Hughes -> Raddysh', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'January 9', action: 'dropped', player: 'Filip Forsberg', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'January 9', action: 'dropped', player: 'Connor Hellebuyck', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'January 9', action: 'dropped', player: 'Leo Carlsson', swap: 'Carlsson -> Marchand', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'January 9', action: 'dropped', player: 'Jackson LaCombe', swap: 'Trouba -> Lacombe', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'January 7', action: 'dropped', player: 'Luke Hughes', swap: 'Hughes -> Raddysh', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'January 6', action: 'dropped', player: 'Luke Hughes', swap: 'Hughes -> Raddysh', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 27', action: 'dropped', player: 'Connor Hellebuyck', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 27', action: 'activated', player: 'Nikita Kucherov', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 26', action: 'dropped', player: 'Spencer Knight', swap: 'Demko -> Knight', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 26', action: 'dropped', player: 'Wyatt Johnston', swap: 'Malkin -> Johnston', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 20', action: 'dropped', player: 'Evgeni Malkin', swap: 'Malkin -> Johnston', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 20', action: 'dropped', player: 'Wyatt Johnston', swap: 'Malkin -> Johnston', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 20', action: 'dropped', player: 'Jackson LaCombe', swap: 'Trouba -> Lacombe', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 19', action: 'dropped', player: 'Nikita Kucherov', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 19', action: 'dropped', player: 'Evgeni Malkin', swap: 'Malkin -> Johnston', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 19', action: 'dropped', player: 'Jacob Trouba', swap: 'Trouba -> Lacombe', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 13', action: 'activated', player: 'David Pastrnak', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 12', action: 'dropped', player: 'Evgeni Malkin', swap: 'Ovi -> Malkin', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 6', action: 'dropped', player: 'Sam Reinhart', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 6', action: 'dropped', player: 'Spencer Knight', swap: 'Demko -> Knight', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 5', action: 'dropped', player: 'Connor Hellebuyck', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 5', action: 'dropped', player: 'David Pastrnak', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 2', action: 'dropped', player: 'Thatcher Demko', swap: 'Demko -> Knight', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'December 1', action: 'dropped', player: 'Thatcher Demko', swap: 'Demko -> Knight', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 22', action: 'dropped', player: 'Mike Matheson', swap: 'Matheson -> Trouba', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 22', action: 'dropped', player: 'Jacob Trouba', swap: 'Trouba -> Lacombe', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 22', action: 'activated', player: 'Rasmus Dahlin', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 21', action: 'dropped', player: 'Luke Hughes', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 21', action: 'dropped', player: 'Mike Matheson', swap: 'Carlson -> Matheson', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 19', action: 'dropped', player: 'Mike Matheson', swap: 'Matheson -> Trouba', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 8', action: 'dropped', player: 'Luke Hughes', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 8', action: 'dropped', player: 'Mike Matheson', swap: 'Carlson -> Matheson', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 8', action: 'dropped', player: 'Leo Carlsson', swap: 'Carlsson -> Marchand', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 8', action: 'dropped', player: 'J.T. Miller', swap: 'Miller -> Carlsson', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 8', action: 'dropped', player: 'Alex Ovechkin', swap: 'Ovi -> Malkin', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 8', action: 'dropped', player: 'Evgeni Malkin', swap: 'Ovi -> Malkin', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 7', action: 'dropped', player: 'Seth Jones', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 7', action: 'dropped', player: 'Sam Reinhart', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 7', action: 'dropped', player: 'Brayden Point', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 7', action: 'dropped', player: 'Rasmus Dahlin', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 7', action: 'dropped', player: 'J.T. Miller', swap: 'Miller -> Carlsson', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 7', action: 'dropped', player: 'Alex Ovechkin', swap: 'Ovi -> Malkin', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'November 1', action: 'activated', player: 'Mikhail Sergachev', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'October 31', action: 'dropped', player: 'Luke Hughes', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'October 28', action: 'dropped', player: 'John Carlson', swap: 'Carlson -> Matheson', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'October 28', action: 'dropped', player: 'John Carlson', swap: 'Carlson -> Matheson', endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'October 18', action: 'dropped', player: 'Luke Hughes', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'October 17', action: 'dropped', player: 'Mikhail Sergachev', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'October 4', action: 'dropped', player: 'Cole Caufield', swap: null, endOfSeasonSnapshot: false },
  { team: 'Patrick', date: 'n/a', action: 'claimed', player: 'Jacob Trouba', swap: 'Jones -> Trouba', endOfSeasonSnapshot: false },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Brent Burns', swap: null, endOfSeasonSnapshot: true },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Matt Duchene', swap: null, endOfSeasonSnapshot: true },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Brock Nelson', swap: null, endOfSeasonSnapshot: true },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Gabriel Landeskog', swap: null, endOfSeasonSnapshot: true },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Scott Wedgewood', swap: null, endOfSeasonSnapshot: true },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Josh Manson', swap: null, endOfSeasonSnapshot: true },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Nathan MacKinnon', swap: null, endOfSeasonSnapshot: true },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Valeri Nichushkin', swap: null, endOfSeasonSnapshot: true },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Artturi Lehkonen', swap: null, endOfSeasonSnapshot: true },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Devon Toews', swap: null, endOfSeasonSnapshot: true },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Jake Middleton', swap: null, endOfSeasonSnapshot: true },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Mackenzie Blackwood', swap: null, endOfSeasonSnapshot: true },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Cale Makar', swap: null, endOfSeasonSnapshot: true },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Martin Necas', swap: null, endOfSeasonSnapshot: true },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Victor Olofsson', swap: null, endOfSeasonSnapshot: true },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Jack Drury', swap: null, endOfSeasonSnapshot: true },
  { team: 'Tay', date: 'April 17', action: 'activated', player: 'Sam Malinski', swap: null, endOfSeasonSnapshot: true },
];

/**
 * Adapt a captured stat line to the shape the scoring engine consumes.
 * 'F' becomes 'C': the engine keys off exactly 'D' and 'G', so any other position
 * string exercises the same code path.
 */
export function toPlayerGameStats(line: HockeyDraftStatLine): PlayerGameStats {
  return {
    playerId: line.hdPlayerId,
    name: { default: line.name },
    teamAbbrev: line.nhlTeam,
    position: line.position === 'F' ? 'C' : line.position,
    goals: line.goals,
    assists: line.assists,
    shortHandedGoals: line.shortHandedGoals,
    overtimeGoals: line.overtimeGoals,
    fights: line.fights,
    blockedShots: line.blockedShots,
    hits: line.hits,
    wins: line.wins,
    shutouts: line.shutouts,
    saves: line.saves,
  };
}

/**
 * Reproduce hockeydraft.ca's display rounding: 1 decimal, round-half-to-even (the
 * .NET `Math.Round` default), e.g. 73.25 -> 73.2 and 79.15 -> 79.2. Binary float
 * noise is snapped away first so exact midpoints are still recognised as midpoints.
 */
export function toPublishedPrecision(value: number): number {
  const scaled = Number((value * 10).toPrecision(12));
  const lower = Math.floor(scaled);
  const remainder = scaled - lower;

  let rounded: number;
  if (remainder > 0.5) rounded = lower + 1;
  else if (remainder < 0.5) rounded = lower;
  else rounded = lower % 2 === 0 ? lower : lower + 1;

  return rounded / 10;
}
