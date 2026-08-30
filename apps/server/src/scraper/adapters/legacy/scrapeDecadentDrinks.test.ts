import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import {
  parseExplicitReleaseYear,
  parseSitemapUpdatedYears,
  parseSkuReleaseYear,
  scrapeProducts,
} from "./scrapeDecadentDrinks";

test("reads update years from the sitemap", () => {
  const sitemap = parseSitemapUpdatedYears(`
    <urlset>
      <url>
        <loc>https://decadent-drinks.com/shop/example/</loc>
        <lastmod>2024-10-12</lastmod>
      </url>
      <url><loc>https://decadent-drinks.com/shop/no-date</loc></url>
    </urlset>
  `);

  expect(sitemap.get("https://decadent-drinks.com/shop/example")).toBe(2024);
  expect(sitemap.has("https://decadent-drinks.com/shop/no-date")).toBe(false);
  expect(parseSkuReleaseYear('{"SKU":"BDS2429"}')).toBe(2024);
  expect(parseExplicitReleaseYear("Equinox & Solstice Summer 2024")).toBe(2024);
});

test("scrapes whisky listings and ignores unsupported sizes", async ({
  axiosMock,
}) => {
  const url = "https://decadent-drinks.com/shop?category=5&page=0";
  const result = await loadFixture("decadentdrinks", "bottle-list.html");

  axiosMock.onGet(url).reply(200, result);

  const items: any[] = [];
  const identities: any[] = [];
  const page = scrapeProducts(url, async (item) => {
    const { sourceBottleIdentity, ...price } =
      StorePriceInputSchema.parse(item);
    identities.push(sourceBottleIdentity);
    items.push(price);
  });
  await expect(page).resolves.toEqual({ hasSourceProducts: true });

  expect(items).toEqual([
    {
      currency: "gbp",
      imageUrl:
        "https://decadent-drinks.com/sites/default/files/tomatin-31.jpg",
      name: "Whiskyland Chapter Thirty Four Tomatin 31-year-old",
      price: 43500,
      url: "https://decadent-drinks.com/shop/whiskyland-chapter-thirty-four-tomatin-31-years-old",
      volume: 700,
    },
  ]);
  expect(identities).toMatchObject([
    {
      bottler: "Decadent Drinks",
      release_year: null,
    },
  ]);
});

test("accepts a SKU year only when the sitemap year agrees", async ({
  axiosMock,
}) => {
  const url = "https://decadent-drinks.com/shop?category=5&page=0";
  const productUrl =
    "https://decadent-drinks.com/shop/whiskyland-chapter-thirty-four-tomatin-31-years-old";
  axiosMock
    .onGet(url)
    .reply(200, await loadFixture("decadentdrinks", "bottle-list.html"));
  axiosMock.onGet(productUrl).reply(200, '{"SKU":"2429"}');

  const identities: any[] = [];
  await scrapeProducts(
    url,
    async (item) => {
      identities.push(item.sourceBottleIdentity);
    },
    parseSitemapUpdatedYears(
      `<urlset><url><loc>${productUrl}/</loc><lastmod>2024-10-12</lastmod></url></urlset>`,
    ),
  );

  expect(identities).toMatchObject([{ release_year: 2024 }]);
});
