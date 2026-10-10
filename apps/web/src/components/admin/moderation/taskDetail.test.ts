import { expect, test } from "vitest";
import { listingMatchInput } from "./taskDetail";

test("a match reason is sent only for the Bottle the server asked about", () => {
  const asked = { bottleId: 42, reason: "  The store page states 62.8%.  " };

  expect(listingMatchInput(7, 42, asked)).toEqual({
    proposal: 7,
    action: "match",
    bottle: 42,
    reason: "The store page states 62.8%.",
  });
  // Another Bottle goes to the server without the reason, so its own
  // differences are checked.
  expect(listingMatchInput(7, 99, asked)).toEqual({
    proposal: 7,
    action: "match",
    bottle: 99,
  });
  expect(listingMatchInput(7, 42, null)).toEqual({
    proposal: 7,
    action: "match",
    bottle: 42,
  });
  expect(listingMatchInput(7, 42, { bottleId: 42, reason: "   " })).toEqual({
    proposal: 7,
    action: "match",
    bottle: 42,
  });
});
