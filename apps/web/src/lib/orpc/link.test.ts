import { createServer, type Server, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createORPCResponseTraceContext,
  getLink,
  isORPCAccountRedirectError,
} from "./link";

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

describe("oRPC account-state errors", () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((err) => (err ? reject(err) : resolve()));
    });
    server = null;
  });

  it("hands suspension and sign-out errors to the handler and replaces them once handled", async () => {
    const statuses = [403, 401];
    server = createServer((_req, res) => {
      const status = statuses.shift() ?? 401;
      writeRpcError(
        res,
        status,
        status === 403 ? "ACCOUNT_SUSPENDED" : "UNAUTHORIZED",
      );
    });
    const apiServer = await listen(server);
    const seen: string[] = [];
    const link = getLink({
      apiServer,
      userAgent: "@peated/web (test)",
      onAccountStateError: (code) => {
        seen.push(code);
        return code === "ACCOUNT_SUSPENDED";
      },
    });

    const suspended = await failure(link.call(["first"], {}, { context: {} }));
    expect(isORPCAccountRedirectError(suspended)).toBe(true);

    const unauthorized = await failure(
      link.call(["second"], {}, { context: {} }),
    );
    expect(isORPCAccountRedirectError(unauthorized)).toBe(false);
    expect(unauthorized).toMatchObject({ code: "UNAUTHORIZED" });
    expect(seen).toEqual(["ACCOUNT_SUSPENDED", "UNAUTHORIZED"]);
  });

  it("leaves other errors alone", async () => {
    server = createServer((_req, res) => writeRpcError(res, 404, "NOT_FOUND"));
    const apiServer = await listen(server);
    const seen: string[] = [];
    const link = getLink({
      apiServer,
      userAgent: "@peated/web (test)",
      onAccountStateError: (code) => {
        seen.push(code);
        return true;
      },
    });

    const error = await failure(link.call(["missing"], {}, { context: {} }));
    expect(error).toMatchObject({ code: "NOT_FOUND" });
    expect(seen).toEqual([]);
  });
});

/** Resolves with the rejection, or null when the call succeeded. */
function failure(call: Promise<unknown>): Promise<Error | null> {
  return call.then(
    () => null,
    (error: Error) => error,
  );
}

function writeRpcError(response: ServerResponse, status: number, code: string) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(
    JSON.stringify({
      json: { defined: true, code, status, message: `${code}.` },
    }),
  );
}

async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const testAddress = z
    .object({ port: z.number().int().positive() })
    .safeParse(address);
  if (!testAddress.success) {
    throw new Error("Unable to bind test server");
  }
  return `http://127.0.0.1:${testAddress.data.port}`;
}

function writeRpcResponse(response: ServerResponse, traceId: string) {
  response.writeHead(200, {
    "Content-Type": "application/json",
    "x-sentry-trace-id": traceId,
  });
  response.end(JSON.stringify({ json: { ok: true } }));
}
