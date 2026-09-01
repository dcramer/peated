import { db } from "@peated/server/db";
import { events, type Event } from "@peated/server/db/schema";
import { logInfo, logWarn } from "@peated/server/lib/log";
import { eq } from "drizzle-orm";

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dayDifference(start: string, end: string): number {
  return Math.round(
    (Date.parse(`${end}T00:00:00.000Z`) -
      Date.parse(`${start}T00:00:00.000Z`)) /
      86_400_000,
  );
}

function nextFixedDate(sourceDate: string, today: string): string | null {
  const monthAndDay = sourceDate.slice(5);
  const currentYear = Number(today.slice(0, 4));
  const thisYear = `${currentYear}-${monthAndDay}`;
  const candidate =
    thisYear >= today ? thisYear : `${currentYear + 1}-${monthAndDay}`;
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  return parsed.toISOString().slice(0, 10) === candidate ? candidate : null;
}

function latestEventByName(eventList: Event[]): Event[] {
  const result = new Map<string, Event>();
  for (const event of eventList) {
    const key = event.name.trim().toLocaleLowerCase();
    const latest = result.get(key);
    if (!latest || event.dateStart > latest.dateStart) result.set(key, event);
  }
  return [...result.values()];
}

/** Only `repeats` events opt in to automatic fixed-date editions. */
export async function createNextRepeatingEvents(
  today = new Date().toISOString().slice(0, 10),
): Promise<number> {
  const sourceEvents = latestEventByName(
    await db.select().from(events).where(eq(events.repeats, true)),
  );
  let created = 0;

  for (const source of sourceEvents) {
    if ((source.dateEnd ?? source.dateStart) >= today) continue;

    const dateStart = nextFixedDate(source.dateStart, today);
    if (!dateStart) {
      logWarn("Skipped repeating event with an invalid yearly date", {
        extra: { eventId: source.id, sourceDate: source.dateStart },
      });
      continue;
    }
    const dateEnd = source.dateEnd
      ? addDays(dateStart, dayDifference(source.dateStart, source.dateEnd))
      : null;

    const inserted = await db
      .insert(events)
      .values({
        name: source.name,
        dateStart,
        dateEnd,
        repeats: true,
        website: source.website,
        description: source.description,
        countryId: source.countryId,
        address: source.address,
        location: source.location,
      })
      .onConflictDoNothing()
      .returning({ id: events.id });
    created += inserted.length;
  }

  logInfo("Updated fixed-date whisky events", { extra: { created } });
  return created;
}

export default createNextRepeatingEvents;
