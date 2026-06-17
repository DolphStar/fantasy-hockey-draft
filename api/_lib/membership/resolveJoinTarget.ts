export interface JoinTeamLike {
  teamName: string;
  ownerUid: string;
}

export type JoinTarget =
  | { kind: 'already' }
  | { kind: 'claim'; index: number }
  | { kind: 'append' }
  | { kind: 'full' };

/** Pure placement decision for a join: claim an open slot, else append under cap, else full. */
export function resolveJoinTarget(
  teams: JoinTeamLike[],
  maxTeams: number,
  uid: string,
): JoinTarget {
  if (teams.some((t) => t.ownerUid === uid)) return { kind: 'already' };
  const openIndex = teams.findIndex((t) => !t.ownerUid);
  if (openIndex >= 0) return { kind: 'claim', index: openIndex };
  if (teams.length < maxTeams) return { kind: 'append' };
  return { kind: 'full' };
}
