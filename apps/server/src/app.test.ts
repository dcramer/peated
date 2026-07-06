import config from "@peated/server/config";
import * as Sentry from "@sentry/hono/node";
import { mkdir, writeFile } from "fs/promises";
import type { AddressInfo } from "node:net";
import { join } from "path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { AppType } from "./app";

let app: AppType;

describe("Sentry tracing", () => {
  beforeAll(async () => {
    Sentry.init({ tracesSampleRate: 1.0 });
    ({ app } = await import("./app"));
  });

  afterAll(async () => {
    await Sentry.close(2000);
  });

  test("continues inbound sentry-trace headers and exposes the trace id", async () => {
    const traceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const { createAdaptorServer } = await import("@hono/node-server");
    const server = createAdaptorServer({
      fetch: app.fetch,
      hostname: "127.0.0.1",
    });

    try {
      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
      });
      const { port } = server.address() as AddressInfo;

      const response = await fetch(`http://127.0.0.1:${port}/_health`, {
        headers: {
          "sentry-trace": `${traceId}-bbbbbbbbbbbbbbbb-1`,
          baggage: "sentry-trace_id=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("x-sentry-trace-id")).toBe(traceId);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  });
});

describe("GET /uploads/:filename", () => {
  beforeAll(async () => {
    if (!app) {
      ({ app } = await import("./app"));
    }
  });

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
