import { z } from "zod";
import type { ScraperAdapter } from "../types";

export const FixtureCursorSchema = z
  .object({ page: z.number().int().positive() })
  .strict();
export const FixtureObservationSchema = z
  .object({ id: z.string().min(1), value: z.string() })
  .strict();
const FixturePageSchema = z
  .object({
    items: z.array(FixtureObservationSchema),
    nextPage: z.number().int().positive().nullable(),
  })
  .strict();

type FixtureCursor = z.infer<typeof FixtureCursorSchema>;
type FixtureObservation = z.infer<typeof FixtureObservationSchema>;

/** Exercises the complete runtime in tests without registering a live source. */
export const fixtureScraperAdapter: ScraperAdapter<
  FixtureCursor,
  FixtureObservation
> = async ({ cursor, session }) => {
  let page = cursor?.page ?? 1;
  while (true) {
    const response = await session.request({
      target: "fixture-target",
      url: new URL(`/catalog?page=${page}`, "https://fixture.invalid"),
    });
    const parsed = FixturePageSchema.parse(JSON.parse(response.body));
    for (const item of parsed.items) {
      await session.emit({ sourceKey: item.id, value: item });
    }
    if (parsed.nextPage === null) return;
    await session.checkpoint({ page: parsed.nextPage });
    page = parsed.nextPage;
  }
};
