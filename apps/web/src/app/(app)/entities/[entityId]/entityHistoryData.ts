import type { Outputs } from "@peated/server/orpc/router";

import type { HistoryEvent, HistoryState } from "@peated/web/components";

type EntityEvent = Outputs["entities"]["events"]["list"]["results"][number];

const eventTitles = {
  acquired: "Acquired",
  closed: "Closed",
  generic: undefined,
  mothballed: "Mothballed",
  opened: "Opened",
  reopened: "Reopened",
} as const satisfies Record<EntityEvent["kind"], string | undefined>;

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

function formatEventDate(value: string) {
  if (value.length === 4) return value;
  const completeDate = value.length === 7 ? `${value}-01` : value;
  const formatter = value.length === 7 ? monthFormatter : dayFormatter;
  return formatter.format(new Date(`${completeDate}T00:00:00Z`));
}

export function getEntityHistoryEvents(
  events: readonly EntityEvent[],
): HistoryEvent[] {
  let state: HistoryState = "operating";

  return events.map((event) => {
    if (event.kind === "closed" || event.kind === "mothballed") {
      state = "silent";
    } else if (event.kind === "opened" || event.kind === "reopened") {
      state = "operating";
    }

    return {
      date: formatEventDate(event.date),
      description: event.description ?? undefined,
      source: event.sourceUrl
        ? { href: event.sourceUrl, label: "Source" }
        : undefined,
      state,
      title: eventTitles[event.kind],
    };
  });
}
