import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from './_lib/firebaseAdmin';
import { evaluateCronAccess } from './_lib/routeAccess';

// This endpoint updates live stats for today's games.
// It is protected for trusted triggers in production and may be manually invoked in development.

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const access = evaluateCronAccess(
    req,
    { cronSecret: process.env.CRON_SECRET, nodeEnv: process.env.NODE_ENV },
    { allowDevBypass: true },
  );

  if (!access.allowed) {
    return res.status(access.statusCode).json(access.body);
  }

  try {
    console.log('🔴 Live stats cron job started');
    const db = await getAdminDb();

    // Get all leagues
    const leaguesSnapshot = await db.collection('leagues').get();

    if (leaguesSnapshot.empty) {
      console.log('No leagues found');
      return res.status(200).json({ 
        success: true, 
        message: 'No leagues to process',
        leaguesProcessed: 0 
      });
    }

    // Process each league
    let totalLeagues = 0;
    let totalGames = 0;
    let totalPlayers = 0;

    for (const leagueDoc of leaguesSnapshot.docs) {
      const leagueId = leagueDoc.id;
      console.log(`Processing live stats for league: ${leagueId}`);

      try {
        // Import and run live stats processing
        const { processLiveStats } = await import('../src/utils/liveStats');
        const result = await processLiveStats(leagueId);

        totalLeagues++;
        totalGames += result.gamesProcessed;
        totalPlayers += result.playersUpdated;

        console.log(`League ${leagueId}: ${result.gamesProcessed} games, ${result.playersUpdated} players`);
      } catch (error) {
        console.error(`Error processing league ${leagueId}:`, error);
        // Continue with other leagues
      }
    }

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      leaguesProcessed: totalLeagues,
      gamesProcessed: totalGames,
      playersUpdated: totalPlayers,
    };

    console.log('🔴 Live stats complete:', summary);

    return res.status(200).json(summary);
  } catch (error) {
    console.error('Error in live stats cron:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
