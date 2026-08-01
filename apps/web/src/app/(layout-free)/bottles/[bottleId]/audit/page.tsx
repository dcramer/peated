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
  const auditMutation = useMutation(orpc.bottleChecks.audit.mutationOptions());
  const [note, setNote] = useState("");

  async function runAudit(
    event: FormEvent<HTMLFormElement | HTMLButtonElement>,
  ) {
    event.preventDefault();
    const check = await auditMutation.mutateAsync({
      bottle: bottle.id,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    router.push(`/bottle-checks/${check.id}`);
  }

  return (
    <FormScreen
      title="Audit Bottle"
      saveDisabled={auditMutation.isPending}
      saveLabel={auditMutation.isPending ? "Running Audit" : "Run Bottle Audit"}
      onSave={runAudit}
    >
      <Form onSubmit={runAudit} isSubmitting={auditMutation.isPending}>
        {auditMutation.isError ? (
          <FormError
            values={[
              "The audit could not be completed. Try again when the classifier is available.",
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                className="font-medium text-white hover:underline"
                href={`/bottles/${bottle.id}`}
              >
                {bottle.fullName}
              </Link>
              <Link
                className="text-highlight text-sm font-semibold hover:underline"
                href={`/bottles/${bottle.id}/checks`}
              >
                Audit history
              </Link>
            </div>
          </section>
          <TextAreaField
            name="note"
            label="Optional context"
            helpText="The audit is read-only. Any proposed catalog changes will require separate moderator approval."
            onChange={(event) => setNote(event.target.value)}
            placeholder="What looks wrong?"
            rows={4}
            value={note}
          />
        </Fieldset>
      </Form>
    </FormScreen>
  );
}
