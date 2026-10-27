// @vitest-environment jsdom

import { createORPCClient } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { Router } from "@peated/server/orpc/router";
import { ORPCContext } from "@peated/web/lib/orpc/context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { act } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  findButton,
  mountDialog,
  typeInto,
} from "../../../../components/dialogTestHarness";
import { ProfileBottleSearch } from "./profileBottleSearch.stylex";

// `useRouter` reads this context; the test never navigates.
const router: AppRouterInstance = {
  back: vi.fn(),
  bfcacheId: "test",
  forward: vi.fn(),
  prefetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

describe("ProfileBottleSearch", () => {
  let mounted: ReturnType<typeof mountDialog> | undefined;
  let queryClient: QueryClient | undefined;

  afterEach(() => {
    mounted?.unmount();
    queryClient?.clear();
  });

  // Below 760px this search sits in the Filters drawer, whose View results
  // button only closes the drawer, so the Search button must submit the text.
  test("the Search button searches the typed text without Enter", async () => {
    const client = createORPCClient<RouterClient<Router>>({
      async call(path) {
        if (path.join("/") === "users/librarySearch") {
          return { bottles: [], entities: [] };
        }
        throw new Error(`Unexpected RPC: ${path.join("/")}`);
      },
    });
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const onSubmit = vi.fn();
    mounted = mountDialog();
    await act(async () =>
      mounted!.root.render(
        <AppRouterContext.Provider value={router}>
          <ORPCContext.Provider value={createTanstackQueryUtils(client)}>
            <QueryClientProvider client={queryClient!}>
              <ProfileBottleSearch
                onEntitySelect={vi.fn()}
                onSubmit={onSubmit}
                query=""
                scope="library"
                userId={1}
              />
            </QueryClientProvider>
          </ORPCContext.Provider>
        </AppRouterContext.Provider>,
      ),
    );

    const field = document.querySelector<HTMLInputElement>(
      'input[aria-label="Find in this library"]',
    );
    if (!field) throw new Error("No library search field");
    typeInto(field, " 16-year ");
    act(() => findButton("Search").click());

    expect(onSubmit).toHaveBeenCalledWith("16-year");
  });
});
