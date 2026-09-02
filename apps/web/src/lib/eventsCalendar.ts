import type { Event } from "@peated/server/types";
import dayjs from "dayjs";

type CalendarEvent = Pick<
  Event,
  "address" | "country" | "dateEnd" | "dateStart" | "id" | "name" | "website"
>;

function escapeText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function formatDate(value: string): string {
  return value.replaceAll("-", "");
}

function formatTimestamp(value: Date): string {
  return value
    .toISOString()
    .replaceAll(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function buildEventCalendar(
  event: CalendarEvent,
  generatedAt = new Date(),
): string {
  const location = [event.address, event.country?.name]
    .filter(Boolean)
    .join(", ");
  const end = dayjs(event.dateEnd ?? event.dateStart)
    .add(1, "day")
    .format("YYYY-MM-DD");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Peated//Whisky events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Peated whisky events",
    "BEGIN:VEVENT",
    `UID:event-${event.id}@peated.com`,
    `DTSTAMP:${formatTimestamp(generatedAt)}`,
    `DTSTART;VALUE=DATE:${formatDate(event.dateStart)}`,
    `DTEND;VALUE=DATE:${formatDate(end)}`,
    `SUMMARY:${escapeText(event.name)}`,
  ];

  if (location) lines.push(`LOCATION:${escapeText(location)}`);
  if (event.website) lines.push(`URL:${event.website}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
