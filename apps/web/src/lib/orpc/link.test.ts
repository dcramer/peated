import { afterEach, describe, expect, it, vi } from "vitest";

import { createORPCResponseTraceContext, getLink } from "./link";

describe("oRPC response trace context", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("captures response Sentry trace IDs per request context", async () => {
    const pendingFetches: Array<{
      resolve: (response: Response) => void;
    }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          pendingFetches.push({ resolve });
        }),
    );

    const link = getLink({
      apiServer: "https://api.example.test",
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

    await vi.waitFor(() => {
      expect(pendingFetches).toHaveLength(2);
    });

    pendingFetches[1]!.resolve(rpcResponse("22222222222222222222222222222222"));
    await expect(secondCall).resolves.toEqual({ ok: true });
    expect(secondTraceContext.sentryTraceId).toBe(
      "22222222222222222222222222222222",
    );
    expect(firstTraceContext.sentryTraceId).toBeNull();

    pendingFetches[0]!.resolve(rpcResponse("11111111111111111111111111111111"));
    await expect(firstCall).resolves.toEqual({ ok: true });
    expect(firstTraceContext.sentryTraceId).toBe(
      "11111111111111111111111111111111",
    );
  });
});

function rpcResponse(traceId: string) {
  return new Response(JSON.stringify({ json: { ok: true } }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "x-sentry-trace-id": traceId,
    },
  });
}
