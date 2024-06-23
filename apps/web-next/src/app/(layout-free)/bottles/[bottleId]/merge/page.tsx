"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BottleMergeSchema } from "@peated/server/schemas";
import BottleField from "@peated/web/components/bottleField";
import ChoiceField from "@peated/web/components/choiceField";
import Fieldset from "@peated/web/components/fieldset";
import Form from "@peated/web/components/form";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

type FormSchemaType = z.infer<typeof BottleMergeSchema>;

export default function MergeBottle({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  useAuthRequired();

  const [bottle] = trpc.bottleById.useSuspenseQuery(Number(bottleId));
  const trpcUtils = trpc.useUtils();

  const router = useRouter();

  const [otherBottleName, setOtherBottleName] = useState<string>("Other");

  // TODO: move to queries
  const bottleMergeMutation = trpc.bottleMerge.useMutation({
    onSuccess: (newBottle) => {
      trpcUtils.bottleById.invalidate(newBottle.id);
      // const previous = trpcUtils.bottleById.getData(newBottle.id);
      // trpcUtils.bottleById.setData(newBottle.id, {
      //   ...previous,
      //   ...newBottle,
      // });
    },
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(BottleMergeSchema),
    defaultValues: {
      direction: "mergeInto",
    },
  });

  const onSubmit: SubmitHandler<FormSchemaType> = async (data) => {
    await bottleMergeMutation.mutateAsync(
      {
        root: bottle.id,
        other: data.bottleId,
        direction: data.direction,
      },
      {
        onSuccess: (newBottle) => router.push(`/bottles/${newBottle.id}`),
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
                helpText="The brand, or main label of the bottle."
                placeholder="e.g. Angel's Envy, Hibiki"
                required
                onChange={(value) => {
                  onChange(value?.id);
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
