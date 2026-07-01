/**
 * Derives goalie win/shutout counts from boxscore fields. The NHL boxscore has
 * no `wins`/`shutouts` fields — only `decision` ('W'|'L'|'O') and `goalsAgainst`.
 *
 * Known deviation from the official NHL rule: when two goalies share a 0-GA game,
 * the NHL credits neither with a shutout; we credit the decision goalie. Shared
 * shutouts are rare enough that this is an accepted simplification.
 */

export function deriveGoalieWin(decision: string | undefined): number {
  return decision === 'W' ? 1 : 0;
}

export function deriveGoalieShutout(goalie: {
  decision?: string;
  goalsAgainst?: number;
  saves?: number;
}): number {
  const facedShots = (goalie.saves ?? 0) > 0;
  return goalie.decision !== undefined && goalie.goalsAgainst === 0 && facedShots ? 1 : 0;
}
