import { defineConfig } from 'vitest/config';

/**
 * Firestore security-rules tests. Kept out of `vitest.config.ts` on purpose:
 * they need the Firestore emulator (and therefore Java), while CI runs node-only.
 * Run via `npm run test:rules`, which starts the emulator around them.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['firestore.rules.test.ts'],
    // One emulator, shared Firestore state, tests that clear it between cases.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
