import { describe, expect, it } from "vitest";

import { buildEventsCalendar } from "./eventsCalendar";

describe("events calendar", () => {
  it("builds an all-day calendar with an exclusive end date", () => {
    const calendar = buildEventsCalendar(
      [
        {
          id: 12,
          name: "Whisky, Wine & Friends",
          dateStart: "2026-09-12",
          dateEnd: "2026-09-13",
          address: "Town Hall; Main Street",
          country: { id: 1, name: "Scotland", slug: "scotland" },
          website: "https://example.com/event",
        },
      ],
      new Date("2026-09-01T12:30:00.123Z"),
    );

    expect(calendar).toContain("DTSTART;VALUE=DATE:20260912\r\n");
    expect(calendar).toContain("DTEND;VALUE=DATE:20260914\r\n");
    expect(calendar).toContain("SUMMARY:Whisky\\, Wine & Friends\r\n");
    expect(calendar).toContain(
      "LOCATION:Town Hall\\; Main Street\\, Scotland\r\n",
    );
    expect(calendar).toContain("DTSTAMP:20260901T123000Z\r\n");
    expect(calendar.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
