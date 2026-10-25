import {
  checkAboutProse,
  checkConflictPicks,
  keepVerifiedCitations,
} from "../checks";
import { getFactCitations } from "../display";
import { findAboutWriteErrors } from "../document";
import { BRORA_ABOUT_EXAMPLE } from "./brora";
import { JOHNNIE_WALKER_ABOUT_EXAMPLE } from "./johnnieWalker";
import { ROSEBANK_ABOUT_EXAMPLE } from "./rosebank";

// Rosebank and Johnnie Walker are the writer's style models; Brora is the
// mock API's page. All are samples of stored documents, so they must pass the
// same checks a generated draft must pass.
describe.each([
  ["Rosebank", ROSEBANK_ABOUT_EXAMPLE],
  ["Johnnie Walker", JOHNNIE_WALKER_ABOUT_EXAMPLE],
  ["Brora", BRORA_ABOUT_EXAMPLE],
])("%s About example", (_name, example) => {
  test("is a valid document", () => {
    expect(findAboutWriteErrors(example)).toEqual([]);
  });

  test("passes the prose checks", () => {
    expect(checkAboutProse(example)).toEqual([]);
    expect(checkConflictPicks(example)).toEqual([]);
  });

  test("keeps every fact under the evidence checks", () => {
    // The quotes are copied from the source pages, so each page is read as
    // the text of its quotes. A fact its quotes cannot state is dropped.
    const quotes = new Map<string, string[]>();
    for (const citation of [...getFactCitations(example).values()].flat()) {
      if (!citation.quote) continue;
      quotes.set(citation.sourceId, [
        ...(quotes.get(citation.sourceId) ?? []),
        citation.quote,
      ]);
    }
    const pages = example.sources.map((source) => ({
      url: source.url,
      text: (quotes.get(source.id) ?? []).join(" "),
    }));

    expect(keepVerifiedCitations(example, pages, null)).toEqual(example);
  });
});
