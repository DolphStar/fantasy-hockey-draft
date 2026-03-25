type QueryValue = string | string[] | undefined;

type RequestLike = {
  headers?: {
    authorization?: string;
  };
  query?: Record<string, QueryValue>;
};

type EnvironmentLike = {
  cronSecret?: string;
  nodeEnv?: string;
};

type QueryBypassOptions = {
  param: string;
  value?: string;
};

export type CronAccessOptions = {
  allowDevBypass?: boolean;
  allowQueryBypass?: QueryBypassOptions;
};

export type CronAccessDecision =
  | { allowed: true; mode: 'cron' | 'manual-dev' | 'manual-query' }
  | { allowed: false; statusCode: number; body: { error: string } };

export const PUBLIC_ALLOWED_ORIGINS = [
  'https://fantasy-hockey-draft.vercel.app',
  'http://localhost:5173',
] as const;

function getQueryValue(query: Record<string, QueryValue> | undefined, key: string): string | undefined {
  const value = query?.[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function evaluateCronAccess(
  request: RequestLike,
  environment: EnvironmentLike,
  options: CronAccessOptions = {},
): CronAccessDecision {
  const cronSecret = environment.cronSecret?.trim();

  if (!cronSecret) {
    return {
      allowed: false,
      statusCode: 500,
      body: { error: 'CRON_SECRET is not configured' },
    };
  }

  const authHeader = request.headers?.authorization;
  if (authHeader === `Bearer ${cronSecret}`) {
    return { allowed: true, mode: 'cron' };
  }

  if (options.allowQueryBypass) {
    const value = getQueryValue(request.query, options.allowQueryBypass.param);
    const expectedValue = options.allowQueryBypass.value ?? 'true';

    if (value === expectedValue) {
      return { allowed: true, mode: 'manual-query' };
    }
  }

  const isDevelopment = environment.nodeEnv !== 'production';
  if (options.allowDevBypass && isDevelopment) {
    return { allowed: true, mode: 'manual-dev' };
  }

  return {
    allowed: false,
    statusCode: 401,
    body: { error: 'Unauthorized' },
  };
}

export function getPublicCorsHeaders(origin?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (origin && PUBLIC_ALLOWED_ORIGINS.includes(origin as (typeof PUBLIC_ALLOWED_ORIGINS)[number])) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}
