import { EmptyState } from "@peated/web/components/designSystem/components";
import {
  PageHeader,
  PageSection,
} from "@peated/web/components/designSystem/patterns/pagePatternShell.stylex";
import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import type { Metadata } from "next";

import { UpdateList } from "./updateList.stylex";

export const metadata: Metadata = { title: "Updates" };

export default async function UpdatesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const input = getApiQueryParams(searchParams, {
    numericFields: ["cursor", "limit"],
  });
  const page = Number(input.cursor ?? 1) || 1;
  const { client } = await getAnonymousServerClient();
  const changeList = await client.changes.list(input);

  return (
    <div>
      <PageHeader eyebrow="Whisky database" title="Updates" />
      <PageSection count={changeList.results.length} heading="Recent changes">
        {changeList.results.length ? (
          <UpdateList
            changes={changeList.results}
            page={page}
            rel={changeList.rel}
          />
        ) : (
          <EmptyState heading="No recent updates">
            There are no database changes to show.
          </EmptyState>
        )}
      </PageSection>
    </div>
  );
}
