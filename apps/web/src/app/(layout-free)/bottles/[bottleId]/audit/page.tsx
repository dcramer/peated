"use client";

import Fieldset from "@peated/web/components/fieldset";
import Form from "@peated/web/components/form";
import FormError from "@peated/web/components/formError";
import FormScreen from "@peated/web/components/formScreen";
import Link from "@peated/web/components/link";
import TextAreaField from "@peated/web/components/textAreaField";
import { ModRequired } from "@peated/web/hooks/useAuthRequired";
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
    orpc.bottles.details.queryOptions({
      input: { bottle: Number(bottleId) },
    }),
  );
  const auditMutation = useMutation(orpc.audits.create.mutationOptions());
  const [note, setNote] = useState("");
  const [cleanSummary, setCleanSummary] = useState<string | null>(null);

  async function runAudit(
    event: FormEvent<HTMLFormElement | HTMLButtonElement>,
  ) {
    event.preventDefault();
    const result = await auditMutation.mutateAsync({
      bottle: bottle.id,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    if (result.status === "needs_review") {
      router.replace(`/admin/audits/${result.audit.id}`);
      return;
    }
    setCleanSummary(result.summary);
  }

  function handlePrimaryAction(
    event: FormEvent<HTMLFormElement | HTMLButtonElement>,
  ) {
    if (cleanSummary) {
      event.preventDefault();
      router.push(`/bottles/${bottle.id}`);
      return;
    }
    void runAudit(event);
  }

  return (
    <FormScreen
      title="Audit Bottle"
      saveDisabled={auditMutation.isPending}
      saveLabel={
        cleanSummary
          ? "Return to Bottle"
          : auditMutation.isPending
            ? "Running Audit"
            : "Run Bottle Audit"
      }
      onSave={handlePrimaryAction}
    >
      {cleanSummary ? (
        <Fieldset>
          <section
            aria-labelledby="audit-bottle-result"
            className="relative block px-4 py-5 text-white"
          >
            <div className="flex items-start gap-3">
              <div
                aria-hidden="true"
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400"
              />
              <div>
                <h2
                  className="font-semibold leading-6"
                  id="audit-bottle-result"
                >
                  No changes proposed
                </h2>
                <p className="mt-1 text-sm text-slate-300">{cleanSummary}</p>
                <Link
                  className="text-highlight mt-3 inline-block text-sm font-semibold hover:underline"
                  href={`/bottles/${bottle.id}`}
                >
                  {bottle.fullName}
                </Link>
              </div>
            </div>
          </section>
        </Fieldset>
      ) : (
        <Form onSubmit={runAudit} isSubmitting={auditMutation.isPending}>
          {auditMutation.isError ? (
            <FormError
              values={[
                auditMutation.error instanceof Error
                  ? auditMutation.error.message
                  : "The audit could not be completed. Try again when the classifier is available.",
              ]}
            />
          ) : null}

          <Fieldset>
            <section
              aria-labelledby="audit-bottle-target"
              className="relative block px-4 py-4 text-white"
            >
              <h2
                className="mb-2 font-semibold leading-6"
                id="audit-bottle-target"
              >
                Bottle
              </h2>
              <Link
                className="font-medium text-white hover:underline"
                href={`/bottles/${bottle.id}`}
              >
                {bottle.fullName}
              </Link>
            </section>
            <TextAreaField
              name="note"
              label="Optional context"
              helpText="The audit is read-only. Each Suggested Change requires separate admin approval."
              onChange={(event) => setNote(event.target.value)}
              placeholder="What looks wrong?"
              rows={4}
              value={note}
            />
          </Fieldset>
        </Form>
      )}
    </FormScreen>
  );
}
