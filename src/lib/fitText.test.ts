import { describe, expect, it } from 'vitest';
import {
    estimateWidthEm,
    fitFontSizeCss,
    fitFontSizePx,
    textWidthEm,
} from './fitText';

/** Roughly the text width a player card leaves after its px-4 gutters. */
const CARD_TEXT_WIDTH = 250;

/** Real NHL surnames, shortest to longest — the long tail is what overflows. */
const SURNAMES = [
    'ORR',
    'GRETZKY',
    'MCDAVID',
    'MATTHEWS',
    'GUDBRANSON',
    'WOTHERSPOON',
    'VAN RIEMSDYK',
    'MUKHAMADULLIN',
];

describe('estimateWidthEm', () => {
    it('grows with the number of characters', () => {
        expect(estimateWidthEm('ORR')).toBeLessThan(estimateWidthEm('GRETZKY'));
        expect(estimateWidthEm('GRETZKY')).toBeLessThan(estimateWidthEm('MUKHAMADULLIN'));
    });

    it('counts narrow glyphs as narrower than wide ones', () => {
        expect(estimateWidthEm('III')).toBeLessThan(estimateWidthEm('OOO'));
        expect(estimateWidthEm('OOO')).toBeLessThan(estimateWidthEm('MMM'));
    });

    it('adds letter spacing once per character', () => {
        const plain = estimateWidthEm('MCDAVID');
        const tracked = estimateWidthEm('MCDAVID', 0.025);
        expect(tracked - plain).toBeCloseTo(0.025 * 7, 5);
    });

    it('is zero for empty text so callers never divide by zero', () => {
        expect(estimateWidthEm('')).toBe(0);
    });
});

describe('fitFontSizePx', () => {
    it('keeps every surname inside the card at the size it returns', () => {
        for (const name of SURNAMES) {
            const widthEm = estimateWidthEm(name, 0.025);
            const size = fitFontSizePx(widthEm, CARD_TEXT_WIDTH, 36);
            // Epsilon: float round-trip, not slack in the fit.
            expect(widthEm * size).toBeLessThanOrEqual(CARD_TEXT_WIDTH + 1e-9);
        }
    });

    it('leaves short names at the design size instead of inflating them', () => {
        const widthEm = estimateWidthEm('ORR', 0.025);
        expect(fitFontSizePx(widthEm, CARD_TEXT_WIDTH, 36)).toBe(36);
    });

    it('shrinks only the names that would otherwise overflow', () => {
        const fits = fitFontSizePx(estimateWidthEm('MCDAVID', 0.025), CARD_TEXT_WIDTH, 36);
        const overflows = fitFontSizePx(estimateWidthEm('MUKHAMADULLIN', 0.025), CARD_TEXT_WIDTH, 36);
        expect(fits).toBe(36);
        expect(overflows).toBeLessThan(36);
    });

    it('shrinks wider names more than narrower ones', () => {
        // Order by measured width, not by character count. The display face has a
        // very narrow `I` and space relative to its caps, so VAN RIEMSDYK is
        // genuinely narrower than the shorter WOTHERSPOON — what the fit owes us
        // is monotonicity in width, which is the thing it actually divides by.
        const byWidth = SURNAMES.map((name) => estimateWidthEm(name, 0.025)).sort((a, b) => a - b);
        const sizes = byWidth.map((widthEm) => fitFontSizePx(widthEm, CARD_TEXT_WIDTH, 36));
        for (let i = 1; i < sizes.length; i++) {
            expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1]);
        }
    });

    it('scales with the container so a wider card gets bigger text', () => {
        const widthEm = estimateWidthEm('MUKHAMADULLIN', 0.025);
        const narrow = fitFontSizePx(widthEm, 250, 36);
        const wide = fitFontSizePx(widthEm, 400, 36);
        expect(wide).toBeGreaterThan(narrow);
        expect(wide).toBeLessThanOrEqual(36);
    });

    it('never returns a non-finite size for empty text', () => {
        expect(fitFontSizePx(0, CARD_TEXT_WIDTH, 36)).toBe(36);
    });
});

describe('textWidthEm', () => {
    it('falls back to the estimate when no canvas is available', () => {
        // Vitest runs these in the node environment, so there is no document to
        // measure with — the fallback is the path that has to hold up.
        expect(textWidthEm('MUKHAMADULLIN', { letterSpacingEm: 0.025 })).toBeCloseTo(
            estimateWidthEm('MUKHAMADULLIN', 0.025),
            5,
        );
    });

    it('returns the same width for the same input (memoised)', () => {
        const first = textWidthEm('WOTHERSPOON', { letterSpacingEm: 0.025 });
        const second = textWidthEm('WOTHERSPOON', { letterSpacingEm: 0.025 });
        expect(second).toBe(first);
    });
});

describe('fitFontSizeCss', () => {
    it('caps at the max size and divides the container by the measured width', () => {
        const css = fitFontSizeCss('MUKHAMADULLIN', {
            letterSpacingEm: 0.025,
            maxFontSize: '2.25rem',
        });
        expect(css).toMatch(/^min\(2\.25rem, calc\(100cqw \/ [\d.]+\)\)$/);
    });

    it('is just the max size for empty text, with no divide-by-zero', () => {
        const css = fitFontSizeCss('', { maxFontSize: '2.25rem' });
        expect(css).toBe('2.25rem');
    });
});
