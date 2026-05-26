const HOURS_START = parseInt(process.env.BUSINESS_HOURS_START ?? "8", 10);
const HOURS_END = parseInt(process.env.BUSINESS_HOURS_END ?? "18", 10);

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function startOfBusinessDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(HOURS_START, 0, 0, 0);
  return r;
}

function endOfBusinessDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(HOURS_END, 0, 0, 0);
  return r;
}

/**
 * Retorna minutos úteis (seg-sex, HOURS_START..HOURS_END) entre `from` e `to`.
 * Se `to <= from`, retorna 0.
 */
export function businessMinutesBetween(from: Date, to: Date): number {
  if (!(from instanceof Date) || !(to instanceof Date)) return 0;
  if (to.getTime() <= from.getTime()) return 0;

  let total = 0;
  const cursor = new Date(from);

  while (cursor.getTime() < to.getTime()) {
    if (!isWeekend(cursor)) {
      const dayStart = startOfBusinessDay(cursor);
      const dayEnd = endOfBusinessDay(cursor);

      const segStart = cursor.getTime() < dayStart.getTime() ? dayStart : cursor;
      const segEnd = to.getTime() > dayEnd.getTime() ? dayEnd : to;

      if (segEnd.getTime() > segStart.getTime()) {
        total += Math.round((segEnd.getTime() - segStart.getTime()) / 60000);
      }
    }

    // próximo dia 00:00
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return total;
}
