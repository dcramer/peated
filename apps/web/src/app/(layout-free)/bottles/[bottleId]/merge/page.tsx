"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BottleMergeSchema } from "@peated/server/schemas";
import BottleField from "@peated/web/components/bottleField";
import ChoiceField from "@peated/web/components/choiceField";
import Fieldset from "@peated/web/components/fieldset";
import { useFlashMessages } from "@peated/web/components/flash";
import Form from "@peated/web/components/form";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import type { Option } from "@peated/web/components/selectField";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

type FormSchemaType = z.infer<typeof BottleMergeSchema>;

export default function MergeBottle({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  useModRequired();

  const orpc = useORPC();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { data: bottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({ input: { bottle: Number(bottleId) } }),
  );
  const { flash } = useFlashMessages();

  const router = useRouter();
  const prefilledOtherBottleId = Number(searchParams.get("other") ?? 0) || null;
  const prefilledDirection =
    searchParams.get("direction") === "mergeFrom" ? "mergeFrom" : "mergeInto";

  const [otherBottleName, setOtherBottleName] = useState<string>("Other");
  const [selectedOtherBottle, setSelectedOtherBottle] = useState<Option | null>(
    null,
  );
  const [hasAppliedPrefill, setHasAppliedPrefill] = useState(false);

  const { data: prefilledOtherBottle } = useQuery({
    ...orpc.bottles.details.queryOptions({
      input: { bottle: prefilledOtherBottleId ?? 0 },
    }),
    enabled: prefilledOtherBottleId !== null,
  });

  const bottleMergeMutation = useMutation({
    ...orpc.bottles.merge.mutationOptions(),
    onSuccess: (newBottle) => {
      queryClient.invalidateQueries({
        queryKey: orpc.bottles.details.key({
          input: { bottle: newBottle.id },
        }),
      });
    },
  });

  const {
    control,
    handleSubmit,
    setValue,
    formState: { dirtyFields, errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(BottleMergeSchema),
    defaultValues: {
      direction: prefilledDirection,
    },
  });

  useEffect(() => {
    if (
      !prefilledOtherBottle ||
      hasAppliedPrefill ||
      dirtyFields.bottleId ||
      dirtyFields.direction
    ) {
      return;
    }

    const nextBottle = {
      id: prefilledOtherBottle.id,
      name: prefilledOtherBottle.fullName,
    };

    setSelectedOtherBottle(nextBottle);
    setOtherBottleName(prefilledOtherBottle.fullName);
    setValue("bottleId", prefilledOtherBottle.id, { shouldDirty: false });
    setValue("direction", prefilledDirection, { shouldDirty: false });
    setHasAppliedPrefill(true);
  }, [
    dirtyFields.bottleId,
    dirtyFields.direction,
    hasAppliedPrefill,
    prefilledDirection,
    prefilledOtherBottle,
    setValue,
  ]);

  const onSubmit: SubmitHandler<FormSchemaType> = async (data) => {
    await bottleMergeMutation.mutateAsync(
      {
        bottle: bottle.id,
        other: data.bottleId,
        direction: data.direction,
      },
      {
        onSuccess: (newBottle) => {
          flash(
            <div>
              Performing merge asynchronously. Updates may take a few minutes.
            </div>,
          );
          router.push(`/bottles/${newBottle.id}`);
        },
      },
    );
  };

  return (
    <Layout
      header={
        <Header>
          <FormHeader
            title="Merge Bottle"
            saveDisabled={isSubmitting}
            onSave={handleSubmit(onSubmit)}
            saveLabel="Continue"
          />
        </Header>
      }
    >
      <Form onSubmit={handleSubmit(onSubmit)} isSubmitting={isSubmitting}>
        {bottleMergeMutation.isError && (
          <FormError values={[bottleMergeMutation.error.message]} />
        )}

        <Fieldset>
          <Controller
            name="bottleId"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <BottleField
                {...field}
                error={errors.bottleId}
                label="Other Bottle"
                required
                value={selectedOtherBottle}
                onChange={(value) => {
                  onChange(value?.id);
                  setSelectedOtherBottle(value ?? null);
                  setOtherBottleName(value?.name || "Other");
                }}
                onResults={(results) => {
                  return results.filter((r) => r.id !== bottle.id);
                }}
              />
            )}
          />
          <ChoiceField
            control={control}
            name="direction"
            label="Direction"
            required
            choices={[
              {
                id: "mergeFrom",
                name: `Merge "${otherBottleName}" into "${bottle.fullName}"`,
              },
              {
                id: "mergeInto",
                name: `Merge "${bottle.fullName}" into "${otherBottleName}"`,
              },
            ]}
            error={errors.direction}
          />
        </Fieldset>
      </Form>
    </Layout>
  );
}
