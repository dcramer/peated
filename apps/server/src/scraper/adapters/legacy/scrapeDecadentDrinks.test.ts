import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { scrapeProducts } from "./scrapeDecadentDrinks";

test("scrapes whisky listings and ignores unsupported sizes", async ({
  axiosMock,
}) => {
  const url = "https://decadent-drinks.com/shop?category=5&page=0";
  const result = await loadFixture("decadentdrinks", "bottle-list.html");

  axiosMock.onGet(url).reply(200, result);

  const items: any[] = [];
  const page = scrapeProducts(url, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
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
});
