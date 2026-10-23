import { RunContext } from "@openai/agents";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { createFirecrawlWebSearchTool } from "./firecrawlWebSearch";
import { createBottleWebSearchBudget } from "./sharedWebSearch";
import { createWhiskybaseTools } from "./whiskybase";
import {
  parseWhiskybaseId,
  readWhiskybaseBottle,
  readWhiskybaseSearch,
} from "./whiskybasePages";

const runContext = new RunContext();

async function loadPage(name: string) {
  return await readFile(
    resolve(import.meta.dirname, "../../__fixtures__/whiskybase", name),
    "utf8",
  );
}

function stubFirecrawl(page: { statusCode: number; html: string }) {
  const firecrawl = vi.fn<typeof fetch>(
    async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: {
            rawHtml: page.html,
            metadata: { statusCode: page.statusCode },
          },
        }),
      ),
  );
  vi.stubGlobal("fetch", firecrawl);
  return firecrawl;
}

function requestBody(firecrawl: ReturnType<typeof stubFirecrawl>) {
  return z
    .object({
      url: z.string(),
      formats: z.array(z.string()),
      proxy: z.string(),
    })
    .parse(JSON.parse(z.string().parse(firecrawl.mock.calls[0]?.[1]?.body)));
}

function createTools(budget = createBottleWebSearchBudget(3)) {
  const onEvidence = vi.fn();
  const [lookup, search] = createWhiskybaseTools({
    apiKey: "firecrawl-test-key",
    budget,
    onEvidence,
  });
  return { lookup: lookup!, search: search!, onEvidence };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Whiskybase pages", () => {
  test("reads a Whiskybase ID from an ID or a Whiskybase Bottle URL only", () => {
    expect(parseWhiskybaseId("WB103088")).toBe(103088);
    expect(parseWhiskybaseId(" 103088 ")).toBe(103088);
    expect(
      parseWhiskybaseId(
        "https://www.whiskybase.com/de/whiskies/whisky/101651/caol-ila-2010-lmdw",
      ),
    ).toBe(101651);
    expect(
      parseWhiskybaseId("https://example.com/whiskies/whisky/101651"),
    ).toBeNull();
    expect(parseWhiskybaseId("Yamazaki 2000")).toBeNull();
  });

  test("reads Bottle details without ratings or member names", async () => {
    const bottle = readWhiskybaseBottle(await loadPage("whisky-101651.html"));

    expect(bottle).toEqual({
      whiskybaseId: 101651,
      url: "https://www.whiskybase.com/whiskies/whisky/101651/caol-ila-2010-lmdw",
      name: "Caol Ila 2010 LMDW",
      brand: "Caol Ila",
      details: [
        { label: "Category", value: "Single Malt" },
        { label: "Distillery", value: "Caol Ila" },
        { label: "Bottler", value: "La Maison du Whisky (LMDW)" },
        { label: "Bottling series", value: "Artist Collective #1.5" },
        { label: "Vintage", value: "2010" },
        { label: "Bottled", value: "2017" },
        { label: "Stated Age", value: "06 years" },
        { label: "Cask Type", value: "Batch of 6 Casks" },
        { label: "Number of bottles", value: "2550" },
        { label: "Strength", value: "43.0 %" },
        { label: "Size", value: "700 ml" },
        { label: "Label", value: "Collective #1.5" },
        { label: "Bottle code", value: "L17/528" },
        { label: "Barcode", value: "3700597303511" },
      ],
      badges: ["Uncolored", "Non-chill Filtered"],
    });
    expect(JSON.stringify(bottle)).not.toContain("example-member");
  });

  test("reads search results with their Whiskybase IDs and listed facts", async () => {
    const results = readWhiskybaseSearch(
      await loadPage("search-yamazaki-2000.html"),
    );

    expect(results.map((result) => result.whiskybaseId)).toEqual([
      99645, 269571, 45268, 274757,
    ]);
    expect(results[2]).toEqual({
      whiskybaseId: 45268,
      url: "https://www.whiskybase.com/whiskies/whisky/45268",
      name: "Yamazaki 2000",
      series: "Whisky Shop W.",
      details: [
        { label: "Size", value: "700 ml" },
        { label: "Strength", value: "59 %vol" },
        { label: "Age", value: "13" },
        { label: "Bottled", value: "2013" },
        { label: "Vintage", value: "2000" },
        { label: "Cask number", value: "EO70049" },
      ],
    });
    // Whiskybase shows a bare unit when it has no strength.
    expect(results[0]?.details.map((detail) => detail.label)).not.toContain(
      "Strength",
    );
  });

  test("tells an empty search apart from a page that did not load", async () => {
    expect(readWhiskybaseSearch(await loadPage("search-empty.html"))).toEqual(
      [],
    );
    expect(() =>
      readWhiskybaseSearch("<html><body><div id='app'></div></body></html>"),
    ).toThrow("Whiskybase search page has no results table.");
  });
});

