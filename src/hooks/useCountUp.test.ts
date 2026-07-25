import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { useCountUp } from './useCountUp';
import { markCountUpPlayed } from '../lib/animation';

/**
 * renderToString gives us the first paint without a DOM — which is exactly what
 * the session gate is about: after a refresh the number must already be there,
 * not a 0 waiting to be animated.
 */
function firstPaint(value: number, scope?: string): string {
    const Probe = () => createElement('span', null, useCountUp(value, 0, scope));
    return renderToString(createElement(Probe));
}

const fakeStorage = () => {
    const store = new Map<string, string>();
    return {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
    } as unknown as Storage;
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('useCountUp first paint', () => {
    it('starts at zero the first time a surface is seen', () => {
        vi.stubGlobal('sessionStorage', fakeStorage());

        expect(firstPaint(115, 'nhl-players-last-season')).toContain('0');
        expect(firstPaint(115, 'nhl-players-last-season')).not.toContain('115');
    });

    it('renders the settled value once that surface has played this session', () => {
        vi.stubGlobal('sessionStorage', fakeStorage());
        markCountUpPlayed('nhl-players-last-season');

        expect(firstPaint(115, 'nhl-players-last-season')).toContain('115');
    });

    it('gates per surface, so an unrelated page still animates', () => {
        vi.stubGlobal('sessionStorage', fakeStorage());
        markCountUpPlayed('standings-points');

        expect(firstPaint(115, 'nhl-players-last-season')).not.toContain('115');
    });

    it('keeps animating every mount when no scope is given', () => {
        vi.stubGlobal('sessionStorage', fakeStorage());
        markCountUpPlayed('nhl-players-last-season');

        expect(firstPaint(115)).not.toContain('115');
    });
});
