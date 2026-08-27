import {
  includesQuery,
  mockEvents,
  mockPage,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

const today = "2026-08-26";
const upcomingCutoff = "2026-10-10";

export default mockOS.events.list.handler(async ({ input }) => {
  const events = mockEvents
    .filter(
      (event) =>
        (event.dateEnd ?? event.dateStart) >= today &&
        (!input.onlyUpcoming || event.dateStart <= upcomingCutoff) &&
        includesQuery(input.query, event.name),
    )
    .toSorted((left, right) => {
      switch (input.sort) {
        case "-date":
          return right.dateStart.localeCompare(left.dateStart);
        case "name":
          return left.name.localeCompare(right.name);
        case "-name":
          return right.name.localeCompare(left.name);
        case "date":
          return left.dateStart.localeCompare(right.dateStart);
      }
    });

  return mockPage(events, input.cursor, input.limit);
});
