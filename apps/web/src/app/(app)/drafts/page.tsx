import type { Metadata } from "next";

import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { redirectToAuth } from "@peated/web/lib/auth";
import { isLoggedIn } from "@peated/web/lib/auth.server";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import { noIndexPageMetadata } from "@peated/web/lib/seoMetadata";

import {
  TastingDraftList,
  TastingDraftsPageFrame,
} from "./tastingDraftList.stylex";

export const metadata: Metadata = {
  title: "Drafts",
  ...noIndexPageMetadata,
};

export default async function TastingDraftsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isLoggedIn())) {
    redirectToAuth({ pathname: "/drafts" });
  }

  const searchParams = await props.searchParams;
  const input = getApiQueryParams(searchParams, { fields: ["cursor"] });
  const page = Number(input.cursor ?? 1) || 1;
  const { client } = await getServerClient();
  const draftList = await client.tastingDrafts.list(input);

  return (
    <TastingDraftsPageFrame>
      <TastingDraftList
        // Next keeps client state when only the cursor changes; start each
        // page with its own rows.
        key={page}
        drafts={draftList.results}
        nextHref={getCursorHref(
          "/drafts",
          searchParams,
          draftList.rel.nextCursor,
        )}
        page={page}
        previousHref={getCursorHref(
          "/drafts",
          searchParams,
          draftList.rel.prevCursor,
        )}
      />
    </TastingDraftsPageFrame>
  );
}
