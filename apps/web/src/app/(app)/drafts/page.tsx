import type { Metadata } from "next";
import { redirect } from "next/navigation";

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
  const cursor = Number(searchParams.cursor);
  const page = Number.isInteger(cursor) && cursor > 0 ? cursor : 1;
  const { client } = await getServerClient();
  const draftList = await client.tastingDrafts.list({ cursor: page });
  // Past the last page, for example after deleting its last draft.
  if (!draftList.results.length && page > 1) redirect("/drafts");

  return (
    <TastingDraftsPageFrame>
      <TastingDraftList
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
