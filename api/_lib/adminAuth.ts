import { getAdminAuth, getAdminDb } from './firebaseAdmin.js';

type RequestLike = {
  headers?: {
    authorization?: string;
  };
};

export type AdminAccessDecision =
  | { allowed: true; uid: string }
  | { allowed: false; statusCode: number; body: { error: string } };

export interface AdminAccessDeps {
  verifyToken: (token: string) => Promise<{ uid: string }>;
  getLeagueAdminUid: (leagueId: string) => Promise<string | undefined>;
}

const UNAUTHORIZED: AdminAccessDecision = {
  allowed: false,
  statusCode: 401,
  body: { error: 'Unauthorized' },
};

export async function evaluateAdminAccess(
  request: RequestLike,
  leagueId: string,
  deps: AdminAccessDeps,
): Promise<AdminAccessDecision> {
  const authHeader = request.headers?.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return UNAUTHORIZED;
  }

  let uid: string;
  try {
    ({ uid } = await deps.verifyToken(authHeader.slice('Bearer '.length)));
  } catch {
    return UNAUTHORIZED;
  }

  const adminUid = await deps.getLeagueAdminUid(leagueId);
  if (!adminUid || adminUid !== uid) {
    return {
      allowed: false,
      statusCode: 403,
      body: { error: 'Forbidden: not the league admin' },
    };
  }

  return { allowed: true, uid };
}

/** Production wiring: Firebase Admin verifyIdToken + league doc lookup. */
export function defaultAdminAccessDeps(): AdminAccessDeps {
  return {
    verifyToken: async (token) => {
      const auth = await getAdminAuth();
      const decoded = await auth.verifyIdToken(token);
      return { uid: decoded.uid };
    },
    getLeagueAdminUid: async (leagueId) => {
      const db = await getAdminDb();
      const snap = await db.doc(`leagues/${leagueId}`).get();
      return snap.exists ? (snap.data()?.admin as string | undefined) : undefined;
    },
  };
}
