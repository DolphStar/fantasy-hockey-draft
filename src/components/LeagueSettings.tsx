import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';
import { useDraft } from '../context/DraftContext';
import TestScoring from './TestScoring';
import TestLiveStats from './TestLiveStats';
import AdminPlayerManagement from './AdminPlayerManagement';
import type { LeagueTeam } from '../types/league';
import { GlassCard } from './ui/GlassCard';
import { GradientButton } from './ui/GradientButton';
import { Badge } from './ui/Badge';
import { db } from '../firebase';
import { collection, getDocs, doc, runTransaction } from 'firebase/firestore';
import { getAllPlayers, getTeamRoster, NHL_TEAMS, type RosterPerson, type TeamAbbrev, getPlayerFullName } from '../utils/nhlApi';
import { toast } from 'sonner';


export default function LeagueSettings() {
  const { user } = useAuth();
  const { league, loading, isAdmin, createLeague, updateLeague, startDraft } = useLeague();
  const { resetDraft, draftState } = useDraft();

  const [leagueName, setLeagueName] = useState('');
  const [draftRounds, setDraftRounds] = useState(15);
  const [teams, setTeams] = useState<LeagueTeam[]>([
    { teamName: 'My Team', ownerUid: user?.uid || '', ownerEmail: user?.email || '' },
    { teamName: 'Friend 1', ownerUid: '', ownerEmail: '' },
    { teamName: 'Friend 2', ownerUid: '', ownerEmail: '' },
    { teamName: 'Friend 3', ownerUid: '', ownerEmail: '' },
  ]);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Populate form when league loads
  useEffect(() => {
    if (league) {
      setLeagueName(league.leagueName);
      setDraftRounds(league.draftRounds);
      setTeams(league.teams);
    }
  }, [league]);

  // Update team field
  const updateTeam = (index: number, field: keyof LeagueTeam, value: string) => {
    const newTeams = [...teams];
    newTeams[index] = { ...newTeams[index], [field]: value };
    setTeams(newTeams);
  };

  // Add team
  const addTeam = () => {
    setTeams([...teams, { teamName: `Team ${teams.length + 1}`, ownerUid: '', ownerEmail: '' }]);
  };

  // Remove team
  const removeTeam = (index: number) => {
    if (teams.length <= 2) {
      setError('You need at least 2 teams');
      return;
    }
    setTeams(teams.filter((_, i) => i !== index));
  };

  // Create new league
  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!leagueName.trim()) {
      setError('Please enter a league name');
      return;
    }

    if (teams.length < 2) {
      setError('You need at least 2 teams');
      return;
    }

    try {
      setCreating(true);
      const leagueId = await createLeague({
        leagueName: leagueName.trim(),
        teams,
        draftRounds,
      });
      setSuccess(`League created! ID: ${leagueId}`);
      setLeagueName('');
    } catch (err) {
      setError('Failed to create league');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  // Update existing league
  const handleUpdateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!league) return;

    setError(null);
    setSuccess(null);

    try {
      setCreating(true);
      await updateLeague(league.id, { teams, draftRounds });
      setSuccess('League updated successfully! Remember to reset the draft if you changed rounds.');
    } catch (err) {
      setError('Failed to update league');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  // Auto-complete draft with smart filling
  const [autoCompleting, setAutoCompleting] = useState(false);

  const autoCompleteDraft = async () => {
    if (!league || !draftState) {
      toast.error('Draft state not found');
      return;
    }

    const remainingPicks = draftState.totalPicks - draftState.currentPickNumber + 1;

    if (remainingPicks <= 0) {
      toast.info('Draft is already complete!');
      return;
    }

    const confirmed = confirm(
      `Auto-complete the remaining ${remainingPicks} picks?\n\nThis will randomly assign players to fill all rosters based on position needs.`
    );

    if (!confirmed) return;

    try {
      setAutoCompleting(true);
      toast.info(`Starting auto-complete for ${remainingPicks} picks...`);

      // 1. Fetch all NHL players
      console.log('Loading all NHL players...');
      const teamPromises = (Object.keys(NHL_TEAMS) as TeamAbbrev[]).map(async (abbrev) => {
        const rosterData = await getTeamRoster(abbrev);
        const teamPlayers = getAllPlayers(rosterData);
        return teamPlayers.map(player => {
          (player as any).teamAbbrev = abbrev;
          return player;
        });
      });
      const results = await Promise.all(teamPromises);
      const allPlayers = results.flat();
      console.log(`Loaded ${allPlayers.length} total players`);

      // 2. Get currently drafted players
      const draftedSnapshot = await getDocs(collection(db, 'draftedPlayers'));
      const draftedPlayerIds = new Set<number>();
      const teamRosters: Record<string, { F: number; D: number; G: number; reserve: number }> = {};

      draftedSnapshot.docs.forEach(doc => {
        const data = doc.data();
        draftedPlayerIds.add(data.playerId);

        // Track each team's current roster
        const teamName = data.draftedByTeam;
        if (!teamRosters[teamName]) {
          teamRosters[teamName] = { F: 0, D: 0, G: 0, reserve: 0 };
        }

        const pos = data.position;
        const slot = data.rosterSlot || 'active';

        if (slot === 'reserve') {
          teamRosters[teamName].reserve++;
        } else if (['C', 'L', 'R'].includes(pos)) {
          teamRosters[teamName].F++;
        } else if (pos === 'D') {
          teamRosters[teamName].D++;
        } else if (pos === 'G') {
          teamRosters[teamName].G++;
        }
      });

      // 3. Filter available players
      const availablePlayers = allPlayers.filter(p => !draftedPlayerIds.has(p.person.id));
      console.log(`${availablePlayers.length} players available`);

      // 4. Auto-draft remaining picks
      const draftRef = doc(db, 'drafts', league.id);

      for (let i = 0; i < remainingPicks; i++) {
        const currentPickNum = draftState.currentPickNumber + i;
        const pickIndex = currentPickNum - 1;

        if (!draftState.draftOrder[pickIndex]) {
          console.log('No more picks in draft order');
          break;
        }

        const pickInfo = draftState.draftOrder[pickIndex];
        const teamName = pickInfo.team;

        // Get team's current roster (initialize if new)
        if (!teamRosters[teamName]) {
          teamRosters[teamName] = { F: 0, D: 0, G: 0, reserve: 0 };
        }

        const roster = teamRosters[teamName];
        const rosterSettings = league.rosterSettings || { forwards: 9, defensemen: 6, goalies: 2 };

        // Determine what positions team needs
        const needs: string[] = [];
        if (roster.F < rosterSettings.forwards) needs.push('F');
        if (roster.D < rosterSettings.defensemen) needs.push('D');
        if (roster.G < rosterSettings.goalies) needs.push('G');

        // If all active spots full, can add to reserves
        const canAddReserve = roster.reserve < 5;

        // Find available players for needed positions
        let candidatePlayers: RosterPerson[] = [];

        if (needs.length > 0) {
          // Priority: fill active roster
          candidatePlayers = availablePlayers.filter(p => {
            if (needs.includes('F') && ['C', 'L', 'R'].includes(p.position.code)) return true;
            if (needs.includes('D') && p.position.code === 'D') return true;
            if (needs.includes('G') && p.position.code === 'G') return true;
            return false;
          });
        } else if (canAddReserve) {
          // All active spots full, add to reserves
          candidatePlayers = availablePlayers;
        } else {
          console.log(`Team ${teamName} roster full, skipping pick ${currentPickNum}`);
          continue;
        }

        if (candidatePlayers.length === 0) {
          console.log(`No available players for team ${teamName}, skipping pick ${currentPickNum}`);
          continue;
        }

        // Randomly select a player
        const randomIndex = Math.floor(Math.random() * candidatePlayers.length);
        const selectedPlayer = candidatePlayers[randomIndex];

        // Determine roster slot
        let rosterSlot: 'active' | 'reserve' = 'active';
        if (needs.length === 0) {
          rosterSlot = 'reserve';
        }

        // Draft the player
        await runTransaction(db, async (transaction) => {
          const draftedPlayerRef = doc(collection(db, 'draftedPlayers'));
          transaction.set(draftedPlayerRef, {
            playerId: selectedPlayer.person.id,
            name: getPlayerFullName(selectedPlayer),
            position: selectedPlayer.position.code,
            positionName: selectedPlayer.position.name,
            jerseyNumber: selectedPlayer.jerseyNumber,
            nhlTeam: (selectedPlayer as any).teamAbbrev || 'UNK',
            draftedByTeam: teamName,
            pickNumber: pickInfo.pick,
            round: pickInfo.round,
            leagueId: league.id,
            draftedAt: new Date().toISOString(),
            rosterSlot: rosterSlot
          });

          const nextPickNumber = currentPickNum + 1;
          transaction.update(draftRef, {
            currentPickNumber: nextPickNumber,
            isComplete: nextPickNumber > draftState.totalPicks
          });
        });

        // Update local tracking
        draftedPlayerIds.add(selectedPlayer.person.id);
        availablePlayers.splice(availablePlayers.findIndex(p => p.person.id === selectedPlayer.person.id), 1);

        // Update team roster tracking
        if (rosterSlot === 'reserve') {
          teamRosters[teamName].reserve++;
        } else if (['C', 'L', 'R'].includes(selectedPlayer.position.code)) {
          teamRosters[teamName].F++;
        } else if (selectedPlayer.position.code === 'D') {
          teamRosters[teamName].D++;
        } else if (selectedPlayer.position.code === 'G') {
          teamRosters[teamName].G++;
        }

        console.log(`Pick ${currentPickNum}: ${teamName} - ${getPlayerFullName(selectedPlayer)} (${selectedPlayer.position.code}) [${rosterSlot}]`);

        // Update progress toast
        if (i % 10 === 0 && i > 0) {
          toast.info(`Auto-completing... (${i}/${remainingPicks} picks done)`);
        }
      }

      toast.success(`Draft auto-completed! ${remainingPicks} picks filled.`);
      setSuccess(`Auto-complete successful! Filled ${remainingPicks} picks.`);
    } catch (err) {
      console.error('Error auto-completing draft:', err);
      toast.error('Failed to auto-complete draft');
      setError('Auto-complete failed. Check console for details.');
    } finally {
      setAutoCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin-slow text-4xl">🏒</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto p-6"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-heading font-bold text-white flex items-center gap-3">
            <span className="text-4xl">⚙️</span>
            League Settings
          </h2>
          <p className="text-slate-400 mt-1">Manage your league configuration, teams, and draft settings.</p>
        </div>
        {league && (
          <Badge variant={league.status === 'live' ? 'success' : 'warning'} className="text-lg px-4 py-2">
            {league.status === 'live' ? 'Draft Live' : 'Draft Pending'}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: League Form */}
        <div className="lg:col-span-2 space-y-8">
          {(!league || isAdmin) ? (
            <form onSubmit={league ? handleUpdateLeague : handleCreateLeague}>
              <GlassCard className="p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
                  <h3 className="text-xl font-bold text-white">
                    {league ? 'League Configuration' : 'Create New League'}
                  </h3>
                  {league && <Badge variant="outline">ID: {league.id}</Badge>}
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg flex items-center gap-3">
                    <span className="text-xl">⚠️</span>
                    <p className="text-red-200">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="bg-green-500/10 border border-green-500/50 p-4 rounded-lg flex items-center gap-3">
                    <span className="text-xl">✅</span>
                    <p className="text-green-200">{success}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* League Name */}
                  <div className="space-y-2">
                    <label className="block text-slate-300 font-semibold text-sm">League Name</label>
                    <input
                      type="text"
                      value={leagueName}
                      onChange={(e) => setLeagueName(e.target.value)}
                      placeholder="e.g., My Hockey League"
                      className="w-full px-4 py-3 rounded-lg bg-slate-900/50 text-white border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      required
                      disabled={!!league} // Name usually shouldn't change after creation to avoid confusion, or enable if desired
                    />
                  </div>

                  {/* Draft Rounds */}
                  <div className="space-y-2">
                    <label className="block text-slate-300 font-semibold text-sm">Draft Rounds</label>
                    <input
                      type="number"
                      value={draftRounds}
                      onChange={(e) => setDraftRounds(parseInt(e.target.value))}
                      min="1"
                      max="30"
                      className="w-full px-4 py-3 rounded-lg bg-slate-900/50 text-white border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Rounds Warning */}
                {draftRounds < 22 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg text-sm text-amber-200">
                    <p className="font-bold mb-1">⚠️ Recommendation</p>
                    Standard rosters need 22 rounds (9F + 6D + 2G + 5 Bench). Currently set to {draftRounds}.
                  </div>
                )}

                {/* Teams Section */}
                <div className="space-y-4 pt-4 border-t border-slate-700/50">
                  <div className="flex justify-between items-center">
                    <h4 className="text-lg font-bold text-white">Teams ({teams.length})</h4>
                    <button
                      type="button"
                      onClick={addTeam}
                      className="text-blue-400 hover:text-blue-300 text-sm font-semibold hover:underline"
                    >
                      + Add Team
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {teams.map((team, index) => (
                      <div key={index} className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                          <Badge variant="default" className="bg-slate-700">Team {index + 1}</Badge>
                          {index > 0 && (
                            <button
                              type="button"
                              onClick={() => removeTeam(index)}
                              className="text-red-400 hover:text-red-300 text-xs uppercase font-bold tracking-wider"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-slate-400 text-xs mb-1 uppercase tracking-wider">Team Name</label>
                            <input
                              type="text"
                              value={team.teamName}
                              onChange={(e) => updateTeam(index, 'teamName', e.target.value)}
                              className="w-full px-3 py-2 rounded bg-slate-900/50 text-white border border-slate-700 focus:border-blue-500 outline-none text-sm"
                              placeholder="Team Name"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 text-xs mb-1 uppercase tracking-wider">Owner UID</label>
                            <input
                              type="text"
                              value={team.ownerUid}
                              onChange={(e) => updateTeam(index, 'ownerUid', e.target.value)}
                              className="w-full px-3 py-2 rounded bg-slate-900/50 text-white border border-slate-700 focus:border-blue-500 outline-none text-sm font-mono"
                              placeholder={index === 0 ? "Your UID (Auto)" : "Paste UID here"}
                              disabled={index === 0}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <GradientButton
                    type="submit"
                    disabled={creating}
                    className="w-full py-4 text-lg"
                  >
                    {creating ? 'Saving Changes...' : league ? 'Save League Settings' : 'Create League'}
                  </GradientButton>
                </div>
              </GlassCard>
            </form>
          ) : (
            <GlassCard className="p-8 text-center">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-xl font-bold text-white mb-2">Admin Access Required</h3>
              <p className="text-slate-400">Only the league commissioner can modify these settings.</p>
            </GlassCard>
          )}
        </div>

        {/* Right Column: Info & Tools */}
        <div className="space-y-6">
          {/* User Info Card */}
          <GlassCard className="p-5 space-y-4">
            <h3 className="text-lg font-bold text-white border-b border-slate-700/50 pb-2">Your Identity</h3>
            <div>
              <label className="block text-slate-400 text-xs uppercase tracking-wider mb-1">Your Firebase UID</label>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700 font-mono text-xs text-blue-300 break-all select-all cursor-pointer hover:bg-slate-900 transition-colors" onClick={() => navigator.clipboard.writeText(user?.uid || '')}>
                {user?.uid}
              </div>
              <p className="text-slate-500 text-xs mt-2">
                Share this UID with your league admin so they can add you to a team.
              </p>
            </div>
          </GlassCard>

          {/* Admin Controls */}
          {league && isAdmin && (
            <>
              <GlassCard className="p-5 space-y-4 border-t-4 border-t-green-500">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🎮</span> Draft Controls
                </h3>

                {league.status === 'pending' ? (
                  <button
                    onClick={async () => {
                      try {
                        await startDraft(league.id);
                        setSuccess('Draft started! Status changed to Live.');
                      } catch (err) {
                        setError('Failed to start draft');
                      }
                    }}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg shadow-green-900/20 active:scale-95"
                  >
                    🚀 Start Draft
                  </button>
                ) : (
                  <div className="bg-green-500/10 border border-green-500/30 p-3 rounded-lg text-center">
                    <p className="text-green-400 font-bold">Draft is Live</p>
                  </div>
                )}

                {draftState && (
                  <>
                    <div className="bg-slate-900/50 p-3 rounded-lg space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Current Pick</span>
                        <span className="text-white font-bold">#{draftState.currentPickNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Picks</span>
                        <span className="text-white font-bold">{draftState.totalPicks}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Progress</span>
                        <span className="text-white font-bold">
                          {Math.round((draftState.currentPickNumber / draftState.totalPicks) * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* Auto-Complete Button */}
                    {league.status === 'live' && !draftState.isComplete && (
                      <button
                        onClick={autoCompleteDraft}
                        disabled={autoCompleting}
                        className="w-full bg-amber-900/20 hover:bg-amber-600/30 text-amber-400 hover:text-amber-300 border border-amber-900/50 hover:border-amber-600/50 font-bold py-3 px-4 rounded-lg transition-all shadow-lg shadow-amber-900/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {autoCompleting ? (
                          <>⏳ Auto-completing...</>
                        ) : (
                          <>⚡ Auto-Complete Draft</>
                        )}
                      </button>
                    )}
                  </>
                )}
              </GlassCard>

              {/* Developer Tools */}
              <div className="space-y-4">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider px-2">Developer Tools</h3>
                <TestScoring />
                <TestLiveStats />
                <AdminPlayerManagement />
              </div>

              {/* Danger Zone */}
              <GlassCard className="p-5 space-y-4 border-red-900/30 bg-red-950/10">
                <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                  <span>☢️</span> Danger Zone
                </h3>
                <p className="text-xs text-red-300/70">
                  Destructive actions that cannot be undone. Proceed with caution.
                </p>
                <button
                  onClick={async () => {
                    if (confirm('Are you sure you want to reset the draft? This will clear all picks and start over.')) {
                      try {
                        await resetDraft();
                        setSuccess('Draft reset successfully! All picks cleared.');
                      } catch (err) {
                        setError('Failed to reset draft');
                      }
                    }
                  }}
                  className="w-full bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 font-semibold py-2 px-4 rounded-lg transition-all text-sm"
                >
                  🔄 Reset Draft State
                </button>
              </GlassCard>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
