import { checkAboutProse, checkConflictPicks } from "../checks";
import { findAboutWriteErrors } from "../document";
import { BRORA_ABOUT_EXAMPLE } from "./brora";

// The Brora example is the writer's style model and a sample stored document.
// It must pass the same checks a generated draft must pass.
describe("Brora About example", () => {
  test("is a valid document", () => {
    expect(findAboutWriteErrors(null, BRORA_ABOUT_EXAMPLE)).toEqual([]);
  });

  test("passes the prose checks", () => {
    expect(checkAboutProse(BRORA_ABOUT_EXAMPLE)).toEqual([]);
    expect(checkConflictPicks(BRORA_ABOUT_EXAMPLE)).toEqual([]);
  });
});
