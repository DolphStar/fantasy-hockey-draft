# Scoring parity vs. hockeydraft.ca — "Esports Hockey" 2025-26

**Date:** 2026-07-24
**Question:** does this project award the same points a real, completed pool awarded, under the same rules?
**Answer:** yes — 143/143 player-seasons match exactly, and the one team whose season is independently reproducible matches to the cent.

**Artifacts**

| File | What it is |
|---|---|
| `packages/core/scoring/__fixtures__/hockeydraft-2025-26.ts` | Golden data: 143 draft picks, 110 roster slots, 337 transactions, final standings |
| `api/_lib/scoring/hockeydraftParity.test.ts` | 22 parity tests built on that fixture |

---

## 1. Where the data came from, and which numbers are trustworthy

Three pages of the completed pool were captured:

- **`draft_recap.aspx`** — every pick with its **full-season** stat line and hockeydraft.ca's own
  points for that line, computed **independently of roster history**.
- **`view_draft.aspx`** — end-of-season rosters (17 active + 5 reserve per team) and final standings.
- **`transactions_view.aspx`** — 337 rows of the season transaction log.

The critical distinction, and the thing that makes this comparison possible at all:

> hockeydraft.ca prints **two different "Points" numbers for the same player.**
> The **Draft Recap** number is a pure function of the season stat line — a valid oracle.
> The **Pool Stats** number is points banked *while on that team's active roster* — a function of
> the entire transaction history plus day-by-day stat splits the site never exposes.

Comparing against the Pool Stats column would have produced dozens of phantom "bugs." Matt Boldy,
for example, shows **85.0** on Pool Stats but **90.0** on the Recap; the 5-point gap is roster time,
not arithmetic. All parity assertions use the Recap column.

## 2. The rule sheet is implemented exactly

Every value in `packages/core/scoring/defaults.ts` matches the league rules as stated, with no
interpretation drift:

| Rule | League | `DEFAULT_SCORING_RULES` |
|---|---|---|
| Goal / Assist / SH goal / OT goal | 1 / 1 / +1 / +1 | ✅ identical |
| Fight (skater) | 2 | ✅ |
| Blocked shot / Hit — **defense only** | 0.15 / 0.1 | ✅ |
| Goalie win / shutout / save | 1 / 2 / 0.04 | ✅ |
| Goalie assist / goal / fight | 1 / 20 / 5 | ✅ |

Two rule *interpretations* were confirmed against real data rather than assumed:

- **SH and OT goals are bonuses stacked on top of the goal**, not replacements. Alex Tuch
  (33 G, 33 A, 3 SHG, 1 OTG, 1 fight) scores 72 both here and there.
- **Forwards earn nothing for hits or blocks.** Alex Ovechkin's 134 hits and 16 blocks are worth
  exactly 0; Mathieu Olivier's 209 hits are worth 0 while his 9 fights are worth 18.

## 3. Results

### 143/143 player-seasons match

Every drafted player — forwards, defense, goalies, a fully-injured player at 0.0, and players
re-acquired in later rounds — reproduces hockeydraft.ca's published total exactly.

One capture detail worth recording: hockeydraft.ca displays to 1 decimal with **round-half-to-even**
(the .NET `Math.Round` default), so 73.25 prints as 73.2 while 79.15 prints as 79.2. The fixture's
`toPublishedPrecision` reproduces this. It affects display only — never stored values.

### End-to-end season match, to the cent

**Tay made zero in-season transactions** (confirmed from the log: 0 moves, versus 49–76 for everyone
else). Their final 17 held from opening night, so their published season total should fall straight
out of our engine applied to those 17 season lines:

```
this project:      1053.87
hockeydraft.ca:    1053.87   ✅
```

This is the strongest single result in the suite. It exercises the rule set, position gating,
reserve exclusion and floating-point accumulation across a full season simultaneously.

The other four teams **cannot** be reproduced from season totals, and the suite asserts that they
don't match — the gap is roster history, not scoring. Only 4–11 of each of those teams' 17 actives
banked their full-season line; Tay's ratio is 17/17.

