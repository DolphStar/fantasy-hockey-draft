import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2/options";
import * as admin from "firebase-admin";
import axios from "axios";

// Initialize the Admin SDK once
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// Optional: global options to avoid runaway concurrency
setGlobalOptions({ maxInstances: 10 });

interface DraftPick {
  team: string;
  round: number;
  pick: number;
}

interface DraftState {
  totalPicks: number;
  currentPickNumber: number; // 1-based index into draftOrder
  draftOrder: DraftPick[];
  isComplete: boolean;
}

interface LeagueTeam {
  teamName: string;
  ownerUid?: string;
  ownerEmail?: string;
  discordId?: string;
}

interface LeagueDoc {
  leagueName: string;
  teams: LeagueTeam[];
}

/**
 * Firestore trigger (v2): whenever the draft state document for a league
 * changes, if currentPickNumber advanced, ping the team who is now on the
 * clock via Discord webhook using their stored discordId.
 */
export const onDraftPick = onDocumentUpdated("drafts/{leagueId}", async (event: any) => {
  const leagueId = event.params.leagueId as string;
  const before = event.data?.before.data() as DraftState | undefined;
  const after = event.data?.after.data() as DraftState | undefined;

  if (!before || !after) {
    console.log("Missing before/after draft state");
    return;
  }

  // Only act when the pick actually advances
  if (before.currentPickNumber === after.currentPickNumber) {
    return;
  }

  // If draft is complete, nothing to do
  if (after.isComplete) {
    console.log("Draft is complete for league", leagueId);
    return;
  }

  const currentPickNumber = after.currentPickNumber;
  const draftOrder = after.draftOrder || [];

  if (!Array.isArray(draftOrder) || draftOrder.length === 0) {
    console.warn("Draft order is empty for league", leagueId);
    return;
  }

  if (currentPickNumber < 1 || currentPickNumber > draftOrder.length) {
    console.warn(
      "currentPickNumber out of bounds",
      currentPickNumber,
      "for league",
      leagueId,
    );
    return;
  }

  const currentPick = draftOrder[currentPickNumber - 1];
  const teamName = currentPick.team;

  console.log(
    `League ${leagueId}: advanced to pick #${currentPickNumber} for team ${teamName}`,
  );

  // Load the league document to find the team and its discordId
  const leagueSnap = await db.doc(`leagues/${leagueId}`).get();
  if (!leagueSnap.exists) {
    console.error("League doc not found for", leagueId);
    return;
  }

  const league = leagueSnap.data() as LeagueDoc;
  const teams = league.teams || [];
  const team = teams.find((t) => t.teamName === teamName);

  if (!team) {
    console.error("Team not found in league for teamName", teamName);
    return;
  }

  const discordId = team.discordId;
  if (!discordId) {
    console.log(
      `No discordId set for team ${teamName} in league ${leagueId}; skipping ping`,
    );
    return;
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error("DISCORD_WEBHOOK_URL environment variable is not set");
    return;
  }

  const message = [
    "## 🏒 Draft Update",
    "",
    `It's now your turn, <@${discordId}>! You are on the clock.`,
    "",
    `**Team:** ${teamName}`,
    `**Pick:** #${currentPick.pick} (Round ${currentPick.round})`,
    "",
    "Go to the app to make your pick: https://fantasy-hockey-draft.vercel.app/",
  ].join("\n");

  try {
    await axios.post(webhookUrl, { content: message });
    console.log("Sent Discord ping to", discordId, "for league", leagueId);
  } catch (err) {
    console.error("Failed to send Discord ping:", err);
  }
});

/**
 * Scheduled function: runs daily at 3 AM EST to calculate fantasy points
 * from yesterday's NHL games for all active leagues.
 */
export const scheduledDailyScoring = onSchedule({
  schedule: "0 3 * * *", // 3:00 AM every day
  timeZone: "America/New_York", // EST/EDT timezone
  memory: "256MiB",
}, async (event) => {
  console.log("🏒 Starting scheduled daily scoring...");

  try {
    // Get all leagues
    const leaguesSnapshot = await db.collection("leagues").get();

    if (leaguesSnapshot.empty) {
      console.log("No leagues found");
      return;
    }

    console.log(`Found ${leaguesSnapshot.size} leagues`);

    // Process each league
    const results = [];
    for (const leagueDoc of leaguesSnapshot.docs) {
      const leagueId = leagueDoc.id;
      const leagueData = leagueDoc.data();

      // Skip leagues that aren't live
      if (leagueData.status !== "live") {
        console.log(`Skipping league ${leagueId} (status: ${leagueData.status})`);
        continue;
      }

      try {
        const { processYesterdayScores } = await import("./scoringEngine.js");
        await processYesterdayScores(leagueId);
        results.push({ leagueId, status: "success" });
      } catch (error: any) {
        console.error(`Error processing league ${leagueId}:`, error);
        results.push({ leagueId, status: "error", error: error.message });
        // Continue with other leagues even if one fails
      }
    }

    console.log("✅ Scheduled daily scoring complete!");
    console.log("Results:", results);
  } catch (error) {
    console.error("Error in scheduledDailyScoring:", error);
    throw error;
  }
});
