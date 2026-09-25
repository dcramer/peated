import { loadFixture } from "@peated/server/lib/test/fixtures";
import { vi } from "vitest";
import type { ScraperObservation, ScraperSession } from "../types";
import {
  kegnbottleAdapter,
  KegnbottleObservationSchema,
  type KegnbottleCursor,
  type KegnbottleObservation,
} from "./kegnbottle";

const EMPTY_PAGE = JSON.stringify({ products: [] });

function pageNumber(url: URL): number {
  return Number(url.searchParams.get("page"));
}

function createSession(
  respond: (page: number) => string,
  { failEmitAfter }: { failEmitAfter?: number } = {},
) {
  const observations: ScraperObservation<KegnbottleObservation>[] = [];
  const checkpoints: KegnbottleCursor[] = [];
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: respond(pageNumber(url)),
  }));
  const session: ScraperSession<KegnbottleCursor, KegnbottleObservation> = {
    request,
    emit: async (observation) => {
      if (failEmitAfter !== undefined && observations.length >= failEmitAfter) {
        throw new Error("Emit failed.");
      }
      observations.push(observation);
    },
    checkpoint: async (cursor) => {
      checkpoints.push(cursor);
    },
    remainingRequests: () => 30,
  };
  return { session, request, observations, checkpoints };
}

test("emits available single bottles in batches and skips unsupported products", async () => {
  const catalog = await loadFixture("kegnbottle", "bottle-list.json");
  const { session, request, observations, checkpoints } = createSession(
    (page) => (page === 1 ? catalog : EMPTY_PAGE),
  );

  await kegnbottleAdapter({ cursor: null, session });

  expect(request.mock.calls.map(([input]) => input.url.href)).toEqual([
    "https://kegnbottle.com/collections/whiskey/products.json?limit=250&page=1",
    "https://kegnbottle.com/collections/whiskey/products.json?limit=250&page=2",
  ]);
  expect(checkpoints).toEqual([{ page: 2 }]);
  expect(observations.map((observation) => observation.itemCount)).toEqual([
    5, 5,
  ]);
  for (const observation of observations) {
    expect(observation.sourceKey).toMatch(/^kegnbottle:[0-9a-f]{64}$/);
    KegnbottleObservationSchema.parse(observation.value);
  }
  expect(observations.flatMap((observation) => observation.value)).toEqual([
    {
      currency: "usd",
      externalProductId: "1001",
      imageUrl: "https://kegnbottle.com/cdn/shop/products/eagle-rare.png",
      name: "Eagle Rare Kentucky Straight Bourbon",
      price: 6999,
      url: "https://kegnbottle.com/products/eagle-rare-bourbon-750-ml",
      volume: 750,
    },
    {
      currency: "usd",
      externalProductId: "1022",
      imageUrl: "https://cdn.shopify.com/s/files/buffalo-trace.png",
      name: "Buffalo Trace Bourbon Whiskey",
      price: 2599,
      url: "https://kegnbottle.com/products/buffalo-trace?variant=1022",
      volume: 750,
    },
    {
      currency: "usd",
      externalProductId: "1023",
      imageUrl: "https://cdn.shopify.com/s/files/buffalo-trace.png",
      name: "Buffalo Trace Bourbon Whiskey",
      price: 3499,
      url: "https://kegnbottle.com/products/buffalo-trace?variant=1023",
      volume: 1000,
    },
    {
      currency: "usd",
      externalProductId: "1024",
      imageUrl: "https://cdn.shopify.com/s/files/buffalo-trace.png",
      name: "Buffalo Trace Bourbon Whiskey",
      price: 6999,
      url: "https://kegnbottle.com/products/buffalo-trace?variant=1024",
      volume: 1750,
    },
    {
      currency: "usd",
      externalProductId: "1091",
      imageUrl: null,
      name: "Kura The Whisky Rum Cask Finish",
      price: 7999,
      url: "https://kegnbottle.com/products/kura-the-whisky-rum-cask-finish",
      volume: 700,
    },
    {
      currency: "usd",
      externalProductId: "1131",
      imageUrl: "https://cdn.shopify.com/s/files/four-roses.png",
      name: "Four Roses Single Barrel Kentucky Straight Bourbon",
      price: 5499,
      url: "https://kegnbottle.com/products/four-roses-single-barrel",
      volume: 750,
    },
    {
      currency: "usd",
      externalProductId: "1211",
      imageUrl:
        "https://cdn.shopify.com/s/files/sagamore-spirit-rye-whiskey.png",
      name: "Sagamore Spirit Rye Whiskey",
      price: 3999,
      url: "https://kegnbottle.com/products/sagamore-spirit-rye-whiskey",
      volume: 750,
    },
    {
      currency: "usd",
      externalProductId: "1221",
      imageUrl: "https://cdn.shopify.com/s/files/btac-george-t-stagg.png",
      name: "Buffalo Trace Antique Collection - George T. Stagg",
      price: 129999,
      url: "https://kegnbottle.com/products/btac-george-t-stagg",
      volume: 750,
    },
    {
      currency: "usd",
      externalProductId: "1231",
      imageUrl:
        "https://cdn.shopify.com/s/files/ardbeg-vintage_y2k-23-year.png",
      name: "Ardbeg Vintage_Y2K 23-year-old Single Malt Scotch Whisky",
      price: 89999,
      url: "https://kegnbottle.com/products/ardbeg-vintage_y2k-23-year",
      volume: 750,
    },
    {
      currency: "usd",
      externalProductId: "1241",
      imageUrl:
        "https://cdn.shopify.com/s/files/whistlepig-the-boss-hog-%E5%85%AD-samurai-scientist.png",
      name: "WhistlePig The Boss Hog 六 Samurai Scientist Katana Edition Rye Whiskey",
      price: 69999,
      url: "https://kegnbottle.com/products/whistlepig-the-boss-hog-%E5%85%AD-samurai-scientist",
      volume: 750,
    },
  ]);
});

