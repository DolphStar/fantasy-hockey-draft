/**
 * Join a list the way a person would read it aloud: "a", "a and b",
 * "a, b and c". Used for naming what's changed in a form, where "league name,
 * teams" reads like a heading and "league name and teams" reads like a sentence.
 */
export function formatList(items: string[]): string {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
