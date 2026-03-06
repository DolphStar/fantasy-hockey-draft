import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const serviceAccount = JSON.parse(
  readFileSync('C:/Users/dolph/Desktop/fantasy-hockey-b7851-firebase-adminsdk-fbsvc-82f5a3cca2.json', 'utf8')
);

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

const COLLECTIONS = ['leagues', 'draftedPlayers', 'drafts'];
const SUBCOLLECTIONS = {
  leagues: ['teamScores', 'playerDailyScores', 'liveStats', 'processedDates', 'chatBans', 'chatMessages'],
};

function serialize(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj.toDate && typeof obj.toDate === 'function') return obj.toDate().toISOString();
  if (Array.isArray(obj)) return obj.map(serialize);
  if (typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) result[k] = serialize(v);
    return result;
  }
  return obj;
}

async function backupCollection(path) {
  const snap = await db.collection(path).get();
  const docs = {};
  for (const doc of snap.docs) {
    docs[doc.id] = serialize(doc.data());
  }
  return docs;
}

async function main() {
  console.log('Starting Firestore backup (skipping nhl_daily_stats cache)...\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = `firestore-backup-${timestamp}`;
  mkdirSync(backupDir, { recursive: true });

  const backup = {};

  for (const col of COLLECTIONS) {
    console.log(`Backing up ${col}...`);
    backup[col] = await backupCollection(col);
    const docCount = Object.keys(backup[col]).length;
    console.log(`  ${docCount} documents`);

    if (SUBCOLLECTIONS[col]) {
      for (const docId of Object.keys(backup[col])) {
        for (const subCol of SUBCOLLECTIONS[col]) {
          const path = `${col}/${docId}/${subCol}`;
          try {
            const subData = await backupCollection(path);
            const subCount = Object.keys(subData).length;
            if (subCount > 0) {
              if (!backup[col][docId].__subcollections) backup[col][docId].__subcollections = {};
              backup[col][docId].__subcollections[subCol] = subData;
              console.log(`  ${path}: ${subCount} documents`);
            }
          } catch (e) {
            console.log(`  ${path}: skipped (${e.message})`);
          }
        }
      }
    }
  }

  const outPath = join(backupDir, 'backup.json');
  writeFileSync(outPath, JSON.stringify(backup, null, 2));
  const sizeKB = (Buffer.byteLength(JSON.stringify(backup)) / 1024).toFixed(1);
  console.log(`\nBackup saved to ${outPath} (${sizeKB} KB)`);
}

main().catch(err => { console.error(err); process.exit(1); });
