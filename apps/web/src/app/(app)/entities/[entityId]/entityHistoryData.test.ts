import { describe, expect, it } from "vitest";

import { getEntityHistoryEvents } from "./entityHistoryData";

describe("getEntityHistoryEvents", () => {
  it("formats dates and carries operating state across generic events", () => {
    expect(
      getEntityHistoryEvents([
        {
          id: 1,
          entityId: 2,
          kind: "opened",
          date: "1816",
          description: "Licensed on Islay.",
          newOwnerId: null,
          sourceUrl: "https://example.com/opened",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: 2,
          entityId: 2,
          kind: "closed",
          date: "1983-05",
          description: null,
          newOwnerId: null,
          sourceUrl: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: 3,
          entityId: 2,
          kind: "generic",
          date: "1984-06-15",
          description: "The stills remained silent.",
          newOwnerId: null,
          sourceUrl: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        date: "1816",
        description: "Licensed on Islay.",
        source: { href: "https://example.com/opened", label: "Source" },
        state: "operating",
        title: "Opened",
      },
      {
        date: "May 1983",
        description: undefined,
        source: undefined,
        state: "silent",
        title: "Closed",
      },
      {
        date: "Jun 15, 1984",
        description: "The stills remained silent.",
        source: undefined,
        state: "silent",
        title: undefined,
      },
    ]);
  });
});
