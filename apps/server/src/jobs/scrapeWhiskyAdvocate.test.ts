import { loadFixture } from "@peated/server/lib/test/fixtures";
import { scrapeIssueList, scrapeReviews } from "./scrapeWhiskyAdvocate";

test("review list", async ({ axiosMock }) => {
  const url =
    "https://whiskyadvocate.com/ratings-reviews?custom_rating_issue%5B0%5D=Winter+2023&order_by=published_desc";
  const result = await loadFixture("whiskyadvocate", "bottle-list.html");

  axiosMock.onGet(url).reply(200, result);

  const items: any[] = [];

  const fn = scrapeReviews(url, async (item) => {
    items.push(item);
  });

  await fn;

  expect(items.length).toBe(166);
  expect(items[0]).toEqual({
    name: "Angel's Envy Cask Strength Sauternes and Toasted Oak Barrel Finished (Batch RC1)",
    category: "rye",
    rating: 94,
    issue: "Winter 2023",
    url: "https://whiskyadvocate.com/Angel-s-Envy-Cask-Strength-Sauternes-and-Toasted-Oak-Barrel-Finished-Batch-RC1-57-2",
  });
});

test("issue list", async ({ axiosMock }) => {
  const url = "https://whiskyadvocate.com/ratings-reviews";
  const result = await loadFixture("whiskyadvocate", "empty-search.html");

  axiosMock.onGet(url).reply(200, result);

  const fn = scrapeIssueList(url);

  const items = await fn;

  expect(items.length).toBe(106);
  expect(items[0]).toEqual("Winter 2023");
});
