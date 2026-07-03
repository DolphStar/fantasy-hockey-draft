# Fantasy Hockey Scoring System

## Overview

The scoring engine automatically calculates fantasy points for your drafted players based on their real NHL performance each night.

## How It Works

### 1. **Daily Automated Scoring**

Every day at **5:00 AM UTC**, a Vercel cron job runs:
```
/api/calculate-scores
```

This function:
- Fetches all NHL games from yesterday
- Gets player statistics from each game's boxscore
- Derives goalie wins/shutouts from the boxscore decision, and SH/OT goals + goalie goals/assists from the game landing summary
- Matches NHL players to your drafted players
- Calculates fantasy points using your league's scoring rules
- Updates team standings in Firestore

### 2. **Scoring Rules** (Default)

#### Skaters (Forwards & Defense)
- **Goal**: 1 pt
- **Assist**: 1 pt
- **Short-Handed Goal**: +1 pt (bonus on top of goal)
- **Overtime Goal**: +1 pt (bonus on top of goal)
- **Fight**: 2 pts

#### Defense Only
- **Blocked Shot**: 0.15 pts
- **Hit**: 0.1 pts

#### Goalies
- **Win**: 1 pt
- **Shutout**: 2 pts
  - Shutout = credited decision + 0 goals against + at least one save (a goalie who loses in the shootout with 0 GA still earns it; shared shutouts credit the decision goalie)
- **Save**: 0.04 pts
- **Assist**: 1 pt
- **Goal**: 20 pts (!)
- **Fight**: 5 pts

### 3. **Data Structure**

#### Firestore Collections:

**`/leagues/{leagueId}`**
```json
{
  "leagueName": "Test League",
  "scoringRules": { /* scoring configuration */ },
  "rosterSettings": {
    "forwards": 9,
    "defensemen": 6,
    "goalies": 2,
    "reserves": 5
  }
}
```

**`/leagues/{leagueId}/teamScores/{teamName}`**
```json
{
  "teamName": "My Team",
  "totalPoints": 125.45,
  "wins": 3,
  "losses": 1,
  "lastUpdated": "2025-11-13T05:00:00.000Z"
}
```

**`/leagues/{leagueId}/playerDailyScores/{playerId}-{date}`**
```json
{
  "playerId": 8478402,
  "playerName": "Elias Pettersson",
  "teamName": "My Team",
  "nhlTeam": "VAN",
  "date": "2025-11-12",
  "points": 3.5,
  "stats": {
    "goals": 1,
    "assists": 2,
    "shots": 4,
    "hits": 1
  }
}
```

## Manual Scoring (For Testing)

You can manually trigger scoring for any date:

1. **Via API Call** (`GET`, requires either the cron secret or a league-admin Firebase ID token — both passed in the `Authorization: Bearer` header):
```bash
# Using the cron secret
curl "https://your-app.vercel.app/api/calculate-scores?leagueId=league-123&date=YYYY-MM-DD" \
  -H "Authorization: Bearer $CRON_SECRET"

# Using a Firebase ID token (league admin)
curl "https://your-app.vercel.app/api/calculate-scores?leagueId=league-123&date=YYYY-MM-DD" \
  -H "Authorization: Bearer <firebase-id-token>"
```

2. **Via Admin UI:**

   In League Settings, click **Test Scoring** — this calls `GET /api/calculate-scores` with your Firebase ID token in the `Authorization: Bearer` header (league-admin authentication required). You can specify any date in the dialog.

### Rescoring a season

After deploying a scoring-engine fix, historical scores can be recalculated:

```bash
# Dry run (lists processed dates and current totals, changes nothing)
FIREBASE_SERVICE_ACCOUNT_KEY='...' node scripts/rescore-season.mjs --league-id <leagueId>

# Execute: clears playerDailyScores/teamScores/aggregates/processedDates,
# then replays every date through the deployed /api/calculate-scores
FIREBASE_SERVICE_ACCOUNT_KEY='...' CRON_SECRET='...' node scripts/rescore-season.mjs --league-id <leagueId> --commit
```

`BASE_URL` overrides the deployed origin (defaults to the production URL). **Deploy the fix first** — the script exercises the deployed engine, not local code.

Caveats before running `--commit`:
- **Roster drift:** the replay scores every date against the *current* roster (active players only). Players moved to reserve since a date was originally scored lose those historical points, so totals can shift beyond the engine fix itself.
- **Cron window:** avoid running near 5:00 AM UTC — the daily cron and the script can both score yesterday's date.
- **If the replay fails partway:** re-run the whole script (the full clear + replay is self-correcting). Don't re-run individual failed dates — a date that failed mid-persist may already have partial team-score increments, and replaying only it would double-count.

## Viewing Standings

Go to the **🏆 Standings** tab to see:
- Current team rankings
- Total fantasy points per team
- Win/loss records
- Last updated timestamp
- Scoring rules reference

## Customizing Scoring Rules

Admins can customize scoring rules when creating a league. In the future, this could be exposed in the League Settings UI.

To change rules for an existing league, update the `scoringRules` field in Firestore:

```javascript
// In Firestore console or via Firebase SDK
await updateDoc(doc(db, 'leagues', leagueId), {
  scoringRules: {
    goal: 2,  // Change goal value to 2 points
    assist: 1,
    // ... rest of rules
  }
});
```

## Troubleshooting

### Scores Not Updating?
1. Check Vercel cron logs in deployment dashboard
2. Verify `CRON_SECRET` environment variable is set
3. Ensure player `leagueId` fields are correctly set when drafting
4. Check Firestore security rules allow writes to `teamScores` collection

### Missing Player Stats?
- NHL API only provides stats for completed games
- Fights come from play-by-play; SH/OT goals and goalie goals/assists come from the landing summary — if either fetch fails for a game, those stats default to 0 for that game (base boxscore stats still score)
- Goalie wins/shutouts are calculated based on game outcome

### Testing Locally?
The cron job won't run locally, and plain `npm run dev` (Vite) does not serve the `/api` routes. Run `vercel dev` instead, then use the **Test Scoring** button in League Settings, or call the endpoint directly with your cron secret:

```bash
curl "http://localhost:3000/api/calculate-scores?leagueId=<leagueId>&date=YYYY-MM-DD" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Future Enhancements

- [ ] Head-to-head matchups (weekly wins/losses)
- [ ] Player performance history graphs
- [ ] Trade functionality
- [ ] Waiver wire/free agents
- [ ] Playoff system
- [ ] Email notifications for daily scores
- [ ] Mobile app
