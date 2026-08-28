import {
  getApiQueryParams,
  type ApiQueryParamValue,
} from "@peated/web/lib/apiQueryParams";
import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";

import { ProfileLibraryPageClient } from "./profileLibraryPageClient.stylex";

export default async function ProfileLibraryPage(props: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await props.params;
  const { client } = await createServerClient();
  const user = await resolveOrNotFound(
    client.users.details({ user: username }),
  );
  const queryParams = getApiQueryParams(await props.searchParams, {
    defaults: { cursor: 1, query: "" },
    numericFields: ["brand", "cursor", "distiller"],
  });
  const status = parseLibraryStatus(queryParams.status);
  const libraryInput = {
    brand: queryParams.brand,
    collection: "library" as const,
    cursor: queryParams.cursor,
    distiller: queryParams.distiller,
    limit: 25,
    query: queryParams.query,
    status,
    user: user.id,
  };
  const [libraryList, libraryStats] = await Promise.all([
    client.collections.bottles.list(libraryInput),
    client.users.libraryStats({ user: user.id }),
  ]);

  return (
    <ProfileLibraryPageClient
      initialLibraryList={libraryList}
      initialLibraryStats={libraryStats}
    />
  );
}

function parseLibraryStatus(
  value: ApiQueryParamValue,
): "empty" | "open" | "sealed" | "unset" | undefined {
  switch (String(value ?? "")) {
    case "empty":
      return "empty";
    case "open":
      return "open";
    case "sealed":
      return "sealed";
    case "unset":
      return "unset";
    default:
      return undefined;
  }
}
