import type { Outputs } from "@peated/server/orpc/router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { InboxListContent, inboxTaskHref } from "./inboxList";

type Task = Outputs["admin"]["moderation"]["listTasks"]["results"][number];

const operationTask = {
  key: "operation:22",
  kind: "operation",
  category: "catalog",
  state: "ready",
  inconclusive: false,
  title: "Update brand or producer #42",
  sourceLabel: "Moderator audit",
  question: "Apply these changes to the brand or producer?",
  statusLabel: "Suggested change",
  attentionAt: "2026-08-12T10:00:00.000Z",
  source: { kind: "operation", checkId: 9, operationId: 22 },
} satisfies Task;

const listingTask = {
  key: "listing:7",
  kind: "listing",
  category: "listing",
  state: "blocked",
  inconclusive: false,
  title: "Mystery whisky listing",
  sourceLabel: "Example Store",
  question: "How should this listing be resolved?",
  statusLabel: "Needs recovery",
  attentionAt: "2026-08-12T09:00:00.000Z",
  source: { kind: "listing", proposalId: 7 },
} satisfies Task;

describe("Moderation Inbox list", () => {
  test("renders compact task questions, counts, and selected state", () => {
    const html = renderToStaticMarkup(
      <InboxListContent
        data={{
          results: [listingTask, operationTask],
          counts: {
            all: 2,
            listing: 1,
            catalog: 1,
            blocked: 1,
            inconclusive: 0,
          },
          rel: { nextCursor: null, prevCursor: null },
        }}
        pathname="/admin/moderation/inbox/operation/22"
        searchParams={new URLSearchParams("category=catalog&query=brand")}
        selectedKey="operation:22"
      />,
    );

    expect(html).toContain("Apply these changes to the brand or producer?");
    expect(html).toContain("How should this listing be resolved?");
    expect(html).toContain("Listings 1");
    expect(html).toContain("Catalog 1");
    expect(html).toContain('aria-current="true"');
  });

  test("preserves list filters in direct task URLs", () => {
    expect(
      inboxTaskHref(
        operationTask,
        new URLSearchParams("category=catalog&blocked=true"),
      ),
    ).toBe(
      "/admin/moderation/inbox/operation/22?category=catalog&blocked=true",
    );
  });

  test("renders page links without keeping a selected task in the path", () => {
    const html = renderToStaticMarkup(
      <InboxListContent
        data={{
          results: [listingTask],
          counts: {
            all: 201,
            listing: 201,
            catalog: 0,
            blocked: 1,
            inconclusive: 0,
          },
          rel: { nextCursor: 3, prevCursor: 1 },
        }}
        pathname="/admin/moderation/inbox/listing/7"
        searchParams={
          new URLSearchParams("category=listing&query=whisky&cursor=2")
        }
        selectedKey="listing:7"
      />,
    );

    expect(html).toContain("Page 2");
    expect(html).toContain(
      'href="/admin/moderation/inbox?category=listing&amp;query=whisky&amp;cursor=1"',
    );
    expect(html).toContain(
      'href="/admin/moderation/inbox?category=listing&amp;query=whisky&amp;cursor=3"',
    );
  });
});
