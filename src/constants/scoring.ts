import type { RosterSettings } from '../types/league';

export { DEFAULT_SCORING_RULES } from '../../packages/core/scoring/defaults';

/** Default roster settings: 9F / 6D / 2G / 5 reserves */
export const DEFAULT_ROSTER_SETTINGS: RosterSettings = {
  forwards: 9,
  defensemen: 6,
  goalies: 2,
  reserves: 5,
};
