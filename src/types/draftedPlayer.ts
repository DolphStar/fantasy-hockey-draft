export interface DraftedPlayer {
  id: string;
  playerId: number;
  name: string;
  position: string;
  positionName: string;
  jerseyNumber: string | number;
  nhlTeam: string;
  draftedByTeam: string;
  pickNumber: number;
  round: number;
  leagueId: string;
  draftedAt: string;
  rosterSlot: 'active' | 'reserve';
  pendingSlot?: 'active' | 'reserve' | null;
  /** Doc id of the player on the other side of a pending swap. */
  pendingSwapWith?: string | null;
  draftedBy?: string;
}
