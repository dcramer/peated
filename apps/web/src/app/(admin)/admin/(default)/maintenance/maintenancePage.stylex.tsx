"use client";

import { useState } from "react";

import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminStat,
  AdminStatGrid,
  AdminStatus,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminAlert as Alert } from "@peated/web/components/admin/adminUtility.stylex";
import ConfirmationDialog from "@peated/web/components/confirmationDialog.client";
import { useORPC } from "@peated/web/lib/orpc/context";
import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

import { space } from "../../../../../styles/tokens.stylex";

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value);
}

function countLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${formatCount(value)} ${value === 1 ? singular : plural}`;
}

export default function MaintenancePage() {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const previewOptions = orpc.admin.getOldStarRatingConversion.queryOptions();
  const { data } = useSuspenseQuery(previewOptions);
  const conversion = useMutation(
    orpc.admin.convertOldStarRatings.mutationOptions(),
  );
  const bottleCountRepair = useMutation(
    orpc.admin.repairBottleCounts.mutationOptions(),
  );
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [bottleCountError, setBottleCountError] = useState<string | null>(null);
  const [bottleCountNotice, setBottleCountNotice] = useState<string | null>(
    null,
  );

  async function runOldRatingRepair() {
    const converting = data.willConvert > 0;
    setConfirming(false);
    setError(null);
    setSuccess(null);
    setWarning(null);

    try {
      const result = await conversion.mutateAsync({
        expectedConversions: data.willConvert,
      });
      setSuccess(
        converting
          ? `Converted ${countLabel(result.converted, "tasting")}. Started recalculating rating totals for ${countLabel(result.bottleTotalsStarted, "Bottle")}.`
          : `Started recalculating rating totals for ${countLabel(result.bottleTotalsStarted, "Bottle")}.`,
      );
      if (result.bottleTotalsFailed > 0) {
        setWarning(
          `Could not start recalculating rating totals for ${countLabel(result.bottleTotalsFailed, "Bottle")}. Try the refresh again.`,
        );
      }
      await queryClient.invalidateQueries({
        queryKey: previewOptions.queryKey,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The old star ratings could not be converted.",
      );
    }
  }

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

  const skippedValues = Object.entries(data.notConvertedValues);
  const oldRatingActionLabel =
    data.willConvert > 0
      ? `Convert ${countLabel(data.willConvert, "tasting")}`
      : `Refresh totals for ${countLabel(data.bottles, "Bottle")}`;

  return (
    <>
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
          description="Preview and run one-off repairs. Each repair checks the current data again before saving."
        />

        <AdminSection
          title="Bottle counts"
          description="Check Bottle counts for brands, producers, countries, and regions, and fix any that are wrong. Bottle editing can continue while this runs."
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

        <AdminSection
          title="Old star ratings"
          description="Give older tastings one of today’s five ratings. Existing ratings stay as they are, and the old stars stay on each tasting."
        >
          <div {...stylex.props(styles.sectionContent)}>
            <div {...stylex.props(styles.actionRow)}>
              {data.willConvert === 0 ? (
                <AdminStatus tone="success">Nothing to convert</AdminStatus>
              ) : null}
              {data.willConvert > 0 || data.bottles > 0 ? (
                <Button
                  disabled={conversion.isPending}
                  loading={conversion.isPending}
                  onClick={() => {
                    if (data.willConvert > 0) {
                      setConfirming(true);
                    } else {
                      void runOldRatingRepair();
                    }
                  }}
                  variant="default"
                >
                  {oldRatingActionLabel}
                </Button>
              ) : null}
            </div>
            {success ? <Alert type="success">{success}</Alert> : null}
            {warning ? <Alert type="warn">{warning}</Alert> : null}
            {error ? <Alert type="error">{error}</Alert> : null}

            <AdminStatGrid>
              <AdminStat
                label="Old ratings"
                value={formatCount(data.oldStarRatings)}
                detail="Tastings that still have stars"
              />
              <AdminStat
                label="Will convert"
                value={formatCount(data.willConvert)}
                detail="Tastings that will get a rating"
              />
              <AdminStat
                label="Already rated"
                value={formatCount(data.alreadyRated)}
                detail="Current ratings that stay unchanged"
              />
              <AdminStat
                label="Skipped"
                value={formatCount(data.notConverted)}
                detail="Old values Peated cannot safely convert"
              />
              <AdminStat
                label="Bottles"
                value={formatCount(data.bottles)}
                detail="Rating totals that will update"
              />
            </AdminStatGrid>

            {skippedValues.length > 0 ? (
              <Alert type="warn">
                Skipped old values:{" "}
                {skippedValues
                  .map(([value, count]) => `${value} (${formatCount(count)})`)
                  .join(", ")}
              </Alert>
            ) : null}
          </div>
        </AdminSection>

        {data.willConvert > 0 ? (
          <AdminSection
            title="Ratings to add"
            description="How the old stars will be split."
          >
            <AdminStatGrid>
              <AdminStat
                label="Mediocre"
                value={formatCount(data.ratings.mediocre)}
              />
              <AdminStat label="Good" value={formatCount(data.ratings.good)} />
              <AdminStat
                label="Very good"
                value={formatCount(data.ratings.very_good)}
              />
              <AdminStat
                label="Outstanding"
                value={formatCount(data.ratings.outstanding)}
              />
              <AdminStat
                label="Unicorn"
                value={formatCount(data.ratings.unicorn)}
              />
            </AdminStatGrid>
          </AdminSection>
        ) : null}
      </AdminPage>

      <ConfirmationDialog
        continueLabel={oldRatingActionLabel}
        isOpen={confirming}
        message={
          data.willConvert > 0
            ? `This adds a rating to ${countLabel(data.willConvert, "tasting")} with saved stars. It will not replace ratings people chose, and it keeps the saved stars. Rating totals for ${countLabel(data.bottles, "Bottle")} will update afterward.`
            : `This recalculates rating totals for ${countLabel(data.bottles, "Bottle")}. It does not change any tastings.`
        }
        onCancel={() => setConfirming(false)}
        onContinue={() => void runOldRatingRepair()}
        title={
          data.willConvert > 0
            ? "Convert old star ratings?"
            : "Refresh Bottle rating totals?"
        }
      />
    </>
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
