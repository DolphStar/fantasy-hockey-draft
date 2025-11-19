// Snake Draft Logic Utilities

export interface DraftPick {
  pick: number;
  round: number;
  team: string;
}

export interface LastPickInfo {
  playerName: string;
  timestamp: string;
  team: string;
  pickNumber: number;
}

export interface DraftState {
  totalPicks: number;
  currentPickNumber: number;
  draftOrder: DraftPick[];
  isComplete: boolean;
  lastPick?: LastPickInfo;
}

/**
 * Generate a snake draft order
 * @param teams - Array of team names
 * @param rounds - Number of rounds
 * @returns Array of draft picks in snake order
 */
export function generateSnakeDraftOrder(teams: string[], rounds: number): DraftPick[] {
  const draftOrder: DraftPick[] = [];
  let pickNumber = 1;

  for (let round = 1; round <= rounds; round++) {
    // Even rounds go in reverse (snake)
    const roundTeams = round % 2 === 0 ? [...teams].reverse() : teams;

    for (const team of roundTeams) {
      draftOrder.push({
        pick: pickNumber,
        round,
        team
      });
      pickNumber++;
    }
  }

  return draftOrder;
}

/**
 * Get the current pick information
 */
export function getCurrentPick(draftState: DraftState): DraftPick | null {
  if (draftState.currentPickNumber > draftState.totalPicks) {
    return null; // Draft is complete
  }
  return draftState.draftOrder[draftState.currentPickNumber - 1];
}

/**
 * Check if it's a specific team's turn
 */
export function isTeamsTurn(draftState: DraftState, teamName: string): boolean {
  const currentPick = getCurrentPick(draftState);
  return currentPick?.team === teamName;
}

/**
 * Get next pick information
 */
export function getNextPick(draftState: DraftState): DraftPick | null {
  if (draftState.currentPickNumber >= draftState.totalPicks) {
    return null;
  }
  return draftState.draftOrder[draftState.currentPickNumber];
}

/**
 * Create initial draft state
 */
export function createInitialDraftState(teams: string[], rounds: number): DraftState {
  const draftOrder = generateSnakeDraftOrder(teams, rounds);

  return {
    totalPicks: draftOrder.length,
    currentPickNumber: 1,
    draftOrder,
    isComplete: false
  };
}
