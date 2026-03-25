const NEW_YORK_TIME_ZONE = 'America/New_York';

const newYorkDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: NEW_YORK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

function shiftDateString(dateString: string, days: number): string {
    const shiftedDate = new Date(`${dateString}T12:00:00Z`);
    shiftedDate.setUTCDate(shiftedDate.getUTCDate() + days);
    return shiftedDate.toISOString().split('T')[0];
}

export function getPreviousNewYorkDateString(date = new Date()): string {
    return shiftDateString(newYorkDateFormatter.format(date), -1);
}
