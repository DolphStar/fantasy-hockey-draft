import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import MyPlayerCard from './MyPlayerCard';

interface SortablePlayerCardProps {
    player: any; // Using any for simplicity here, but should match DraftedPlayer
    fantasyPoints: number;
    history?: { points: number }[];
    injury?: any;
    isSelected?: boolean;
}

export default function SortablePlayerCard({
    player,
    fantasyPoints,
    history,
    injury,
    isSelected
}: SortablePlayerCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: player.id, data: { player } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <MyPlayerCard
                player={player}
                fantasyPoints={fantasyPoints}
                history={history}
                injury={injury}
                isSelected={isSelected}
                isOverlay={isDragging}
            />
        </div>
    );
}
