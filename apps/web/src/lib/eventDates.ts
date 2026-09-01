import type { Event } from "@peated/server/types";
import dayjs from "dayjs";

type EventDates = Pick<Event, "dateEnd" | "dateStart">;
type NamedEventDates = Pick<Event, "dateEnd" | "dateStart" | "name">;

export function addCalendarYear(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return [year! + 1, month, day]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
    .join("-");
}

export function getNextEditionDates(event: EventDates) {
  return {
    dateStart: addCalendarYear(event.dateStart),
    dateEnd: event.dateEnd ? addCalendarYear(event.dateEnd) : null,
  };
}

export function getEventsNeedingNextDate<T extends NamedEventDates>(
  eventList: T[],
  today = new Date().toISOString().slice(0, 10),
): T[] {
  const latestByName = new Map<string, T>();

  for (const event of eventList) {
    const key = event.name.trim().toLocaleLowerCase();
    const latest = latestByName.get(key);
    if (!latest || event.dateStart > latest.dateStart) {
      latestByName.set(key, event);
    }
  }

  return [...latestByName.values()]
    .filter((event) => (event.dateEnd ?? event.dateStart) < today)
    .sort((left, right) =>
      (right.dateEnd ?? right.dateStart).localeCompare(
        left.dateEnd ?? left.dateStart,
      ),
    );
}

export function isEventWithinDays(
  event: EventDates,
  days: number,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  return (
    (event.dateEnd ?? event.dateStart) >= today &&
    event.dateStart <= dayjs(today).add(days, "day").format("YYYY-MM-DD")
  );
}
