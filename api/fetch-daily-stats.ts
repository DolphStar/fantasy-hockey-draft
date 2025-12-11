import type { VercelRequest, VercelResponse } from '@vercel/node';

// Default scoring rules matching league settings (from Scoring Rules UI)
const STANDARD_SCORING = {
  // Skaters
  goal: 1,
  assist: 1,
  shortHandedGoal: 1,
  overtimeGoal: 1,
  fight: 2,
  // Defense only
  blockedShot: 0.15,
  hit: 0.1,
  // Goalies
  win: 1,
  save: 0.04,
  shutout: 2,
  goalieGoal: 20,
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Vercel Cron jobs automatically include CRON_SECRET in authorization header
  // Manual calls with returnOnly=true are allowed for backfill UI
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isManualBackfill = req.query.returnOnly === 'true';
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isManualBackfill) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get date from query param OR default to yesterday
    let dateStr: string;
    if (req.query.date && typeof req.query.date === 'string') {
      dateStr = req.query.date;
    } else {
      const date = new Date();
      date.setDate(date.getDate() - 1);
      dateStr = date.toISOString().split('T')[0];
    }

    console.log(`Fetching NHL stats for ${dateStr}...`);

    // Fetch schedule/scores for date (Using /score endpoint as requested)
    const scheduleRes = await fetch(`https://api-web.nhle.com/v1/score/${dateStr}`);
    if (!scheduleRes.ok) throw new Error(`Schedule API error: ${scheduleRes.status}`);
    const scheduleData = await scheduleRes.json();

    const gameIds: number[] = [];
    // /score endpoint returns { games: [...] } directly
    const games = scheduleData.games || [];

    console.log(`API returned ${games.length} games for ${dateStr}`);

    for (const game of games) {
        // gameState can be 'OFF', 'FINAL', 'LIVE', 'CRIT' (critical?), 'FUT' (future)
        // We only want completed games for stats
        if (game.gameState === 'OFF' || game.gameState === 'FINAL') {
          gameIds.push(game.id);
        }
    }

    console.log(`Found ${gameIds.length} completed games for ${dateStr}`);

    if (gameIds.length === 0) {
      return res.status(200).json({ message: 'No completed games found for date', date: dateStr, rawGamesFound: games.length });
    }

    // Fetch boxscores and process stats
    const dailyStats: Record<number, any> = {};

    // Fetch in batches of 5
    const batchSize = 5;
    for (let i = 0; i < gameIds.length; i += batchSize) {
      const batch = gameIds.slice(i, i + batchSize);
      const boxscores = await Promise.all(
        batch.map(id => fetch(`https://api-web.nhle.com/v1/gamecenter/${id}/boxscore`).then(r => r.ok ? r.json() : null))
      );

      for (const boxscore of boxscores) {
        if (!boxscore) continue;

        // playerByGameStats is at root level, with homeTeam/awayTeam inside
        const playerStats = boxscore.playerByGameStats;
        if (!playerStats) continue;

        ['homeTeam', 'awayTeam'].forEach(teamKey => {
          const teamInfo = boxscore[teamKey];
          const teamStats = playerStats[teamKey];
          if (!teamInfo || !teamStats) return;
          const teamAbbrev = teamInfo.abbrev || 'UNK';

          // Process Forwards (no hits/blocks scoring)
          (teamStats.forwards || []).forEach((p: any) => {
            let points = 0;
            points += (p.goals || 0) * STANDARD_SCORING.goal;
            points += (p.assists || 0) * STANDARD_SCORING.assist;
            // Note: SHG/OTG/Fights not easily available in boxscore, using basics

            dailyStats[p.playerId] = {
              id: p.playerId,
              name: p.name?.default,
              team: teamAbbrev,
              pos: p.position,
              stats: { g: p.goals, a: p.assists },
              fp: Number(points.toFixed(2))
            };
          });

          // Process Defense (includes hits/blocks scoring)
          (teamStats.defense || []).forEach((p: any) => {
            let points = 0;
            points += (p.goals || 0) * STANDARD_SCORING.goal;
            points += (p.assists || 0) * STANDARD_SCORING.assist;
            points += (p.blockedShots || 0) * STANDARD_SCORING.blockedShot;
            points += (p.hits || 0) * STANDARD_SCORING.hit;

            dailyStats[p.playerId] = {
              id: p.playerId,
              name: p.name?.default,
              team: teamAbbrev,
              pos: p.position,
              stats: { g: p.goals, a: p.assists, h: p.hits, bs: p.blockedShots },
              fp: Number(points.toFixed(2))
            };
          });

          // Process Goalies
          (teamStats.goalies || []).forEach((g: any) => {
            let points = 0;
            if (g.decision === 'W') points += STANDARD_SCORING.win;
            points += (g.saveShotsAgainst || 0) * STANDARD_SCORING.save; // Verify field name
            // Note: boxscore field is usually 'saves' or computed from shots-goals
            // Let's check standard boxscore structure... usually it's `saves`
            const saves = Number(g.saves || 0); 
            points += saves * STANDARD_SCORING.save;
            if (Number(g.goalsAgainst || 0) === 0 && saves > 0 && g.toi !== '00:00') {
               points += STANDARD_SCORING.shutout;
            }

            dailyStats[g.playerId] = {
              id: g.playerId,
              name: g.name?.default,
              team: teamAbbrev,
              pos: 'G',
              stats: { w: g.decision === 'W' ? 1 : 0, sv: saves, so: (g.goalsAgainst === 0 && saves > 0) ? 1 : 0 },
              fp: Number(points.toFixed(1))
            };
          });
        });
      }
    }

    // Check if we should just return the data (for client-side saving)
    const returnOnly = req.query.returnOnly === 'true';

    if (returnOnly) {
      return res.status(200).json({
        success: true,
        date: dateStr,
        data: {
          date: dateStr,
          players: dailyStats,
          updatedAt: new Date().toISOString()
        }
      });
    }

    // Save to Firestore using Firebase Admin SDK (works in serverless environment)
    // Collection: nhl_daily_stats, Doc ID: YYYY-MM-DD
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    // Initialize Firebase Admin (only once)
    if (getApps().length === 0) {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
      );

      initializeApp({
        credential: cert(serviceAccount),
      });
    }

    const db = getFirestore();
    
    await db.collection('nhl_daily_stats').doc(dateStr).set({
      date: dateStr,
      players: dailyStats,
      updatedAt: new Date().toISOString()
    });

    console.log(`Saved stats for ${Object.keys(dailyStats).length} players to Firestore`);

    return res.status(200).json({ 
      success: true, 
      date: dateStr, 
      playerCount: Object.keys(dailyStats).length 
    });

  } catch (error) {
    console.error('Error in daily stats cron:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
