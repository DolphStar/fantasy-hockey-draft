// Batch reprocess scores for multiple dates
// Usage: node lib/batchReprocess.js <leagueId> <startDate> <endDate>

import * as admin from 'firebase-admin';
import { processYesterdayScores } from './scoringEngine.js';

// Get command line arguments
const args = process.argv.slice(2);
if (args.length !== 3) {
    console.error('Usage: node lib/batchReprocess.js <leagueId> <startDate> <endDate>');
    console.error('Example: node lib/batchReprocess.js myLeague 2024-11-19 2024-11-22');
    process.exit(1);
}

const [leagueId, startDateStr, endDateStr] = args;

// Initialize Firebase Admin (if not already initialized)
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Get all dates between start and end (inclusive)
 */
function getDateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const startDate = new Date(start + 'T00:00:00Z');
    const endDate = new Date(end + 'T00:00:00Z');

    const current = new Date(startDate);
    while (current <= endDate) {
        const year = current.getUTCFullYear();
        const month = String(current.getUTCMonth() + 1).padStart(2, '0');
        const day = String(current.getUTCDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
        current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
}

/**
 * Process a single date by temporarily modifying the processYesterdayScores function
 */
async function processSpecificDate(leagueId: string, dateStr: string): Promise<void> {
    console.log(`\n========================================`);
    console.log(`Processing date: ${dateStr}`);
    console.log(`========================================`);

    // Check if already processed
    const processedDateRef = db.doc(`leagues/${leagueId}/processedDates/${dateStr}`);
    const processedDateSnap = await processedDateRef.get();

    if (processedDateSnap.exists) {
        console.log(`⚠️ Date ${dateStr} already processed, deleting to reprocess...`);
        await processedDateRef.delete();
    }

    // The trick: temporarily override Date() to return our target date + 1 day
    // (since processYesterdayScores calculates "yesterday")
    const targetDate = new Date(dateStr + 'T12:00:00Z'); // Use noon to avoid timezone issues
    targetDate.setDate(targetDate.getDate() + 1); // Add one day because function subtracts one

    // Monkey-patch Date constructor
    const OriginalDate = Date;
    (global as any).Date = class extends OriginalDate {
        constructor(...args: any[]) {
            if (args.length === 0) {
                super(targetDate.toISOString());
            } else {
                super(...args);
            }
        }

        static now() {
            return targetDate.getTime();
        }
    };

    try {
        await processYesterdayScores(leagueId);
        console.log(`✅ Successfully processed ${dateStr}`);
    } catch (error: any) {
        console.error(`❌ Error processing ${dateStr}:`, error.message);
    } finally {
        // Restore original Date
        (global as any).Date = OriginalDate;
    }
}

/**
 * Main function
 */
async function main() {
    console.log(`Batch reprocessing scores for league: ${leagueId}`);
    console.log(`Date range: ${startDateStr} to ${endDateStr}`);

    const dates = getDateRange(startDateStr, endDateStr);
    console.log(`\nFound ${dates.length} dates to process:\n`, dates.join(', '));

    for (const date of dates) {
        await processSpecificDate(leagueId, date);
        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log(`\n========================================`);
    console.log(`✅ Batch processing complete!`);
    console.log(`Processed ${dates.length} dates`);
    console.log(`========================================`);

    process.exit(0);
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
