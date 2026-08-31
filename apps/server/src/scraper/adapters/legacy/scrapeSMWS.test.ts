import { loadFixture } from "@peated/server/lib/test/fixtures";
import { z } from "zod";
import {
  parseArchivePage,
  parseCaskNumberFromSku,
  parseStorefrontToken,
  scrapeArchiveBottles,
  scrapeBottles,
} from "./scrapeSMWS";

process.env.DISABLE_HTTP_CACHE = "1";

test("decodes exact SMWS cask identity from a bottle SKU", () => {
  expect(parseCaskNumberFromSku("001243GB0700607")).toBe("1.243");
  expect(parseCaskNumberFromSku("RW3006GB0700605")).toBe("RW3.6");
  expect(parseCaskNumberFromSku("0B5015GB0700607")).toBe("B5.15");
  expect(parseCaskNumberFromSku("BUNDLE-UK")).toBeNull();
});

test("parses all-time archive bottle cards and skips non-bottle products", () => {
  const result = parseArchivePage(`
    <p class="productCount">121 Products</p>
    <ul class="productGrid">
      <li class="product">
        <article class="itemSmall"
          data-item-id="42"
          data-item-image="https://images.example/1.243.png"
          data-item-name="Cast a net and catch the sun"
          data-item-sku="001243GB0700607"
          data-item-type="New Charred Oak Barrel"
          data-item-distilleddate="26-02-2013">
          <div class="itemInfoWrap"><ul>
            <li><span class="name">CASK NO.</span><span class="value">1.234</span></li>
            <li><span class="name">REGION</span><span class="value">Speyside</span></li>
            <li><span class="name">Age</span><span class="value">7 years</span></li>
            <li><span class="name">ABV</span><span class="value">56.7%</span></li>
            <li><span class="name">CASK</span><span class="value">New Charred Oak Barrel</span></li>
            <li><span class="name">OUTTURN</span><span class="value">607 bottles</span></li>
            <li><span class="name">Spirit</span><span class="value">Malt Whisky</span></li>
          </ul></div>
        </article>
      </li>
      <li class="product">
        <article class="itemSmall"
          data-item-name="Tabanco Time"
          data-item-sku="SM0011GB0700611"
          data-item-type="Ex-Oloroso butts &amp; Ex-Pedro Ximenes hogsheads">
          <div class="itemInfoWrap"><ul>
            <li><span class="name">CASK NO.</span><span class="value">BAT.13</span></li>
            <li><span class="name">REGION</span><span class="value">Blended malt</span></li>
            <li><span class="name">ABV</span><span class="value">50.0%</span></li>
            <li><span class="name">Spirit</span><span class="value">Malt Whisky</span></li>
          </ul></div>
        </article>
      </li>
      <li class="product">
        <article class="itemSmall"
          data-item-name="Festival tasting pack"
          data-item-sku="FESTIVAL-PACK"></article>
      </li>
      <li class="product">
        <article class="itemSmall"
          data-item-name="Anniversary Case"
          data-item-sku="CASE-1983">
          <div class="itemInfoWrap"><ul>
            <li><span class="name">CASK NO.</span><span class="value">1.9.8.3</span></li>
            <li><span class="name">ABV</span><span class="value">57.8%</span></li>
          </ul></div>
        </article>
      </li>
      <li class="product">
        <article class="itemSmall"
          data-item-name="Incognito"
          data-item-sku="BATCH41"
          data-item-type="Small batch">
          <div class="itemInfoWrap"><ul>
            <li><span class="name">CASK NO.</span><span class="value">Batch 41</span></li>
            <li><span class="name">ABV</span><span class="value">50.0%</span></li>
            <li><span class="name">SPIRIT</span><span class="value">Single Grain</span></li>
          </ul></div>
        </article>
      </li>
    </ul>
  `);

  expect(result.pageCount).toBe(2);
  expect(result.bottles).toHaveLength(3);
  expect(result.bottles[0]).toMatchObject({
    imageUrl: "https://images.example/1.243.png",
    productId: 42,
  });
  expect(result.bottles[0]?.bottle).toMatchObject({
    name: "1.243 Cast a net and catch the sun",
    statedAge: 7,
    vintageYear: 2013,
    abv: 56.7,
    category: "single_malt",
    caskNumber: "1.243",
    maturation: "New Charred Oak Barrel",
    outturn: 607,
    singleCask: true,
    distillers: [{ name: "Glenfarclas" }],
  });
  expect(result.bottles[1]?.bottle).toMatchObject({
    name: "BAT.13 Tabanco Time",
    abv: 50,
    category: "blended_malt",
    caskNumber: "BAT.13",
    singleCask: false,
    distillers: [],
  });
  expect(result.bottles[2]?.bottle).toMatchObject({
    name: "Incognito",
    edition: "Batch 41",
    category: "single_grain",
    caskNumber: null,
    singleCask: false,
    distillers: [],
  });
});

