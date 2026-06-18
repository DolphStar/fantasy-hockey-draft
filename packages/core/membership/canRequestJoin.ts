import { resolveJoinTarget } from './resolveJoinTarget.js';

export interface RequestableLeague {
  isPublic: boolean;
  status: string;
  teams: { teamName: string; ownerUid: string }[];
  maxTeams: number;
}

/** Whether `uid` may request to join `league` right now (pure; drives the browse UI). */
export function canRequestJoin(
  league: RequestableLeague,
  uid: string,
  hasPendingRequest: boolean,
): boolean {
  if (!league.isPublic || league.status !== 'pending' || hasPendingRequest) return false;
  const target = resolveJoinTarget(league.teams, league.maxTeams, uid);
  return target.kind === 'claim' || target.kind === 'append';
}
