import { RunContext } from "@openai/agents";
import type { PageRead, WebSearch } from "@peated/bot";
import { describe, expect, test, vi } from "vitest";
import type { EntityClassificationSearchEvidence } from "../classifierTypes";
import { createWebTools } from "./webTools";

const PAGE: PageRead = {
  status: "ok",
  url: "https://www.ardbeg.com/about",
  title: "About Ardbeg",
  description: "The Ultimate Islay Malt",
  publishedTime: null,
  content: `${"Islay. ".repeat(400)}Founded in 1815 on the south coast.`,
  route: "firecrawl",
};

function setup({
  maxSearchQueries = 2,
  read = PAGE,
  search = {
    status: "ok",
    results: [
      {
        url: "https://www.ardbeg.com/",
        title: "Ardbeg",
        description: "Islay single malt",
      },
    ],
  },
}: {
  maxSearchQueries?: number;
  read?: PageRead;
  search?: WebSearch;
} = {}) {
  const web = {
    readPage: vi.fn(async () => read),
    searchWeb: vi.fn(async () => search),
  };
  const evidence: EntityClassificationSearchEvidence[] = [];
  const [webSearch, readPage, findInPage] = createWebTools({
    web,
    maxSearchQueries,
    onEvidence: (item) => evidence.push(item),
  });
  const call = async (tool: typeof webSearch, args: Record<string, string>) =>
    await tool.invoke(new RunContext({}), JSON.stringify(args));
  return {
    web,
    evidence,
    search: (query: string) => call(webSearch, { query }),
    read: (url: string) => call(readPage, { url }),
    find: (url: string, query: string) => call(findInPage, { url, query }),
  };
}

describe("createWebTools", () => {
  test("searches through PeatedBot and records the links as evidence", async () => {
    const { search, evidence } = setup();

    await search("Ardbeg official site");

    expect(evidence).toEqual([
      {
        provider: "firecrawl",
        query: "Ardbeg official site",
        summary: null,
        results: [
          {
            title: "Ardbeg",
            url: "https://www.ardbeg.com/",
            domain: "ardbeg.com",
            description: "Islay single malt",
          },
        ],
      },
    ]);
  });

  test("stops searching when the budget runs out", async () => {
    const { search, web } = setup({ maxSearchQueries: 1 });

    await search("one");
    await expect(search("two")).resolves.toEqual({
      error: "Web search budget exhausted.",
    });
    expect(web.searchWeb).toHaveBeenCalledTimes(1);
  });

  test("shows a page's opening and finds facts further down it", async () => {
    const { read, find, evidence } = setup();

    await read("https://ardbeg.com/about");
    expect(evidence[0]?.results[0]?.url).toBe("https://www.ardbeg.com/about");
    expect(evidence[0]?.summary).not.toContain("1815");

    // The model may use the address it asked for or the one that answered.
    await find("https://ardbeg.com/about", "founded");
    await find("https://www.ardbeg.com/about", "founded");
    expect(evidence).toHaveLength(3);
    expect(evidence[1]?.summary).toContain("Founded in 1815");
  });

  test("doesn't record a missed find as evidence", async () => {
    const { read, find, evidence } = setup();

    await read("https://www.ardbeg.com/about");
    await expect(
      find("https://www.ardbeg.com/about", "Speyside"),
    ).resolves.toEqual({ message: '"Speyside" is not on this page.' });
    expect(evidence).toHaveLength(1);
  });

  test("only finds text on pages the run read", async () => {
    const { find } = setup();

    await expect(find("https://www.ardbeg.com/", "founded")).resolves.toEqual({
      error: "Read this page with read_page first.",
    });
  });

  test("reports a page PeatedBot refused without recording evidence", async () => {
    const { read, evidence } = setup({
      read: {
        status: "refused",
        url: "https://peated.com/entities/1",
        reason: "peated_website",
      },
    });

    await expect(read("https://peated.com/entities/1")).resolves.toEqual({
      error: "Page not read (peated_website).",
    });
    expect(evidence).toEqual([]);
  });

  test("stops reading pages when the budget runs out", async () => {
    const { read, web } = setup();

    await read("https://www.ardbeg.com/a");
    await read("https://www.ardbeg.com/b");
    await expect(read("https://www.ardbeg.com/c")).resolves.toEqual({
      error: "Page read budget exhausted.",
    });
    expect(web.readPage).toHaveBeenCalledTimes(2);
  });
});