describe("Whiskybase tools", () => {
  test("looks up one Whiskybase page and returns it as citable evidence", async () => {
    const firecrawl = stubFirecrawl({
      statusCode: 200,
      html: await loadPage("whisky-101651.html"),
    });
    const { lookup, onEvidence } = createTools();

    const result = await lookup.invoke(
      runContext,
      JSON.stringify({
        reference:
          "https://www.whiskybase.com/de/whiskies/whisky/101651/caol-ila-2010-lmdw",
      }),
    );

    expect(firecrawl).toHaveBeenCalledOnce();
    expect(requestBody(firecrawl)).toMatchObject({
      url: "https://www.whiskybase.com/whiskies/whisky/101651",
      formats: ["rawHtml"],
      proxy: "basic",
    });
    expect(result).toMatchObject({
      provider: "firecrawl",
      query: "WB101651",
      results: [
        {
          title: "Caol Ila 2010 LMDW (WB101651)",
          url: "https://www.whiskybase.com/whiskies/whisky/101651",
          domain: "whiskybase.com",
        },
      ],
    });
    const summary = z.object({ summary: z.string() }).parse(result).summary;
    expect(summary).toContain("Bottler: La Maison du Whisky (LMDW)");
    expect(summary).toContain("Stated Age: 06 years");
    expect(summary).toContain("Label badges: Uncolored, Non-chill Filtered");
    expect(summary).not.toContain("example-member");
    expect(onEvidence).toHaveBeenCalledWith(result);
  });

  test("marks a calculated age as Whiskybase arithmetic", async () => {
    stubFirecrawl({
      statusCode: 200,
      html: await loadPage("whisky-103088.html"),
    });
    const { lookup } = createTools();

    const result = await lookup.invoke(
      runContext,
      JSON.stringify({ reference: "WB103088" }),
    );

    const summary = z.object({ summary: z.string() }).parse(result).summary;
    expect(summary).toContain(
      "Calculated age (Whiskybase arithmetic, not a stated age): 10 years",
    );
    expect(summary).not.toContain("Stated Age");
  });

  test("reports a missing Whiskybase entry as evidence, not a failure", async () => {
    stubFirecrawl({ statusCode: 404, html: "<h1>Oops!</h1>" });
    const { lookup, onEvidence } = createTools();

    const result = await lookup.invoke(
      runContext,
      JSON.stringify({ reference: "999999999" }),
    );

    expect(result).toEqual({
      provider: "firecrawl",
      query: "WB999999999",
      summary: "Whiskybase has no entry WB999999999.",
      results: [],
    });
    expect(onEvidence).not.toHaveBeenCalled();
  });

  test("rejects a reference that is not a Whiskybase ID or URL", async () => {
    const firecrawl = stubFirecrawl({ statusCode: 200, html: "" });
    const budget = createBottleWebSearchBudget(3);
    const { lookup } = createTools(budget);

    const result = await lookup.invoke(
      runContext,
      JSON.stringify({ reference: "https://example.com/whiskies/whisky/1" }),
    );

    expect(result).toEqual({
      error: "Use a Whiskybase ID such as WB103088 or a Whiskybase Bottle URL.",
    });
    expect(firecrawl).not.toHaveBeenCalled();
    expect(budget.tryConsumeSearch(3)).toBe(true);
  });

  test("searches Whiskybase and lists each entry's ID and facts", async () => {
    const firecrawl = stubFirecrawl({
      statusCode: 200,
      html: await loadPage("search-yamazaki-2000.html"),
    });
    const { search } = createTools();

    const result = await search.invoke(
      runContext,
      JSON.stringify({ query: "yamazaki 2000" }),
    );

    expect(requestBody(firecrawl).url).toBe(
      "https://www.whiskybase.com/search?q=yamazaki+2000",
    );
    expect(result).toMatchObject({
      query: "yamazaki 2000",
      results: expect.arrayContaining([
        expect.objectContaining({
          title: "Yamazaki 2000 - Whisky Shop W. (WB45268)",
          url: "https://www.whiskybase.com/whiskies/whisky/45268",
          description:
            "Size: 700 ml; Strength: 59 %vol; Age: 13; Bottled: 2013; Vintage: 2000; Cask number: EO70049",
        }),
      ]),
    });
  });

  test("returns a Firecrawl failure as a tool error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => new Response("", { status: 502 })),
    );
    const { search } = createTools();

    await expect(
      search.invoke(runContext, JSON.stringify({ query: "yamazaki 2000" })),
    ).resolves.toEqual({
      error:
        "Whiskybase search failed: Firecrawl could not read Whiskybase (502).",
    });
  });

  test("uses the shared web search allowance, not the page-read allowance", async () => {
    const firecrawl = stubFirecrawl({
      statusCode: 200,
      html: await loadPage("whisky-103088.html"),
    });
    const budget = createBottleWebSearchBudget(2);
    const { lookup, search } = createTools(budget);

    await lookup.invoke(runContext, JSON.stringify({ reference: "WB103088" }));
    await lookup.invoke(runContext, JSON.stringify({ reference: "WB103088" }));
    await expect(
      search.invoke(runContext, JSON.stringify({ query: "yamazaki 2000" })),
    ).resolves.toEqual({
      error: "Web search budget exhausted after 2 queries",
    });

    expect(firecrawl).toHaveBeenCalledTimes(2);
    expect(budget.tryConsumePageRead()).toBe(true);
  });

  test("tells the agent how many searches are left when a batch is too large", async () => {
    stubFirecrawl({
      statusCode: 200,
      html: await loadPage("whisky-103088.html"),
    });
    const budget = createBottleWebSearchBudget(2);
    const { lookup } = createTools(budget);
    const webSearch = createFirecrawlWebSearchTool({
      apiKey: "firecrawl-test-key",
      budget,
    });

    await lookup.invoke(runContext, JSON.stringify({ reference: "WB103088" }));

    await expect(
      webSearch.invoke(
        runContext,
        JSON.stringify({ queries: ["yamazaki 2000", "yamazaki ES70153"] }),
      ),
    ).resolves.toEqual({
      error: "Web search budget has 1 query left; send at most that many",
    });
    expect(budget.tryConsumeSearch(1)).toBe(true);
  });

  test("hands replay and reviewed-evidence executors the page that is read", async () => {
    const executeWebSearch = vi.fn(async () => ({
      provider: "firecrawl" as const,
      query: "WB103088",
      summary: "Whiskybase entry WB103088 (community-entered).",
      results: [
        {
          title: "Yamazaki 2000 (WB103088)",
          url: "https://www.whiskybase.com/whiskies/whisky/103088",
          domain: "whiskybase.com",
          description: null,
          extraSnippets: [],
        },
      ],
    }));
    const onEvidence = vi.fn();
    const [lookup, search] = createWhiskybaseTools({
      apiKey: "firecrawl-test-key",
      budget: createBottleWebSearchBudget(3),
      executeWebSearch,
      onEvidence,
    });

    await lookup!.invoke(runContext, JSON.stringify({ reference: "103088" }));
    await search!.invoke(runContext, JSON.stringify({ query: "yamazaki" }));

    expect(executeWebSearch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        toolName: "whiskybase_lookup",
        args: { url: "https://www.whiskybase.com/whiskies/whisky/103088" },
      }),
    );
    expect(executeWebSearch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        toolName: "whiskybase_search",
        args: { query: "yamazaki" },
      }),
    );
    expect(onEvidence).toHaveBeenCalledTimes(2);
  });
});
