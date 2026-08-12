import type * as CreateExternalReviewModule from "@peated/server/lib/createExternalReview";
import { ExternalReviewBottleStateError } from "@peated/server/lib/createExternalReview";
import { ActiveBottleSelectionError } from "@peated/server/lib/resolveActiveBottleIds";
import { loadFixture } from "@peated/server/lib/test/fixtures";
import { beforeEach, expect, test, type TestContext, vi } from "vitest";
import scrapeWhiskeyAdvocate, {
  scrapeIssueList,
  scrapeReviews,
} from "./scrapeWhiskyAdvocate";

const createExternalReviewMock = vi.hoisted(() => vi.fn());
const getExternalSiteConfigMock = vi.hoisted(() => vi.fn());
const setExternalSiteConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@peated/server/lib/createExternalReview", async (importOriginal) => ({
  ...(await importOriginal<typeof CreateExternalReviewModule>()),
  createExternalReview: createExternalReviewMock,
}));

vi.mock("@peated/server/lib/externalSiteConfig", () => ({
  getExternalSiteConfig: getExternalSiteConfigMock,
  setExternalSiteConfig: setExternalSiteConfigMock,
}));

beforeEach(() => {
  createExternalReviewMock.mockReset();
  getExternalSiteConfigMock.mockReset();
  setExternalSiteConfigMock.mockReset();
});

async function mockSingleNewIssue(axiosMock: TestContext["axiosMock"]) {
  const issueListUrl = "https://whiskyadvocate.com/ratings-reviews";
  const issueList = await loadFixture("whiskyadvocate", "empty-search.html");
  axiosMock.onGet(issueListUrl).reply(200, issueList);

  const issueNames = await scrapeIssueList(issueListUrl);
  const newIssue = issueNames[0]!;
  const processedIssues = issueNames.slice(1);
  getExternalSiteConfigMock.mockResolvedValue(processedIssues);

  const reviewListUrl = `https://whiskyadvocate.com/ratings-reviews?custom_rating_issue%5B0%5D=${encodeURIComponent(
    newIssue,
  )}&order_by=published_desc`;
  const reviewList = await loadFixture("whiskyadvocate", "bottle-list.html");
  axiosMock.onGet(reviewListUrl).reply(200, reviewList);

  return { newIssue, processedIssues };
}

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

test("continues an issue after a review resolves to an unavailable bottle", async ({
  axiosMock,
}) => {
  const { newIssue, processedIssues } = await mockSingleNewIssue(axiosMock);
  createExternalReviewMock
    .mockRejectedValueOnce(
      new ExternalReviewBottleStateError(
        new ActiveBottleSelectionError("bottle_retired", 123),
      ),
    )
    .mockResolvedValue(undefined);

  await scrapeWhiskeyAdvocate();

  expect(createExternalReviewMock).toHaveBeenCalledTimes(166);
  expect(setExternalSiteConfigMock).toHaveBeenCalledWith({
    site: "whiskyadvocate",
    key: "processedIssues",
    value: [...processedIssues, newIssue],
  });
});

test("leaves an issue unprocessed after an unexpected review failure", async ({
  axiosMock,
}) => {
  await mockSingleNewIssue(axiosMock);
  createExternalReviewMock.mockRejectedValueOnce(new Error("database offline"));

  await expect(scrapeWhiskeyAdvocate()).rejects.toThrow("database offline");
  expect(setExternalSiteConfigMock).not.toHaveBeenCalled();
});
