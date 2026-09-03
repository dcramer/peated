import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { proxy } from "./proxy";

describe("web proxy", () => {
  const fetchApi = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchApi.mockReset();
    fetchApi.mockRejectedValue(new Error("Unexpected API request"));
    vi.stubGlobal("fetch", fetchApi);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("does not add API requests before rendering catalog slug URLs", async () => {
    for (const path of [
      "/bottles",
      "/bottles/42-lagavulin-16-year-old",
      "/bottles/42-old-name/tastings?cursor=2",
      "/bottles/42-lagavulin-16-year-old/edit",
      "/series/42-special-releases",
      "/series/42-old-name?library=in",
      "/series/42-%E5%B1%B1%E5%B4%8E",
      "/locations",
      "/locations/all-regions",
      "/locations/scotland",
      "/locations/scotland/bottles?cursor=2",
      "/locations/scotland/regions/islay",
      "/locations/scotland/regions/islay/distillers",
    ]) {
      for (const cookie of ["", "_session=member"]) {
        const response = await proxy(
          new NextRequest(`https://peated.com${path}`, {
            headers: { cookie, "x-peated-request-path": "/untrusted" },
          }),
        );

        expect(response.headers.get("x-middleware-next")).toBe("1");
        expect(
          response.headers.get("x-middleware-request-x-peated-request-path"),
        ).toBe(path);
        if (cookie)
          expect(response.headers.get("cache-control")).toContain("private");
      }
    }

    expect(fetchApi).not.toHaveBeenCalled();
  });

  test("resolves legacy IDs once and preserves the redirect query", async () => {
    fetchApi.mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      expect(request.headers.get("authorization")).toBeNull();
      switch (new URL(request.url).pathname) {
        case "/rpc/bottles/details":
          expect(await request.json()).toEqual({ json: { bottle: 42 } });
          return Response.json({
            json: {
              id: 43,
              name: "16-year-old",
              brand: { name: "Lagavulin" },
            },
          });
        case "/rpc/bottleSeries/details":
          expect(await request.json()).toEqual({ json: { series: 42 } });
          return Response.json({
            json: { id: 43, fullName: "Special Releases" },
          });
        default:
          throw new Error(`Unexpected API route: ${request.url}`);
      }
    });

    for (const [source, destination] of [
      ["/bottles/42/tastings", "/bottles/43-lagavulin-16-year-old/tastings"],
      ["/B0042", "/bottles/43-lagavulin-16-year-old"],
      ["/series/42", "/series/43-special-releases"],
      ["/S0042", "/series/43-special-releases"],
    ]) {
      const response = await proxy(
        new NextRequest(`https://peated.com${source}?tag=one&tag=two`),
      );
      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(
        `https://peated.com${destination}?tag=one&tag=two`,
      );
    }

    expect(fetchApi).toHaveBeenCalledTimes(4);
  });

  test("looks up location identities only when correcting slug casing", async () => {
    fetchApi.mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      expect(request.headers.get("authorization")).toBeNull();
      switch (new URL(request.url).pathname) {
        case "/rpc/countries/details":
          expect(await request.json()).toEqual({
            json: { country: "SCOTLAND" },
          });
          return Response.json({ json: { slug: "scotland" } });
        case "/rpc/regions/details":
          expect(await request.json()).toEqual({
            json: { country: "scotland", region: "ISLAY" },
          });
          return Response.json({
            json: { slug: "islay", country: { slug: "scotland" } },
          });
        default:
          throw new Error(`Unexpected API route: ${request.url}`);
      }
    });
    const response = await proxy(
      new NextRequest(
        "https://peated.com/locations/SCOTLAND/regions/ISLAY/bottles?cursor=2",
      ),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://peated.com/locations/scotland/regions/islay/bottles?cursor=2",
    );
    expect(fetchApi).toHaveBeenCalledTimes(2);
  });

  test("protects the OAuth authorization response", async () => {
    const response = await proxy(
      new NextRequest(
        "https://peated.com/oauth/authorize?client_id=peated-cli",
      ),
    );

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
});
