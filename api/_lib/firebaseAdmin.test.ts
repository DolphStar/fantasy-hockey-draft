import { describe, expect, it } from 'vitest';

import { parseServiceAccountKey } from './firebaseAdmin';

describe('parseServiceAccountKey', () => {
  it('throws when the service account key is missing', () => {
    expect(() => parseServiceAccountKey()).toThrow('FIREBASE_SERVICE_ACCOUNT_KEY is not configured');
  });

  it('parses service account JSON and normalizes escaped newlines', () => {
    const serviceAccount = parseServiceAccountKey(
      JSON.stringify({
        project_id: 'fantasy-hockey-b7851',
        client_email: 'firebase-adminsdk@example.com',
        private_key: '-----BEGIN PRIVATE KEY-----\\nline-two\\n-----END PRIVATE KEY-----\\n',
      }),
    );

    expect(serviceAccount.project_id).toBe('fantasy-hockey-b7851');
    expect(serviceAccount.private_key).toContain('\nline-two\n');
  });
});
