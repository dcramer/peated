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

test("matches several wildcards and an end anchor", () => {
  const state = parseRobotsRules(
    "User-agent: *\nDisallow: /*/reviews/*.html$\nDisallow: /tmp*",
  );
  const allows = (path: string) =>
    robotsAllowsUrl(state, new URL(`https://example.com${path}`));

  expect(allows("/shop/reviews/one.html")).toBe(false);
  expect(allows("/shop/reviews/one.html?page=2")).toBe(true);
  expect(allows("/shop/one.html")).toBe(true);
  expect(allows("/tmp")).toBe(false);
  expect(allows("/tmp/files")).toBe(false);
});

test("matches a pattern full of wildcards without stalling", () => {
  const state = parseRobotsRules(
    `User-agent: *\nDisallow: /${"*a".repeat(40)}*c`,
  );

  expect(
    robotsAllowsUrl(
      state,
      new URL(`https://example.com/${"a".repeat(5_000)}b`),
    ),
  ).toBe(true);
});
