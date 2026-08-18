import { loadFixture } from "@peated/server/lib/test/fixtures";
import { load as cheerio } from "cheerio";
import { vi } from "vitest";
import type { z } from "zod";
import type { ScraperObservation, ScraperSession } from "../types";
import {
  type WhiskyAdvocateCursorSchema,
  type WhiskyAdvocateObservation,
  whiskyAdvocateAdapter,
} from "./whiskyAdvocate";

type Cursor = z.infer<typeof WhiskyAdvocateCursorSchema>;

test("resumes by issue and emits stable review observations", async () => {
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
  const processedIssues = issueNames.slice(1);
  const observations: ScraperObservation<WhiskyAdvocateObservation>[] = [];
  const checkpoints: Cursor[] = [];
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: url.search.includes("custom_rating_issue") ? reviewHtml : issueHtml,
  }));
  const session: ScraperSession<Cursor, WhiskyAdvocateObservation> = {
    request,
    emit: async (observation) => {
      observations.push(observation);
    },
    checkpoint: async (cursor) => {
      checkpoints.push(cursor);
    },
    remainingRequests: () => 100,
  };

  await whiskyAdvocateAdapter({
    cursor: { processedIssues },
    session,
  });

  expect(request).toHaveBeenCalledTimes(2);
  expect(observations).toHaveLength(166);
  expect(observations[0]?.sourceKey).toBe(observations[0]?.value.url);
  expect(checkpoints).toEqual([
    { processedIssues: [...processedIssues, issueNames[0]!] },
  ]);
});
