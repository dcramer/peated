import { createServer, type Server, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { createORPCResponseTraceContext, getLink } from "./link";

describe("oRPC response trace context", () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (!server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      server?.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
    server = null;
  });

  it("captures response Sentry trace IDs per request context", async () => {
    const pendingResponses: ServerResponse[] = [];
    server = createServer((_req, res) => {
      pendingResponses.push(res);
    });
    const apiServer = await listen(server);

    const link = getLink({
      apiServer,
      userAgent: "@peated/web (test)",
    });
    const firstTraceContext = createORPCResponseTraceContext();
    const secondTraceContext = createORPCResponseTraceContext();

    const firstCall = link.call(
      ["first"],
      { value: 1 },
      { context: { responseTraceContext: firstTraceContext } },
    );
    const secondCall = link.call(
      ["second"],
      { value: 2 },
      { context: { responseTraceContext: secondTraceContext } },
    );

    await expect.poll(() => pendingResponses.length).toBe(2);

    writeRpcResponse(pendingResponses[1]!, "22222222222222222222222222222222");
    await expect(secondCall).resolves.toEqual({ ok: true });
    expect(secondTraceContext.sentryTraceId).toBe(
      "22222222222222222222222222222222",
    );
    expect(firstTraceContext.sentryTraceId).toBeNull();

    writeRpcResponse(pendingResponses[0]!, "11111111111111111111111111111111");
    await expect(firstCall).resolves.toEqual({ ok: true });
    expect(firstTraceContext.sentryTraceId).toBe(
      "11111111111111111111111111111111",
    );
  });

  it("ignores malformed response Sentry trace IDs", async () => {
    server = createServer((_req, res) => {
      writeRpcResponse(res, "not-a-trace-id");
    });
    const apiServer = await listen(server);

    const traceContext = createORPCResponseTraceContext();
    const link = getLink({
      apiServer,
      userAgent: "@peated/web (test)",
    });

    await expect(
      link.call(
        ["trace"],
        {},
        { context: { responseTraceContext: traceContext } },
      ),
    ).resolves.toEqual({ ok: true });
    expect(traceContext.sentryTraceId).toBeNull();
  });
});

async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to bind test server");
  }
  return `http://127.0.0.1:${address.port}`;
}

function writeRpcResponse(response: ServerResponse, traceId: string) {
  response.writeHead(200, {
    "Content-Type": "application/json",
    "x-sentry-trace-id": traceId,
  });
  response.end(JSON.stringify({ json: { ok: true } }));
}
