"use client";

import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminActions,
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminFormError } from "@peated/web/components/admin/adminForm.stylex";
import { AdminEmptyActivity as EmptyActivity } from "@peated/web/components/admin/adminUtility.stylex";
import WebsiteAccessTable from "@peated/web/components/admin/websiteAccessTable";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";

export default function Page() {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const listQuery = orpc.admin.botSites.list.queryOptions({ input: {} });
  const { data } = useSuspenseQuery(listQuery);
  const update = useMutation(orpc.admin.botSites.update.mutationOptions());
  const [pendingOrigin, setPendingOrigin] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  async function change(
    origin: string,
    changes: { blocked?: false; robotsException?: null },
  ) {
    setError(undefined);
    setPendingOrigin(origin);
    try {
      await update.mutateAsync({ origin, ...changes });
      await queryClient.invalidateQueries({ queryKey: listQuery.queryKey });
    } catch (caught) {
      setError(getFormErrorMessage(caught));
    } finally {
      setPendingOrigin(null);
    }
  }

  return (
    <AdminPage>
      <AdminBreadcrumbs
        items={[
          { label: "Scrapers", href: "/admin/sites" },
          {
            label: "Website access",
            href: "/admin/website-access",
            current: true,
          },
        ]}
      />
      <AdminPageHeader
        title="Website access"
        description="PeatedBot reads a blocked website through Firecrawl until you clear the block. A robots.txt exception lets PeatedBot read pages that the website's robots.txt disallows."
        actions={
          <AdminActions>
            <Button href="/admin/website-access/add" variant="accent">
              Add exception
            </Button>
          </AdminActions>
        }
      />
      {error ? <AdminFormError values={[error]} /> : null}
      {data.results.length ? (
        <WebsiteAccessTable
          sites={data.results}
          pendingOrigin={pendingOrigin}
          onClearBlock={(origin) => void change(origin, { blocked: false })}
          onRemoveException={(origin) =>
            void change(origin, { robotsException: null })
          }
        />
      ) : (
        <EmptyActivity>
          No website is blocked, and no website has a robots.txt exception.
        </EmptyActivity>
      )}
    </AdminPage>
  );
}
