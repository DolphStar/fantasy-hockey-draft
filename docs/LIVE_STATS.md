# Live Stats Feature

## Overview

The Live Stats system provides **real-time tracking** of your fantasy players' performance during today's NHL games. Unlike the daily scoring system (which runs once per day at 5 AM UTC), Live Stats is currently a **manual/admin-triggered or external-triggered** server flow that is ready for cron-style execution but is **not** scheduled in the current `vercel.json`.

## How It Works

### Current Runtime Mode

- **Current scheduling**: No Vercel cron is configured for `/api/live-stats` in `vercel.json`
- **Current access**: Requires `CRON_SECRET` to be configured, and allows a development-only bypass for manual testing when `NODE_ENV !== 'production'`
- **Current trigger paths**:
  - Admin manual trigger from League Settings
  - External scheduler/webhook if you choose to add one later
- **What it tracks**: All games scheduled for TODAY (scheduled, live, and completed)

### Update Flow

1. **A trusted trigger** calls `/api/live-stats`
2. API fetches **today's NHL games** from NHL API
3. For each game (except future/unstarted games):
   - Fetch current boxscore stats
   - Update stats for all drafted players in that game
   - Save to Firestore: `leagues/{leagueId}/liveStats/{date}_{playerId}`
4. **Frontend auto-updates** via Firestore real-time listener
5. Users see stats update automatically (no refresh needed)

## What's Displayed

### On Standings Page

**🔴 Live Stats - Today's Games** section shows:

- **Player Name** - Your drafted player
- **NHL Team** - Which NHL team they play for
- **Status Badge**:
  - 🔴 **LIVE** - Game in progress (red, animated)
  - **FINAL** - Game completed today (green)
- **Stats Columns**:
  - ⚽ **G** - Goals
  - 🎯 **A** - Assists
  - 📊 **Pts** - Total points (Goals + Assists)
  - 🏹 **S** - Shots
  - 💥 **H** - Hits
  - 🛡️ **BS** - Blocked Shots
  - 🏆 **W** - Wins (goalies)
  - 🥅 **Sv** - Saves (goalies)
- **Team Totals** - Aggregate stats for each fantasy team today

### Real-Time Features

✅ **Auto-updates** - Stats refresh automatically via Firestore listener  
✅ **Grouped by team** - See all your players together  
✅ **Game status** - Know which games are live vs completed  
✅ **No refresh needed** - Updates appear instantly when the server job runs  
✅ **Last updated timestamp** - Shows when stats were last fetched

## Differences from Daily Scoring

| Feature | Live Stats | Daily Scoring |
|---------|-----------|---------------|
| **Frequency** | Every 15 min during games | Once per day at 5 AM |
| **Games Tracked** | Today's games only | Yesterday's completed games |
| **Purpose** | Real-time monitoring | Calculate fantasy points |
| **Data Shown** | Raw game stats | Fantasy points earned |
| **Storage** | `liveStats` (temporary) | `playerDailyScores` (permanent) |
| **Points Calculation** | No | Yes, based on scoring rules |

## Manual Testing

### For Admins

1. Go to **⚙️ League Settings**
2. Scroll to bottom
3. Click **"🔴 Update Live Stats Now"**
4. Check browser console for logs
5. Go to **🏆 Standings** to see updated stats

### What Happens

```
🔴 LIVE STATS: Starting live stats update...
🔴 LIVE STATS: Fetching games for 2025-11-13
🔴 LIVE STATS: Found 4 games today
🔴 LIVE STATS: Processing game 2023020234 (LIVE)
🔴 C. McDavid (My Team): 1G 2A [LIVE]
🔴 N. MacKinnon (Friend 1): 0G 1A [FINAL]
🔴 LIVE STATS: Complete! Processed 4 games, updated 15 players
```

## Firestore Structure

