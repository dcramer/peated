// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SelectField from ".";

// SAFETY: React reads this documented test-only flag to verify updates happen inside act().
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("SelectField", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("searches once per query instead of refetching after each result", async () => {
    const onQuery = vi.fn(async (query: string) => [
      { id: 1, name: `Result for ${query || "empty"}` },
    ]);
    const queryClient = new QueryClient();

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SelectField label="Brand" onQuery={onQuery} />
        </QueryClientProvider>,
      );
    });
    // Leave room for several 150 ms debounce windows. Each finished search
    // used to re-render with a new default `options` array and search again.
    await wait(1000);
    await act(async () => {});

    expect(onQuery).toHaveBeenCalledTimes(1);
    expect(onQuery).toHaveBeenCalledWith("", []);
  });

  it("searches again when a search dependency changes", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
    });
    const searchCountry = vi.fn(async (country: string) => [
      { id: country, name: `Region in ${country}` },
    ]);

    async function renderForCountry(country: string) {
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <SelectField
              label="Region"
              onQuery={() => searchCountry(country)}
              searchDependencies={[country]}
            />
          </QueryClientProvider>,
        );
      });
      await wait(300);
      await act(async () => {});
    }

    await renderForCountry("scotland");
    await renderForCountry("japan");

    expect(searchCountry.mock.calls).toEqual([["scotland"], ["japan"]]);
  });
});
