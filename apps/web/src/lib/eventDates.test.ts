import { describe, expect, it } from "vitest";

import {
  getEventsNeedingNextDate,
  getNextEditionDates,
  isEventWithinDays,
} from "./eventDates";

describe("event dates", () => {
  it("moves both dates to the next calendar year", () => {
    expect(
      getNextEditionDates({
        dateStart: "2026-12-31",
        dateEnd: "2027-01-02",
      }),
    ).toEqual({ dateStart: "2027-12-31", dateEnd: "2028-01-02" });
  });

  it("finds event series whose latest date has passed", () => {
    const oldEdition = {
      id: 1,
      name: "Whisky Show",
      dateStart: "2025-09-01",
      dateEnd: "2025-09-02",
    };
    const currentEdition = {
      id: 2,
      name: "whisky show",
      dateStart: "2026-10-01",
      dateEnd: null,
    };
    const expired = {
      id: 3,
      name: "Another show",
      dateStart: "2026-08-01",
      dateEnd: null,
    };

    expect(
      getEventsNeedingNextDate(
        [oldEdition, currentEdition, expired],
        "2026-09-01",
      ),
    ).toEqual([expired]);
  });

  it("includes events that start within 30 days", () => {
    expect(
      isEventWithinDays(
        { dateStart: "2026-10-01", dateEnd: null },
        30,
        "2026-09-01",
      ),
    ).toBe(true);
    expect(
      isEventWithinDays(
        { dateStart: "2026-10-02", dateEnd: null },
        30,
        "2026-09-01",
      ),
    ).toBe(false);
  });
});
