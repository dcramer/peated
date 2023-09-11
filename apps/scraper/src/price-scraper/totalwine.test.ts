import mockAxios from "vitest-mock-axios";
import { loadFixture } from "~/lib/test";
import { scrapeProducts } from "./totalwine";

process.env.DISABLE_HTTP_CACHE = "1";

test("selects only 750ml", async () => {
  const url =
    "https://www.totalwine.com/spirits/scotch/single-malt/c/000887?viewall=true&pageSize=120&aty=0,0,0,0";
  const result = await loadFixture("totalwine", "bottle-list.html");

  const items: any[] = [];

  const fn = scrapeProducts(url, async (item) => {
    items.push(item);
  });

  expect(mockAxios.get).toHaveBeenCalledOnce();

  mockAxios.mockResponseFor({ url }, { data: result });

  await fn;

  expect(items.length).toBe(102);
});
