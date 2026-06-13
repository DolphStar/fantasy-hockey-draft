// ESPN exposes a few teams with 2-letter codes that differ from NHL's logo abbreviations.
const ESPN_TO_NHL_ABBREV: Record<string, string> = {
    LA: 'LAK',
    NJ: 'NJD',
    SJ: 'SJS',
    TB: 'TBL',
    UTAH: 'UTA',
};

/** NHL dark-logo SVG URL for a team, normalizing ESPN abbreviations. */
export function nhlTeamLogo(abbrev: string): string {
    const code = ESPN_TO_NHL_ABBREV[(abbrev || '').toUpperCase()] ?? (abbrev || 'NHL').toUpperCase();
    return `https://assets.nhle.com/logos/nhl/svg/${code}_dark.svg`;
}
