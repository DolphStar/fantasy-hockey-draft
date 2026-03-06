import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * TEMPORARY: Test auth endpoint for pentest - generates a Firebase custom token
 * DELETE THIS FILE AFTER SECURITY TESTING
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = [
    'https://fantasy-hockey-draft.vercel.app',
    'http://localhost:5173',
  ];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Only allow the specific test secret
  const { secret } = req.body || {};
  if (secret !== process.env.PENTEST_SECRET) {
    return res.status(403).json({ error: 'Invalid secret' });
  }

  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');

    if (getApps().length === 0) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
      initializeApp({ credential: cert(serviceAccount) });
    }

    const auth = getAuth();

    // Get the test user by email
    const user = await auth.getUserByEmail('skyoldcombats@gmail.com');
    const customToken = await auth.createCustomToken(user.uid);

    return res.status(200).json({ token: customToken });
  } catch (error) {
    console.error('Test auth error:', error);
    return res.status(500).json({ error: 'Failed to create token' });
  }
}
