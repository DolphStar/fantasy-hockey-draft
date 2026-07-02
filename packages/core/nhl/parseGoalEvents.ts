/**
 * Parses the NHL `gamecenter/{id}/landing` goal summary into per-player counts
 * the boxscore does not provide: SH goals, OT goals, and (for goalies) goals
 * and assists. Shootout periods are excluded — shootout goals never score.
 */

export interface GoalEventStats {
  goals: number;
  assists: number;
  shortHandedGoals: number;
  overtimeGoals: number;
}

interface LandingGoal {
  playerId?: number;
  strength?: string;
  assists?: { playerId?: number }[];
}

interface LandingPeriod {
  periodDescriptor?: { periodType?: string };
  goals?: LandingGoal[];
}

const emptyStats = (): GoalEventStats => ({
  goals: 0,
  assists: 0,
  shortHandedGoals: 0,
  overtimeGoals: 0,
});

export function parseGoalEvents(landing: unknown): Map<number, GoalEventStats> {
  const byPlayer = new Map<number, GoalEventStats>();

  const periods =
    ((landing as { summary?: { scoring?: LandingPeriod[] } })?.summary?.scoring ?? []);

  const bump = (playerId: number | undefined, apply: (s: GoalEventStats) => void) => {
    if (!playerId) return;
    const stats = byPlayer.get(playerId) ?? emptyStats();
    apply(stats);
    byPlayer.set(playerId, stats);
  };

  for (const period of periods) {
    if (period?.periodDescriptor?.periodType === 'SO') continue;
    const isOvertime = period?.periodDescriptor?.periodType === 'OT';

    for (const goal of period?.goals ?? []) {
      bump(goal.playerId, (s) => {
        s.goals += 1;
        if (goal.strength === 'sh') s.shortHandedGoals += 1;
        if (isOvertime) s.overtimeGoals += 1;
      });
      for (const assist of goal.assists ?? []) {
        bump(assist.playerId, (s) => {
          s.assists += 1;
        });
      }
    }
  }

  return byPlayer;
}
