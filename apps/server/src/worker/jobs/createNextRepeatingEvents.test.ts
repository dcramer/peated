import { db } from "@peated/server/db";
import { events } from "@peated/server/db/schema";
import { asc, eq } from "drizzle-orm";

import { createNextRepeatingEvents } from "./createNextRepeatingEvents";

test("creates one future edition for each fixed-date event", async ({
  fixtures,
}) => {
  await fixtures.Event({
    name: "Fixed whisky day",
    dateStart: "2025-05-10",
    dateEnd: "2025-05-12",
    repeats: true,
    website: "https://example.com/fixed",
    address: "Town Hall",
  });
  await fixtures.Event({
    name: "Date changes each year",
    dateStart: "2025-06-10",
    repeats: false,
  });

  await expect(createNextRepeatingEvents("2026-09-01")).resolves.toBe(1);
  await expect(createNextRepeatingEvents("2026-09-01")).resolves.toBe(0);

  const fixedEvents = await db
    .select()
    .from(events)
    .where(eq(events.name, "Fixed whisky day"))
    .orderBy(asc(events.dateStart));
  expect(fixedEvents).toHaveLength(2);
  expect(fixedEvents[1]).toMatchObject({
    dateStart: "2027-05-10",
    dateEnd: "2027-05-12",
    website: "https://example.com/fixed",
    address: "Town Hall",
    repeats: true,
  });

  const variableEvents = await db
    .select()
    .from(events)
    .where(eq(events.name, "Date changes each year"));
  expect(variableEvents).toHaveLength(1);
});

test("does not create another edition while one is still ahead", async ({
  fixtures,
}) => {
  await fixtures.Event({
    name: "Upcoming fixed event",
    dateStart: "2026-10-10",
    repeats: true,
  });

  await expect(createNextRepeatingEvents("2026-09-01")).resolves.toBe(0);
});
