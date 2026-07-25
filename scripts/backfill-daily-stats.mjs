#!/usr/bin/env node

/**
 * Re-populate the global `nhl_daily_stats` cache (the one behind "Hot Pickups")
 * over a date range, through the DEPLOYED /api/fetch-daily-stats endpoint so the
 * fixed engine runs rather than a local copy.
 *
 * Written for the 2026-07 goalie fix: `saveShotsAgainst` is a string ("17/22"),
 * so multiplying it by the save rate produced NaN and every goalie's `fp` in
 * this cache was NaN. `??` does not catch NaN downstream, so goalies silently
 * vanished from Hot Pickups. Documents written before that fix need replaying.
 *
 * Usage:
 *   node scripts/backfill-daily-stats.mjs --from 2025-10-07 --to 2026-04-16
 *   node scripts/backfill-daily-stats.mjs --from 2025-10-07 --to 2026-04-16 --commit
 *
 * Environment:
 *   CRON_SECRET - the deployed app's cron secret (required for --commit)
 *   BASE_URL    - deployed app origin (default https://fantasy-hockey-draft.vercel.app)
 *   BACKFILL_DELAY_MS - pause between dates (default 1500)
 *
 * Notes:
 * - SAFE TO RE-RUN. Each date overwrites a single `nhl_daily_stats/{date}`
 *   document, so unlike rescore-season.mjs there is nothing to clear first and
 *   no double-counting risk if a run dies partway. Just run it again.
 * - This cache is global, not per-league. It does not touch any league's
 *   standings, team scores or rosters — only the free-agent trend data.
 * - Dates with no completed games are reported as "no games" and skipped; that
 *   is expected across the all-star break and off days.
 * - Each date triggers a boxscore fetch per game, so keep the pace gentle.
 */

const args = process.argv.slice(2);
const commitMode = args.includes('--commit');

function flag(name) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
}

const from = flag('--from');
const to = flag('--to');
const baseUrl = process.env.BASE_URL || 'https://fantasy-hockey-draft.vercel.app';
const cronSecret = process.env.CRON_SECRET;
const delayMs = Number(process.env.BACKFILL_DELAY_MS) || 1500;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

if (!from || !to || !DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
  console.error('Usage: node scripts/backfill-daily-stats.mjs --from YYYY-MM-DD --to YYYY-MM-DD [--commit]');
  process.exit(1);
}
if (from > to) {
  console.error(`Error: --from (${from}) is after --to (${to}).`);
  process.exit(1);
}
if (commitMode && !cronSecret) {
  console.error('Error: CRON_SECRET is required in --commit mode.');
  process.exit(1);
}

/** Inclusive YYYY-MM-DD range, stepped in UTC so DST never skips or repeats a day. */
function datesInRange(startStr, endStr) {
  const dates = [];
  const end = new Date(`${endStr}T00:00:00Z`);
  for (let d = new Date(`${startStr}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dates = datesInRange(from, to);

console.log(`Backfill nhl_daily_stats`);
console.log(`  target : ${baseUrl}`);
console.log(`  range  : ${from} .. ${to} (${dates.length} dates)`);
console.log(`  pace   : ${delayMs}ms between dates`);
console.log(`  mode   : ${commitMode ? 'COMMIT — will overwrite cached documents' : 'DRY RUN — no requests sent'}`);
console.log('');

if (!commitMode) {
  console.log('Dry run. Dates that would be replayed:');
  console.log(dates.join(' '));
  console.log('\nRe-run with --commit to execute.');
  process.exit(0);
}

let updated = 0;
let noGames = 0;
const failures = [];

for (const [index, date] of dates.entries()) {
  const position = `[${index + 1}/${dates.length}]`;

  try {
    const response = await fetch(
      `${baseUrl}/api/fetch-daily-stats?date=${encodeURIComponent(date)}`,
      { headers: { Authorization: `Bearer ${cronSecret}` } },
    );
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      failures.push({ date, reason: body.error || body.message || `HTTP ${response.status}` });
      console.log(`${position} ${date}  FAILED  ${body.error || body.message || response.status}`);
    } else if (body.success) {
      updated++;
      console.log(`${position} ${date}  ok      ${body.playerCount ?? '?'} players`);
    } else {
      noGames++;
      console.log(`${position} ${date}  skip    ${body.message || 'no completed games'}`);
    }
  } catch (error) {
    failures.push({ date, reason: error.message });
    console.log(`${position} ${date}  FAILED  ${error.message}`);
  }

  if (index < dates.length - 1) await sleep(delayMs);
}

console.log('');
console.log(`Done. ${updated} date(s) rewritten, ${noGames} with no games, ${failures.length} failed.`);

if (failures.length > 0) {
  console.log('\nFailed dates (safe to re-run — each date overwrites one document):');
  for (const failure of failures) console.log(`  ${failure.date}  ${failure.reason}`);
  process.exit(1);
}
