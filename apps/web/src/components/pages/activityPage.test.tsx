import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { ActivityPage } from "./activityPage.stylex";

test("keeps known activity content visible while the feed loads", () => {
  const html = renderToStaticMarkup(
    <ActivityPage items={[]} loading selector={<span>Feed selection</span>} />,
  );

  expect(html).toContain("Activity");
  expect(html).toContain("Feed selection");
  expect(html).toContain("What have you tried?");
  expect(html).toContain("Loading activity");
  expect(html).not.toContain("Nothing here yet");
});

test("shows review sites in the supplied critic order", () => {
  const html = renderToStaticMarkup(
    <ActivityPage
      activeCritics={[
        {
          bottleName: "Lagavulin 8-year-old",
          href: "https://example.com/reviews/lagavulin-8",
          name: "Whiskyfun",
          publishedAt: "2026-08-20T09:00:00.000Z",
          type: "whiskyfun",
        },
        {
          bottleName: "Lagavulin 16-year-old",
          href: "https://example.com/reviews/lagavulin-16",
          name: "Whisky Advocate",
          publishedAt: "2026-08-26T09:00:00.000Z",
          type: "whisky-advocate",
        },
      ]}
      items={[]}
      selector={<span>Feed selection</span>}
    />,
  );

  expect(html).toContain("Active critics");
  expect(html).toContain("Whiskyfun");
  expect(html).toContain("Lagavulin 8-year-old");
  expect(html.indexOf("Whiskyfun")).toBeLessThan(
    html.indexOf("Whisky Advocate"),
  );
});
