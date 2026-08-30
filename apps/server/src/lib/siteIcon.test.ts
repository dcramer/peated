import sharp from "sharp";
import { describe, expect, test, vi } from "vitest";
import {
  downloadSiteIcon,
  findSiteIconDeclarations,
  SiteIconUnavailableError,
} from "./siteIcon";

function response(body: string | Uint8Array, contentType: string) {
  return new Response(body, {
    headers: { "content-type": contentType },
    status: 200,
  });
}

test("finds standard, Apple, mask, and Windows icon declarations", () => {
  const result = findSiteIconDeclarations(
    `
      <link rel="shortcut icon" href="/favicon-32.png" sizes="32x32">
      <link rel="apple-touch-icon-precomposed" href="/touch.png">
      <link rel="mask-icon" href="/mask.svg" sizes="any">
      <link rel="manifest" href="/site.webmanifest">
      <meta name="msapplication-square310x310logo" content="/tile.png">
      <meta name="msapplication-TileImage" content="/tile-legacy.png">
    `,
    new URL("https://www.example.com/"),
  );

  expect(result.icons.map((candidate) => candidate.url.pathname)).toEqual([
    "/favicon-32.png",
    "/touch.png",
    "/mask.svg",
    "/tile.png",
    "/tile-legacy.png",
  ]);
  expect(result.icons.map((candidate) => candidate.size)).toEqual([
    32, 180, 512, 310, 144,
  ]);
  expect(result.manifests.map((url) => url.pathname)).toEqual([
    "/site.webmanifest",
  ]);
});

test("ignores icon declarations that leave the site", () => {
  const result = findSiteIconDeclarations(
    `<link rel="icon" href="https://other.example/icon.png" sizes="512x512">`,
    new URL("https://example.com/"),
  );

  expect(result.icons).toEqual([]);
});

describe("downloadSiteIcon", () => {
  test("uses the largest valid declaration and emits a 128px WebP", async () => {
    const small = await sharp({
      create: {
        background: "#ff0000",
        channels: 4,
        height: 32,
        width: 32,
      },
    })
      .png()
      .toBuffer();
    const large = await sharp({
      create: {
        background: "#0000ff",
        channels: 4,
        height: 256,
        width: 256,
      },
    })
      .png()
      .toBuffer();
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/") {
        return response(
          `<link rel="icon" href="/small.png" sizes="32x32">
           <link rel="apple-touch-icon" href="/large.png" sizes="256x256">`,
          "text/html",
        );
      }
      if (url.pathname === "/large.png") {
        return response(new Uint8Array(large), "image/png");
      }
      if (url.pathname === "/small.png") {
        return response(new Uint8Array(small), "image/png");
      }
      return new Response(null, { status: 404 });
    });

    const result = await downloadSiteIcon(
      new URL("https://example.com/archive"),
      fetchImpl,
    );
    const metadata = await sharp(result.data).metadata();

    expect(result.sourceUrl).toBe("https://example.com/large.png");
    expect(metadata).toMatchObject({ format: "webp", height: 128, width: 128 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test("uses icons from a web app manifest", async () => {
    const icon = await sharp({
      create: {
        background: "#00ff00",
        channels: 4,
        height: 192,
        width: 192,
      },
    })
      .png()
      .toBuffer();
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/") {
        return response(
          `<link rel="manifest" href="/app/site.webmanifest">`,
          "text/html",
        );
      }
      if (url.pathname === "/app/site.webmanifest") {
        return response(
          JSON.stringify({
            icons: [{ sizes: "192x192", src: "icons/site.png" }],
            name: "Example",
          }),
          "application/manifest+json",
        );
      }
      if (url.pathname === "/app/icons/site.png") {
        return response(new Uint8Array(icon), "image/png");
      }
      return new Response(null, { status: 404 });
    });

    const result = await downloadSiteIcon(
      new URL("https://example.com/"),
      fetchImpl,
    );

    expect(result.sourceUrl).toBe("https://example.com/app/icons/site.png");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  test("ignores a broken optional manifest", async () => {
    const icon = await sharp({
      create: {
        background: "#00ff00",
        channels: 4,
        height: 192,
        width: 192,
      },
    })
      .png()
      .toBuffer();
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/") {
        return response(
          `<link rel="manifest" href="/site.webmanifest">
           <link rel="icon" href="/site.png" sizes="192x192">`,
          "text/html",
        );
      }
      if (url.pathname === "/site.webmanifest") {
        return response("not json", "application/manifest+json");
      }
      if (url.pathname === "/site.png") {
        return response(new Uint8Array(icon), "image/png");
      }
      return new Response(null, { status: 404 });
    });

    const result = await downloadSiteIcon(
      new URL("https://example.com/"),
      fetchImpl,
    );

    expect(result.sourceUrl).toBe("https://example.com/site.png");
  });

  test("reports network failures as an unavailable icon", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(
      downloadSiteIcon(new URL("https://example.com/"), fetchImpl),
    ).rejects.toBeInstanceOf(SiteIconUnavailableError);
  });
});
