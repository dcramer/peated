import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import scrapeKilchoman, {
  parseKilchomanProducts,
  scrapeProducts,
} from "./scrapeKilchoman";

process.env.DISABLE_HTTP_CACHE = "1";

const shopUrl = "https://www.kilchomandistillery.com/whisky-shop/";

test("scrapes purchasable bottles and excludes unsupported products", async ({
  axiosMock,
}) => {
  const result = await loadFixture("kilchoman", "bottle-list.html");
  axiosMock.onGet(shopUrl).reply(200, result);

  const items: unknown[] = [];
  await scrapeProducts(shopUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });

  expect(items).toEqual([
    {
      currency: "gbp",
      imageUrl:
        "https://www.kilchomandistillery.com/wp-content/uploads/2018/06/MachirBay70cl_BC_Low.png",
      name: "Kilchoman Machir Bay 70cl",
      price: 4158,
      url: "https://www.kilchomandistillery.com/our-whisky/machir-bay/",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl:
        "https://www.kilchomandistillery.com/wp-content/uploads/2025/03/13YearsOld2025_BC_Low.png",
      name: "Kilchoman 13-year-old",
      price: 7492,
      url: "https://www.kilchomandistillery.com/our-whisky/13-years-old/",
      volume: 700,
    },
  ]);
});

test("rejects malformed candidate cards", () => {
  const html = `
    <ul class="grid-products">
      <li class="product">
        <a href="/our-whisky/broken/"><h3>Broken Release</h3></a>
        <div class="img_place" style="background:url('/broken.png')"></div>
      </li>
    </ul>
  `;

  expect(() => parseKilchomanProducts(html, shopUrl)).toThrow();
});

test("runs a single-page dry run and stops on duplicate listings", async ({
  axiosMock,
}) => {
  const result = await loadFixture("kilchoman", "bottle-list.html");
  axiosMock.onGet(shopUrl).reply(200, result);

  await expect(scrapeKilchoman({ dryRun: true })).resolves.toBe(2);
  expect(axiosMock.history.get).toHaveLength(2);
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(shopUrl).reply(200, '<ul class="grid-products"></ul>');

  await expect(scrapeKilchoman({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
