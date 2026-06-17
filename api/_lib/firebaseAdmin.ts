import type { ServiceAccount } from 'firebase-admin/app';

export function parseServiceAccountKey(raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY): ServiceAccount {
  if (!raw?.trim()) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not configured');
  }

  // The downloaded service-account JSON uses snake_case keys (private_key, …),
  // whereas firebase-admin's ServiceAccount type is camelCase. cert() accepts the
  // snake_case object at runtime, so parse into a loose shape, normalize the
  // escaped newlines, and hand it back typed as ServiceAccount.
  const parsed = JSON.parse(raw) as { private_key?: string; [key: string]: unknown };

  if (typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }

  return parsed as unknown as ServiceAccount;
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

export async function getAdminAuth() {
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(parseServiceAccountKey()),
    });
  }

  return getAuth();
}
