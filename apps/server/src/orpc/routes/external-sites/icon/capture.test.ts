import { db } from "@peated/server/db";
import {
  externalSiteScrapeTargets,
  externalSites,
  scrapeOrigins,
  scrapeTargets,
} from "@peated/server/db/schema";
import type * as FixtureModule from "@peated/server/lib/test/fixtures";
import waitError from "@peated/server/lib/test/waitError";
import { readFile } from "@peated/server/lib/uploads";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

async function sourceWithOrigin(
  fixtures: typeof FixtureModule,
  origin = "https://icon-source.example",
) {
  const site = await fixtures.ExternalSite({ type: "icon-source" });
  await db.insert(scrapeTargets).values({
    key: site.type,
    enabled: true,
    maxResponseBytes: 10_485_760,
    maxRetries: 2,
    minimumSpacingMs: 2_000,
    requestsPerWindow: 60,
    timeoutMs: 30_000,
    windowMs: 3_600_000,
  });
  await db.insert(scrapeOrigins).values({
    origin,
    robotsMode: "enforce",
    targetKey: site.type,
  });
  await db.insert(externalSiteScrapeTargets).values({
    externalSiteId: site.id,
    targetKey: site.type,
  });
  return site;
}

test("capturing a site icon requires an administrator", async ({
  fixtures,
}) => {
  const site = await sourceWithOrigin(fixtures);
  const moderator = await fixtures.User({ mod: true });

  const error = await waitError(() =>
    routerClient.externalSites.icon.capture(
      { site: site.type },
      { context: { user: moderator } },
    ),
  );

  expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
});

test("captures and stores a normalized site icon", async ({ fixtures }) => {
  const site = await sourceWithOrigin(fixtures);
  const administrator = await fixtures.User({ admin: true });
  const sourceIcon = await sharp({
    create: {
      background: "#e89b24",
      channels: 4,
      height: 256,
      width: 256,
    },
  })
    .png()
    .toBuffer();
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/") {
        return new Response(
          `<link rel="apple-touch-icon" href="/site-icon.png" sizes="256x256">`,
          { headers: { "content-type": "text/html" } },
        );
      }
      if (url.pathname === "/site-icon.png") {
        return new Response(new Uint8Array(sourceIcon), {
          headers: { "content-type": "image/png" },
        });
      }
      return new Response(null, { status: 404 });
    }),
  );

  const result = await routerClient.externalSites.icon.capture(
    { site: site.type },
    { context: { user: administrator } },
  );
  const [stored] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.id, site.id));
  const filename = new URL(result.imageUrl!).pathname.slice("/uploads/".length);
  const metadata = await sharp(await readFile({ filename })).metadata();

  expect(stored?.imageUrl).toMatch(/^\/uploads\/external-sites\/.+\.webp$/);
  expect(result.imageUrl).toContain("/uploads/external-sites/");
  expect(metadata).toMatchObject({ format: "webp", height: 128, width: 128 });
});

test("rejects icon capture when the scraper has no website", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "no-icon-origin" });
  const administrator = await fixtures.User({ admin: true });

  const error = await waitError(() =>
    routerClient.externalSites.icon.capture(
      { site: site.type },
      { context: { user: administrator } },
    ),
  );

  expect(error).toMatchInlineSnapshot(
    `[Error: This scraper has no website to check.]`,
  );
});

test("tries the next website when an icon is unavailable", async ({
  fixtures,
}) => {
  const site = await sourceWithOrigin(fixtures);
  await db.insert(scrapeOrigins).values({
    origin: "https://second-icon-source.example",
    robotsMode: "enforce",
    targetKey: site.type,
  });
  const administrator = await fixtures.User({ admin: true });
  const sourceIcon = await sharp({
    create: {
      background: "#e89b24",
      channels: 4,
      height: 128,
      width: 128,
    },
  })
    .png()
    .toBuffer();
  let homepageRequests = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/") {
        homepageRequests += 1;
        return homepageRequests === 1
          ? new Response(null, { status: 404 })
          : new Response(
              `<link rel="icon" href="/site-icon.png" sizes="128x128">`,
              { headers: { "content-type": "text/html" } },
            );
      }
      if (url.pathname === "/site-icon.png") {
        return new Response(new Uint8Array(sourceIcon), {
          headers: { "content-type": "image/png" },
        });
      }
      return new Response(null, { status: 404 });
    }),
  );

  const result = await routerClient.externalSites.icon.capture(
    { site: site.type },
    { context: { user: administrator } },
  );

  expect(result.imageUrl).toContain("/uploads/external-sites/");
  expect(homepageRequests).toBe(2);
});

test("does not hide an invalid stored origin", async ({ fixtures }) => {
  const site = await sourceWithOrigin(fixtures, "https://[");
  const administrator = await fixtures.User({ admin: true });

  const error = await waitError(() =>
    routerClient.externalSites.icon.capture(
      { site: site.type },
      { context: { user: administrator } },
    ),
  );

  expect(error).toMatchInlineSnapshot(`[TypeError: Invalid URL]`);
});
