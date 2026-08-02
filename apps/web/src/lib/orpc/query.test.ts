import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { formQueryOptions } from "./query";

describe("formQueryOptions", () => {
  it("configures an isolated, session-stable form query", () => {
    const queryFn = async () => ({ name: "Current value" });
    const options = formQueryOptions({
      queryKey: ["bottles", "details", { bottle: 1 }] as const,
      queryFn,
    });

    expect(options).toMatchObject({
      gcTime: 0,
      staleTime: "static",
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      queryFn,
    });
    expect(options.queryKey).toEqual([
      "bottles",
      "details",
      { bottle: 1 },
      { scope: "form" },
    ]);
  });

  it("fetches past read-view data and evicts the form snapshot", async () => {
    const queryClient = new QueryClient();
    const queryKey = ["bottles", "details", { bottle: 1 }] as const;
    const queryFn = vi.fn().mockResolvedValue({ name: "Current value" });
    const options = formQueryOptions({ queryKey, queryFn });
    queryClient.setQueryData(queryKey, { name: "Cached value" });

    const observer = new QueryObserver(queryClient, options);
    const unsubscribe = observer.subscribe(() => undefined);

    await vi.waitFor(() => {
      expect(observer.getCurrentResult().data).toEqual({
        name: "Current value",
      });
    });
    expect(queryFn).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(queryKey)).toEqual({
      name: "Cached value",
    });

    unsubscribe();
    await vi.waitFor(() => {
      expect(queryClient.getQueryData(options.queryKey)).toBeUndefined();
    });
  });
});
