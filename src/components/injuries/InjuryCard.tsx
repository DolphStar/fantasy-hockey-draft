import { CornerDownLeft } from 'lucide-react';
import type { InjuryReport } from '../../services/injuryService';
import { cn } from '../../lib/utils';
import { nhlTeamLogo } from './nhlTeamLogo';

const DEFAULT_MUG = 'https://assets.nhle.com/mugs/nhl/default-skater.png';

/** Two-bucket severity: red = out/IR/doubtful, amber = day-to-day/questionable. */
function severity(status: string): 'out' | 'dtd' {
    const s = status.toLowerCase();
    if (s.includes('out') || s.includes('ir') || s.includes('reserve') || s.includes('doubtful')) return 'out';
    return 'dtd';
}

/** ESPN often echoes the status/type as the "description"; hide those so the line isn't redundant. */
function meaningfulDescription(injury: InjuryReport): string | null {
    const desc = (injury.description || '').trim();
    if (!desc) return null;
    const d = desc.toLowerCase();
    if (d === 'no details available' || d === injury.status.toLowerCase() || d === injury.injuryType.toLowerCase()) {
        return null;
    }
    return desc;
}

// Broadcast-ticker parallelogram for the status chip.
const CHIP_CLIP = { clipPath: 'polygon(7px 0, 100% 0, calc(100% - 7px) 100%, 0 100%)' } as const;

interface InjuryCardProps {
    injury: InjuryReport;
    /** NHL headshot URL when resolvable (My Injured Players). Falls back to a team-logo avatar. */
    headshotUrl?: string;
}

/**
 * One injury row. Severity reads from the avatar (glow ring + radial bloom) rather than a
 * left accent bar; team logo ghosts in the corner; status sits in an angled broadcast chip.
 */
export function InjuryCard({ injury, headshotUrl }: InjuryCardProps) {
    const sev = severity(injury.status);
    const hasHeadshot = Boolean(headshotUrl);
    const logo = nhlTeamLogo(injury.teamAbbrev);

    const description = meaningfulDescription(injury);
    const ringCls = sev === 'out'
        ? 'border-red-500/55 shadow-[0_0_14px_rgba(239,68,68,0.3)]'
        : 'border-amber-500/50 shadow-[0_0_14px_rgba(245,158,11,0.25)]';
    const bloom = sev === 'out' ? 'rgba(239,68,68,0.32)' : 'rgba(245,158,11,0.26)';
    const chipCls = sev === 'out'
        ? 'bg-gradient-to-r from-red-700 to-red-500 text-white'
        : 'bg-gradient-to-r from-amber-700 to-amber-500 text-amber-50';

    return (
        <div className="relative overflow-hidden rounded-xl p-4 flex gap-3.5 items-start bg-gradient-to-br from-[#151d31] to-[#0c1322] border border-slate-700/60 shadow-glass hover:-translate-y-0.5 hover:border-slate-600 transition-all duration-200">
            {/* Severity bloom radiating from behind the avatar */}
            <div
                aria-hidden
                className="pointer-events-none absolute -left-8 -top-8 w-[150px] h-[150px] rounded-full"
                style={{ background: `radial-gradient(circle, ${bloom} 0%, transparent 68%)` }}
            />

            {/* Ghosted team logo (only when the avatar is a headshot, to avoid duplicating the logo) */}
            {hasHeadshot && (
                <img
                    src={logo}
                    aria-hidden
                    alt=""
                    className="pointer-events-none absolute -right-4 -bottom-5 w-28 h-28 object-contain opacity-[0.07] saturate-[0.6]"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
            )}

            {/* Avatar with severity glow ring */}
            <div className={cn('relative z-[1] w-[54px] h-[54px] rounded-full border-2 shrink-0 bg-slate-800 flex items-center justify-center overflow-hidden', ringCls)}>
                <img
                    src={headshotUrl ?? logo}
                    alt={injury.playerName}
                    className={hasHeadshot ? 'w-full h-full object-cover' : 'w-8 h-8 object-contain'}
                    onError={(e) => {
                        const img = e.currentTarget;
                        if (hasHeadshot && !img.dataset.fallback) {
                            img.dataset.fallback = '1';
                            img.src = DEFAULT_MUG;
                        } else if (!hasHeadshot) {
                            img.style.display = 'none';
                        }
                    }}
                />
            </div>

            <div className="relative z-[1] flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-white font-bold text-[14.5px] truncate">{injury.playerName}</span>
                    <span
                        className={cn('shrink-0 whitespace-nowrap text-[9.5px] font-black tracking-[0.1em] uppercase px-3 py-[3.5px]', chipCls)}
                        style={CHIP_CLIP}
                    >
                        {injury.status}
                    </span>
                </div>
                <div className="text-[#8094b3] text-[11.5px] font-semibold mt-0.5">{injury.position} · {injury.team}</div>
                <div className="text-slate-200 text-[12.5px] font-bold mt-2">
                    <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-[0.12em] mr-1.5">Injury</span>
                    {injury.injuryType}
                </div>
                {description && (
                    <p className="text-slate-500 text-[11.5px] mt-0.5 leading-snug line-clamp-2">{description}</p>
                )}
                {injury.returnDate && (
                    <span className="inline-flex items-center gap-1.5 mt-2 text-[10.5px] font-bold text-blue-300 bg-blue-500/10 border border-blue-500/[0.22] px-2.5 py-[2.5px] rounded-full">
                        <CornerDownLeft size={11} /> Returns {new Date(injury.returnDate).toLocaleDateString()}
                    </span>
                )}
            </div>
        </div>
    );
}
