import type { PageRead, WebSearch } from "@peated/bot";
import {
  createBotSource,
  findInPages,
  toPlainText,
  withPublishedDate,
} from "./webTools";

describe("toPlainText", () => {
  test("keeps link text and drops images", () => {
    expect(
      toPlainText(
        '![Still house](https://example.com/a.jpg)[Brora](https://en.wikipedia.org/wiki/Brora_(distillery)) was founded in 1819 by the [Marquess of Stafford](/wiki/Marquess "title").',
      ),
    ).toBe("Brora was founded in 1819 by the Marquess of Stafford.");
  });

  test("drops footnote links so a sentence reads whole", () => {
    expect(
      toPlainText(
        "In December 2003, Diageo caused controversy[\\[10\\]](https://en.wikipedia.org/wiki/Cardhu_distillery#cite_note-10)[\\[a\\]](https://en.wikipedia.org/wiki/Cardhu_distillery#cite_note-a) by renaming it.",
      ),
    ).toBe("In December 2003, Diageo caused controversy by renaming it.");
  });
});

describe("withPublishedDate", () => {
  test("puts the metadata's published date at the top", () => {
    expect(withPublishedDate("Body.", "2025-08-07T00:15:00+00:00")).toBe(
      "Published 2025-08-07.\n\nBody.",
    );
    expect(withPublishedDate("Body.", null)).toBe("Body.");
    expect(withPublishedDate("Body.", "last week")).toBe("Body.");
  });
});

describe("findInPages", () => {
  const pages = [
    {
      url: "https://example.com/a",
      text: "The distillery was bought by Seager Evans in 1962. Later, Seager Evans finished the purchase.",
    },
    {
      url: "https://example.com/b",
      text: "seager evans completed it in 1967.",
    },
    { url: "https://example.com/c", text: "Nothing about owners here." },
  ];

  test("finds every passage on every page, ignoring case", () => {
    const matches = findInPages(pages, "Seager Evans");

    expect(matches.map(({ url }) => url)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
    expect(matches[0]?.passage).toContain("1962");
    expect(matches[1]?.passage).toContain("1967");
  });

  test("matches across line breaks", () => {
    const matches = findInPages(
      [
        {
          url: "https://example.com/d",
          text: "Bought by Seager\nEvans in 1962.",
        },
      ],
      "seager evans",
    );

    expect(matches[0]?.passage).toBe("Bought by Seager Evans in 1962.");
  });

  test("returns nothing when no page has the text", () => {
    expect(findInPages(pages, "Allied Lyons")).toEqual([]);
  });
});

describe("createBotSource", () => {
  function source({
    page,
    search = { status: "ok", results: [] },
  }: {
    page?: PageRead;
    search?: WebSearch;
  }) {
    const reads: Array<{ url: string; format: string }> = [];
    const bot = {
      readPage: async (input: { url: string; format: "markdown" | "html" }) => {
        reads.push(input);
        if (!page) throw new Error("No page.");
        return page;
      },
      searchWeb: async () => search,
    };
    return { source: createBotSource(bot), reads };
  }

  test("reads a page's main text with its published date", async () => {
    const { source: bot, reads } = source({
      page: {
        status: "ok",
        url: "https://example.com/a",
        title: "Brora",
        publishedTime: "2025-08-07T00:15:00+00:00",
        content: "[Brora](https://example.com/brora) was founded in 1819.",
        route: "firecrawl",
      },
    });

    await expect(bot.read("https://example.com/a")).resolves.toEqual({
      title: "Brora",
      text: "Published 2025-08-07.\n\nBrora was founded in 1819.",
    });
    expect(reads).toEqual([
      { url: "https://example.com/a", format: "markdown" },
    ]);
  });

  test("tells the writer why a page was not read", async () => {
    const refused = source({
      page: {
        status: "refused",
        url: "https://example.com/private",
        reason: "robots_disallowed",
      },
    });
    await expect(
      refused.source.read("https://example.com/private"),
    ).rejects.toThrow(
      "The website's robots.txt does not allow reading this page.",
    );

    const missing = source({
      page: {
        status: "failed",
        url: "https://example.com/gone",
        reason: "not_found",
        httpStatus: 404,
      },
    });
    await expect(
      missing.source.read("https://example.com/gone"),
    ).rejects.toThrow("Page not found.");
  });

  test("reports a failed search", async () => {
    const { source: bot } = source({
      search: {
        status: "failed",
        reason: "service_unavailable",
        httpStatus: 402,
      },
    });

    await expect(bot.search("brora")).rejects.toThrow(
      "Search failed (HTTP 402).",
    );
  });
});
