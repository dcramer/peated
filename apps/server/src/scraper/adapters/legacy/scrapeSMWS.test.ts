import { loadFixture } from "@peated/server/lib/test/fixtures";
import { z } from "zod";
import { scrapeBottles } from "./scrapeSMWS";

process.env.DISABLE_HTTP_CACHE = "1";

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
        "releaseDate": "2023-10-06",
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
        "releaseDate": "2023-12-13",
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

test("continues when optional SMWS catalog fields are absent", async ({
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

  expect(items).toHaveLength(127);
  expect(items[0][0]).toMatchObject({
    name: "3.350 Gladrags of yesteryear",
    maturation: null,
    caskNumber: "3.350",
    vintageYear: 2004,
    releaseDate: "2023-12-13",
  });
  expect(items[1][0]).toMatchObject({
    name: "4.303 A nocturne sipper",
    vintageYear: null,
    releaseDate: null,
    releaseYear: null,
  });
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