```
/leagues/{leagueId}/liveStats/
  2025-11-13_8478402     // Today's date + Player ID
  {
    playerId: 8478402
    playerName: "C. McDavid"
    teamName: "My Team"
    nhlTeam: "EDM"
    gameId: 2023020234
    gameState: "LIVE"      // LIVE, FINAL, FUT
    goals: 1
    assists: 2
    points: 3
    shots: 4
    hits: 1
    blockedShots: 0
    wins: 0
    saves: 0
    shutouts: 0
    lastUpdated: Timestamp
  }
```

## Game States

| State | Meaning | Tracked? |
|-------|---------|----------|
| **FUT** | Future/Scheduled | ❌ No stats yet |
| **LIVE** | In Progress | ✅ Yes, updates every 15 min |
| **CRIT** | Critical (end of game) | ✅ Yes |
| **FINAL** | Completed today | ✅ Yes |
| **OFF** | Official final | ✅ Yes |

## Scheduling Configuration

Located in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/calculate-scores",
      "schedule": "0 5 * * *"
    },
    {
      "path": "/api/fetch-daily-stats",
      "schedule": "30 4 * * *"
    }
  ]
}
```

**Current production schedules:**
- `/api/fetch-daily-stats` runs at **4:30 AM UTC**
- `/api/calculate-scores` runs at **5:00 AM UTC**
- `/api/live-stats` is **not currently scheduled** by Vercel

**Why this matters:**
- Daily stats and daily scoring are automated overnight
- Live stats remains available for manual/admin use without silently depending on a missing cron job
- If you re-enable a scheduled live-stats job later, update both `vercel.json` and this document together

## Performance

### API Calls Per Day

- **Cron runs**: Based on the scheduler you configure
- **NHL API calls per run**: ~10-15 games on busy nights
- **Total NHL API calls**: Depends on how often you trigger the job
- **Within NHL rate limits**: ✅ Yes

### Firestore Usage

- **Writes per run**: ~20-30 player documents
- **Daily writes**: ~640-960 documents
- **Reads**: Real-time listeners (efficient)
- **Storage**: Minimal (cleared nightly by daily scoring)

## Troubleshooting

### No Live Stats Showing

**Possible Causes:**
1. **No games today** - Wait for NHL games to start
2. **Games haven't started yet** - FUT games don't have stats
3. **Job not being triggered** - Check your manual admin flow, external scheduler, or Vercel configuration
4. **No drafted players in games** - Your players might not be playing today

**Check:**
```javascript
// In browser console
const today = new Date().toISOString().split('T')[0];
const liveStatsRef = collection(db, `leagues/your-league-id/liveStats`);
const snapshot = await getDocs(liveStatsRef);
console.log(`Live stats count: ${snapshot.size}`);
```

### Stats Not Updating

**Solutions:**
1. **Hard refresh**: Ctrl+Shift+R
2. **Check last updated time**: Shows at top right
3. **Manual trigger**: Use test button in League Settings
4. **Verify Firestore rules**: Ensure read access to liveStats

### Job Not Running

**Check Vercel Dashboard:**
1. Go to your project → **Functions** or **Cron Jobs** tab
2. Confirm whether `/api/live-stats` is actually scheduled in the current deployment
3. Check logs for errors

**Common Issues:**
- `CRON_SECRET` not set in environment variables
- Firebase credentials not configured
- API timeout (increase timeout limit)

## Future Enhancements

Potential improvements:
- **Push notifications** when your players score
- **Live fantasy points** calculated in real-time
- **Game highlights** linked from stats
- **Head-to-head matchups** with live scoring
- **Adjustable update frequency** (every 5/10/15 min)
- **Historical live stats** (keep past days)

## API Endpoint

**Endpoint**: `https://your-app.vercel.app/api/live-stats`

**Method**: GET

**Auth**: Bearer token (CRON_SECRET)

**Response**:
```json
{
  "success": true,
  "timestamp": "2025-11-13T22:15:00.000Z",
  "leaguesProcessed": 2,
  "gamesProcessed": 8,
  "playersUpdated": 45
}
```

## Summary

Live Stats gives you **real-time visibility** into your fantasy team's performance as games unfold. It's like watching the scoreboard update live, but only for YOUR players across all games happening right now. 🏒🔴
