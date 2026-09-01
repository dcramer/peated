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

describe("SearchBox database empty state", () => {
  it("shows recent searches when the query is empty", () => {
    const html = renderToStaticMarkup(
      <SearchBox
        groups={[
          {
            id: "recent-searches",
            items: [
              {
                href: "/search?q=Ardbeg%2010",
                id: "recent-search-ardbeg-10",
                title: "Ardbeg 10",
              },
            ],
            label: "Recent searches",
          },
        ]}
        onQueryChange={() => undefined}
        onScopeChange={() => undefined}
        placement="database"
        query=""
        scope="all"
        scopes={[{ label: "Everything", value: "all" }]}
      />,
    );

    expect(html).toContain("Recent searches");
    expect(html).toContain("Ardbeg 10");
    expect(html).not.toContain("aria-activedescendant");
  });
});

describe("SearchBox active result", () => {
  const groups = [
    {
      id: "bottles",
      items: [{ href: "/bottles/1", id: "bottle-1", title: "Ardbeg 10" }],
      label: "Bottles",
    },
  ];

  function renderSearch(resultQuery: string) {
    return renderToStaticMarkup(
      <SearchBox
        groups={groups}
        onQueryChange={() => undefined}
        onScopeChange={() => undefined}
        query="ardbeg"
        resultQuery={resultQuery}
        scope="all"
        scopes={[{ label: "Everything", value: "all" }]}
      />,
    );
  }

  it("activates the first result for the current query", () => {
    const html = renderSearch("ardbeg");

    expect(html).toMatch(/aria-activedescendant="[^"]*bottle-1"/);
  });

  it("does not activate a result from an older query", () => {
    const html = renderSearch("ard");

    expect(html).not.toContain("aria-activedescendant");
  });

  it("does not activate results when typeahead navigation is disabled", () => {
    const html = renderToStaticMarkup(
      <SearchBox
        groups={groups}
        onQueryChange={() => undefined}
        onScopeChange={() => undefined}
        query="ardbeg"
        resultQuery="ardbeg"
        scope="all"
        scopes={[{ label: "Everything", value: "all" }]}
        typeaheadNavigation={false}
      />,
    );

    expect(html).not.toContain("aria-activedescendant");
    expect(html).not.toContain('aria-autocomplete="list"');
  });
});
