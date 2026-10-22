import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { formQueryOptions, serverDataQueryOptions } from "./query";

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

describe("serverDataQueryOptions", () => {
  it("shows newer server data on the next page view after an edit", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { refetchOnMount: false } },
    });
    const queryKey = ["bottles", "details", { bottle: 1 }] as const;
    const queryFn = vi.fn().mockResolvedValue({ name: "Fetched value" });

    const firstView = new QueryObserver(
      queryClient,
      serverDataQueryOptions({ queryKey, queryFn }, { name: "Old value" }),
    );
    const unsubscribe = firstView.subscribe(() => undefined);
    expect(firstView.getCurrentResult().data).toEqual({ name: "Old value" });
    unsubscribe();
    await vi.waitFor(() => {
      expect(queryClient.getQueryData(queryKey)).toBeUndefined();
    });

    // The edit page invalidates the details while the page view is closed.
    await queryClient.invalidateQueries({ queryKey, refetchType: "all" });

    const nextView = new QueryObserver(
      queryClient,
      serverDataQueryOptions({ queryKey, queryFn }, { name: "Edited value" }),
    );
    nextView.subscribe(() => undefined);

    expect(nextView.getCurrentResult().data).toEqual({ name: "Edited value" });
    expect(queryFn).not.toHaveBeenCalled();
  });
});
