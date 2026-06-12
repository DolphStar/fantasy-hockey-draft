import { Outlet } from 'react-router-dom';
import { PageHeader } from './ui/PageHeader';
import { SegmentedLinks } from './ui/SegmentedTabs';
import { useDraftedPlayers } from '../hooks/useDraftedPlayers';
import { useInjuries } from '../queries/useInjuries';

/** Layout route for the Players hub: My Roster / Browse NHL / Injuries tabs. */
export default function PlayersHub() {
    const { myRosterStats } = useDraftedPlayers();
    const { data: injuries = [] } = useInjuries();

    return (
        <div className="max-w-[1600px] mx-auto px-6">
            <PageHeader
                title="Players"
                actions={
                    <SegmentedLinks
                        links={[
                            { to: '/players', label: myRosterStats.total > 0 ? `My Roster · ${myRosterStats.total}` : 'My Roster', end: true },
                            { to: '/players/browse', label: 'Browse NHL' },
                            { to: '/players/injuries', label: injuries.length > 0 ? `Injuries · ${injuries.length}` : 'Injuries' },
                        ]}
                    />
                }
            />
            <Outlet />
        </div>
    );
}
