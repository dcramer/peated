import { sealData } from "iron-session";
import { INFINITE_CACHE } from "next/dist/lib/constants";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { createRequestStoreForAPI } from "next/dist/server/async-storage/request-store";
import { createWorkStore } from "next/dist/server/async-storage/work-store";
import { NextRequest } from "next/server";
import { sessionOptions } from "../session.server";

/** Runs server reads with real Next request cookies and the application's session reader. */
export async function withNextRequest<T>(
  accessToken: string | null,
  read: () => Promise<T>,
) {
  const headers = new Headers();
  if (accessToken) {
    const value = await sealData(
      { accessToken },
      { password: sessionOptions.password },
    );
    headers.set("cookie", `${sessionOptions.cookieName}=${value}`);
  }
  const request = new NextRequest("http://localhost/", { headers });
  const store = createRequestStoreForAPI(
    request,
    request.nextUrl,
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined,
    undefined,
  );
  const work = createWorkStore({
    page: "/test",
    buildId: "test",
    deploymentId: "test",
    previouslyRevalidatedTags: [],
    renderOpts: {
      cacheComponents: false,
      cacheLifeProfiles: {
        default: { stale: 0, revalidate: 900, expire: INFINITE_CACHE },
      },
      supportsDynamicResponse: true,
      isDraftMode: false,
      isBuildTimePrerendering: false,
      staticPageGenerationTimeout: 60,
      validationLevel: "warning",
      assetPrefix: "",
      experimental: { authInterrupts: false, useCacheTimeout: 0 },
      waitUntil: undefined,
      onClose: (callback) => queueMicrotask(callback),
      onAfterTaskError: undefined,
    },
  });
  return workAsyncStorage.run(work, async () => {
    const result = await workUnitAsyncStorage.run(store, read);
    await Promise.all(Object.values(work.pendingRevalidates ?? {}));
    return result;
  });
}
