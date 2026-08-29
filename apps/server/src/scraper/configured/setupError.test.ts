import { expect, test } from "vitest";
import { ScrapeSourceSetupError } from "./setupError";

test("labels nested AI output fields without exposing their paths", () => {
  const error = new ScrapeSourceSetupError("AI returned invalid rules.", [
    {
      field: "rules.list.detailLink.selector",
      message: "The selector was empty.",
    },
    {
      field: "rules.detail.score.value.selector",
      message: "The selector was empty.",
    },
    {
      field: "rules.detail.name.attribute",
      message: "The attribute was invalid.",
    },
  ]);

  const message = error.adminMessage();
  expect(message).toBe(
    "AI could not finish setup. Check: Item links, Score, Item name.",
  );
  expect(message).not.toContain("rules");
  expect(message).not.toContain("selector");
  expect(message).not.toContain("attribute");
});
