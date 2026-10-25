import { JOHNNIE_WALKER_ABOUT_EXAMPLE } from "@peated/server/lib/entityAbout/examples/johnnieWalker";
import { ROSEBANK_ABOUT_EXAMPLE } from "@peated/server/lib/entityAbout/examples/rosebank";

import { MAX_PAGE_CHARS } from "../webTools";
import { ABOUT_EVAL_CASES } from "./evidence";

// The About model check reads only these packs, so they are checked in
// `pnpm test` where no model runs.
describe("About model check evidence", () => {
  test("has 12 distinct cases", () => {
    const names = ABOUT_EVAL_CASES.map((evidence) => evidence.case);
    expect(new Set(names).size).toBe(12);
  });

  // Model check rule (owner: docs/development/model-checks.md): a test case
  // must not appear in the prompt, and the prompt's examples are Rosebank and
  // Johnnie Walker.
  test("leaves out the prompt's examples", () => {
    const exampleUrls = [ROSEBANK_ABOUT_EXAMPLE, JOHNNIE_WALKER_ABOUT_EXAMPLE]
      .flatMap((example) => example.sources)
      .map((source) => source.url);
    for (const evidence of ABOUT_EVAL_CASES) {
      expect(["Rosebank", "Johnnie Walker"]).not.toContain(
        evidence.entity.name,
      );
      for (const page of evidence.pages) {
        expect(exampleUrls).not.toContain(page.url);
      }
    }
  });

  test.each(ABOUT_EVAL_CASES.map((evidence) => [evidence.case, evidence]))(
    "%s states every expected year and fits a page read",
    (_name, evidence) => {
      const urls = evidence.pages.map((page) => page.url);
      expect(new Set(urls).size).toBe(urls.length);
      for (const page of evidence.pages) {
        expect(page.text.length).toBeLessThanOrEqual(MAX_PAGE_CHARS);
      }
      const text = evidence.pages.map((page) => page.text).join("\n");
      for (const { year } of evidence.expected.events) {
        expect(text).toContain(year);
      }
    },
  );
});