### Roster handling matches

All five teams finished at exactly **9 F / 6 D / 2 G active + 5 reserves**. Run through the real
`buildActivePlayerToTeamMap` → `aggregateDailyScores` path, 85 players score and 25 are benched.
Sebastian Aho's 84 points of production sat on Tay's bench and correctly counted for nothing.

### Daily scoring is provably equivalent to season scoring

The comparison only works because our engine scores day by day while the oracle scores one season
line. That equivalence holds because every rule is `count × weight` with per-player position
gating, making the scoring function linear in the stats. This is now asserted directly, so if a
non-linear rule is ever added (a hat-trick bonus, a per-game cap), that test fails first and flags
that the parity suite has stopped being meaningful.

## 4. What this does *not* prove

- **`goalieGoal` (20 pts) is unvalidated by real data.** No goalie scored in 2025-26, so 12 of the
  13 rules have external confirmation and this one rests on a synthetic assertion. Called out
  explicitly in the suite rather than left silent.
- **Stat *collection* is out of scope here.** This proves that *given identical stat lines* the
  points match. Whether our NHL pipeline derives the same season totals hockeydraft.ca's feed
  produces (particularly SH goals, OT goals and fights, which come from play-by-play and the
  landing summary rather than the boxscore) is covered separately by
  `api/_lib/nhl/realContract.test.ts`.
- Roster-swap timing, the Saturday swap window and waiver logic are untouched by this suite.

## 5. Cross-check against the 2026-07-01 audit

The audit found 6 of 13 rules could never score. That fix has landed — `applyDerivedStats`
(`api/_lib/scoring/fetchDailyGameStats.ts`) now derives goalie wins/shutouts/goals/assists plus SH
and OT goals. Scored against this real league, the pre-fix engine would have cost:

| Team | Correct | Pre-fix engine | Lost | of which goalies |
|---|---|---|---|---|
| Patrick | 1526.26 | 1440.26 | −86.00 | −60.00 |
| Colin | 1479.68 | 1386.68 | −93.00 | −66.00 |
| Kieran | 1416.91 | 1319.91 | −97.00 | −75.00 |
| Nick | 1410.02 | 1301.02 | −109.00 | −89.00 |
| Tay | 1053.87 | 980.87 | −73.00 | −70.00 |

**73–109 points per team**, unevenly distributed — Nick's Vasilevskiy/Oettinger tandem lost 89
while Patrick's lost 60. In a season decided by 7.92 points between 1st and 2nd, that is decisive.
This suite would have caught it immediately: Sorokin alone would have scored 55.32 instead of 99.32.

## 6. The counterfactual you asked for

Same draft, same final rosters, scored by **this** project with no in-season churn:

| | hockeydraft.ca (actual) | This project, rosters held | Δ |
|---|---|---|---|
| Patrick | **1445.14** (1st) | **1526.26** (1st) | +81.12 |
| Nick | 1437.22 (2nd) | 1410.02 (**4th**) | −27.20 |
| Kieran | 1430.47 (3rd) | 1416.91 (3rd) | −13.56 |
| Colin | 1411.08 (4th) | 1479.68 (**2nd**) | +68.60 |
| Tay | 1053.87 (5th) | 1053.87 (5th) | 0.00 |

The engines agree; the deltas are **entirely** roster management. Patrick and Colin were *hurt* by
their own churn relative to just holding their final lineup (they'd have gained 81 and 69), while
Nick and Kieran genuinely gained ground by working the wire (27 and 14 points of real value added).
Patrick wins either way, but 2nd through 4th completely reorders.

---

## Reproducing / refreshing

The fixture is a static capture — no network access at test time. To refresh after a future season,
re-capture the three pages, regenerate the fixture, and update the expected counts in the coverage
and transaction tests. The `hdPlayerId` values are **hockeydraft.ca's** internal ids, not NHL API
ids, and are used only as unique keys inside these tests.
