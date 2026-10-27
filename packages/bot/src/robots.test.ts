import { expect, test } from "vitest";
import { parseRobotsRules, robotsAllowsUrl } from "./robots";

test("parses user-agent groups and applies longest-match allow precedence", () => {
  const state = parseRobotsRules(`
    User-agent: *
    Disallow: /private

    User-agent: PeatedBot
    Disallow: /catalog
    Allow: /catalog/public
    Disallow: /*.pdf$
  `);

  expect(robotsAllowsUrl(state, new URL("https://example.com/catalog/a"))).toBe(
    false,
  );
  expect(
    robotsAllowsUrl(state, new URL("https://example.com/catalog/public/a")),
  ).toBe(true);
  expect(robotsAllowsUrl(state, new URL("https://example.com/file.pdf"))).toBe(
    false,
  );
  // The specific PeatedBot group replaces the wildcard group.
  expect(robotsAllowsUrl(state, new URL("https://example.com/private"))).toBe(
    true,
  );
});

test("follows the * group when no group names PeatedBot", () => {
  const state = parseRobotsRules("User-agent: *\nDisallow: /private");

  expect(robotsAllowsUrl(state, new URL("https://example.com/private/a"))).toBe(
    false,
  );
  expect(robotsAllowsUrl(state, new URL("https://example.com/shop"))).toBe(
    true,
  );
});

test("allows every page when the website publishes no rules", () => {
  expect(
    robotsAllowsUrl({ status: "missing" }, new URL("https://example.com/a")),
  ).toBe(true);
});
