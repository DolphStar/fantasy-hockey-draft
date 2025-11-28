import type { VercelRequest, VercelResponse } from '@vercel/node';

// Default scoring rules for waiver wire ranking (standard league settings)
const STANDARD_SCORING = {
  goal: 3,
  assist: 2,
  shortHandedGoal: 2,
  overtimeGoal: 1,
  fight: 5,
  blockedShot: 0.5,
  hit: 0.2,
  win: 4,
  save: 0.2,
  shutout: 3,
  goalieGoal: 10,
  goalieAssist: 3
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Verify this is called by Vercel Cron (security check)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

    // Fetch schedule for yesterday
    const scheduleRes = await fetch(`https://api-web.nhle.com/v1/schedule/${dateStr}`);
    if (!scheduleRes.ok) throw new Error(`Schedule API error: ${scheduleRes.status}`);
    const scheduleData = await scheduleRes.json();

    const gameIds: number[] = [];
    const gameDay = scheduleData.gameWeek?.[0]; // Should be the requested day

    if (gameDay && gameDay.date === dateStr && gameDay.games) {
      for (const game of gameDay.games) {
        if (game.gameState === 'OFF' || game.gameState === 'FINAL') {
          gameIds.push(game.id);
        }
      }
    }

    console.log(`Found ${gameIds.length} games for ${dateStr}`);

    if (gameIds.length === 0) {
      return res.status(200).json({ message: 'No games played yesterday', date: dateStr });
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

        ['homeTeam', 'awayTeam'].forEach(teamKey => {
          const team = boxscore[teamKey];
          if (!team) return;
          const teamAbbrev = team.abbrev || 'UNK';

          // Process Skaters
          ['forwards', 'defense'].forEach(group => {
            (team.playerByGameStats?.[group] || []).forEach((p: any) => {
              // Calculate fantasy points
              let points = 0;
              points += (p.goals || 0) * STANDARD_SCORING.goal;
              points += (p.assists || 0) * STANDARD_SCORING.assist;
              // Note: boxscore doesn't always have SHG/OTG detailed easily, sticking to basics for waiver wire
              // We can try to get hits/blocks if available
              // API v1 boxscore fields: goals, assists, points, shots, hits, blockedShots, plusMinus, pim
              points += (p.blockedShots || 0) * STANDARD_SCORING.blockedShot;
              points += (p.hits || 0) * STANDARD_SCORING.hit;

              // Save player stat
              dailyStats[p.playerId] = {
                id: p.playerId,
                name: p.name?.default,
                team: teamAbbrev,
                pos: p.position,
                stats: { g: p.goals, a: p.assists, h: p.hits, bs: p.blockedShots },
                fp: Number(points.toFixed(1))
              };
            });
          });

          // Process Goalies
          (team.playerByGameStats?.goalies || []).forEach((g: any) => {
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

    // Save to Firestore
    // Collection: nhl_daily_stats, Doc ID: YYYY-MM-DD
    const { db } = await import('../src/firebase');
    const { doc, setDoc } = await import('firebase/firestore');

    const docRef = doc(db, 'nhl_daily_stats', dateStr);
    await setDoc(docRef, {
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
