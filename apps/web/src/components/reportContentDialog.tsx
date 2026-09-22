"use client";

import type { Inputs } from "@peated/server/orpc/router";
import { useMutation } from "@tanstack/react-query";

import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import { ReportDialog } from "@peated/web/components/reportDialog";
import { useORPC } from "@peated/web/lib/orpc/context";

type ReportTarget = Pick<
  Inputs["reports"]["create"],
  "objectType" | "objectId"
>;

/** Sends a report for one piece of content or one member. */
export function ReportContentDialog({
  isOpen,
  onClose,
  subject,
  target,
}: {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  target: ReportTarget;
}) {
  const orpc = useORPC();
  const { flash } = useFlashMessages();
  const createReport = useMutation(orpc.reports.create.mutationOptions());

  return (
    <ReportDialog
      isOpen={isOpen}
      onCancel={onClose}
      onSubmit={async (input) => {
        await createReport.mutateAsync({ ...target, ...input });
        onClose();
        flash("Thanks. Moderators will review your report.", "success");
      }}
      subject={subject}
    />
  );
}
