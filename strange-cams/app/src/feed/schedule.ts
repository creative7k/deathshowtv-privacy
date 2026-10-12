/**
 * OOI CAMHD streams live for 14 minutes every 3 hours, starting at
 * 2:00, 5:00, 8:00, 11:00 (AM and PM) Pacific time.
 * Returns whether a window is open now, and when the next one starts.
 */
export function ooiWindow(now: Date): { live: boolean; next: Date } {
  const pacificHour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now),
  );
  const minute = now.getUTCMinutes();
  const sinceSlotStart = (((pacificHour - 2) % 3) + 3) % 3; // hours since last slot start
  const live = sinceSlotStart === 0 && minute < 14;

  const next = new Date(now);
  next.setUTCSeconds(0, 0);
  next.setUTCMinutes(0);
  next.setTime(next.getTime() + (3 - sinceSlotStart) * 3_600_000);
  return { live, next };
}
