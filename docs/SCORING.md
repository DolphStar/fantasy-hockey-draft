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

1. **Via API Call:**
```bash
curl -X GET "https://your-app.vercel.app/api/calculate-scores?leagueId=league-123"
```

2. **Via Console (in browser DevTools):**
```javascript
// Import and run scoring manually
import { processYesterdayScores } from './utils/scoringEngine';
await processYesterdayScores('league-1234567890');
```

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
- Some stats (fights, overtime goals) may require additional play-by-play data
- Goalie wins/shutouts are calculated based on game outcome

### Testing Locally?
The cron job won't run locally. To test scoring:

```bash
# Run the dev server
npm run dev

# In browser console, manually trigger:
# (requires importing scoring functions)
```

## Future Enhancements

- [ ] Head-to-head matchups (weekly wins/losses)
- [ ] Player performance history graphs
- [ ] Trade functionality
- [ ] Waiver wire/free agents
- [ ] Playoff system
- [ ] Email notifications for daily scores
- [ ] Mobile app
