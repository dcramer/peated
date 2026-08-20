import { loadFixture } from "@peated/server/lib/test/fixtures";
import { load as cheerio } from "cheerio";
import { vi } from "vitest";
import type { ScraperObservation, ScraperSession } from "../types";
import {
  type WhiskyAdvocateObservation,
  whiskyAdvocateAdapter,
} from "./whiskyAdvocate";

test("fetches the latest issue and preserves Bottle identity facts", async () => {
  const issueHtml = await loadFixture("whiskyadvocate", "empty-search.html");
  const reviewHtml = await loadFixture("whiskyadvocate", "bottle-list.html");
  const $ = cheerio(issueHtml);
  const issueNames = $("select")
    .filter(
      (_, element) =>
        element.attribs.name === "filters[default][custom_rating_issue][]",
    )
    .find("option")
    .toArray()
    .flatMap((element) => {
      const value = $(element).text().trim();
      return element.attribs.value === "" || !value ? [] : [value];
    });
  const observations: ScraperObservation<WhiskyAdvocateObservation>[] = [];
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: url.search.includes("custom_rating_issue") ? reviewHtml : issueHtml,
  }));
  const session: ScraperSession<null, WhiskyAdvocateObservation> = {
    request,
    emit: async (observation) => {
      observations.push(observation);
    },
    checkpoint: vi.fn(),
    remainingRequests: () => 2,
  };

  await whiskyAdvocateAdapter({ cursor: null, session });

  expect(request).toHaveBeenCalledTimes(2);
  expect(
    request.mock.calls[1]?.[0].url.searchParams.get("custom_rating_issue[0]"),
  ).toBe(issueNames[0]);
  expect(observations).toHaveLength(166);
  expect(observations[0]).toMatchObject({
    sourceKey:
      "https://whiskyadvocate.com/Angel-s-Envy-Cask-Strength-Sauternes-and-Toasted-Oak-Barrel-Finished-Batch-RC1-57-2",
    value: {
      name: "Angel’s Envy Cask Strength Sauternes and Toasted Oak Barrel Finished (Batch RC1), 57.2%",
      category: "rye",
      rating: 94,
      issue: "Winter 2023",
    },
  });
});

test("fails when the newest issue has no review results", async () => {
  const issueHtml = await loadFixture("whiskyadvocate", "empty-search.html");
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: issueHtml,
  }));
  const session: ScraperSession<null, WhiskyAdvocateObservation> = {
    request,
    emit: vi.fn(),
    checkpoint: vi.fn(),
    remainingRequests: () => 2,
  };

  await expect(
    whiskyAdvocateAdapter({ cursor: null, session }),
  ).rejects.toThrow("Whisky Advocate issue contains no reviews.");
});
