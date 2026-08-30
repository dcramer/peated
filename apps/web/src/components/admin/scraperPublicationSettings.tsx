"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getFormErrorMessage } from "../../lib/formHelpers";
import { useORPC } from "../../lib/orpc/context";
import { AdminButton } from "./adminButton.stylex";
import { AdminSection, AdminStatus } from "./adminContent.stylex";
import { AdminFormError } from "./adminForm.stylex";
import { AdminDefinitionList as DefinitionList } from "./adminUtility.stylex";

type Site = Outputs["externalSites"]["healthDetails"];

export function ReviewPublishingAction({
  approved,
  disabled,
  loading,
  onToggle,
}: {
  approved: boolean;
  disabled: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  return (
    <AdminButton
      color={approved ? "danger" : "highlight"}
      disabled={disabled}
      loading={loading}
      onClick={onToggle}
    >
      {approved ? "Stop publishing" : "Publish reviews"}
    </AdminButton>
  );
}

export function ReviewPublishingState({ site }: { site: Site }) {
  const approved = site.reviewPublication?.approved ?? false;
  return (
    <DefinitionList>
      <DefinitionList.Term>Status</DefinitionList.Term>
      <DefinitionList.Details>
        <AdminStatus tone={approved ? "success" : "warning"}>
          {approved ? "Public" : "Not public"}
        </AdminStatus>
      </DefinitionList.Details>
      <DefinitionList.Term>Reviews</DefinitionList.Term>
      <DefinitionList.Details>
        {site.externalReviews.matched.toLocaleString("en-US")} of{" "}
        {site.externalReviews.total.toLocaleString("en-US")} matched
      </DefinitionList.Details>
    </DefinitionList>
  );
}

export default function ScraperPublicationSettings({ site }: { site: Site }) {
  const [error, setError] = useState<string>();
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const update = useMutation(
    orpc.externalSites.reviewPublication.update.mutationOptions(),
  );
  const approved = site.reviewPublication?.approved ?? false;

  async function setApproved(nextApproved: boolean) {
    setError(undefined);
    try {
      await update.mutateAsync({
        site: site.type,
        publication: { approved: nextApproved },
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.externalSites.healthDetails.key({
            input: { site: site.type },
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
      title="Public reviews"
      description={
        approved
          ? "Matched reviews are public. New matches will be public too."
          : "Publish matched reviews. New matches will be public too."
      }
      action={
        <ReviewPublishingAction
          approved={approved}
          disabled={update.isPending}
          loading={update.isPending}
          onToggle={() => void setApproved(!approved)}
        />
      }
    >
      {error ? <AdminFormError values={[error]} /> : null}
      <ReviewPublishingState site={site} />
    </AdminSection>
  );
}
