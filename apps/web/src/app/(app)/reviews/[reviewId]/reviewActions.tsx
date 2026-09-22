"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useState } from "react";

import { ReportContentDialog } from "@peated/web/components/reportContentDialog";
import { RowMenu } from "@peated/web/components/rowMenu.stylex";
import useAuth from "@peated/web/hooks/useAuth";

type Review = Outputs["memberReviews"]["details"];

/** Lets a signed-in member report someone else's review. */
export function ReviewActions({ review }: { review: Review }) {
  const { user } = useAuth();
  const [reporting, setReporting] = useState(false);

  if (!user || user.id === review.createdBy.id) return null;

  return (
    <>
      <RowMenu
        groups={[
          [{ label: "Report review", onSelect: () => setReporting(true) }],
        ]}
        label="Review"
        triggerVariant="text"
      />
      <ReportContentDialog
        isOpen={reporting}
        onClose={() => setReporting(false)}
        subject="this review"
        target={{ objectType: "member_review", objectId: review.id }}
      />
    </>
  );
}
