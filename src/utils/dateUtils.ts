import { HOCKEY_DAY_CUTOFF_HOUR, NEW_YORK_TIME_ZONE } from '../constants/time';

const newYorkDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: NEW_YORK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const newYorkHourFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: NEW_YORK_TIME_ZONE,
  hour: 'numeric',
  hour12: false,
});

function shiftDateString(dateString: string, days: number): string {
  const shiftedDate = new Date(`${dateString}T12:00:00Z`);
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + days);
  return shiftedDate.toISOString().split('T')[0];
}

export function getNewYorkDateString(date = new Date()): string {
  return newYorkDateFormatter.format(date);
}

export function getPreviousNewYorkDateString(date = new Date()): string {
  return shiftDateString(getNewYorkDateString(date), -1);
}

export function getHockeyDay(date = new Date()): string {
  const newYorkHour = Number(newYorkHourFormatter.format(date));

  if (newYorkHour < HOCKEY_DAY_CUTOFF_HOUR) {
    return getPreviousNewYorkDateString(date);
  }

  return getNewYorkDateString(date);
}
