import { checkAboutProse, checkConflictPicks } from "../checks";
import { findAboutWriteErrors } from "../document";
import { BRORA_ABOUT_EXAMPLE } from "./brora";
import { JOHNNIE_WALKER_ABOUT_EXAMPLE } from "./johnnieWalker";

// The examples are the writer's style models and samples of stored documents.
// They must pass the same checks a generated draft must pass.
describe.each([
  ["Brora", BRORA_ABOUT_EXAMPLE],
  ["Johnnie Walker", JOHNNIE_WALKER_ABOUT_EXAMPLE],
])("%s About example", (_name, example) => {
  test("is a valid document", () => {
    expect(findAboutWriteErrors(null, example)).toEqual([]);
  });

  test("passes the prose checks", () => {
    expect(checkAboutProse(example)).toEqual([]);
    expect(checkConflictPicks(example)).toEqual([]);
  });
});
