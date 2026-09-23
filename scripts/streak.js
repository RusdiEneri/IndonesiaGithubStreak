export function calculateStreaks(days, today) {
  const active = new Set(
    days
      .filter((day) => Number(day.contributionCount) > 0)
      .map((day) => day.date)
  );

  const dates = [...active].sort();

  let longestStreak = 0;
  let currentRun = 0;
  let previous = null;

  for (const date of dates) {
    if (!previous || daysBetween(previous, date) !== 1) {
      currentRun = 1;
    } else {
      currentRun += 1;
    }

    if (currentRun > longestStreak) longestStreak = currentRun;
    previous = date;
  }

  let currentStreak = 0;
  let cursor = today;
  while (active.has(cursor)) {
    currentStreak += 1;
    cursor = shiftDate(cursor, -1);
  }

  return { longestStreak, currentStreak };
}

export function daysBetween(a, b) {
  const first = Date.parse(`${a}T00:00:00Z`);
  const second = Date.parse(`${b}T00:00:00Z`);
  return Math.round((second - first) / 86400000);
}

export function shiftDate(dateString, deltaDays) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}
