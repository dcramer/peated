"use client";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { moderationHrefForAudit } from "@peated/web/components/admin/moderation/auditHref";
import {
  Field,
  FormNotice,
  FormSection,
  FormStack,
  SelectedBottleSummary,
  Textarea,
} from "@peated/web/components/designSystem/components";
import { WorkflowScreen } from "@peated/web/components/workflowScreen.stylex";
import { ModRequired } from "@peated/web/hooks/useAuthRequired";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { use, useState, type FormEvent } from "react";

export default function AuditBottle(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = use(props.params);
  return (
    <ModRequired>
      <AuditBottleForm bottleId={bottleId} />
    </ModRequired>
  );
}

function AuditBottleForm({ bottleId }: { bottleId: string }) {
  const orpc = useORPC();
  const router = useRouter();
  const { data: bottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({ input: { bottle: Number(bottleId) } }),
  );
  const audit = useMutation(orpc.audits.create.mutationOptions());
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState<string>();
  const [error, setError] = useState<string>();

  async function runAudit(
    event: FormEvent<HTMLButtonElement | HTMLFormElement>,
  ) {
    event.preventDefault();
    if (summary) {
      router.push(`/bottles/${bottle.id}`);
      return;
    }

    setError(undefined);
    try {
      const context = note.trim();
      const input = {
        bottle: bottle.id,
        note: context || undefined,
      } satisfies Parameters<typeof audit.mutateAsync>[0];
      const result = await audit.mutateAsync(input);
      if (result.status === "needs_review") {
        router.replace(moderationHrefForAudit(result.audit));
        return;
      }
      setSummary(result.summary);
    } catch (caught) {
      setError(
        getFormErrorMessage(caught, {
          allowAnyErrorMessage: true,
          fallbackMessage:
            "The audit could not be completed. Try again when the classifier is available.",
        }),
      );
    }
  }

  return (
    <WorkflowScreen
      onSave={runAudit}
      saveLabel={summary ? "Return to bottle" : "Run audit"}
      saving={audit.isPending}
      title="Audit bottle"
    >
      <form onSubmit={runAudit}>
        <FormStack>
          <SelectedBottleSummary
            bottleId={bottle.peatedId}
            imageUrl={bottle.imageUrl}
            metadata={getBottleMetadata(bottle)}
            name={formatBottleDisplayName(bottle)}
          />
          {error ? <FormNotice>{error}</FormNotice> : null}
          {summary ? (
            <FormNotice>No changes proposed. {summary}</FormNotice>
          ) : (
            <FormSection
              description="The audit is read-only. Every catalog update still requires separate approval."
              title="Audit context"
            >
              <Field htmlFor="audit-note" label="What looks wrong?" optional>
                <Textarea
                  id="audit-note"
                  onChange={(event) => setNote(event.currentTarget.value)}
                  rows={5}
                  value={note}
                />
              </Field>
            </FormSection>
          )}
        </FormStack>
      </form>
    </WorkflowScreen>
  );
}