test("gives repeated listings the same source key", async () => {
  const catalog = await loadFixture("kegnbottle", "bottle-list.json");
  const first = createSession((page) => (page === 1 ? catalog : EMPTY_PAGE));
  const second = createSession((page) => (page === 1 ? catalog : EMPTY_PAGE));

  await kegnbottleAdapter({ cursor: null, session: first.session });
  await kegnbottleAdapter({ cursor: null, session: second.session });

  expect(
    first.observations.map((observation) => observation.sourceKey),
  ).toEqual(second.observations.map((observation) => observation.sourceKey));
});

test("resumes from the saved page and saves listings before progress", async () => {
  const catalog = await loadFixture("kegnbottle", "bottle-list.json");
  const { session, request, observations, checkpoints } = createSession(
    (page) => (page === 3 ? catalog : EMPTY_PAGE),
  );

  await kegnbottleAdapter({ cursor: { page: 3 }, session });

  expect(request.mock.calls.map(([input]) => pageNumber(input.url))).toEqual([
    3, 4,
  ]);
  expect(observations).toHaveLength(2);
  expect(checkpoints).toEqual([{ page: 4 }]);
});

test("does not save progress when a page's listings cannot be saved", async () => {
  const catalog = await loadFixture("kegnbottle", "bottle-list.json");
  const { session, checkpoints } = createSession(() => catalog, {
    failEmitAfter: 1,
  });

  await expect(kegnbottleAdapter({ cursor: null, session })).rejects.toThrow(
    "Emit failed.",
  );
  expect(checkpoints).toEqual([]);
});

test("fails a fresh run that finds no listings", async () => {
  const { session } = createSession(() => EMPTY_PAGE);

  await expect(kegnbottleAdapter({ cursor: null, session })).rejects.toThrow(
    "no supported whisky listings",
  );
});

test("finishes a resumed run whose remaining pages are empty", async () => {
  const { session, checkpoints } = createSession(() => EMPTY_PAGE);

  await expect(
    kegnbottleAdapter({ cursor: { page: 2 }, session }),
  ).resolves.toBeUndefined();
  expect(checkpoints).toEqual([]);
});

test("rejects a malformed catalog payload", async () => {
  const { session } = createSession(() => JSON.stringify({ items: [] }));

  await expect(kegnbottleAdapter({ cursor: null, session })).rejects.toThrow();
});

test("stops at the page limit instead of crawling the whole store", async () => {
  const catalog = await loadFixture("kegnbottle", "bottle-list.json");
  const { session, request, checkpoints } = createSession(() => catalog);

  await kegnbottleAdapter({ cursor: null, session });

  expect(request).toHaveBeenCalledTimes(25);
  expect(checkpoints.at(-1)).toEqual({ page: 26 });
});
