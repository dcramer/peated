"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getFormErrorMessage } from "../../lib/formHelpers";
import { useORPC } from "../../lib/orpc/context";
import { AdminButton } from "./adminButton.stylex";
import { AdminSection } from "./adminContent.stylex";
import { AdminFormError } from "./adminForm.stylex";
import { ExternalSiteIdentity } from "./externalSiteIcon.stylex";

type Site = Outputs["externalSites"]["healthDetails"];

export default function ScraperIconSettings({ site }: { site: Site }) {
  const [error, setError] = useState<string>();
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const capture = useMutation(
    orpc.externalSites.icon.capture.mutationOptions(),
  );
  const hasWebsite = site.runtime.targets.some(
    (target) => target.origins.length > 0,
  );

  async function findIcon() {
    setError(undefined);
    try {
      await capture.mutateAsync({ site: site.type });
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
      title="Site icon"
      description={
        hasWebsite
          ? "Peated checks the site's homepage and saves the best icon it finds."
          : "This scraper has no website to check."
      }
      action={
        <AdminButton
          color="primary"
          disabled={!hasWebsite || capture.isPending}
          loading={capture.isPending}
          onClick={() => void findIcon()}
        >
          {site.imageUrl ? "Refresh icon" : "Find icon"}
        </AdminButton>
      }
    >
      {error ? <AdminFormError values={[error]} /> : null}
      <ExternalSiteIdentity imageUrl={site.imageUrl} name={site.name} size="lg">
        {site.imageUrl ? "Saved icon" : "No icon saved"}
      </ExternalSiteIdentity>
    </AdminSection>
  );
}
