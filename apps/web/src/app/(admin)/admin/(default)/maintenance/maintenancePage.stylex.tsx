"use client";

import { useState } from "react";

import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
  AdminSection,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminAlert as Alert } from "@peated/web/components/admin/adminUtility.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import * as stylex from "@stylexjs/stylex";
import { useMutation } from "@tanstack/react-query";

import { space } from "../../../../../styles/tokens.stylex";

export default function MaintenancePage() {
  const orpc = useORPC();
  const catalogSummaryRebuild = useMutation(
    orpc.admin.rebuildCatalogSummaries.mutationOptions(),
  );
  const [catalogSummaryError, setCatalogSummaryError] = useState<string | null>(
    null,
  );
  const [catalogSummaryNotice, setCatalogSummaryNotice] = useState<
    string | null
  >(null);

  async function startCatalogSummaryRebuild() {
    setCatalogSummaryError(null);
    setCatalogSummaryNotice(null);
    try {
      await catalogSummaryRebuild.mutateAsync({});
      setCatalogSummaryNotice("Catalog summary rebuild started.");
    } catch {
      setCatalogSummaryError(
        "The catalog summary rebuild could not start. Try again.",
      );
    }
  }

  return (
    <AdminPage>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          {
            label: "Maintenance",
            href: "/admin/maintenance",
            current: true,
          },
        ]}
      />
      <AdminPageHeader
        title="Maintenance"
        description="Run administrator-only checks and repairs."
      />

      <AdminSection
        title="Catalog summaries"
        description="Rebuild saved Bottle ratings, flavor notes, and catalog totals. Bottle editing can continue while this runs."
      >
        <div {...stylex.props(styles.sectionContent)}>
          <div {...stylex.props(styles.actionRow)}>
            <Button
              disabled={catalogSummaryRebuild.isPending}
              loading={catalogSummaryRebuild.isPending}
              onClick={() => void startCatalogSummaryRebuild()}
              variant="default"
            >
              Rebuild catalog summaries
            </Button>
          </div>
          {catalogSummaryNotice ? (
            <Alert type="success">{catalogSummaryNotice}</Alert>
          ) : null}
          {catalogSummaryError ? (
            <Alert type="error">{catalogSummaryError}</Alert>
          ) : null}
        </div>
      </AdminSection>
    </AdminPage>
  );
}

const styles = stylex.create({
  actionRow: {
    display: "flex",
    alignItems: "center",
    gap: space.x3,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  sectionContent: {
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
  },
});
