import { describe, expect, it } from 'vitest';

import { formatList } from './formatList';

describe('formatList', () => {
    it('is empty for no items, so callers can render nothing', () => {
        expect(formatList([])).toBe('');
    });

    it('leaves a single item alone', () => {
        expect(formatList(['teams'])).toBe('teams');
    });

    it('joins two items with "and", not a comma', () => {
        expect(formatList(['league name', 'teams'])).toBe('league name and teams');
    });

    it('commas all but the last, which gets "and"', () => {
        expect(formatList(['league name', 'draft rounds', 'teams']))
            .toBe('league name, draft rounds and teams');
    });
});
