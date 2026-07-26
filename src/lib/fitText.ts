/**
 * Sizing a single line of text to a container it can't see.
 *
 * The obvious fix for text that overflows its box is to measure the rendered
 * element and scale it down. That means a `scrollWidth` read per element, which
 * forces layout — and the players grid is virtualized, so every recycled card
 * would pay for one mid-scroll. That is exactly the cost the card was recently
 * stripped of.
 *
 * So measure the string instead of the element: a canvas gives its width in `em`
 * off-DOM (no layout, no reflow), and `calc(100cqw / widthEm)` hands the actual
 * container math to the browser at layout time. One cached measurement per unique
 * string, zero DOM reads, and it stays correct across breakpoints because the
 * container query resolves against whatever width the card ends up with.
 */

/** Size we measure at; dividing by it converts px back to em. */
const MEASURE_PX = 100;

/** Advance width in em of an average uppercase glyph in a heavy geometric sans. */
const AVG_EM = 0.72;
const NARROW_EM = 0.36;
const WIDE_EM = 0.95;

const NARROW_CHARS = new Set([...'IJL1 .,\'’-']);
const WIDE_CHARS = new Set([...'MW']);

export interface MeasureOptions {
    /** CSS font-weight the text renders at. */
    weight?: number | string;
    /** CSS font-family stack the text renders with. */
    family?: string;
    /** Tracking in em applied after every character (Tailwind's `tracking-*`). */
    letterSpacingEm?: number;
}

export interface FitOptions extends MeasureOptions {
    /** Size to use when the text already fits, as a CSS length. */
    maxFontSize: string;
}

/**
 * Width of `text` in em, guessed from per-character averages.
 *
 * Used wherever a canvas isn't available (tests, SSR). Deliberately errs wide so
 * the fallback under-sizes rather than overflows.
 */
export function estimateWidthEm(text: string, letterSpacingEm = 0): number {
    if (!text) return 0;
    let em = 0;
    for (const char of text) {
        if (NARROW_CHARS.has(char)) em += NARROW_EM;
        else if (WIDE_CHARS.has(char)) em += WIDE_EM;
        else em += AVG_EM;
    }
    return em + letterSpacingEm * [...text].length;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
    if (measureCtx === undefined) {
        measureCtx =
            typeof document === 'undefined'
                ? null
                : document.createElement('canvas').getContext('2d');
    }
    return measureCtx;
}

const widthCache = new Map<string, number>();
/** Bounded so a long session can't grow the cache without limit. */
const CACHE_LIMIT = 2000;

/**
 * Web fonts load with `font-display: swap`, so the first measurement of a string
 * can happen against the fallback face and then be invalidated when the real one
 * arrives — which would leave long names overflowing again, silently.
 *
 * Two defences: a provisional measurement is never cached, and everything
 * re-measures once the fonts settle. `fontEpoch` is what components subscribe to.
 */
let fontEpoch = 0;
const epochListeners = new Set<() => void>();
let watchingFonts = false;

function armFontWatcher(): void {
    if (watchingFonts || typeof document === 'undefined' || !document.fonts) return;
    watchingFonts = true;
    document.fonts.ready.then(() => {
        widthCache.clear();
        fontEpoch++;
        for (const listener of epochListeners) listener();
    });
}

/** Whether the real face is available, or we'd be measuring a fallback. */
function isFontReady(weight: number | string, family: string): boolean {
    if (typeof document === 'undefined' || typeof document.fonts?.check !== 'function') {
        return true;
    }
    // Check the primary family only — a stack ending in `sans-serif` always
    // reports as available, which would defeat the point.
    const primary = family.split(',')[0].trim();
    try {
        return document.fonts.check(`${weight} ${MEASURE_PX}px ${primary}`);
    } catch {
        return true;
    }
}

/** Subscribe to font-load invalidation. Pairs with `getFontEpoch` for `useSyncExternalStore`. */
export function subscribeFontEpoch(onChange: () => void): () => void {
    armFontWatcher();
    epochListeners.add(onChange);
    return () => { epochListeners.delete(onChange); };
}

export function getFontEpoch(): number {
    return fontEpoch;
}

/**
 * Width of `text` in em at the given font, measured off-DOM and memoised.
 *
 * Letter spacing is added arithmetically rather than through the canvas
 * `letterSpacing` property, which isn't universally supported — CSS applies
 * tracking after every character including the last, and so does this.
 */
export function textWidthEm(text: string, options: MeasureOptions = {}): number {
    if (!text) return 0;

    const { weight = 400, family = 'sans-serif', letterSpacingEm = 0 } = options;
    const key = `${weight}|${family}|${letterSpacingEm}|${text}`;
    const cached = widthCache.get(key);
    if (cached !== undefined) return cached;

    const ctx = getMeasureContext();
    let em: number;
    if (ctx) {
        ctx.font = `${weight} ${MEASURE_PX}px ${family}`;
        em = ctx.measureText(text).width / MEASURE_PX + letterSpacingEm * [...text].length;
        // A font that hasn't resolved can measure as zero; the estimate is better
        // than a divide-by-zero.
        if (!(em > 0)) em = estimateWidthEm(text, letterSpacingEm);
    } else {
        em = estimateWidthEm(text, letterSpacingEm);
    }

    if (!isFontReady(weight, family)) {
        // Measured against a fallback face. Usable for this paint, but caching it
        // would outlive the swap, so hand it back without storing it.
        armFontWatcher();
        return em;
    }

    if (widthCache.size >= CACHE_LIMIT) widthCache.clear();
    widthCache.set(key, em);
    return em;
}

/**
 * Largest font size in px at which text of `widthEm` fits `containerPx`, never
 * exceeding `maxPx`. Exported for tests — the runtime lets CSS do this.
 */
export function fitFontSizePx(widthEm: number, containerPx: number, maxPx: number): number {
    if (!(widthEm > 0)) return maxPx;
    return Math.min(maxPx, containerPx / widthEm);
}

/**
 * A `font-size` value that shrinks `text` just enough to fit its container.
 *
 * Requires an ancestor with `container-type: inline-size` for `cqw` to resolve
 * against — see `PlayerCardName`.
 */
export function fitFontSizeCss(text: string, options: FitOptions): string {
    const widthEm = textWidthEm(text, options);
    if (!(widthEm > 0)) return options.maxFontSize;
    // Round the divisor *up*: rounding down would overstate the size that fits,
    // which is the whole bug this module exists to prevent.
    const divisor = Math.ceil(widthEm * 1e4) / 1e4;
    return `min(${options.maxFontSize}, calc(100cqw / ${divisor}))`;
}
