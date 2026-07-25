# Codebase Audit — Code Quality, Stat Tracking, Security

**Date:** 2026-07-01
**Scope:** Whole repository (frontend `src/`, serverless `api/`, shared `packages/core/`, `functions/`, Firestore rules, CI).
**Method:** Full read of the scoring/live-stats/membership pipelines and security surface, cross-checked against the **live NHL API** (`api-web.nhle.com` boxscore for game 2025020947) to verify which stat fields actually exist.

---

## Executive summary

- **Stat tracking has one major, systemic gap:** 6 of the 13 configured scoring rules can never award points, because the daily scorer reads fields (`wins`, `shutouts`, goalie `goals`/`assists`, `shortHandedGoals`) that the NHL boxscore API does not return. Goalies effectively earn **saves only**. The unit tests pass because their fixtures fabricate these fields. Every league is affected (all leagues get `DEFAULT_SCORING_RULES`; there is no rules editor).
- **Security posture is fundamentally sound** — server-side token verification, admin checks, deny-by-default Firestore rules, secrets kept server-side, no XSS vectors. The real findings are second-order: creator **emails exposed** on world-readable league docs, **chat impersonation** (sender not bound to auth uid), **within-league sabotage** paths (any member can bench any player / tamper with draft state), and **non-cryptographic invite codes**.
- **Code quality is good in the core** (pure, dependency-injected, tested scoring modules in `packages/core/`) but there are **three divergent implementations of stats fetching/scoring**, a 726-line god component, several broken admin tools (401s, >500-op batches), and UI that displays data that can never be non-zero.

Severity legend: 🔴 High · 🟠 Medium · 🟡 Low · ⚪ Info/hardening

---

## Part 1 — Stat tracking vs. league rules

### 1.1 Verified NHL boxscore field inventory

Fetched live from `GET /v1/gamecenter/{id}/boxscore` (`playerByGameStats`):