test("marks an explicitly multi-cask Society release as a small batch", () => {
  const result = parseArchivePage(`
    <p class="productCount">1 Product</p>
    <ul class="productGrid"><li class="product">
      <article class="itemSmall"
        data-item-name="A cake walk in the Black Forest"
        data-item-sku="064149GB0700607"
        data-item-type="two 1st fill oloroso hogsheads">
        <div class="itemInfoWrap"><ul>
          <li><span class="name">CASK NO.</span><span class="value">64.149</span></li>
          <li><span class="name">ABV</span><span class="value">56.6%</span></li>
        </ul></div>
      </article>
    </li></ul>
  `);

  expect(result.bottles[0]?.bottle).toMatchObject({
    caskNumber: "64.149",
    singleCask: false,
  });
});

test("keeps Society batch-family codes separate from single-cask codes", () => {
  const result = parseArchivePage(`
    <p class="productCount">4 Products</p>
    <ul class="productGrid">
      <li class="product"><article class="itemSmall"
        data-item-name="Douro Cruise"
        data-item-sku="BATCH-FAMILY-14"
        data-item-type="1st fill ex-port pipes &amp; 2nd fill ex-bourbon barrels">
        <div class="itemInfoWrap"><ul>
          <li><span class="name">CASK NO.</span><span class="value">BAT.14</span></li>
          <li><span class="name">ABV</span><span class="value">50.0%</span></li>
        </ul></div>
      </article></li>
      <li class="product"><article class="itemSmall"
        data-item-name="Lemon odyssey"
        data-item-sku="SMALL-BATCH-1"
        data-item-type="1st &amp; 2nd fill ex-bourbon barrels">
        <div class="itemInfoWrap"><ul>
          <li><span class="name">CASK NO.</span><span class="value">SM0.1</span></li>
          <li><span class="name">ABV</span><span class="value">50.0%</span></li>
        </ul></div>
      </article></li>
      <li class="product"><article class="itemSmall"
        data-item-name="70s chart topper"
        data-item-sku="TIF-BATCH-1"
        data-item-type="Cognac barrel">
        <div class="itemInfoWrap"><ul>
          <li><span class="name">CASK NO.</span><span class="value">TIF.1</span></li>
          <li><span class="name">ABV</span><span class="value">53.0%</span></li>
        </ul></div>
      </article></li>
      <li class="product"><article class="itemSmall"
        data-item-name="Muscovado meringue"
        data-item-sku="ARMAGNAC-CASK-1"
        data-item-type="refill armagnac black oak barrel">
        <div class="itemInfoWrap"><ul>
          <li><span class="name">CASK NO.</span><span class="value">A9.1</span></li>
          <li><span class="name">ABV</span><span class="value">51.9%</span></li>
        </ul></div>
      </article></li>
    </ul>
  `);

  expect(
    result.bottles.map(({ bottle }) => ({
      caskNumber: bottle.caskNumber,
      singleCask: bottle.singleCask,
    })),
  ).toEqual([
    { caskNumber: "BAT.14", singleCask: false },
    { caskNumber: "SM0.1", singleCask: false },
    { caskNumber: "TIF.1", singleCask: false },
    { caskNumber: "A9.1", singleCask: true },
  ]);
});

