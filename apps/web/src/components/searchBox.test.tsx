import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SearchBox } from "./searchBox.stylex";

function renderDatabaseSearch({
  resultCount,
  status,
}: {
  resultCount?: number;
  status: "ready" | "searching";
}) {
  return renderToStaticMarkup(
    <SearchBox
      emptyText={status === "ready" ? "Nothing matches this query." : undefined}
      groups={[]}
      onQueryChange={() => undefined}
      onScopeChange={() => undefined}
      placement="database"
      query="lagavulin"
      resultCount={resultCount}
      scope="all"
      scopes={[{ label: "Everything", value: "all" }]}
      status={status}
      statusText="Searching bottles, brands, and producers…"
    />,
  );
}

describe("SearchBox database result count", () => {
  it("does not show an unsettled count while searching", () => {
    const html = renderDatabaseSearch({ resultCount: 0, status: "searching" });

    expect(html).not.toContain("0 results");
    expect(html).toContain("Searching bottles, brands, and producers");
  });

  it("shows zero after the search settles", () => {
    const html = renderDatabaseSearch({ resultCount: 0, status: "ready" });

    expect(html).toContain("0 results");
  });
});