- **Skaters:** `goals, assists, points, plusMinus, pim, hits, blockedShots, powerPlayGoals, sog, faceoffWinningPctg, shifts, giveaways, takeaways, toi`
  → there is **no `shortHandedGoals`** and **no `shots`** (it's `sog`).
- **Goalies:** `decision ('W'|'L'|'O'), goalsAgainst, saves, shotsAgainst, saveShotsAgainst ("17/22"), savePctg, pim, toi, starter` (+ EV/PP/SH splits)
  → there are **no `wins`, `shutouts`, `goals`, `assists`** fields.

### 1.2 Rule-by-rule audit (daily scoring pipeline)

Pipeline: `api/calculate-scores.ts` → `runDailyScoring` → `fetchDailyGameStats` → `aggregateDailyScores` → `calculatePlayerPoints` (`packages/core/scoring/scoringMath.ts`).

| Rule | Value | Works? | Why |
|---|---|---|---|
| `goal` | 1 | ✅ | `goals` present in boxscore |
| `assist` | 1 | ✅ | `assists` present |
| `fight` | 2 | ✅ | Derived from play-by-play `descKey === 'fighting'` (`fetchDailyGameStats.ts:27-50`) |
| `blockedShot` (D only) | 0.15 | ✅ | `blockedShots` present |
| `hit` (D only) | 0.1 | ✅ | `hits` present |
| `save` | 0.04 | ✅ | `saves` present |
| `goalieFight` | 5 | ✅ | Play-by-play covers goalies too |
| `shortHandedGoal` | +1 | ❌ **Never scores** | Boxscore has no `shortHandedGoals` field; `scoringMath.ts:39` always multiplies `undefined→0`. (PBP or `/landing` data would be needed.) |
| `overtimeGoal` | +1 | ❌ **Never scores** | Acknowledged in code comments (`types.ts:5-7`, `scoringMath.ts:40-41`) — but still advertised in the UI and docs (see 1.5) |
| `win` | 1 | ❌ **Never scores** | No `wins` field; must be derived from `decision === 'W'`. Nothing in the daily pipeline does this. `scoringMath.ts:58` gets `undefined` |
| `shutout` | 2 | ❌ **Never scores** | No `shutouts` field; must be derived from `goalsAgainst === 0` + played-full-game. Not done. `scoringMath.ts:59` |
| `goalieAssist` | 1 | ❌ **Never scores** | Goalie boxscore entries have no `assists` field. `scoringMath.ts:61` |
| `goalieGoal` | 20 | ❌ **Never scores** | Goalie boxscore entries have no `goals` field. `scoringMath.ts:62` |

**Impact:** a starting goalie is shorted ~1–3 pts on most starts (win + potential shutout). Over a season that's roughly **40–70 points per team with a workhorse goalie** — easily enough to change standings. Teams that drafted goalie-heavy are systematically penalized. SH-goal specialists lose their bonus.

**Why tests didn't catch it:** `packages/core/scoring/scoringMath.test.ts:73-92` and `aggregateDailyScores.test.ts:29,108` construct players with `wins: 1, shutouts: 1` — fields the real API never returns. The math is correct; the **data contract is fictional**. A derivation step exists in the codebase but only in the unrelated `api/fetch-daily-stats.ts:119-134` (`decision === 'W'`, `goalsAgainst === 0`) — evidence the requirement was known.

**Recommended fix (small, contained):** normalize goalie entries in `getAllPlayersFromBoxscore` (`api/_lib/nhl/webClient.ts:88`) — set `wins = decision === 'W' ? 1 : 0`, `shutouts = (decision && goalsAgainst === 0 && saves > 0) ? 1 : 0`. Then either implement SHG via play-by-play (same pass as fights) or remove SHG/OTG/goalie-goal/goalie-assist from the rules shape **and the UI**. Add one test fixture copied verbatim from a real boxscore response.

### 1.3 Live-stats pipeline discrepancies

Two parallel implementations exist: server (`api/_lib/live-stats/processLiveStats.ts`) and a still-active client copy (`src/utils/liveStats.ts`, 351 lines). Both share these issues:

| # | Issue | Location |
|---|---|---|
| L1 | **Fights counted as `Math.floor(pim / 5)`** in live view vs. play-by-play parsing in official scoring. A 5-min boarding major or a 10-min misconduct shows as 1–2 "fights" live, then scores 0 at night. | `processLiveStats.ts:214`, `liveStats.ts:261` |
| L2 | `wins`/`shutouts` read from nonexistent boxscore fields → **always 0** in live view (W column is dead UI). | `processLiveStats.ts:215-217` |
| L3 | **`points` means NHL points (G+A) for today but fantasy points for past dates.** `useLiveStatsData` maps historical `playerDailyScores.points` (fantasy) into the same field the live path fills with `goals+assists`. Same column, two meanings; sorting and "+X.XX Pts" badges are inconsistent across dates. | `useLiveStatsData.ts:106` vs `processLiveStats.ts:210` |
| L4 | `TeamStatsTables` filters `points > 0`, where today's `points` = G+A → **goalies never appear in today's tables** even with 40 saves (their G+A is 0), though they do appear for historical dates. | `TeamStatsTables.tsx:23` |
| L5 | `fights` is **not** in `TRACKED_STAT_KEYS`, so historical rows always show F = 0 even when a fight was scored. `shots` is also never persisted because the API field is `sog`. | `aggregateDailyScores.ts:21-31` |
| L6 | **No trigger in production:** `vercel.json` has no cron for `/api/live-stats` (documented in `docs/LIVE_STATS.md`). The de-facto refresher is `useLiveStatsRefresh`, which runs the client `processLiveStats` in **every member's browser every 5 minutes** — but Firestore rules only allow the **admin** to write `liveStats`, so every non-admin browser fails with `permission-denied` on every cycle, silently (`console.error` only). Live stats only actually update while the admin has the page open. | `useLiveStatsRefresh.ts:31-60`, `firestore.rules:65-68` |

### 1.4 `fetch-daily-stats` (nhl_daily_stats cache) is corrupt for goalies

`api/fetch-daily-stats.ts` (powers "Hot Pickups"):

- **Line 120: `points += (g.saveShotsAgainst || 0) * save`** — `saveShotsAgainst` is a *string* (`"17/22"`); `"17/22" * 0.04` is `NaN`, which poisons the accumulator, so **every goalie's `fp` in `nhl_daily_stats` is `NaN`** (line 124 then also adds saves a second time — a double count that the NaN happens to mask).
- Downstream, `waiverWireService.ts:85` does `existing.points += player.fp ?? 0` — `??` doesn't catch `NaN`, so goalie totals stay `NaN` and goalies are silently filtered out of Hot Pickups.
- Uses `DEFAULT_SCORING_RULES` (fair for a global cache, but it's a third, divergent scoring implementation — see Part 3).

### 1.5 Rules the UI promises but the engine ignores

`Standings.tsx:382-455` renders the scoring-rules panel from `league.scoringRules`, including **SH Goal, OT Goal, Win, Shutout, Goalie Goal** — five values that never score (see 1.2). `docs/SCORING.md` also documents OT/SH bonuses and says "Goalie wins/shutouts are calculated based on game outcome," which is only true of the orphaned `fetch-daily-stats` path. The Standings player table's **W and SO columns** (`Standings.tsx:280-282`) can never be non-zero.

Also: `Standings.tsx:66` comment says "last 7 days" but the query has **no limit** — it downloads the entire season's `playerDailyScores` collection on every page view (see Part 3, Q4).

### 1.6 What's working well

- Idempotency via `processedDates` + increment-based team totals (`scoreLeagueForDate.ts:131-134,226`).
- Per-league failure isolation and a single hoisted NHL fetch shared across leagues (`runDailyScoring.ts`).
- `allowedGameTypes` filtering in both daily and live paths (the Feb 2026 Olympic-points incident that `scripts/remove-olympic-points.mjs` cleaned up is now guarded against).
- Reserve players correctly excluded from scoring; Saturday roster-swap application is scoped per league (`applyRosterSwaps.ts`). *(Note: "Saturday" is evaluated in the server's timezone — UTC on Vercel — so swaps apply during the 5:00 UTC Saturday run, i.e. when Friday's games are scored. Saturday games count with the new roster. Worth documenting as intended.)*
- Timezone handling (`packages/core/dates/dateUtils.ts`) is correct and well-tested ("hockey day" cutoff, NY-timezone date math).

---

## Part 2 — Security review

### Trust model (correctly implemented where it matters)

Server endpoints verify Firebase ID tokens via Admin SDK (`api/_lib/userAuth.ts`, `adminAuth.ts` checks `leagues/{id}.admin` server-side); cron routes require `CRON_SECRET`; the service-account key and cron secret are server-only env vars (never `VITE_`); invite codes live in an Admin-SDK-only collection (`firestore.rules:145-147`) so they can't be enumerated; membership changes are transactional. No `dangerouslySetInnerHTML`/`eval` anywhere in `src/`. Global headers set `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`.

### Findings

#### S1 🟠 PII exposure: owner emails on world-readable league docs
- **Where:** `src/components/leagues/CreateLeague.tsx:31` (`ownerEmail: user.email`), `LeagueSettings.tsx:48-51,142`; readable because `firestore.rules:33` allows **any signed-in user** to read any league doc (needed for public browse).
- **Exploit:** any person with a Google account signs in, runs one `getDocs(collection('leagues'))` query from the console, and harvests every league creator's email address (plus league membership graphs via `memberUids`).
- **Fix:** stop writing `ownerEmail` (invite codes/join requests already made it obsolete — the "Your Identity" UID card was removed for the same reason). If needed for admin display, move it to `leagues/{id}/private/`. Migrate existing docs.

#### S2 🟠 Chat impersonation: sender identity not bound to auth
- **Where:** `firestore.rules:84` (`allow create: if isInLeague(...) && !isChatBanned(...)`) — no field validation; `chatService.ts:52-58` sets `userId`/`userName` client-side.
- **Exploit:** any league member writes a `chatMessages` doc with another member's `userId`/`userName` (and any `createdAt`, enabling backdating). Moderation (chat bans, admin deletes) then targets the wrong person.
- **Fix:** `allow create: if isInLeague(leagueId) && !isChatBanned(leagueId) && request.resource.data.userId == request.auth.uid;` (optionally validate `createdAt == request.time` and a max `text` size).

#### S3 🟠 Within-league sabotage: any member can bench any team's players
- **Where:** `firestore.rules:122-125` — `draftedPlayers` update allowed for **any league member** (only restricts *which keys* may change: `rosterSlot`, `pendingSlot`, `lastSwapDate`).
- **Exploit:** a rival member sets your star players' `rosterSlot` to `'reserve'`; daily scoring counts **active players only** (`helpers.ts:24-39`), so your team silently scores 0 for them. Nearly invisible — no audit trail.
- **Fix:** store the owner's `ownerUid` on each `draftedPlayers` doc at draft time and require `resource.data.ownerUid == request.auth.uid` (or league admin) for updates.

#### S4 🟠 Draft integrity relies on client honesty
- **Where:** `firestore.rules:130-133` (`drafts/{leagueId}` create/update by any member) and `firestore.rules:112-114` (`draftedPlayers` create by any member, arbitrary fields).
- **Exploit:** a member can advance `currentPickNumber` (skipping rivals' picks), set `isComplete`, rewrite `draftOrder`, or directly `create` drafted-player docs out of turn / for any team (client draft logic enforces turn order, rules don't).
- **Assessment:** inherent to the client-driven draft design; members are semi-trusted. Flagged so it's a *known* tradeoff. Longer-term fix: route picks through a server endpoint (like join/leave already are) or add turn validation in rules against the draft doc.

#### S5 🟠 Invite codes generated with `Math.random()`
- **Where:** `api/_lib/membership/inviteCode.ts:5` (used server-side by `rotateInvite`).
- **Risk:** V8's PRNG is predictable once its state is recovered; codes generated in the same serverless isolate can become guessable. Codes are the **only** gate to joining a private league (`/api/join-league` accepts any authenticated user with a valid code).
- **Fix:** one-liner — `crypto.randomBytes`/`crypto.getRandomValues` mapped onto the existing alphabet. (8 chars over a 31-char alphabet ≈ 39.6 bits is otherwise adequate against online guessing.)

#### S6 🟡 User-controlled team names become Firestore document IDs
- **Where:** `scoreLeagueForDate.ts:155,178,207` (`teamScores/{teamName}`, `aggregates/{teamName}`); team names enter via `/api/join-league` (`join-league.ts:14` — 40-char cap, **no charset check**), via the admin Teams editor (`LeagueSettings.tsx:534-541` — no validation), and via join requests (`joinRequestService.ts:22-28` — **no length cap**; `approveJoinRequest` copies it verbatim).
- **Exploit/impact:** a team name containing `/`, or equal to `.`/`..`, or matching `__.*__` makes `db.doc(...)` throw inside `persistDailyScores` → **the entire league's nightly scoring fails** every night until the name is fixed. A malicious joiner can do this to any league they can join; it also breaks accidentally.
- **Fix:** validate `^[\w ..-]{1,40}$`-style charset at every entry point (server + rules), or better, key `teamScores`/`aggregates` by team index/owner uid instead of display name (also fixes the rename-orphaning problem, Q11).

#### S7 🟡 Unauthenticated compute path on `fetch-daily-stats`
- **Where:** `api/fetch-daily-stats.ts:11-15` — `allowQueryBypass: { param: 'returnOnly' }` lets **anyone** unauthenticated trigger the full NHL fetch+compute (no Firestore write in that mode).
- **Assessment:** exposes only public NHL data; main cost is compute/quota abuse. Nothing uses this mode anymore (the client can't write `nhl_daily_stats`, and `BackfillStats` doesn't pass it).
- **Fix:** delete the bypass and the `returnOnly` branch.

#### S8 ⚪ Hardening / design notes (no concrete exploit)
- No `Content-Security-Policy` or `Strict-Transport-Security` headers (`vercel.json:2-11`).
- `CRON_SECRET` compared with `===` (`routeAccess.ts:60`) — not constant-time (theoretical).
- League **create** rule (`firestore.rules:37-39`) lets a creator put arbitrary UIDs into `memberUids`/`teams`, injecting their league into any victim's "My Leagues" list (annoyance/harassment vector; also grants the victim member-level access to that league).
- One global `DISCORD_WEBHOOK_URL` for all leagues (`functions/src/index.ts:116`) — every league's draft pings go to a single Discord channel; content (`teamName`, `discordId`) is user-influenced. Single-league-era leftover.
- `chatMessages` have no size validation (1 MB doc spam possible).
- Firestore rules deny-by-default catch-all is present and correct (`firestore.rules:150`). Remember rule deploys are manual: `firebase deploy --only firestore:rules`.

---

## Part 3 — Code quality

### Strengths worth preserving

- **`packages/core/` is exemplary:** pure functions, injected dependencies (`ScoreLeagueDeps`, `RosterSwapDeps`, `JoinLeagueDeps`), exhaustive small tests, shared between client and server without drift (`src/utils/scoringMath.ts` is a clean re-export).
- Solid CI gate (lint → typecheck app+api → tests → build app + functions).
- Route-level code splitting with retry (`App.tsx:17-22`, `lazyWithRetry`), error-boundary component present, react-virtuoso available for long lists.
- Consistent design system usage; date/timezone logic centralized and tested.

### Issues (highest value first)

| # | Issue | Where | Recommendation |
|---|---|---|---|
| Q1 | **Three divergent stats/scoring implementations:** server live-stats, legacy client live-stats (351 lines, still wired into `useLiveStatsRefresh`), and `fetch-daily-stats`'s inline scoring. They already disagree (fights heuristic, NaN bug, default vs league rules). | `api/_lib/live-stats/`, `src/utils/liveStats.ts`, `api/fetch-daily-stats.ts` | Delete the client `processLiveStats`; have the LiveStats page trigger the server endpoint (admin ID token, like Test Scoring) or accept staleness. Rewrite `fetch-daily-stats` on top of `packages/core` scoring. |
| Q2 | **Test fixtures don't match the real API contract** — the root cause of the Part 1 failures going unnoticed. | `scoringMath.test.ts`, `aggregateDailyScores.test.ts` | Add a checked-in fixture captured from a real boxscore response; test `getAllPlayersFromBoxscore` → `calculatePlayerPoints` end-to-end against it. |
| Q3 | **Broken admin tools:** `BackfillStats` calls `/api/fetch-daily-stats` with no auth header → 401 in production (`BackfillStats.tsx:13`). `TestScoring` "Clear Scores" puts *all* docs in a single `writeBatch` — Firestore caps batches at 500 ops, so it throws once a season has >500 score docs (`TestScoring.tsx:85-120`). | admin components | Send the admin ID token (and accept admin tokens on that route, as `calculate-scores` does); chunk deletes by 500 (the Olympic script at `scripts/remove-olympic-points.mjs:170` already does this correctly) or move clearing server-side. |
| Q4 | **Unbounded reads:** Standings fetches the entire `playerDailyScores` collection (comment claims 7 days, `Standings.tsx:66-72`) and re-aggregates client-side even though the `aggregates` collection exists for exactly this. | `Standings.tsx` | Read `aggregates` (as Dashboard does) or add `limit()`/date filter. |
| Q5 | **`LeagueSettings.tsx` god component (726 lines):** create+update forms, 4 tabs, invite management, join requests, and a ~150-line auto-draft algorithm with inline NHL fetching. Also `draftRounds` uses raw `parseInt` (NaN if field cleared), reserve cap hardcoded to 5 ignoring `rosterSettings.reserves` (`LeagueSettings.tsx:282`), and the Teams tab still has legacy "Paste UID here" fields that bypass the invite/join flow. | `LeagueSettings.tsx` | Extract auto-draft into a service; split tabs into components; remove the manual-UID editor. |
| Q6 | **Team identity keyed by mutable display name** across `draftedPlayers.draftedByTeam`, `teamScores/{teamName}`, `aggregates/{teamName}`, chat, matchups. Admin rename (Teams tab) silently orphans all history. | schema-wide | Introduce a stable team id (slot index or owner uid); migrate display name to a field. Related to S6. |
| Q7 | **Fabricated UI data:** `percentRostered: Math.random()*40+10` shown to users as real (`waiverWireService.ts:101,126`); headshot URLs hardcode the `20242025` season (stale in 2026). | `waiverWireService.ts` | Compute real rostered % (drafted count / league count) or drop the stat; derive season string. |
| Q8 | **Async listener leak:** `useLiveStatsData` assigns `unsubscribe` after an await; unmount before resolution leaks the Firestore listener (`useLiveStatsData.ts:72-75`). Same-file: `console.log` on every snapshot in production. | `useLiveStatsData.ts` | Track a `cancelled` flag in the effect and unsubscribe on late resolution. |
| Q9 | **Silent permission-denied as a control-flow pattern** — non-admin live-stats writes (L6), `createLeague`'s invite-code failure swallowed (`leagueService.ts:92-96` → league exists with no invite code and only a console.error). | various | Surface errors to the UI (toast) and gate admin-only writes behind `isAdmin` checks client-side so they aren't attempted at all. |
| Q10 | **Dev-console globals via side-effect import:** `import '../utils/updateLeague'` in Standings attaches `window.addScoringRulesToLeague`, which *resets* a league's rules to defaults — referenced by TestScoring's help text as the official remedy. | `Standings.tsx:18`, `updateLeague.ts:31` | Replace with an admin-tab button (rules already restrict to admin); delete the global. |
| Q11 | Minor: `league-${Date.now()}` ids (collision-prone in principle; ids leak creation time), emoji-heavy `console.log` noise throughout production server code, `api/fetch-daily-stats.ts` full of `any`, `resolveJoinTarget` claim-vs-`teamName` overwrite semantics undocumented. | various | Opportunistic cleanup. |

---

## Prioritized action list

**P0 — league fairness / correctness (small diffs, big impact)**
1. Derive goalie `wins`/`shutouts` in `getAllPlayersFromBoxscore` from `decision`/`goalsAgainst` (server + shared type note); backfill-rescore affected dates if desired (Clear Scores + re-run per date already supports this).
2. Decide SHG/OTG/goalie-goal/goalie-assist: implement via play-by-play or remove from `ScoringRules`, `Standings` UI, and `docs/SCORING.md`.
3. Add a real-boxscore test fixture so the contract can't silently regress (Q2).

**P1 — security**
4. Bind chat `userId` to `request.auth.uid` in rules (S2).
5. Restrict `draftedPlayers` roster-slot updates to the owning member (S3).
6. Stop writing `ownerEmail` to league docs; migrate existing data (S1).
7. `crypto.randomBytes` for invite codes (S5); validate team-name charset/length at all entry points (S6).

**P2 — consolidation & tooling**
8. Remove the client live-stats writer; single server implementation with a real trigger (cron or admin-token endpoint) (L6/Q1).
9. Fix `fetch-daily-stats` NaN + auth, and the two broken admin tools (1.4, Q3, S7).
10. Fix mixed points semantics + dead columns in live-stats UI (L3/L4); add `fights` to `TRACKED_STAT_KEYS` and map `sog`→`shots` (L5).

**P3 — structure**
11. Stable team ids (Q6/S6), LeagueSettings split (Q5), Standings reads from aggregates (Q4), CSP/HSTS headers (S8).
