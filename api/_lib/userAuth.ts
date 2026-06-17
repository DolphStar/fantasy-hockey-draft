import { getAdminAuth } from './firebaseAdmin.js';

type RequestLike = { headers?: { authorization?: string } };

export type UserAccessDecision =
  | { allowed: true; uid: string }
  | { allowed: false; statusCode: number; body: { error: string } };

export interface UserAccessDeps {
  verifyToken: (token: string) => Promise<{ uid: string }>;
}

const UNAUTHORIZED: UserAccessDecision = {
  allowed: false,
  statusCode: 401,
  body: { error: 'Unauthorized' },
};

export async function evaluateUserAccess(
  request: RequestLike,
  deps: UserAccessDeps,
): Promise<UserAccessDecision> {
  const authHeader = request.headers?.authorization;
  if (!authHeader?.startsWith('Bearer ')) return UNAUTHORIZED;
  try {
    const { uid } = await deps.verifyToken(authHeader.slice('Bearer '.length));
    return { allowed: true, uid };
  } catch {
    return UNAUTHORIZED;
  }
}

export function defaultUserAccessDeps(): UserAccessDeps {
  return {
    verifyToken: async (token) => {
      const auth = await getAdminAuth();
      const decoded = await auth.verifyIdToken(token);
      return { uid: decoded.uid };
    },
  };
}
