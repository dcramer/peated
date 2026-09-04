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
  const bottleCountRepair = useMutation(
    orpc.admin.repairBottleCounts.mutationOptions(),
  );
  const [bottleCountError, setBottleCountError] = useState<string | null>(null);
  const [bottleCountNotice, setBottleCountNotice] = useState<string | null>(
    null,
  );

  async function startBottleCountRepair() {
    setBottleCountError(null);
    setBottleCountNotice(null);
    try {
      await bottleCountRepair.mutateAsync({});
      setBottleCountNotice("Bottle count check started.");
    } catch {
      setBottleCountError("The Bottle count check could not start. Try again.");
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
        title="Bottle counts"
        description="Check saved Bottle counts and fix any that are wrong. Bottle editing can continue while this runs."
      >
        <div {...stylex.props(styles.sectionContent)}>
          <div {...stylex.props(styles.actionRow)}>
            <Button
              disabled={bottleCountRepair.isPending}
              loading={bottleCountRepair.isPending}
              onClick={() => void startBottleCountRepair()}
              variant="default"
            >
              Check Bottle counts
            </Button>
          </div>
          {bottleCountNotice ? (
            <Alert type="success">{bottleCountNotice}</Alert>
          ) : null}
          {bottleCountError ? (
            <Alert type="error">{bottleCountError}</Alert>
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
