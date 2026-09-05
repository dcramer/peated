import { app } from "@peated/server/app";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";
import { createTestSource, reviewRules } from "./testUtils";

describe("POST /admin/scrape-sources/:id/revisions", () => {
  test("requires an administrator", async ({ defaults }) => {
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.createRevision(
        {
          id: 1,
          listUrl: "https://route-reviews.example/archive",
          rules: reviewRules,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("reports a missing source", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.createRevision(
        {
          id: 999,
          listUrl: "https://route-reviews.example/archive",
          rules: reviewRules,
        },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Source not found.]`);
  });

  test("rejects a list page on another website", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const { source } = await createTestSource(admin.id);
    const error = await waitError(() =>
      routerClient.externalSites.scrapeSources.createRevision(
        {
          id: source.id,
          listUrl: "https://other.example/archive",
          rules: reviewRules,
        },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: The list page must stay on the source website.]`,
    );
  });

  test("saves an inactive revision", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const { source } = await createTestSource(admin.id);

    const revision =
      await routerClient.externalSites.scrapeSources.createRevision(
        {
          id: source.id,
          listUrl: source.listUrl,
          rules: reviewRules,
        },
        { context: { user: admin } },
      );

    expect(revision).toMatchObject({
      active: false,
      author: "person",
      previewStatus: "pending",
      revision: 1,
    });
  });

  test("saves strict union rules over HTTP", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const token = await fixtures.AuthToken({ user: admin });
    const { source } = await createTestSource(admin.id);
    const response = await app.request(
      `/v1/admin/scrape-sources/${source.id}/revisions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listUrl: source.listUrl,
          rules: {
            ...reviewRules,
            article: {
              ...reviewRules.article,
              canonicalUrl: {
                try: [
                  {
                    get: "attribute",
                    selector: 'link[rel="canonical"]',
                    attribute: "href",
                    clean: {
                      removeStart: null,
                      removeEnd: ["/"],
                      addStart: null,
                      addEnd: null,
                    },
                  },
                ],
              },
            },
          },
        }),
      },
      {
        incoming: {
          socket: {
            remoteAddress: "127.0.0.1",
            remotePort: 12345,
            remoteFamily: "IPv4",
          },
        },
      },
    );

    expect({
      status: response.status,
      body: await response.json(),
    }).toMatchObject({
      status: 200,
      body: {
        active: false,
        author: "person",
        previewStatus: "pending",
        revision: 1,
        rules: {
          article: {
            canonicalUrl: {
              try: [
                {
                  get: "attribute",
                  selector: 'link[rel="canonical"]',
                  attribute: "href",
                  clean: {
                    removeStart: null,
                    removeEnd: ["/"],
                    addStart: null,
                    addEnd: null,
                  },
                },
              ],
            },
          },
        },
      },
    });
  });
});
