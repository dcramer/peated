"use client";
import { use, useState } from "react";

import { type ExternalSiteKey } from "@peated/server/types";
import { AdminButton } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminSection,
  AdminStatus,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminEmptyActivity as EmptyActivity } from "@peated/web/components/admin/adminUtility.stylex";
import ExternalReviewTable from "@peated/web/components/admin/externalReviewTable";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

export default function Page(props: {
  params: Promise<{ siteId: ExternalSiteKey }>;
}) {
  const params = use(props.params);

  const { siteId } = params;
  const [error, setError] = useState<string>();

  const queryParams = useApiQueryParams({
    overrides: {
      site: siteId,
      sort: "name",
    },
  });

  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { data: externalReviewList } = useSuspenseQuery(
    orpc.externalReviews.list.queryOptions({
      input: queryParams,
    }),
  );
  const { data: site } = useSuspenseQuery(
    orpc.externalSites.healthDetails.queryOptions({
      input: { site: siteId },
    }),
  );
  const updatePublication = useMutation(
    orpc.externalSites.reviewPublication.update.mutationOptions(),
  );
  const approved = site.reviewPublication?.approved ?? false;

  async function setApproved(nextApproved: boolean) {
    setError(undefined);
    try {
      await updatePublication.mutateAsync({
        site: siteId,
        publication: { approved: nextApproved },
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.externalSites.healthDetails.key({
            input: { site: siteId },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.externalSites.healthList.key(),
        }),
      ]);
    } catch (caught) {
      setError(getFormErrorMessage(caught));
    }
  }

  return (
    <AdminSection
      title="Collected reviews"
      description={
        approved
          ? "Matched reviews are public. Future matches publish automatically."
          : "Check the Bottle matches and source scores below. Approving publishes matched reviews and future matches."
      }
      action={
        externalReviewList.results.length > 0 ? (
          <AdminButton
            color={approved ? "danger" : "primary"}
            disabled={updatePublication.isPending}
            loading={updatePublication.isPending}
            onClick={() => void setApproved(!approved)}
          >
            {approved ? "Stop publishing" : "Approve and publish"}
          </AdminButton>
        ) : null
      }
    >
      <p>
        <AdminStatus tone={approved ? "success" : "warning"}>
          {approved ? "Publishing" : "Not published"}
        </AdminStatus>
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {externalReviewList.results.length > 0 ? (
        <ExternalReviewTable
          externalReviewList={externalReviewList.results}
          rel={externalReviewList.rel}
        />
      ) : (
        <EmptyActivity>No reviews have been collected yet.</EmptyActivity>
      )}
    </AdminSection>
  );
}