test("keeps reused Society labels out of bottle names and cask numbers", () => {
  const result = parseArchivePage(`
    <p class="productCount">4 Products</p>
    <ul class="productGrid">
      <li class="product"><article class="itemSmall"
        data-item-name="Bazaar Berries"
        data-item-sku="SM0123GB0700609">
        <div class="itemInfoWrap"><ul>
          <li><span class="name">CASK NO.</span><span class="value">Small Batch</span></li>
          <li><span class="name">ABV</span><span class="value">50.0%</span></li>
          <li><span class="name">SPIRIT</span><span class="value">Malt Whisky</span></li>
        </ul></div>
      </article></li>
      <li class="product"><article class="itemSmall"
        data-item-name="Viking toothpaste"
        data-item-sku="SM0124GB0700610">
        <div class="itemInfoWrap"><ul>
          <li><span class="name">CASK NO.</span><span class="value">Distillery 93 Rare Release</span></li>
          <li><span class="name">REGION</span><span class="value">Campbeltown</span></li>
          <li><span class="name">ABV</span><span class="value">60.0%</span></li>
          <li><span class="name">SPIRIT</span><span class="value">Malt Whisky</span></li>
        </ul></div>
      </article></li>
      <li class="product"><article class="itemSmall"
        data-item-name="Lime and thyme"
        data-item-sku="SM0125GB0700611">
        <div class="itemInfoWrap"><ul>
          <li><span class="name">CASK NO.</span><span class="value">5 Lowland Batch 2022</span></li>
          <li><span class="name">REGION</span><span class="value">Lowland</span></li>
          <li><span class="name">ABV</span><span class="value">55.8%</span></li>
          <li><span class="name">SPIRIT</span><span class="value">Malt Whisky</span></li>
        </ul></div>
      </article></li>
      <li class="product"><article class="itemSmall"
        data-item-name="Shades of green"
        data-item-sku="SM0126GB0700612">
        <div class="itemInfoWrap"><ul>
          <li><span class="name">CASK NO.</span><span class="value">G17.1</span></li>
          <li><span class="name">ABV</span><span class="value">60.9%</span></li>
          <li><span class="name">SPIRIT</span><span class="value">Single Grain Whisky</span></li>
        </ul></div>
      </article></li>
    </ul>
  `);

  expect(result.bottles.map(({ bottle }) => bottle)).toEqual([
    expect.objectContaining({
      name: "Bazaar Berries",
      category: null,
      caskNumber: null,
      singleCask: false,
      distillers: [],
    }),
    expect.objectContaining({
      name: "Viking toothpaste",
      category: "single_malt",
      caskNumber: null,
      singleCask: false,
      distillers: [{ name: "Glen Scotia" }],
    }),
    expect.objectContaining({
      name: "Lime and thyme",
      category: "single_malt",
      caskNumber: null,
      singleCask: false,
      distillers: [{ name: "Auchentoshan" }],
    }),
    expect.objectContaining({
      name: "G17.1 Shades of green",
      category: "single_grain",
      caskNumber: "G17.1",
      singleCask: true,
      distillers: [],
    }),
  ]);
  for (const { bottle } of result.bottles) {
    expect(bottle).not.toHaveProperty("edition");
  }
});

test("reads the public storefront token from plain or escaped page context", () => {
  expect(
    parseStorefrontToken('{"storefront_api":{"token":"plain-token"}}'),
  ).toBe("plain-token");
  expect(
    parseStorefrontToken(
      '{\\"storefront_api\\":{\\"token\\":\\"escaped-token\\"}}',
    ),
  ).toBe("escaped-token");
  expect(parseStorefrontToken("<html></html>")).toBeNull();
});

