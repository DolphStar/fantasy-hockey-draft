/**
 * Firestore security-rules tests for `drafts/{leagueId}` — the turn-order gate.
 *
 * These run against the Firestore emulator, NOT in `npm test` (CI is node-only,
 * the emulator needs Java). Run them with:
 *
 *   npm run test:rules
 *
 * Why they exist: the draft is client-driven, so the rules are the only thing
 * stopping a league member from advancing the clock past their rivals. That is
 * not something the app's unit tests can prove — it has to be exercised against
 * a real rules engine. Note also that `firebase emulators:exec` alone does NOT
 * validate rules; it happily starts with syntactically broken rules. Only issuing
 * real reads/writes, as these tests do, actually compiles and evaluates them.
 */
import { readFileSync } from 'node:fs';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const LEAGUE_ID = 'league-1';
const ADMIN = 'uid-admin';
const NICK = 'uid-nick';
const KIERAN = 'uid-kieran';
const OUTSIDER = 'uid-outsider';

const TEAMS = [
  { teamName: 'Nick', ownerUid: NICK },
  { teamName: 'Kieran', ownerUid: KIERAN },
  { teamName: 'Open Slot', ownerUid: '' },
];

/** Snake order for the three teams above, two rounds — six picks. */
const DRAFT_ORDER = [
  { pick: 1, round: 1, team: 'Nick', ownerUid: NICK },
  { pick: 2, round: 1, team: 'Kieran', ownerUid: KIERAN },
  { pick: 3, round: 1, team: 'Open Slot', ownerUid: '' },
  { pick: 4, round: 2, team: 'Open Slot', ownerUid: '' },
  { pick: 5, round: 2, team: 'Kieran', ownerUid: KIERAN },
  { pick: 6, round: 2, team: 'Nick', ownerUid: NICK },
];

const pristineDraft = () => ({
  totalPicks: DRAFT_ORDER.length,
  currentPickNumber: 1,
  draftOrder: DRAFT_ORDER,
  isComplete: false,
});

let testEnv: RulesTestEnvironment;

const draftRef = (uid: string) =>
  doc(testEnv.authenticatedContext(uid).firestore(), 'drafts', LEAGUE_ID);

/** Seed the draft doc at a given pick, bypassing rules. */
async function seedDraftAtPick(currentPickNumber: number) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'drafts', LEAGUE_ID), {
      ...pristineDraft(),
      currentPickNumber,
    });
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-rules-check',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'leagues', LEAGUE_ID), {
      leagueName: 'Esports Hockey',
      admin: ADMIN,
      teams: TEAMS,
      memberUids: [ADMIN, NICK, KIERAN],
    });
  });
});

describe('drafts/{leagueId} — bootstrap', () => {
  it('lets a member create a pristine draft', async () => {
    await assertSucceeds(setDoc(draftRef(NICK), pristineDraft()));
  });

  it('refuses a non-member', async () => {
    await assertFails(setDoc(draftRef(OUTSIDER), pristineDraft()));
  });

  it('refuses a draft that starts mid-way or pre-completed', async () => {
    await assertFails(setDoc(draftRef(NICK), { ...pristineDraft(), currentPickNumber: 4 }));
    await assertFails(setDoc(draftRef(NICK), { ...pristineDraft(), isComplete: true }));
  });

  it('refuses a totalPicks that disagrees with the draft order', async () => {
    await assertFails(setDoc(draftRef(NICK), { ...pristineDraft(), totalPicks: 99 }));
  });
});

describe('drafts/{leagueId} — advancing the clock', () => {
  it('lets the manager on the clock make their pick', async () => {
    await seedDraftAtPick(1); // Nick is up
    await assertSucceeds(
      updateDoc(draftRef(NICK), { currentPickNumber: 2, isComplete: false }),
    );
  });

  /** The finding this whole change exists to close. */
  it('stops a member advancing past someone else’s pick', async () => {
    await seedDraftAtPick(1); // Nick is up
    await assertFails(
      updateDoc(draftRef(KIERAN), { currentPickNumber: 2, isComplete: false }),
    );

    await seedDraftAtPick(2); // Kieran is up
    await assertFails(
      updateDoc(draftRef(NICK), { currentPickNumber: 3, isComplete: false }),
    );
  });

  it('stops the clock jumping more than one pick, or going backwards', async () => {
    await seedDraftAtPick(2); // Kieran is up
    await assertFails(
      updateDoc(draftRef(KIERAN), { currentPickNumber: 5, isComplete: false }),
    );
    await assertFails(
      updateDoc(draftRef(KIERAN), { currentPickNumber: 1, isComplete: false }),
    );
  });

  it('stops isComplete being flipped early, and requires it once the draft ends', async () => {
    await seedDraftAtPick(1);
    await assertFails(updateDoc(draftRef(NICK), { currentPickNumber: 2, isComplete: true }));

    await seedDraftAtPick(6); // last pick, Nick
    await assertFails(updateDoc(draftRef(NICK), { currentPickNumber: 7, isComplete: false }));
    await assertSucceeds(updateDoc(draftRef(NICK), { currentPickNumber: 7, isComplete: true }));
  });

  it('freezes the draft order and totalPicks mid-draft', async () => {
    await seedDraftAtPick(1);

    await assertFails(
      updateDoc(draftRef(NICK), {
        currentPickNumber: 2,
        isComplete: false,
        draftOrder: [...DRAFT_ORDER].reverse(),
      }),
    );
    await assertFails(
      updateDoc(draftRef(NICK), { currentPickNumber: 2, isComplete: false, totalPicks: 2 }),
    );
  });

  it('lets only the admin draft for an unclaimed team slot', async () => {
    await seedDraftAtPick(3); // 'Open Slot', ownerUid ''
    await assertFails(updateDoc(draftRef(NICK), { currentPickNumber: 4, isComplete: false }));
    await assertFails(updateDoc(draftRef(KIERAN), { currentPickNumber: 4, isComplete: false }));
    await assertSucceeds(updateDoc(draftRef(ADMIN), { currentPickNumber: 4, isComplete: false }));
  });

  it('lets the admin auto-draft on any team’s behalf', async () => {
    await seedDraftAtPick(2); // Kieran is up
    await assertSucceeds(updateDoc(draftRef(ADMIN), { currentPickNumber: 3, isComplete: false }));
  });
});

describe('drafts/{leagueId} — reset and read', () => {
  it('lets the admin reset to a pristine draft but not to an arbitrary state', async () => {
    await seedDraftAtPick(4);

    await assertFails(
      setDoc(draftRef(ADMIN), { ...pristineDraft(), currentPickNumber: 3 }),
    );
    await assertSucceeds(setDoc(draftRef(ADMIN), pristineDraft()));
  });

  it('stops a member resetting the draft', async () => {
    await seedDraftAtPick(4);
    await assertFails(setDoc(draftRef(NICK), pristineDraft()));
  });

  it('lets members read the draft and keeps outsiders out', async () => {
    await seedDraftAtPick(1);
    await assertSucceeds(getDoc(draftRef(KIERAN)));
    await assertFails(getDoc(draftRef(OUTSIDER)));
  });
});

describe('the rules file itself', () => {
  it('is the real one from the repo root', () => {
    // Guards against the emulator silently running with no rules loaded, which is
    // what made `firebase emulators:exec` alone a useless check.
    const source = readFileSync('firestore.rules', 'utf8');
    expect(source).toContain('match /drafts/{leagueId}');
    expect(source).toContain('pickOnTheClock');
  });
});
