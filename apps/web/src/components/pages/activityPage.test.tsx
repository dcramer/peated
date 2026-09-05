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
