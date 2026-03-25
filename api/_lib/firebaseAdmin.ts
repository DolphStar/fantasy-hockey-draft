import type { ServiceAccount } from 'firebase-admin/app';

export function parseServiceAccountKey(raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY): ServiceAccount {
  if (!raw?.trim()) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not configured');
  }

  const parsed = JSON.parse(raw) as ServiceAccount;

  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }

  return parsed;
}

export async function getAdminDb() {
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(parseServiceAccountKey()),
    });
  }

  return getFirestore();
}
