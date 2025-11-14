import type { VercelRequest, VercelResponse } from '@vercel/node';

// This endpoint updates live stats for today's games
// Called by cron job every 10-15 minutes during game hours

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Verify this is a cron request (optional security)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('Unauthorized live stats request');
    // Still allow for manual testing
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    console.log('🔴 Live stats cron job started');

    // Dynamic import to avoid bundling issues
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