test("enriches archive cards from the batch storefront API", async ({
  axiosMock,
}) => {
  const archiveUrl = "https://smws.com/archive?limit=100&page=1";
  axiosMock.onGet(archiveUrl).reply(
    200,
    `
      <script>{"storefront_api":{"token":"public-token"}}</script>
      <p class="productCount">1 Product</p>
      <ul class="productGrid"><li class="product">
        <article class="itemSmall"
          data-item-id="42"
          data-item-image="https://images.example/card.png"
          data-item-name="Cast a net and catch the son"
          data-item-sku="001243GB0700607">
          <div class="itemInfoWrap"><ul>
            <li><span class="name">CASK NO.</span><span class="value">1.234</span></li>
            <li><span class="name">ABV</span><span class="value">56.7%</span></li>
            <li><span class="name">Spirit</span><span class="value">Malt Whisky</span></li>
          </ul></div>
        </article>
      </li></ul>
    `,
  );
  axiosMock.onPost("https://smws.com/graphql").reply(200, {
    data: {
      site: {
        products: {
          edges: [
            {
              node: {
                entityId: 42,
                sku: "001243GB0700607",
                name: "Cast a net and catch the sun",
                description: "<p>A bright &amp; sunny Society description.</p>",
                customFields: {
                  edges: [
                    { node: { name: "Age", value: "7" } },
                    {
                      node: {
                        name: "Date Distilled",
                        value: "26/02/2013",
                      },
                    },
                    {
                      node: {
                        name: "Release Date",
                        value: "2020-10-02 08:00:00",
                      },
                    },
                    { node: { name: "Outturn", value: "607" } },
                    {
                      node: {
                        name: "Flavour Profile",
                        value: "Sweet, Fruity & Mellow",
                      },
                    },
                  ],
                },
                images: {
                  edges: [
                    {
                      node: {
                        urlOriginal: "https://images.example/original.png",
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    },
  });

  const items: any[] = [];
  await scrapeArchiveBottles(
    () => archiveUrl,
    async (...item) => {
      items.push(item);
    },
  );

  expect(items).toEqual([
    [
      expect.objectContaining({
        name: "1.243 Cast a net and catch the sun",
        caskNumber: "1.243",
        description: "A bright & sunny Society description.",
        flavorProfile: "sweet_fruit_mellow",
        outturn: 607,
        releaseMonth: 10,
        releaseDay: 2,
        releaseYear: 2020,
        statedAge: 7,
        vintageYear: 2013,
      }),
      null,
      "https://images.example/original.png",
    ],
  ]);
  expect(axiosMock.history.post[0]?.headers).toMatchObject({
    authorization: "Bearer public-token",
  });
});

test("bottle list", async ({ axiosMock }) => {
  const url = "https://smws.com/all-whisky?filter-page=1&per-page=128";
  const result = await loadFixture("smws", "bottle-list.json");

  axiosMock.onGet(url).reply(200, result);

  const items: any[] = [];

  const fn = scrapeBottles(url, async (...item) => {
    items.push(item);
  });

  await fn;

  expect(items.length).toBe(128);
  expect(items[0]).toMatchInlineSnapshot(`
    [
      {
        "abv": 58.9,
        "bottler": {
          "name": "The Scotch Malt Whisky Society",
        },
        "brand": {
          "name": "The Scotch Malt Whisky Society",
        },
        "caskNumber": "RW3.6",
        "category": "rye",
        "description": null,
        "distillers": [
          {
            "name": "New York Distilling Co.",
          },
        ],
        "maturation": "American Rye Whisky",
        "name": "RW3.6 Truly a flavour bomb",
        "releaseDay": 6,
        "releaseMonth": 10,
        "releaseYear": 2023,
        "singleCask": true,
        "statedAge": 5,
        "vintageYear": 2016,
      },
      {
        "currency": "gbp",
        "externalProductId": "4399",
        "name": "SMWS RW3.6 Truly a flavour bomb",
        "price": 6500,
        "url": "https://smws.com/truly-a-flavour-bomb/",
        "volume": 700,
      },
      "https://cdn11.bigcommerce.com/s-vagfena5nz/products/4399/images/6955/RW3.6-web__05977.1696343897.386.513.png?c=1",
    ]
  `);
  expect(items[1]).toMatchInlineSnapshot(`
    [
      {
        "abv": 57.1,
        "bottler": {
          "name": "The Scotch Malt Whisky Society",
        },
        "brand": {
          "name": "The Scotch Malt Whisky Society",
        },
        "caskNumber": "3.350",
        "category": "single_malt",
        "description": null,
        "distillers": [
          {
            "name": "Bowmore",
          },
        ],
        "maturation": "2nd fill ex-bourbon hogshead",
        "name": "3.350 Gladrags of yesteryear",
        "releaseDay": 13,
        "releaseMonth": 12,
        "releaseYear": 2023,
        "singleCask": true,
        "statedAge": 19,
        "vintageYear": 2004,
      },
      {
        "currency": "gbp",
        "externalProductId": "4702",
        "name": "SMWS 3.350 Gladrags of yesteryear",
        "price": 17950,
        "url": "https://smws.com/gladrags-of-yesteryear/",
        "volume": 700,
      },
      "https://cdn11.bigcommerce.com/s-vagfena5nz/products/4702/images/7487/3.350-GX-web__19122.1704362139.386.513.png?c=1",
    ]
  `);
});

test("continues when optional fields are absent and recovers code from SKU", async ({
  axiosMock,
}) => {
  const url = "https://smws.com/all-whisky?filter-page=1&per-page=128";
  const payload = z
    .object({
      items: z.array(
        z
          .object({
            cask_no: z.string().nullable().optional(),
            cask_type: z.string().nullable().optional(),
            distilleddate: z.string().nullable().optional(),
            release_date: z.string().nullable().optional(),
          })
          .passthrough(),
      ),
    })
    .passthrough()
    .parse(JSON.parse(await loadFixture("smws", "bottle-list.json")));

  payload.items[0].cask_no = null;
  payload.items[1].cask_type = null;
  delete payload.items[2].distilleddate;
  delete payload.items[2].release_date;
  axiosMock.onGet(url).reply(200, payload);

  const items: any[] = [];
  await scrapeBottles(url, async (...item) => {
    items.push(item);
  });

  expect(items).toHaveLength(128);
  expect(items[0][0]).toMatchObject({
    name: "RW3.6 Truly a flavour bomb",
    caskNumber: "RW3.6",
  });
  expect(items[1][0]).toMatchObject({
    name: "3.350 Gladrags of yesteryear",
    maturation: null,
    caskNumber: "3.350",
    vintageYear: 2004,
    releaseYear: 2023,
    releaseMonth: 12,
    releaseDay: 13,
  });
  expect(items[2][0]).toMatchObject({
    name: "4.303 A nocturne sipper",
    vintageYear: null,
  });
  expect(items[2][0]).not.toHaveProperty("releaseYear");
  expect(items[2][0]).not.toHaveProperty("releaseMonth");
  expect(items[2][0]).not.toHaveProperty("releaseDay");
});

test("omits the release date when it conflicts with age and vintage", async ({
  axiosMock,
}) => {
  const url = "https://smws.com/all-whisky?filter-page=1&per-page=128";
  const payload = z
    .object({
      items: z.array(
        z
          .object({
            age: z.number(),
            distilleddate: z.string().nullable(),
            release_date: z.string().nullable(),
          })
          .passthrough(),
      ),
    })
    .passthrough()
    .parse(JSON.parse(await loadFixture("smws", "bottle-list.json")));

  payload.items = [payload.items[0]];
  payload.items[0].age = 8;
  axiosMock.onGet(url).reply(200, payload);

  const items: any[] = [];
  await scrapeBottles(url, async (...item) => {
    items.push(item);
  });

  expect(items).toHaveLength(1);
  expect(items[0][0]).toMatchObject({
    statedAge: 8,
    vintageYear: 2016,
  });
  expect(items[0][0]).not.toHaveProperty("releaseYear");
  expect(items[0][0]).not.toHaveProperty("releaseMonth");
  expect(items[0][0]).not.toHaveProperty("releaseDay");
});

test("uses the SKU volume and positive sale price", async ({ axiosMock }) => {
  const url = "https://smws.com/all-whisky?filter-page=1&per-page=128";
  const payload = z
    .object({
      items: z.array(
        z
          .object({
            sku: z.string(),
            list_description: z.string().nullable(),
            sale_price: z.number(),
          })
          .passthrough(),
      ),
    })
    .passthrough()
    .parse(JSON.parse(await loadFixture("smws", "bottle-list.json")));

  payload.items = [payload.items[0]];
  payload.items[0].sku = "105061GX0351211";
  payload.items[0].list_description = "A half-size Society bottle.";
  payload.items[0].sale_price = 55.25;
  axiosMock.onGet(url).reply(200, payload);

  const items: any[] = [];
  await scrapeBottles(url, async (...item) => {
    items.push(item);
  });

  expect(items).toHaveLength(1);
  expect(items[0][0]).toMatchObject({
    description: "A half-size Society bottle.",
  });
  expect(items[0][1]).toMatchObject({
    price: 5525,
    volume: 350,
  });
});

test("prefers a known cask code encoded in the official SKU", async ({
  axiosMock,
}) => {
  const url = "https://smws.com/all-whisky?filter-page=1&per-page=128";
  const payload = z
    .object({
      items: z.array(
        z
          .object({
            cask_no: z.string(),
          })
          .passthrough(),
      ),
    })
    .passthrough()
    .parse(JSON.parse(await loadFixture("smws", "bottle-list.json")));
  payload.items = [payload.items[0]];
  payload.items[0].cask_no = "RW3.7";
  axiosMock.onGet(url).reply(200, payload);

  const items: any[] = [];
  await scrapeBottles(url, async (...item) => {
    items.push(item);
  });

  expect(items[0][0]).toMatchObject({
    name: "RW3.6 Truly a flavour bomb",
    caskNumber: "RW3.6",
  });
});

test("keeps current batch and rare-release titles clean", async ({
  axiosMock,
}) => {
  const url = "https://smws.com/all-whisky?filter-page=1&per-page=128";
  const payload = z
    .object({
      items: z.array(
        z
          .object({
            sku: z.string(),
            name: z.string(),
            cask_no: z.string().nullable(),
            region: z.string().nullish(),
            spirit_type: z.string().nullish(),
            list_description: z.string().nullish(),
          })
          .passthrough(),
      ),
    })
    .passthrough()
    .parse(JSON.parse(await loadFixture("smws", "bottle-list.json")));
  payload.items = payload.items.slice(0, 4);
  payload.items[0].sku = "SM0123GB0700609";
  payload.items[0].name = "Incognito";
  payload.items[0].cask_no = "Batch 41";
  payload.items[0].region = null;
  payload.items[0].spirit_type = "Single Grain";
  payload.items[1].sku = "SM0124GB0700610";
  payload.items[1].name = "Highland peaty potion";
  payload.items[1].cask_no = "Batch 42";
  payload.items[1].region = "Highland";
  payload.items[1].spirit_type = "Malt Whisky";
  payload.items[2].sku = "SM0125GB0700611";
  payload.items[2].name = "Bazaar Berries";
  payload.items[2].cask_no = "Small Batch";
  payload.items[2].region = null;
  payload.items[2].spirit_type = "Malt Whisky";
  payload.items[2].list_description =
    "A delightful small batch drawn from casks of Speyside single malt.";
  payload.items[3].sku = "SM0126GB0700612";
  payload.items[3].name = "Dark 'n' stormy crème brûlée";
  payload.items[3].cask_no = "Distillery G16 Rare Release";
  payload.items[3].region = "Lowland";
  payload.items[3].spirit_type = "Grain Whisky";
  axiosMock.onGet(url).reply(200, payload);

  const items: any[] = [];
  await scrapeBottles(url, async (...item) => {
    items.push(item);
  });

  expect(items).toHaveLength(4);
  expect(items.map(([bottle]) => bottle)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "Incognito",
        edition: "Batch 41",
        category: "single_grain",
        caskNumber: null,
        singleCask: false,
        distillers: [],
      }),
      expect.objectContaining({
        name: "Highland peaty potion",
        edition: "Batch 42",
        category: null,
        caskNumber: null,
        singleCask: false,
        distillers: [],
      }),
      expect.objectContaining({
        name: "Bazaar Berries",
        category: "single_malt",
        caskNumber: null,
        singleCask: false,
        distillers: [],
      }),
      expect.objectContaining({
        name: "Dark 'n' stormy crème brûlée",
        category: "single_grain",
        caskNumber: null,
        singleCask: false,
        distillers: [{ name: "Glasgow Distillery" }],
      }),
    ]),
  );
  expect(items[2][0]).not.toHaveProperty("edition");
  expect(items[3][0]).not.toHaveProperty("edition");
});
