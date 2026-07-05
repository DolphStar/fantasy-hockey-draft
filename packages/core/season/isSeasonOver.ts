const IDLE_DAYS_REQUIRED = 14;
const OFF_SEASON_FIRST_MONTH = 4; // May (0-indexed UTC months)
const OFF_SEASON_LAST_MONTH = 8;  // September

/**
 * A league's season counts as over when it has been idle for 14+ days AND the
 * current date is in the May–September off-season window. The window guard
 * keeps long in-season breaks (Olympics, All-Star) from ending seasons early.
 */
export function isSeasonOver(now: Date, lastActivityDate: string | null): boolean {
  if (!lastActivityDate) return false;

  const month = now.getUTCMonth();
  if (month < OFF_SEASON_FIRST_MONTH || month > OFF_SEASON_LAST_MONTH) return false;

  const last = new Date(`${lastActivityDate}T00:00:00Z`);
  const idleDays = (now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000);
  return idleDays >= IDLE_DAYS_REQUIRED;
}
