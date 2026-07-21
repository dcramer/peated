import config from "@peated/server/config";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { describe, expect, test } from "vitest";
import { app } from "./app";

describe("app trace headers", () => {
  test("returns the Sentry trace id header and exposes it to browsers", async () => {
    const response = await app.request("/_health", {
      headers: {
        Origin: config.CORS_HOST,
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-sentry-trace-id")).toMatch(/^[0-9a-f]{32}$/);
    expect(response.headers.get("access-control-expose-headers")).toContain(
      "x-sentry-trace-id",
    );
  });
});

describe("GET /spec.json", () => {
  test("publishes the target-native price-change component name", async () => {
    const response = await app.request("/spec.json");

    expect(response.status).toBe(200);
    const spec = (await response.json()) as {
      components?: { schemas?: Record<string, unknown> };
    };
    expect(spec.components?.schemas?.PriceChange).toBeDefined();
    expect(spec.components?.schemas?.BottlePriceChange).toBeUndefined();
  });
});

describe("GET /uploads/:filename", () => {
  test("serves uploaded image files with image headers", async () => {
    const filename = "test-upload.webp";
    const imageBytes = Buffer.from("RIFF\x00\x00\x00\x00WEBP");

    await mkdir(config.UPLOAD_PATH, { recursive: true });
    await writeFile(join(config.UPLOAD_PATH, filename), imageBytes);

    const response = await app.request(`/uploads/${filename}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(imageBytes);
  });

  test("serves uploaded image files from nested paths with image headers", async () => {
    const filename = "pending-uploads/test-upload.webp";
    const imageBytes = Buffer.from("RIFF\x00\x00\x00\x00WEBP");

    await mkdir(join(config.UPLOAD_PATH, "pending-uploads"), {
      recursive: true,
    });
    await writeFile(join(config.UPLOAD_PATH, filename), imageBytes);

    const response = await app.request(`/uploads/${filename}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(imageBytes);
  });
});
