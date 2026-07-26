import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils';
import { fitFontSizeCss } from '../../lib/fitText';

/** Matches `font-heading` in tailwind.config.js. */
const HEADING_FAMILY = 'Outfit, sans-serif';

/** The design sizes — what a name that already fits still renders at. */
const FIRST_NAME_MAX = '0.875rem'; // text-sm
const LAST_NAME_MAX = '2.25rem'; // text-4xl

/** Tracking on each line, in em, so the fit accounts for it. */
const FIRST_NAME_TRACKING = 0.3; // tracking-[0.3em]
const LAST_NAME_TRACKING = 0.05; // tracking-wider (0.05em — tracking-*wide* is the 0.025em one)

interface PlayerCardNameProps {
    firstName: string;
    lastName: string;
    className?: string;
    style?: CSSProperties;
}

/**
 * The name block on a player card: small tracked-out first name over a big heavy
 * last name.
 *
 * Both lines are sized to the card rather than fixed, because the card is a fixed
 * width and surnames are not — MUKHAMADULLIN at a hardcoded `text-4xl` ran clean
 * off the edge. Sizing happens in CSS against the container, so a name that
 * already fits still renders at the design size and nothing measures the DOM.
 */
export function PlayerCardName({ firstName, lastName, className, style }: PlayerCardNameProps) {
    // The lines render uppercase via CSS, so that is the shape to measure.
    const firstSize = fitFontSizeCss(firstName.toUpperCase(), {
        weight: 500,
        family: HEADING_FAMILY,
        letterSpacingEm: FIRST_NAME_TRACKING,
        maxFontSize: FIRST_NAME_MAX,
    });
    const lastSize = fitFontSizeCss(lastName.toUpperCase(), {
        weight: 900,
        family: HEADING_FAMILY,
        letterSpacingEm: LAST_NAME_TRACKING,
        maxFontSize: LAST_NAME_MAX,
    });

    return (
        <div
            className={cn('text-center w-full [container-type:inline-size]', className)}
            style={style}
        >
            <h3
                className="text-white/70 font-heading font-medium uppercase tracking-[0.3em] leading-none mb-1 drop-shadow-md whitespace-nowrap"
                style={{ fontSize: firstSize }}
            >
                {firstName}
            </h3>
            <h2
                className="text-white font-heading font-black uppercase tracking-wider leading-none drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] whitespace-nowrap"
                style={{ fontSize: lastSize }}
            >
                {lastName}
            </h2>
        </div>
    );
}
